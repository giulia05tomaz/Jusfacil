import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { JURISBOT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { JurisBotRequestSchema, JurisBotResponseSchema } from "@/lib/ai/schemas";
import { createOpenAIClient, estimateLunaCost, OPENAI_CHAT_MODEL, safeOpenAIError } from "@/lib/ai/openai";
import { evaluateCaseEligibility } from "@/lib/cases/eligibility";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { checkChatRateLimit } from "@/lib/security/inMemoryRateLimit";
import { POST as draftPost } from "@/app/api/cases/[caseId]/draft/route";
import { isRevisionConfirmation, revisionAdviceMessage, RevisionProposalSchema } from "@/lib/drafts/revisionShared";
import type { LegalCase, StructuredCaseData, UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error, message }, { status, headers });
}

function mergeStructuredData(previous: StructuredCaseData | null | undefined, next: StructuredCaseData): StructuredCaseData {
  if (!previous) return next;
  const mergeArrays = <T,>(left: T[], right: T[]) => {
    const seen = new Set<string>();
    return [...left, ...right].filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return {
    ...next,
    caseSummary: next.caseSummary.trim() || previous.caseSummary,
    category: next.category ?? previous.category,
    parties: mergeArrays(previous.parties, next.parties),
    facts: mergeArrays(previous.facts, next.facts),
    timeline: mergeArrays(previous.timeline, next.timeline),
    values: mergeArrays(previous.values, next.values),
    evidence: mergeArrays(previous.evidence, next.evidence),
    legalIssues: mergeArrays(previous.legalIssues, next.legalIssues),
    requestedRelief: mergeArrays(previous.requestedRelief, next.requestedRelief),
    contradictions: mergeArrays(previous.contradictions, next.contradictions),
    riskFlags: mergeArrays(previous.riskFlags, next.riskFlags),
    draftReady: previous.draftReady || next.draftReady,
    requiresHumanReview: previous.requiresHumanReview || next.requiresHumanReview,
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse("AUTH_REQUIRED", "Faça login para continuar.", 401);

  let uid: string;
  try {
    const token = authHeader.slice(7).trim();
    if (token.split(".").length !== 3) throw Object.assign(new Error("Malformed Firebase token"), { code: "auth/argument-error" });
    uid = (await getAdminAuth().verifyIdToken(token)).uid;
  } catch (error) {
    const authError = error as { code?: string };
    const token = authHeader.slice(7).trim();
    logger.warn("firebase_token_verification_failed", { errorType: error instanceof Error ? error.name : "unknown", upstreamCode: authError.code, tokenLength: token.length, tokenSegments: token.split(".").length });
    return errorResponse("AUTH_REQUIRED", "Sessão inválida ou expirada. Faça login novamente.", 401);
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch { return errorResponse("VALIDATION_ERROR", "O corpo da requisição deve ser JSON válido.", 400); }
  const parsed = JurisBotRequestSchema.safeParse(rawBody);
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A mensagem enviada excede os limites ou contém dados inválidos.", 400);

  let responseMessageRef: FirebaseFirestore.DocumentReference | undefined;
  let reservationCreated = false;
  try {
    const adminDb = getAdminDb();
    const [caseSnapshot, userSnapshot] = await Promise.all([
      adminDb.collection("cases").doc(parsed.data.caseId).get(),
      adminDb.collection("users").doc(uid).get(),
    ]);
    if (!caseSnapshot.exists) return errorResponse("CASE_NOT_FOUND", "O caso solicitado não foi encontrado.", 404);
    if (!userSnapshot.exists) return errorResponse("FORBIDDEN", "Perfil de acesso não encontrado.", 403);

    const legalCase = caseSnapshot.data() as LegalCase;
    const user = userSnapshot.data() as UserProfile;
    if (!isAuthorizedForCase(uid, user, legalCase)) return errorResponse("FORBIDDEN", "Você não tem acesso a este caso.", 403);
    // Após a primeira minuta, o chat é uma entrada do MESMO fluxo de revisão.
    // Uma resposta de triagem nunca é tratada como documento alterado.
    if (legalCase.currentDraftVersion) {
      // Conserva a versão-base/proposta no retry, mesmo após a versão avançar.
      const dispatchRef = caseSnapshot.ref.collection("revisionChatRequests").doc(parsed.data.clientMessageId);
      const priorDispatch = await dispatchRef.get();
      const savedDispatch = priorDispatch.data();
      if (priorDispatch.exists && (savedDispatch?.createdBy !== uid || savedDispatch?.message !== parsed.data.message)) return errorResponse("IDEMPOTENCY_CONFLICT", "O identificador já pertence a outra solicitação.", 409);
      let payload: Record<string, unknown> = { clientRequestId: parsed.data.clientMessageId, action: "review_revision", revisionRequest: parsed.data.message, baseVersion: legalCase.currentDraftVersion };
      if (priorDispatch.exists) payload = savedDispatch!.payload;
      else if (isRevisionConfirmation(parsed.data.message)) {
        const history = await caseSnapshot.ref.collection("messages").orderBy("timestamp", "desc").limit(20).get();
        const proposals = history.docs.map(item => item.data()).filter(item => item.createdBy === uid).map(item => RevisionProposalSchema.safeParse(item.revisionReview));
        const latest = proposals.find(item => item.success && item.data.baseVersion === legalCase.currentDraftVersion);
        if (!latest?.success || !latest.data.ready || latest.data.questions.length) return errorResponse("REVISION_NOT_READY", "Ainda não há uma proposta pronta para confirmar. Esclareça a alteração primeiro.", 409);
        payload = { ...payload, action: "revise", revisionRequest: latest.data.revisionRequest, reviewId: latest.data.reviewId, confirmation: true };
      }
      const dispatch = await adminDb.runTransaction(async transaction => {
        const existing = await transaction.get(dispatchRef);
        if (existing.exists) return existing.data()!;
        const record = { createdBy: uid, message: parsed.data.message, payload, createdAt: new Date() };
        transaction.set(dispatchRef, record);
        return record;
      });
      if (dispatch.createdBy !== uid || dispatch.message !== parsed.data.message) return errorResponse("IDEMPOTENCY_CONFLICT", "O identificador já pertence a outra solicitação.", 409);
      payload = dispatch.payload;
      logger.info("jurisbot_revision_dispatch", { action: String(payload.action), baseVersion: legalCase.currentDraftVersion });
      const result = await draftPost(new Request(request.url, { method: "POST", headers: { Authorization: authHeader, "Content-Type": "application/json" }, body: JSON.stringify(payload) }), { params: Promise.resolve({ caseId: parsed.data.caseId }) });
      const output = await result.json();
      if (!result.ok) return NextResponse.json(output, { status: result.status, headers: result.headers });
      const review = RevisionProposalSchema.safeParse(output);
      if (review.success) return NextResponse.json({ ...output, revisionReview: review.data, reply: revisionAdviceMessage(review.data) });
      return NextResponse.json({ ...output, reply: `Texto da versão ${output.version} salvo para revisão. A aplicação irá montar o documento completo com as evidências. Nenhum e-mail foi enviado.` });
    }
    responseMessageRef = caseSnapshot.ref.collection("messages").doc(`ai_${parsed.data.clientMessageId}`);
    const priorResponse = await responseMessageRef.get();
    if (priorResponse.exists) {
      const saved = priorResponse.data() as { content?: string; structuredData?: StructuredCaseData; processingState?: string };
      if (saved.processingState === "COMPLETED" || saved.content) {
        return NextResponse.json({ reply: saved.content, structuredData: saved.structuredData ?? legalCase.structuredData ?? null, idempotent: true });
      }
      return errorResponse("REQUEST_ALREADY_RECEIVED", "Esta mensagem já está sendo processada ou já falhou. Envie uma nova mensagem para tentar novamente.", 409);
    }
    if (!process.env.OPENAI_API_KEY) return errorResponse("AI_UNAVAILABLE", "O JurisBot está temporariamente indisponível.", 503);

    const rate = checkChatRateLimit(uid);
    if (!rate.allowed) return errorResponse("RATE_LIMITED", "Você enviou muitas mensagens em pouco tempo. Aguarde alguns segundos.", 429, { "Retry-After": String(rate.retryAfter) });

    const userMessageRef = caseSnapshot.ref.collection("messages").doc(parsed.data.clientMessageId);
    const reservedAt = new Date();
    reservationCreated = await adminDb.runTransaction(async (transaction) => {
      const existingReservation = await transaction.get(responseMessageRef!);
      if (existingReservation.exists) return false;
      transaction.set(userMessageRef, {
        messageId: parsed.data.clientMessageId,
        clientMessageId: parsed.data.clientMessageId,
        caseId: parsed.data.caseId,
        sender: "USER",
        senderName: user.fullName || "Usuário",
        content: parsed.data.message,
        timestamp: reservedAt,
      });
      transaction.set(responseMessageRef!, {
        messageId: responseMessageRef!.id,
        clientMessageId: parsed.data.clientMessageId,
        caseId: parsed.data.caseId,
        sender: "SYSTEM",
        senderName: "JurisBot",
        content: "",
        hidden: true,
        processingState: "PROCESSING",
        timestamp: reservedAt,
      });
      return true;
    });
    if (!reservationCreated) {
      const concurrent = await responseMessageRef.get();
      const saved = concurrent.data() as { content?: string; structuredData?: StructuredCaseData; processingState?: string } | undefined;
      if (saved?.processingState === "COMPLETED" || saved?.content) {
        return NextResponse.json({ reply: saved.content, structuredData: saved.structuredData ?? legalCase.structuredData ?? null, idempotent: true });
      }
      return errorResponse("REQUEST_ALREADY_RECEIVED", "Esta mensagem já está sendo processada.", 409);
    }

    const [evidenceSnapshot, messageSnapshot] = await Promise.all([
      caseSnapshot.ref.collection("evidences").where("status", "==", "PROCESSED").get(),
      caseSnapshot.ref.collection("messages").orderBy("timestamp", "desc").limit(20).get(),
    ]);
    const evidenceContext = evidenceSnapshot.docs.map((item) => {
      const data = item.data();
      return { evidenceId: item.id, order: data.order ?? null, reference: data.reference ?? null, title: data.title ?? data.originalName, summary: data.analysis?.summary || String(data.extractedText || "").slice(0, 400), relevantFacts: data.analysis?.relevantFacts?.slice?.(0, 5) || [] };
    }).sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));
    const context = JSON.stringify({
      caseId: parsed.data.caseId,
      originalStory: legalCase.originalStory,
      caseSummary: legalCase.summary,
      structuredData: legalCase.structuredData ?? null,
      evidences: evidenceContext,
    }).slice(0, 22_000);
    let remainingCharacters = 12_000;
    const newestRelevant = messageSnapshot.docs.flatMap((item) => {
      const data = item.data();
      const sender = data.sender === "USER" || data.sender === "BOT" ? data.sender : null;
      const content = String(data.content || "").trim().slice(0, 4_000);
      if (!sender || !content || remainingCharacters <= 0) return [];
      const boundedContent = content.slice(Math.max(0, content.length - remainingCharacters));
      remainingCharacters -= boundedContent.length;
      return [{ role: sender === "USER" ? "user" as const : "assistant" as const, content: boundedContent }];
    }).slice(0, 10);
    const input = newestRelevant.reverse();

    const response = await createOpenAIClient().responses.parse({
      model: OPENAI_CHAT_MODEL,
      instructions: JURISBOT_SYSTEM_PROMPT,
      input: [
        { role: "developer", content: `DADOS_DO_USUARIO\n${context}\nFIM_DADOS_DO_USUARIO` },
        ...input.map((message) => ({ role: message.role, content: message.content })),
      ],
      text: { format: zodTextFormat(JurisBotResponseSchema, "jurisbot_response") },
      reasoning: { effort: "low" },
      max_output_tokens: 3_200,
      store: false,
    });
    const incompleteReason = response.incomplete_details?.reason;
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    logger.info("jurisbot_openai_response", {
      model: OPENAI_CHAT_MODEL,
      status: response.status,
      incompleteReason,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      requestId: response._request_id || undefined,
    });
    if (response.status === "incomplete") {
      const incompleteError = Object.assign(new Error("OpenAI response incomplete"), {
        status: 502,
        code: incompleteReason === "max_output_tokens" ? "AI_OUTPUT_TRUNCATED" : "AI_OUTPUT_INCOMPLETE",
      });
      throw incompleteError;
    }
    const payload = response.output_parsed;
    if (!payload) {
      const invalidError = Object.assign(new Error("OpenAI response missing parsed output"), { status: 502, code: "AI_INVALID_RESPONSE" });
      throw invalidError;
    }

    const data = mergeStructuredData(legalCase.structuredData, payload.structuredData as StructuredCaseData);
    const eligibility = evaluateCaseEligibility(data);
    const now = new Date();
    await adminDb.runTransaction(async (transaction) => {
      const freshCase = await transaction.get(caseSnapshot.ref);
      if (!freshCase.exists) throw new Error("case_deleted");
      transaction.update(caseSnapshot.ref, {
        structuredData: data,
        summary: data.caseSummary || legalCase.summary,
        category: data.category || legalCase.category,
        requiresHumanReview: eligibility.path === "HUMAN_REVIEW",
        humanReviewReason: eligibility.reasons.join(" ") || null,
        status: eligibility.path === "HUMAN_REVIEW" ? "REVISAO_HUMANA" : data.draftReady ? "PREPARANDO_MINUTA" : "COLETANDO_INFORMACOES",
        updatedAt: now,
      });
      transaction.update(responseMessageRef!, {
        sender: "BOT",
        senderName: "JurisBot",
        content: payload.assistantMessage,
        structuredData: data,
        hidden: false,
        processingState: "COMPLETED",
        timestamp: now,
      });
    });

    logger.info("jurisbot_openai_completed", {
      model: OPENAI_CHAT_MODEL, status: response.status,
      latencyMs: Date.now() - startedAt, inputTokens, outputTokens,
      estimatedCostUsd: Number(estimateLunaCost(inputTokens, outputTokens).toFixed(8)), requestId: response._request_id || undefined,
    });
    return NextResponse.json({ reply: payload.assistantMessage, structuredData: data, draftReady: data.draftReady });
  } catch (error) {
    if (reservationCreated && responseMessageRef) {
      await responseMessageRef.update({ processingState: "FAILED", hidden: true, content: "", failedAt: new Date() }).catch(() => undefined);
    }
    const safe = safeOpenAIError(error);
    logger.error("jurisbot_request_failed", { errorType: safe.type, upstreamStatus: safe.status, upstreamCode: safe.code });
    if (safe.status === 429) return errorResponse("AI_RATE_LIMITED", "O JurisBot atingiu temporariamente o limite de uso. Tente novamente.", 429);
    if (safe.status === 401 || safe.status === 403) return errorResponse("AI_UNAVAILABLE", "O JurisBot está temporariamente indisponível.", 503);
    if (safe.code === "AI_OUTPUT_TRUNCATED") return errorResponse("AI_OUTPUT_TRUNCATED", "Não consegui concluir a análise desta mensagem. Tente novamente.", 502);
    if (safe.code === "AI_INVALID_RESPONSE" || safe.code === "AI_OUTPUT_INCOMPLETE") return errorResponse("AI_INVALID_RESPONSE", "Não consegui concluir a análise desta mensagem. Tente novamente.", 502);
    return errorResponse("AI_UNAVAILABLE", "Não foi possível obter uma resposta agora. Tente novamente.", 503);
  }
}
