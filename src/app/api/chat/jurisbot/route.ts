import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { JURISBOT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { JurisBotRequestSchema, JurisBotResponseSchema } from "@/lib/ai/schemas";
import { evaluateCaseEligibility } from "@/lib/cases/eligibility";
import { logger } from "@/lib/logger";
import type { LegalCase, StructuredCaseData, UserProfile } from "@/types";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function omitNullValues<T>(value: T): T {
  if (Array.isArray(value)) return value.map(omitNullValues) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null)
        .map(([key, item]) => [key, omitNullValues(item)]),
    ) as T;
  }
  return value;
}

export function checkRateLimit(uid: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const max = Number(process.env.JURISBOT_RATE_LIMIT_MAX || 12);
  const windowMs = Number(process.env.JURISBOT_RATE_LIMIT_WINDOW_MS || 60_000);
  const current = rateBuckets.get(uid);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(uid, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= max) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function errorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error, message }, { status, headers });
}

type OpenAIErrorLike = {
  status?: number;
  code?: string;
  error?: { code?: string };
  name?: string;
  request_id?: string;
  requestId?: string;
};

export function classifyOpenAIError(error: unknown) {
  const apiError = error as OpenAIErrorLike;
  const upstreamStatus = apiError.status;
  const upstreamCode = apiError.code || apiError.error?.code;
  const requestId = apiError.request_id || apiError.requestId;
  const errorType = error instanceof Error ? error.name : apiError.name || "unknown";

  if (upstreamStatus === 401) {
    return {
      error: "AI_AUTHENTICATION_FAILED",
      message: "O JurisBot está temporariamente indisponível. Tente novamente mais tarde.",
      status: 503,
      upstreamStatus,
      upstreamCode,
      requestId,
      errorType,
    };
  }
  if (upstreamStatus === 429) {
    return {
      error: "AI_QUOTA_EXCEEDED",
      message: "O JurisBot está temporariamente indisponível para gerar uma resposta. Tente novamente mais tarde.",
      status: 503,
      upstreamStatus,
      upstreamCode,
      requestId,
      errorType,
    };
  }
  if (upstreamStatus === 400) {
    return {
      error: "AI_INVALID_REQUEST",
      message: "Não foi possível processar esta solicitação. Revise a mensagem e tente novamente.",
      status: 502,
      upstreamStatus,
      upstreamCode,
      requestId,
      errorType,
    };
  }
  if (upstreamStatus && upstreamStatus >= 500) {
    return {
      error: "AI_UPSTREAM_ERROR",
      message: "O JurisBot está temporariamente indisponível. Tente novamente mais tarde.",
      status: 503,
      upstreamStatus,
      upstreamCode,
      requestId,
      errorType,
    };
  }
  if (["APIConnectionError", "APIConnectionTimeoutError"].includes(errorType)
    || ["ECONNRESET", "ETIMEDOUT"].includes(upstreamCode || "")) {
    return {
      error: "AI_NETWORK_ERROR",
      message: "Não foi possível conectar ao JurisBot. Tente novamente mais tarde.",
      status: 503,
      upstreamStatus,
      upstreamCode,
      requestId,
      errorType,
    };
  }
  return {
    error: "AI_UNAVAILABLE",
    message: "O JurisBot está temporariamente indisponível. Tente novamente mais tarde.",
    status: 503,
    upstreamStatus,
    upstreamCode,
    requestId,
    errorType,
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse("AUTH_REQUIRED", "Faça login para continuar.", 401);

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return errorResponse("AUTH_REQUIRED", "Sessão inválida ou expirada. Faça login novamente.", 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "O corpo da requisição deve ser JSON válido.", 400);
  }
  const parsed = JurisBotRequestSchema.safeParse(rawBody);
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A mensagem enviada excede os limites ou contém dados inválidos.", 400);

  const rate = checkRateLimit(uid);
  if (!rate.allowed) return errorResponse("RATE_LIMITED", "Muitas mensagens em pouco tempo. Aguarde antes de tentar novamente.", 429, { "Retry-After": String(rate.retryAfter) });

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

    if (!process.env.OPENAI_API_KEY) return errorResponse("AI_UNAVAILABLE", "O JurisBot está temporariamente indisponível. Tente novamente.", 503);

    const [evidenceSnapshot, draftSnapshot] = await Promise.all([
      caseSnapshot.ref.collection("evidences").where("status", "==", "PROCESSED").limit(12).get(),
      caseSnapshot.ref.collection("drafts").orderBy("version", "desc").limit(1).get(),
    ]);
    const evidenceContext = evidenceSnapshot.docs.map((item) => {
      const data = item.data();
      return { evidenceId: item.id, originalName: data.originalName, analysis: data.analysis, extractedText: String(data.extractedText || "").slice(0, 4_000) };
    });
    const context = JSON.stringify({
      caseId: parsed.data.caseId,
      summary: legalCase.summary,
      structuredData: legalCase.structuredData,
      evidences: evidenceContext,
      currentDraft: draftSnapshot.empty ? null : draftSnapshot.docs[0].data(),
    }).slice(0, 24_000);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.parse({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages: [
        { role: "system", content: JURISBOT_SYSTEM_PROMPT },
        { role: "system", content: `DADOS_DO_USUARIO\n${context}\nFIM_DADOS_DO_USUARIO` },
        ...(parsed.data.messages.length ? parsed.data.messages : [{ role: "user" as const, content: parsed.data.userStory || legalCase.originalStory }]),
      ],
      response_format: zodResponseFormat(JurisBotResponseSchema, "jurisbot_response"),
    });
    const payload = completion.choices[0]?.message.parsed;
    if (!payload) return errorResponse("AI_INVALID_RESPONSE", "Não foi possível validar a resposta do JurisBot.", 502);

    if (payload.structuredData) {
      const data = omitNullValues(payload.structuredData);
      const eligibility = evaluateCaseEligibility(data as unknown as StructuredCaseData);
      await adminDb.runTransaction(async (transaction) => {
        const freshCase = await transaction.get(caseSnapshot.ref);
        if (!freshCase.exists) throw new Error("case_deleted");
        const current = freshCase.data() as LegalCase;
        const caseUpdates: Record<string, unknown> = {
          structuredData: data,
          summary: data.summary || current.summary,
          category: data.category || current.category,
          requiresHumanReview: eligibility.path === "HUMAN_REVIEW",
          humanReviewReason: eligibility.reasons.join(" ") || null,
          updatedAt: new Date(),
        };
        if (eligibility.path === "HUMAN_REVIEW") caseUpdates.status = "REVISAO_HUMANA";
        if (data.generateDraft && data.draftContent) {
          const version = (current.currentDraftVersion || 0) + 1;
          const draftRef = caseSnapshot.ref.collection("drafts").doc(`v${version}`);
          transaction.set(draftRef, {
            version,
            caseId: parsed.data.caseId,
            title: data.draftTitle || "Minuta informativa",
            content: data.draftContent,
            approved: false,
            createdBy: uid,
            source: "AI",
            createdAt: new Date(),
          });
          caseUpdates.currentDraftVersion = version;
          caseUpdates.status = eligibility.path === "HUMAN_REVIEW" ? "REVISAO_HUMANA" : "AGUARDANDO_REVISAO";
          const notificationRef = adminDb.collection("notifications").doc();
          transaction.set(notificationRef, {
            notificationId: notificationRef.id,
            userId: legalCase.citizenId,
            caseId: parsed.data.caseId,
            type: "DRAFT_READY",
            title: "Minuta pronta para revisão",
            message: "Uma nova versão da minuta está disponível. Revise as informações antes de aprovar.",
            read: false,
            createdAt: new Date(),
          });
        }
        transaction.update(caseSnapshot.ref, caseUpdates);
      });
    }

    const botMessageRef = caseSnapshot.ref.collection("messages").doc();
    await botMessageRef.set({
      messageId: botMessageRef.id,
      caseId: parsed.data.caseId,
      sender: "BOT",
      senderName: "JurisBot",
      content: payload.reply,
      timestamp: new Date(),
    });

    return NextResponse.json(payload);
  } catch (error) {
    const failure = classifyOpenAIError(error);
    logger.error("jurisbot_request_failed", {
      errorType: failure.errorType,
      upstreamStatus: failure.upstreamStatus,
      upstreamCode: failure.upstreamCode,
      requestId: failure.requestId,
    });
    return errorResponse(failure.error, failure.message, failure.status);
  }
}
