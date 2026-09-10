import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { createOpenAIClient, estimateLunaCost, OPENAI_DRAFT_MODEL, safeOpenAIError } from "@/lib/ai/openai";
import { DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { DraftRequestSchema, DraftResponseSchema, StructuredCaseDataSchema } from "@/lib/ai/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { checkDraftRateLimit } from "@/lib/security/inMemoryRateLimit";
import type { LegalCase, UserProfile } from "@/types";

export const runtime = "nodejs";

function respond(error: string, message: string, status: number, headers?: HeadersInit) { return NextResponse.json({ error, message }, { status, headers }); }

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
    const structured = StructuredCaseDataSchema.safeParse(legalCase.structuredData);
    if (!structured.success || !structured.data.draftReady) return respond("DRAFT_NOT_READY", "Ainda faltam informações para gerar uma minuta coerente.", 409);
    if (!process.env.OPENAI_API_KEY) return respond("AI_UNAVAILABLE", "O JurisBot está temporariamente indisponível.", 503);

    requestRef = caseSnapshot.ref.collection("draftRequests").doc(body.data.clientRequestId);
    const priorRequest = await requestRef.get();
    if (priorRequest.exists) {
      const saved = priorRequest.data() as { processingState?: string; version?: number; title?: string; changeSummary?: string };
      if (saved.processingState === "COMPLETED") {
        return NextResponse.json({ version: saved.version, title: saved.title, changeSummary: saved.changeSummary, idempotent: true });
      }
      return respond("REQUEST_ALREADY_RECEIVED", "Esta solicitação de minuta já está sendo processada ou já falhou.", 409);
    }

    const rate = checkDraftRateLimit(uid, caseId);
    if (!rate.allowed) return respond("RATE_LIMITED", "Limite temporário de geração de minutas atingido. Tente novamente mais tarde.", 429, { "Retry-After": String(rate.retryAfter) });

    reservationCreated = await db.runTransaction(async (transaction) => {
      const existingReservation = await transaction.get(requestRef!);
      if (existingReservation.exists) return false;
      transaction.set(requestRef!, {
        requestId: body.data.clientRequestId,
        caseId,
        createdBy: uid,
        action: body.data.action,
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
    if (body.data.action === "revise" && !currentDraft) return respond("DRAFT_NOT_FOUND", "Não há minuta anterior para revisar.", 404);
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
    const context = JSON.stringify({
      structuredData: structured.data,
      evidences: evidenceRecords,
      recentMessages: messageSnapshot.docs.reverse().map((item) => ({ sender: item.data().sender, content: String(item.data().content || "").slice(0, 2_000) })),
      currentDraft: body.data.action === "revise" ? currentDraft : null,
      revisionRequest: body.data.revisionRequest ?? null,
    }).slice(0, 45_000);

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
    const draft = response.output_parsed;
    if (!draft) throw Object.assign(new Error("Draft response missing parsed output"), { status: 502, code: "AI_INVALID_RESPONSE" });
    const validLabels = new Set(evidenceRecords.map((item) => item.label));
    let draftContent = draft.content;
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
      version = Number(freshCase.data()?.currentDraftVersion || 0) + 1;
      const draftRef = caseSnapshot.ref.collection("drafts").doc(`v${version}`);
      transaction.set(draftRef, {
        version, caseId, title: `Petição Inicial — Versão ${version}`, content: draftContent,
        approved: false, createdBy: uid, source: "AI", changeSummary: draft.changeSummary,
        feedback: body.data.revisionRequest ?? null, createdAt: new Date(),
      });
      transaction.update(caseSnapshot.ref, { currentDraftVersion: version, status: "AGUARDANDO_REVISAO", updatedAt: new Date() });
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
    const safe = safeOpenAIError(error);
    logger.error("draft_generation_failed", { errorType: safe.type, upstreamStatus: safe.status, upstreamCode: safe.code });
    if (safe.status === 429) return respond("AI_RATE_LIMITED", "O JurisBot atingiu temporariamente o limite de uso. Tente novamente.", 429);
    if (safe.code === "AI_OUTPUT_TRUNCATED") return respond("AI_OUTPUT_TRUNCATED", "Não consegui concluir a minuta. Tente novamente.", 502);
    if (safe.code === "AI_INVALID_RESPONSE") return respond("AI_INVALID_RESPONSE", "Não foi possível validar a minuta gerada.", 502);
    return respond("AI_UNAVAILABLE", "Não foi possível gerar a minuta agora. Tente novamente.", 503);
  }
}
