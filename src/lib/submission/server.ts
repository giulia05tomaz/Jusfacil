import { createHash } from "node:crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { EmailProviderError, EmailThreadSchema, getSentEmailMessageId, sendEmail, type EmailThread } from "@/lib/email/sendEmail";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";
import { draftNeedsEvidenceRevision, exportEvidences, STALE_DRAFT_MESSAGE } from "@/lib/drafts/evidenceExport";
import { CopyEmailSchema, currentApprovedDraftVersion, TEST_SUBMISSION_DISCLAIMER, type SubmissionRequest, type TestEmailSubmission } from "./shared";
import type { DraftVersion, Evidence, LegalCase } from "@/types";
import { ArtifactError, readCompleteArtifact, validateArtifact, type CompleteArtifact } from "@/lib/drafts/completeArtifact";

export class SubmissionError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

export function publicSubmission(id: string, data: DocumentData): TestEmailSubmission {
  return {
    submissionId: id,
    type: "TEST_EMAIL",
    draftId: data.draftId,
    draftVersion: data.draftVersion,
    status: data.status,
    recipientMode: "TEST",
    copyEmail: data.copyEmail,
    createdAt: iso(data.createdAt),
    ...(data.sentAt ? { sentAt: iso(data.sentAt) } : {}),
    ...(data.errorCode ? { errorCode: data.errorCode } : {}),
    ...(data.replyToSubmissionId ? { replyToSubmissionId: data.replyToSubmissionId, replyToDraftVersion: data.replyToDraftVersion } : {}),
  };
}

