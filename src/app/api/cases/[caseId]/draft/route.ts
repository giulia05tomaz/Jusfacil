import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { createOpenAIClient, estimateLunaCost, OPENAI_DRAFT_MODEL, safeOpenAIError } from "@/lib/ai/openai";
import { DRAFT_SYSTEM_PROMPT, REVISION_REVIEW_PROMPT } from "@/lib/ai/prompts";
import { DraftRequestSchema, DraftResponseSchema, RevisionReviewSchema, PersistedCaseDataSchema, PersistedRevisionReviewSchema } from "@/lib/ai/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { checkChatRateLimit, checkDraftRateLimit } from "@/lib/security/inMemoryRateLimit";
import { revisedClaimValueMatches, revisedPartyNamesMatch } from "@/lib/drafts/revisionValidation";
import { revisionAdviceMessage } from "@/lib/drafts/revisionShared";
import type { LegalCase, UserProfile } from "@/types";

export const runtime = "nodejs";

function respond(error: string, message: string, status: number, headers?: HeadersInit) {
  logger.warn("draft_request_blocked", { errorCode: error, status });
  return NextResponse.json({ error, message }, { status, headers });
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const caseBinding = (value: LegalCase) => hash({ version: value.currentDraftVersion || 0, structuredData: value.structuredData });
const evidenceBinding = (snapshot: FirebaseFirestore.QuerySnapshot) => hash(snapshot.docs.map((item) => ({ id: item.id, data: item.data() })).sort((a, b) => a.id.localeCompare(b.id)));
class RevisionError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const startedAt = Date.now();
  let requestRef: FirebaseFirestore.DocumentReference | undefined;
  let reservationCreated = false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return respond("AUTH_REQUIRED", "Faça login para continuar.", 401);
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(authorization.slice(7))).uid; } catch { return respond("AUTH_REQUIRED", "Sessão inválida ou expirada.", 401); }

  const { caseId } = await params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(caseId)) return respond("VALIDATION_ERROR", "Identificador de caso inválido.", 400);
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch { return respond("VALIDATION_ERROR", "O corpo da requisição deve ser JSON válido.", 400); }
  const body = DraftRequestSchema.safeParse(rawBody);
  if (!body.success) return respond("VALIDATION_ERROR", "Solicitação de minuta inválida.", 400);

  try {
    const db = getAdminDb();
    const [caseSnapshot, userSnapshot] = await Promise.all([db.collection("cases").doc(caseId).get(), db.collection("users").doc(uid).get()]);
    if (!caseSnapshot.exists) return respond("CASE_NOT_FOUND", "Caso não encontrado.", 404);
    if (!userSnapshot.exists) return respond("FORBIDDEN", "Perfil de acesso não encontrado.", 403);
    const legalCase = caseSnapshot.data() as LegalCase;
    if (!isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, legalCase)) return respond("FORBIDDEN", "Você não tem acesso a este caso.", 403);
    const structured = PersistedCaseDataSchema.safeParse(legalCase.structuredData);
    if (!structured.success) {
      logger.warn("draft_structured_data_invalid", { issues: JSON.stringify(structured.error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code }))) });
      return respond("CASE_DATA_INVALID", "Os dados salvos do caso precisam de conferência. Nenhuma versão foi gerada.", 409);
    }
    if (!structured.data.draftReady) return respond("DRAFT_NOT_READY", "Ainda faltam informações para gerar uma minuta coerente.", 409);
    if (!process.env.OPENAI_API_KEY) return respond("AI_UNAVAILABLE", "O JurisBot está temporariamente indisponível.", 503);

    requestRef = caseSnapshot.ref.collection("draftRequests").doc(body.data.clientRequestId);
    const requestFingerprint = hash({ ...body.data, uid });
    const priorRequest = await requestRef.get();
    if (priorRequest.exists) {
      const saved = priorRequest.data() as { processingState?: string; version?: number; title?: string; changeSummary?: string; fingerprint?: string; result?: Record<string, unknown> };
      if (saved.fingerprint && saved.fingerprint !== requestFingerprint) return respond("IDEMPOTENCY_CONFLICT", "O identificador já pertence a outra solicitação.", 409);
      if (saved.processingState === "COMPLETED") {
        if (saved.result) return NextResponse.json({ ...saved.result, idempotent: true });
        return NextResponse.json({ version: saved.version, title: saved.title, changeSummary: saved.changeSummary, idempotent: true });
      }
      if (saved.processingState === "FAILED") return respond("REQUEST_PREVIOUSLY_FAILED", "Esta tentativa falhou. Solicite uma nova tentativa.", 409);
      return respond("REQUEST_ALREADY_RECEIVED", "Esta solicitação de minuta já está sendo processada ou já falhou.", 409);
    }
    if (body.data.action !== "generate" && body.data.baseVersion !== Number(legalCase.currentDraftVersion)) return respond("REVISION_STALE", "A minuta mudou. Atualize a página e solicite a alteração na versão atual.", 409);
    let confirmedReview: ReturnType<typeof PersistedRevisionReviewSchema.parse> | undefined;
    let reviewRecord: FirebaseFirestore.DocumentData | undefined;
    if (body.data.action === "revise") {
      const reviewSnapshot = await caseSnapshot.ref.collection("draftRequests").doc(body.data.reviewId!).get();
      reviewRecord = reviewSnapshot.data();
      const parsedReview = PersistedRevisionReviewSchema.safeParse(reviewRecord?.review);
      if (!reviewSnapshot.exists || reviewRecord?.createdBy !== uid || reviewRecord?.action !== "review_revision" || reviewRecord?.processingState !== "COMPLETED" || reviewRecord?.revisionRequest !== body.data.revisionRequest || reviewRecord?.baseVersion !== body.data.baseVersion || !parsedReview.success || !parsedReview.data.ready || parsedReview.data.questions.length || !parsedReview.data.structuredData.draftReady) {
        return respond("REVISION_NOT_CONFIRMED", "Esclareça e confirme a orientação antes de gerar a nova versão.", 409);
      }
      if (reviewRecord.caseBinding !== caseBinding(legalCase)) return respond("REVISION_STALE", "Os dados do caso mudaram. Solicite uma nova orientação.", 409);
      confirmedReview = parsedReview.data;
    }

    // Esclarecimentos são triagem; somente gerar/aplicar consome o limite de
    // novas minutas. Mantém os dois limites existentes e evita que perguntas
    // impeçam a confirmação após uma geração feita na mesma hora.
    const rate = body.data.action === "review_revision" ? checkChatRateLimit(uid) : checkDraftRateLimit(uid, caseId);
    if (!rate.allowed) return respond("RATE_LIMITED", "Limite temporário do JurisBot atingido. Tente novamente mais tarde.", 429, { "Retry-After": String(rate.retryAfter) });

    reservationCreated = await db.runTransaction(async (transaction) => {
      const existingReservation = await transaction.get(requestRef!);
      if (existingReservation.exists) return false;
      transaction.set(requestRef!, {
        requestId: body.data.clientRequestId,
        caseId,
        createdBy: uid,
        action: body.data.action,
        fingerprint: requestFingerprint,
        processingState: "PROCESSING",
        createdAt: new Date(),
      });
      return true;
    });
    if (!reservationCreated) return respond("REQUEST_ALREADY_RECEIVED", "Esta solicitação de minuta já está sendo processada.", 409);

    const [evidenceSnapshot, messageSnapshot, draftSnapshot] = await Promise.all([
      caseSnapshot.ref.collection("evidences").where("status", "==", "PROCESSED").get(),
      caseSnapshot.ref.collection("messages").orderBy("timestamp", "desc").limit(10).get(),
      caseSnapshot.ref.collection("drafts").orderBy("version", "desc").limit(1).get(),
    ]);
    const currentDraft = draftSnapshot.empty ? null : draftSnapshot.docs[0].data();
    if (body.data.action !== "generate" && !currentDraft) throw new RevisionError("DRAFT_NOT_FOUND", "Não há minuta anterior para revisar.", 404);
    const sourceCaseBinding = caseBinding(legalCase);
    const sourceEvidenceBinding = evidenceBinding(evidenceSnapshot);
    if (confirmedReview && reviewRecord?.evidenceBinding !== sourceEvidenceBinding) throw new RevisionError("REVISION_STALE", "As evidências mudaram. Solicite uma nova orientação.");
    const evidenceRecords = evidenceSnapshot.docs
      .map((item) => ({
        evidenceId: item.id,
        order: item.data().order ?? null,
        reference: item.data().reference ?? null,
        title: item.data().title ?? item.data().originalName,
        originalName: item.data().originalName,
        uploadedAt: item.data().uploadedAt,
        summary: item.data().analysis?.summary || String(item.data().extractedText || "").slice(0, 500),
        relevantFacts: Array.isArray(item.data().analysis?.relevantFacts) ? item.data().analysis.relevantFacts.slice(0, 8) : [],
      }))
      .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999) || String(a.uploadedAt || "").localeCompare(String(b.uploadedAt || "")))
      .map((item, index) => ({ ...item, label: `EVIDÊNCIA ${item.reference || String(index + 1).padStart(2, "0")}` }));
    const baseStructuredData = confirmedReview?.structuredData ?? (body.data.action === "review_revision" && currentDraft?.structuredData ? currentDraft.structuredData : structured.data);
    const context = JSON.stringify({
      // Evidências são imutáveis nesta revisão e já estão no contexto dedicado.
      // Não pedir à IA que copie o catálogo inteiro na resposta estruturada.
      structuredData: body.data.action === "review_revision" ? { ...baseStructuredData, evidence: [] } : baseStructuredData,
      evidences: evidenceRecords,
      recentMessages: messageSnapshot.docs.reverse().map((item) => ({ sender: item.data().sender, content: String(item.data().content || "").slice(0, 2_000) })),
      currentDraft: body.data.action !== "generate" ? { version: currentDraft?.version, content: currentDraft?.content } : null,
      revisionRequest: body.data.revisionRequest ?? null,
      confirmedChangeSummary: confirmedReview?.changeSummary ?? null,
    });
    // Não truncar JSON nem cortar a minuta/evidências silenciosamente.
    if (context.length > 100_000) throw new RevisionError("CONTEXT_TOO_LARGE", "O caso excede o limite de revisão. Solicite revisão profissional.");

    if (body.data.action === "review_revision") {
      const response = await createOpenAIClient().responses.parse({
        model: OPENAI_DRAFT_MODEL, instructions: REVISION_REVIEW_PROMPT,
        input: `DADOS_CONFIRMADOS_DO_CASO\n${context}\nFIM_DADOS_CONFIRMADOS_DO_CASO`,
        text: { format: zodTextFormat(RevisionReviewSchema, "petition_revision_review") },
        reasoning: { effort: "low" }, max_output_tokens: 6_000, store: false,
      });
      const parsed = RevisionReviewSchema.safeParse(response.output_parsed);
      if (response.status === "incomplete" || !parsed.success) throw new RevisionError("AI_INVALID_RESPONSE", "Não foi possível validar a orientação gerada.", 502);
      const review = parsed.data;
      if (review.ready && (review.questions.length || !review.structuredData.draftReady)) throw new RevisionError("AI_INVALID_RESPONSE", "A orientação ainda precisa de esclarecimentos.", 502);
      if (review.structuredData.evidence.length && hash(review.structuredData.evidence) !== hash(structured.data.evidence)) throw new RevisionError("AI_INVALID_RESPONSE", "A orientação não pode alterar as evidências existentes.", 502);
      // Preserva o catálogo server-side, inclusive mais de 20 referências.
      review.structuredData.evidence = structured.data.evidence;
      // Revisões ambíguas não podem mudar nem mesmo a proposta estruturada.
      if (!review.ready) review.structuredData = structured.data;
      const result = { reviewId: body.data.clientRequestId, baseVersion: body.data.baseVersion!, revisionRequest: body.data.revisionRequest!, advice: review.advice, ready: review.ready, questions: review.questions, changeSummary: review.changeSummary, proposedClaimValue: review.ready ? review.structuredData.claimValue ?? null : null };
      await db.runTransaction(async (transaction) => {
        const freshCase = await transaction.get(caseSnapshot.ref);
        const freshEvidences = await transaction.get(caseSnapshot.ref.collection("evidences").where("status", "==", "PROCESSED"));
        if (!freshCase.exists || caseBinding(freshCase.data() as LegalCase) !== sourceCaseBinding || evidenceBinding(freshEvidences) !== sourceEvidenceBinding) throw new RevisionError("REVISION_STALE", "O caso mudou durante a orientação. Atualize e tente novamente.");
        transaction.update(requestRef!, { processingState: "COMPLETED", review, result, baseVersion: body.data.baseVersion, revisionRequest: body.data.revisionRequest, caseBinding: sourceCaseBinding, evidenceBinding: sourceEvidenceBinding, model: OPENAI_DRAFT_MODEL, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, estimatedCostUsd: estimateLunaCost(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0), completedAt: new Date() });
        const timestamp = new Date();
        transaction.set(caseSnapshot.ref.collection("messages").doc(body.data.clientRequestId), { messageId: body.data.clientRequestId, caseId, createdBy: uid, sender: "USER", senderName: userSnapshot.data()?.fullName || "Cidadão", content: body.data.revisionRequest, timestamp });
        transaction.set(caseSnapshot.ref.collection("messages").doc(`revision_${body.data.clientRequestId}`), { messageId: `revision_${body.data.clientRequestId}`, caseId, createdBy: uid, sender: "BOT", senderName: "JurisBot", content: revisionAdviceMessage(result), revisionReview: result, timestamp });
      });
      return NextResponse.json(result);
    }

    const response = await createOpenAIClient().responses.parse({
      model: OPENAI_DRAFT_MODEL,
      instructions: DRAFT_SYSTEM_PROMPT,
      input: `DADOS_CONFIRMADOS_DO_CASO\n${context}\nFIM_DADOS_CONFIRMADOS_DO_CASO`,
      text: { format: zodTextFormat(DraftResponseSchema, "initial_petition_draft") },
      reasoning: { effort: "low" },
      max_output_tokens: 6_000,
      store: false,
    });
    logger.info("draft_openai_response", {
      model: OPENAI_DRAFT_MODEL,
      status: response.status,
      incompleteReason: response.incomplete_details?.reason,
      latencyMs: Date.now() - startedAt,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      requestId: response._request_id || undefined,
    });
    if (response.status === "incomplete") {
      throw Object.assign(new Error("Draft response incomplete"), { status: 502, code: "AI_OUTPUT_TRUNCATED" });
    }
    const parsedDraft = DraftResponseSchema.safeParse(response.output_parsed);
    if (!parsedDraft.success) throw Object.assign(new Error("Draft response missing parsed output"), { status: 502, code: "AI_INVALID_RESPONSE" });
    const draft = parsedDraft.data;
    const validLabels = new Set(evidenceRecords.map((item) => item.label));
    let draftContent = draft.content;
    if (confirmedReview && !revisedPartyNamesMatch(draftContent, confirmedReview.structuredData.parties)) throw new RevisionError("AI_INVALID_RESPONSE", "A peça não refletiu os nomes confirmados das partes. Nenhuma nova versão foi salva.", 502);
    if (confirmedReview?.structuredData.claimValue != null && confirmedReview.structuredData.claimValue !== structured.data.claimValue && !revisedClaimValueMatches(draftContent, confirmedReview.structuredData.claimValue)) throw new RevisionError("AI_INVALID_RESPONSE", "A peça não refletiu o valor confirmado. Nenhuma nova versão foi salva.", 502);
    if (evidenceRecords.length > 0 && !/DOCUMENTOS\s+E\s+EVID[ÊE]NCIAS|DOCUMENTOS\s+QUE\s+INSTRUEM/i.test(draftContent)) {
      draftContent += `\n\nDOS DOCUMENTOS E EVIDÊNCIAS\n\n${evidenceRecords.map((item) => `${item.label} — ${item.title}`).join("\n")}`;
    }
    const referencedLabels = [...draftContent.matchAll(/EVID[ÊE]NCIA\s+(\d+(?:\.\d+)?)/gi)].map((match) => `EVIDÊNCIA ${match[1]}`);
    if (referencedLabels.some((label) => !validLabels.has(label))) {
      throw Object.assign(new Error("Draft referenced an unavailable evidence"), { status: 502, code: "AI_INVALID_RESPONSE" });
    }

    let version = 0;
    await db.runTransaction(async (transaction) => {
      const freshCase = await transaction.get(caseSnapshot.ref);
      if (!freshCase.exists) throw new Error("CASE_NOT_FOUND");
      const freshEvidences = await transaction.get(caseSnapshot.ref.collection("evidences").where("status", "==", "PROCESSED"));
      if (caseBinding(freshCase.data() as LegalCase) !== sourceCaseBinding || evidenceBinding(freshEvidences) !== sourceEvidenceBinding) throw new RevisionError("REVISION_STALE", "O caso mudou durante a geração. Atualize e tente novamente.");
      if (confirmedReview && reviewRecord?.appliedVersion) throw new RevisionError("REVISION_ALREADY_APPLIED", "Esta orientação já gerou uma nova versão.");
      version = Number(freshCase.data()?.currentDraftVersion || 0) + 1;
      const draftRef = caseSnapshot.ref.collection("drafts").doc(`v${version}`);
      transaction.set(draftRef, {
        version, caseId, title: `Petição Inicial — Versão ${version}`, content: draftContent,
        approved: false, createdBy: uid, source: "AI", changeSummary: draft.changeSummary,
        feedback: body.data.revisionRequest ?? null, createdAt: new Date(),
        structuredData: confirmedReview?.structuredData ?? structured.data,
        ...(confirmedReview ? { baseVersion: body.data.baseVersion, reviewId: body.data.reviewId, revisionAdvice: confirmedReview.advice } : {}),
        model: OPENAI_DRAFT_MODEL, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0,
        estimatedCostUsd: estimateLunaCost(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0),
      });
      transaction.update(caseSnapshot.ref, { currentDraftVersion: version, status: "AGUARDANDO_REVISAO", ...(confirmedReview ? { structuredData: confirmedReview.structuredData, summary: confirmedReview.structuredData.caseSummary } : {}), updatedAt: new Date() });
      if (confirmedReview) transaction.update(caseSnapshot.ref.collection("draftRequests").doc(body.data.reviewId!), { appliedVersion: version });
      if (confirmedReview) transaction.set(caseSnapshot.ref.collection("messages").doc(`revision_${body.data.clientRequestId}`), { messageId: `revision_${body.data.clientRequestId}`, caseId, createdBy: uid, sender: "BOT", senderName: "JurisBot", content: `O texto da versão ${version} foi salvo como nova minuta, sem alterar a versão anterior. Confira a montagem do documento completo com as evidências e revise antes de aprovar. Nenhum e-mail foi enviado.`, timestamp: new Date() });
      const notificationRef = db.collection("notifications").doc();
      transaction.set(notificationRef, { notificationId: notificationRef.id, userId: legalCase.citizenId, caseId, type: version === 1 ? "DRAFT_READY" : "DRAFT_UPDATED", title: version === 1 ? "Minuta pronta para revisão" : "Nova versão da minuta", message: `A versão ${version} da minuta foi gerada para revisão.`, read: false, createdAt: new Date() });
      transaction.update(requestRef!, {
        processingState: "COMPLETED",
        version,
        title: `Petição Inicial — Versão ${version}`,
        changeSummary: draft.changeSummary,
        completedAt: new Date(),
      });
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    logger.info("draft_openai_completed", { model: OPENAI_DRAFT_MODEL, version, latencyMs: Date.now() - startedAt, inputTokens, outputTokens, estimatedCostUsd: Number(estimateLunaCost(inputTokens, outputTokens).toFixed(8)) });
    return NextResponse.json({ version, title: `Petição Inicial — Versão ${version}`, changeSummary: draft.changeSummary });
  } catch (error) {
    if (reservationCreated && requestRef) {
      await requestRef.update({ processingState: "FAILED", failedAt: new Date() }).catch(() => undefined);
    }
    if (error instanceof RevisionError) return respond(error.code, error.message, error.status);
    const safe = safeOpenAIError(error);
    logger.error("draft_generation_failed", { errorType: safe.type, upstreamStatus: safe.status, upstreamCode: safe.code });
    if (safe.status === 429) return respond("AI_RATE_LIMITED", "O JurisBot atingiu temporariamente o limite de uso. Tente novamente.", 429);
    if (safe.code === "AI_OUTPUT_TRUNCATED") return respond("AI_OUTPUT_TRUNCATED", "Não consegui concluir a minuta. Tente novamente.", 502);
    if (safe.code === "AI_INVALID_RESPONSE") return respond("AI_INVALID_RESPONSE", "Não foi possível validar a minuta gerada.", 502);
    return respond("AI_UNAVAILABLE", "Não foi possível gerar a minuta agora. Tente novamente.", 503);
  }
}