function validateDocument(uid: string, caseId: string, draftId: string, legalCase: DocumentData, draft: DocumentData) {
  if (legalCase.citizenId !== uid) throw new SubmissionError("FORBIDDEN", 403, "Você não pode enviar a petição de outro cidadão.");
  if (legalCase.caseId !== caseId || draft.caseId !== caseId) throw new SubmissionError("DRAFT_CASE_MISMATCH", 403, "A minuta não pertence ao caso informado.");
  const version = currentApprovedDraftVersion(legalCase as LegalCase);
  // APPROVED no modelo existente é representado por approved === true.
  if (draft.approved !== true || version !== draft.version || draftId !== `v${version}`) {
    throw new SubmissionError("DRAFT_APPROVAL_REQUIRED", 409, "A petição precisa estar aprovada antes do envio.");
  }
  if (typeof draft.content !== "string" || !draft.content.trim() || draft.content.length > 200_000) {
    throw new SubmissionError("DRAFT_CONTENT_INVALID", 409, "A versão aprovada não possui conteúdo válido.");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function submitTestEmail(db: Firestore, uid: string, caseId: string, input: SubmissionRequest) {
  if (process.env.FORUM_SUBMISSION_MODE !== "test") {
    throw new SubmissionError("SUBMISSION_MODE_DISABLED", 403, "O envio de teste está desabilitado neste ambiente.");
  }
  const recipient = CopyEmailSchema.safeParse(process.env.FORUM_TEST_RECIPIENT);
  if (!recipient.success) throw new SubmissionError("TEST_RECIPIENT_NOT_CONFIGURED", 503, "O destinatário de teste não está configurado.");

  const caseRef = db.collection("cases").doc(caseId);
  const draftRef = caseRef.collection("drafts").doc(input.approvedDraftId);
  const submissionRef = caseRef.collection("submissions").doc(input.idempotencyKey);
  // Uma entrega bem-sucedida por versão, inclusive entre abas/dispositivos/chaves diferentes.
  // Esta coleção não é acessível pelo SDK do browser nas regras existentes.
  const lockRef = caseRef.collection("submissionLocks").doc(input.approvedDraftId);
  const createdAt = new Date();
  const baseSubject = `[JusFácil — TESTE] Petição Inicial — ${caseId}`;
  const reservation = await db.runTransaction(async (transaction) => {
    const [caseSnapshot, draftSnapshot, previousSnapshot, lockSnapshot, userSnapshot] = await Promise.all([
      transaction.get(caseRef), transaction.get(draftRef), transaction.get(submissionRef), transaction.get(lockRef),
      transaction.get(db.collection("users").doc(uid)),
    ]);
    if (!caseSnapshot.exists) throw new SubmissionError("CASE_NOT_FOUND", 404, "Caso não encontrado.");
    if (caseSnapshot.data()!.citizenId !== uid || !userSnapshot.exists || userSnapshot.data()!.role !== "CITIZEN") {
      throw new SubmissionError("FORBIDDEN", 403, "Somente o cidadão responsável pode realizar este envio.");
    }
    if (!draftSnapshot.exists) throw new SubmissionError("DRAFT_NOT_FOUND", 404, "Minuta não encontrada.");
    const legalCase = caseSnapshot.data()!;
    const draft = draftSnapshot.data()!;
    validateDocument(uid, caseId, input.approvedDraftId, legalCase, draft);
    const fingerprintParts = [uid, caseId, input.approvedDraftId, draft.content, input.copyEmail, recipient.data, process.env.RESEND_FROM?.trim() || ""];
    // Preserva os fingerprints anteriores para requests sem resposta encadeada.
    if (input.replyToSubmissionId) fingerprintParts.push(input.replyToSubmissionId);
    const fingerprint = hash(JSON.stringify(fingerprintParts));
    const previous = previousSnapshot.data();
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new SubmissionError("IDEMPOTENCY_CONFLICT", 409, "Esta chave já foi usada para outra confirmação.");
      return { send: false as const, submission: publicSubmission(submissionRef.id, previous), status: previous.status === "PENDING" ? 202 : previous.status === "FAILED" ? 409 : 200 };
    }
    const lock = lockSnapshot.data();
    if (lock?.status === "SENT" || lock?.status === "PENDING") {
      const existing = await transaction.get(caseRef.collection("submissions").doc(lock.submissionId));
      if (!existing.exists) throw new SubmissionError("SUBMISSION_INCONSISTENT", 409, "O histórico precisa ser verificado antes de uma nova tentativa.");
      // A trava por versão não autoriza trocar a cópia nem afirmar um novo envio.
      const existingCopy = CopyEmailSchema.safeParse(existing.data()!.copyEmail);
      if (!existingCopy.success) throw new SubmissionError("SUBMISSION_INCONSISTENT", 409, "O histórico precisa ser verificado antes de uma nova tentativa.");
      if (existingCopy.data.toLowerCase() !== input.copyEmail.toLowerCase()) {
        throw new SubmissionError("SUBMISSION_COPY_EMAIL_CONFLICT", 409, lock.status === "SENT"
          ? "Esta versão já foi enviada com outro e-mail de cópia. Nenhum novo e-mail foi enviado para o endereço informado. Consulte o histórico."
          : "Esta versão já possui um envio em processamento com outro e-mail de cópia. Nenhum novo envio foi iniciado para o endereço informado. Aguarde o histórico.");
      }
      if ((existing.data()!.replyToSubmissionId || "") !== (input.replyToSubmissionId || "")) throw new SubmissionError("SUBMISSION_THREAD_CONFLICT", 409, "Esta versão já possui um envio. Não é possível movê-lo para outra conversa nem reenviar a mesma versão. Consulte o histórico.");
      return { send: false as const, submission: publicSubmission(existing.id, existing.data()!), status: lock.status === "PENDING" ? 202 : 200 };
    }
    let parent: DocumentData | null = null;
    if (input.replyToSubmissionId) {
      const parentSnapshot = await transaction.get(caseRef.collection("submissions").doc(input.replyToSubmissionId));
      parent = parentSnapshot.data() || null;
      if (!parent || parent.createdBy !== uid || parent.type !== "TEST_EMAIL" || parent.recipientMode !== "TEST" || parent.status !== "SENT" || parent.provider !== "resend" || !Number.isInteger(parent.draftVersion) || parent.draftVersion >= draft.version || parent.draftId !== `v${parent.draftVersion}` || typeof parent.providerMessageId !== "string") throw new SubmissionError("SUBMISSION_REPLY_INVALID", 409, "Selecione um envio concluído de uma versão anterior deste mesmo caso.");
      if (parent.thread && !EmailThreadSchema.safeParse(parent.thread).success) throw new SubmissionError("SUBMISSION_REPLY_INVALID", 409, "A conversa anterior precisa ser verificada antes do envio.");
      if (parent.emailSubject && parent.emailSubject !== baseSubject && parent.emailSubject !== `Re: ${baseSubject}`) throw new SubmissionError("SUBMISSION_REPLY_INVALID", 409, "A conversa anterior não corresponde a este caso.");
    }
    // Uma exportação Word isolada não cria nem aprova uma nova versão jurídica.
    // O índice é obtido no servidor, dentro da mesma reserva, não pelo browser.
    const evidenceSnapshot = await transaction.get(caseRef.collection("evidences"));
    const records = evidenceSnapshot.docs.map((doc) => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
    if (records.some((item) => item.caseId !== caseId)) throw new SubmissionError("EVIDENCE_CASE_MISMATCH", 403, "Há um documento que não pertence a este caso.");
    if (draftNeedsEvidenceRevision(draft as DraftVersion, records)) throw new SubmissionError("DRAFT_EVIDENCE_REVISION_REQUIRED", 409, STALE_DRAFT_MESSAGE);
    const evidences = exportEvidences(records);
    const evidenceFingerprint = hash(JSON.stringify(evidences));
    const artifactSnapshot = await transaction.get(caseRef.collection("draftArtifacts").doc(input.approvedDraftId));
    const artifact = artifactSnapshot.exists ? artifactSnapshot.data() as CompleteArtifact : null;
    if (records.length && !artifact) throw new SubmissionError("DRAFT_ARTIFACT_REQUIRED", 409, "Monte o Word com as evidências desta versão antes do envio.");
    if (artifact) {
      try { validateArtifact(artifact, draft as DraftVersion, records); }
      catch (error) { throw new SubmissionError(error instanceof ArtifactError ? error.code : "DRAFT_ARTIFACT_INVALID", 409, "O documento completo precisa ser atualizado para esta versão."); }
    }
    const artifactFingerprint = artifact?.pdfHash || "";
    const previousDeliveryTime = new Date(iso(lock?.deliveryCreatedAt)).getTime();
    if (lock?.deliveryUncertain && (lock.fingerprint !== fingerprint || lock.evidenceFingerprint !== evidenceFingerprint || (lock.artifactFingerprint || "") !== artifactFingerprint || !Number.isFinite(previousDeliveryTime) || createdAt.getTime() - previousDeliveryTime >= 23 * 60 * 60 * 1000)) {
      // O provedor mantém a deduplicação por 24h. Fora da janela segura, nunca reenvia uma entrega incerta.
      throw new SubmissionError("EMAIL_DELIVERY_UNKNOWN", 409, "A entrega anterior precisa de confirmação manual antes de uma nova tentativa.");
    }
    const deliveryCreatedAt = lock?.deliveryUncertain ? lock.deliveryCreatedAt : createdAt;
    const data = {
      submissionId: submissionRef.id, type: "TEST_EMAIL", draftId: input.approvedDraftId, draftVersion: draft.version,
      status: "PENDING", recipientMode: "TEST", copyEmail: input.copyEmail, idempotencyKey: input.idempotencyKey,
      createdBy: uid, createdAt, acknowledgment: true, fingerprint, evidenceFingerprint, evidenceIndex: evidences, provider: "resend",
      copyRecipientDeduplicated: input.copyEmail.toLowerCase() === recipient.data.toLowerCase(),
      artifactFingerprint, ...(artifact ? { completeArtifactId: artifact.id, attachedPdfHash: artifact.pdfHash, attachedImageCount: artifact.imageCount } : {}),
      emailSubject: parent ? `Re: ${baseSubject}` : baseSubject,
      ...(parent ? { replyToSubmissionId: input.replyToSubmissionId!, replyToDraftVersion: parent.draftVersion } : {}),
    };
    transaction.set(submissionRef, data);
    const priorDeliveryUncertain = Boolean(lock?.deliveryUncertain);
    transaction.set(lockRef, { status: "PENDING", submissionId: submissionRef.id, fingerprint, evidenceFingerprint, artifactFingerprint, deliveryCreatedAt, deliveryUncertain: priorDeliveryUncertain });
    return { send: true as const, legalCase, draft, evidences, records, artifact, artifactFingerprint, data, fingerprint, evidenceFingerprint, priorDeliveryUncertain, parent, frozenThread: lock?.fingerprint === fingerprint ? lock.thread : undefined };
  });
  if (!reservation.send) return {
    status: reservation.status, submission: reservation.submission, idempotent: true,
    message: reservation.submission.status === "SENT"
      ? "Esta versão já foi enviada anteriormente. Nenhum novo e-mail foi enviado nesta tentativa. Consulte o histórico."
      : "Tentativa anterior encontrada. Nenhum novo envio foi iniciado nesta tentativa. Consulte o histórico.",
  };

  let providerMessageId: string;
  let thread: EmailThread | undefined;
  try {
    const draft = { ...reservation.draft, createdAt: iso(reservation.draft.createdAt) } as DraftVersion;
    const deliveryFingerprint = hash(`${reservation.fingerprint}:${reservation.evidenceFingerprint}${reservation.artifact ? `:${reservation.artifactFingerprint}` : ""}`);
    let content: Buffer;
    if (reservation.artifact) {
      // Immutable server-generated PDF, the same artifact used by the download route.
      content = await readCompleteArtifact(reservation.artifact, draft, reservation.records, "pdf");
    } else {
      const pdf = generateDraftPdf(reservation.legalCase as LegalCase, draft, []);
      const creationDate = new Date(draft.createdAt);
      pdf.setCreationDate(Number.isNaN(creationDate.getTime()) ? new Date(0) : creationDate);
      pdf.setFileId(deliveryFingerprint.slice(0, 32));
      content = Buffer.from(pdf.output("arraybuffer"));
    }
    if (content.length < 5 || content.length > 8 * 1024 * 1024 || content.subarray(0, 5).toString() !== "%PDF-") {
      throw new EmailProviderError("PDF_INVALID");
    }
    if (reservation.parent) {
      if (reservation.frozenThread) {
        const parsed = EmailThreadSchema.safeParse(reservation.frozenThread);
        if (!parsed.success) throw new EmailProviderError("EMAIL_THREAD_UNAVAILABLE");
        thread = parsed.data;
      } else {
        const messageId = await getSentEmailMessageId(reservation.parent.providerMessageId, reservation.parent.emailSubject || baseSubject);
        const references = [...new Set([...(reservation.parent.thread?.references || []), messageId])];
        const parsed = EmailThreadSchema.safeParse({ inReplyTo: messageId, references });
        if (!parsed.success) throw new EmailProviderError("EMAIL_THREAD_UNAVAILABLE");
        thread = parsed.data;
      }
      // Congela os cabeçalhos antes da entrega para que retries usem o mesmo payload.
      await db.runTransaction(async (transaction) => {
        transaction.update(submissionRef, { thread });
        transaction.update(lockRef, { thread });
      });
    }
    const updateNote = reservation.parent ? `\n\nEsta versão atualizada substitui a Versão ${reservation.parent.draftVersion} enviada anteriormente nesta conversa.` : "";
    const text = `Olá,\n\nEste e-mail foi gerado pelo ambiente de testes do JusFácil.\n\nDocumento:\nPetição Inicial — Versão ${draft.version}\n\nProtocolo interno JusFácil:\n${caseId}\n\nO PDF da versão aprovada está anexado.${updateNote}\n\nIMPORTANTE:\n${TEST_SUBMISSION_DISCLAIMER}\n\nJusFácil`;
    ({ providerMessageId } = await sendEmail({
      to: recipient.data, cc: input.copyEmail, subject: reservation.data.emailSubject,
      ...(thread ? { thread } : {}),
      text, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>`,
      attachments: [{ filename: `peticao-inicial-${caseId}-v${draft.version}.pdf`, contentType: "application/pdf", content }],
      idempotencyKey: `jusfacil-test-${deliveryFingerprint}`,
    }));
  } catch (error) {
    const safeError = error instanceof EmailProviderError ? error : error instanceof ArtifactError ? new EmailProviderError("PDF_INVALID") : new EmailProviderError("EMAIL_DELIVERY_UNKNOWN", true);
    await db.runTransaction(async (transaction) => {
      transaction.update(submissionRef, { status: "FAILED", failedAt: new Date(), errorCode: safeError.code });
      transaction.update(lockRef, { status: "FAILED", deliveryUncertain: safeError.deliveryUncertain || reservation.priorDeliveryUncertain });
    });
    return { status: safeError.code === "EMAIL_NOT_CONFIGURED" ? 503 : 502, submission: publicSubmission(submissionRef.id, { ...reservation.data, status: "FAILED", errorCode: safeError.code }), error: safeError.code, message: safeError.code === "EMAIL_THREAD_UNAVAILABLE" ? "Não foi possível vincular a resposta ao e-mail anterior. Nenhum novo e-mail foi enviado. Verifique a permissão de leitura da chave Resend e o histórico." : safeError.code === "EMAIL_NOT_CONFIGURED" ? "O serviço de e-mail do JusFácil ainda não está configurado. Nenhum documento foi enviado." : safeError.message };
  }
  const sentAt = new Date();
  // Se o provedor aceitou mas a gravação falhar, nunca chama o provedor novamente nessa tentativa.
  await db.runTransaction(async (transaction) => {
    transaction.update(submissionRef, { status: "SENT", sentAt, providerMessageId });
    transaction.update(lockRef, { status: "SENT", providerMessageId, deliveryUncertain: false });
  });
  return { status: 200, submission: publicSubmission(submissionRef.id, { ...reservation.data, status: "SENT", sentAt }), message: "Envio de teste realizado" };
}
