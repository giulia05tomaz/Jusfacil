import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { EVIDENCE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { EvidenceAnalysisSchema } from "@/lib/ai/schemas";
import { createOpenAIClient, estimateLunaCost, OPENAI_CHAT_MODEL, safeOpenAIError } from "@/lib/ai/openai";
import { extractEvidenceText } from "@/lib/evidence/extract";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { checkEvidenceRateLimit } from "@/lib/security/inMemoryRateLimit";
import type { LegalCase, UserProfile } from "@/types";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CASE_FILES = 5;
const MAX_CASE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  [".pdf", ["application/pdf"]], [".png", ["image/png"]], [".jpg", ["image/jpeg"]], [".jpeg", ["image/jpeg"]],
  [".txt", ["text/plain"]], [".csv", ["text/csv", "application/vnd.ms-excel", "text/plain"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
]);

function respond(error: string, message: string, status: number, headers?: HeadersInit) { return NextResponse.json({ error, message }, { status, headers }); }

function validateFile(file: File): string | null {
  if (!file.size) return "O arquivo está vazio.";
  if (file.size > MAX_BYTES) return "O arquivo deve ter no máximo 8 MB.";
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_TYPES.get(extension)?.includes(file.type.toLowerCase())) return "Formato, extensão ou tipo MIME não permitido.";
  return null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond("AUTH_REQUIRED", "Faça login para continuar.", 401);
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid; } catch { return respond("AUTH_REQUIRED", "Sessão inválida ou expirada.", 401); }

  let evidenceRef: FirebaseFirestore.DocumentReference | undefined;
  let reservationCreated = false;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const caseId = String(form.get("caseId") || "");
    const evidenceId = String(form.get("evidenceId") || "");
    const description = String(form.get("description") || "").trim().slice(0, 1_000);
    if (!(file instanceof File) || !/^[A-Za-z0-9_-]{8,100}$/.test(caseId) || !/^[0-9a-f-]{36}$/i.test(evidenceId)) return respond("VALIDATION_ERROR", "Arquivo ou identificadores inválidos.", 400);
    const validationMessage = validateFile(file);
    if (validationMessage) return respond("VALIDATION_ERROR", validationMessage, 400);

    const adminDb = getAdminDb();
    const [caseSnapshot, userSnapshot] = await Promise.all([adminDb.collection("cases").doc(caseId).get(), adminDb.collection("users").doc(uid).get()]);
    if (!caseSnapshot.exists) return respond("CASE_NOT_FOUND", "Caso não encontrado.", 404);
    if (!userSnapshot.exists || !isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, caseSnapshot.data() as LegalCase)) return respond("FORBIDDEN", "Você não tem acesso a esta evidência.", 403);

    evidenceRef = caseSnapshot.ref.collection("evidences").doc(evidenceId);
    if ((await evidenceRef.get()).exists) return respond("EVIDENCE_ALREADY_RECEIVED", "Esta evidência já foi recebida.", 409);

    const evidences = await caseSnapshot.ref.collection("evidences").limit(MAX_CASE_FILES).get();
    const accumulatedBytes = evidences.docs.reduce((sum, item) => sum + Number(item.data().size || 0), 0);
    if (evidences.size >= MAX_CASE_FILES || accumulatedBytes + file.size > MAX_CASE_BYTES) return respond("EVIDENCE_LIMIT", "Limite de 5 arquivos e 20 MB por caso atingido.", 400);
    if (!process.env.OPENAI_API_KEY) return respond("AI_UNAVAILABLE", "A análise automática não está configurada neste ambiente.", 503);

    const rate = checkEvidenceRateLimit(uid, caseId);
    if (!rate.allowed) return respond("RATE_LIMITED", "Limite temporário de análise de evidências atingido. Tente novamente mais tarde.", 429, { "Retry-After": String(rate.retryAfter) });

    reservationCreated = await adminDb.runTransaction(async (transaction) => {
      const existingReservation = await transaction.get(evidenceRef!);
      if (existingReservation.exists) return false;
      transaction.set(evidenceRef!, { evidenceId, caseId, originalName: file.name.slice(0, 300), mimeType: file.type, size: file.size, description, uploadedBy: uid, uploadedAt: new Date(), status: "PROCESSING", originalRetained: false });
      return true;
    });
    if (!reservationCreated) return respond("EVIDENCE_ALREADY_RECEIVED", "Esta evidência já foi recebida.", 409);

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type === "image/png" || file.type === "image/jpeg";
    const extraction = isImage ? null : await extractEvidenceText(buffer, file.type, file.name);
    if (!isImage && (!extraction || !extraction.text)) {
      await evidenceRef.update({ status: "UNSUPPORTED", extractionMethod: file.type === "application/pdf" ? "SCANNED_PDF_OCR_UNAVAILABLE" : "UNSUPPORTED", processingError: "Não foi possível extrair texto útil.", processedAt: new Date() });
      return respond("EVIDENCE_UNSUPPORTED", file.type === "application/pdf" ? "Documento possivelmente digitalizado; OCR não está disponível nesta fase." : "Não foi possível analisar este documento.", 422);
    }

    const legalCase = caseSnapshot.data() as LegalCase;
    const content = isImage
      ? [{ type: "input_text" as const, text: `ARQUIVO: ${file.name}\nCONTEXTO DO CASO: ${legalCase.summary}\nExtraia somente o conteúdo visível.` }, { type: "input_image" as const, image_url: `data:${file.type};base64,${buffer.toString("base64")}`, detail: "low" as const }]
      : [{ type: "input_text" as const, text: `ARQUIVO: ${file.name}\nTIPO: ${file.type}\nCONTEXTO DO CASO: ${legalCase.summary}\nEVIDENCIA_NAO_CONFIAVEL\n${extraction!.text.slice(0, 24_000)}\nFIM_EVIDENCIA` }];
    const response = await createOpenAIClient().responses.parse({
      model: OPENAI_CHAT_MODEL,
      instructions: EVIDENCE_SYSTEM_PROMPT,
      input: [{ role: "user", content }],
      text: { format: zodTextFormat(EvidenceAnalysisSchema, "evidence_analysis") },
      reasoning: { effort: "low" },
      max_output_tokens: 1_200,
      store: false,
    });
    const analysis = response.output_parsed;
    if (!analysis) throw new Error("invalid_ai_response");
    await evidenceRef.update({ status: "PROCESSED", extractionMethod: isImage ? "OPENAI_VISION_LOW" : extraction?.method, analysis, confidence: analysis.confidence, processedAt: new Date(), processingError: null, originalRetained: false });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    logger.info("evidence_openai_completed", { model: OPENAI_CHAT_MODEL, latencyMs: Date.now() - startedAt, inputTokens, outputTokens, estimatedCostUsd: Number(estimateLunaCost(inputTokens, outputTokens).toFixed(8)) });
    return NextResponse.json({ evidenceId, status: "PROCESSED", analysis, truncated: extraction?.truncated ?? false, originalRetained: false });
  } catch (error) {
    const safe = safeOpenAIError(error);
    if (evidenceRef) await evidenceRef.update({ status: "FAILED", processingError: "Falha durante a análise.", processedAt: new Date(), originalRetained: false }).catch(() => undefined);
    logger.error("evidence_processing_failed", { errorType: safe.type, upstreamStatus: safe.status, upstreamCode: safe.code });
    if (safe.status === 429) return respond("AI_RATE_LIMITED", "O JurisBot atingiu temporariamente o limite de uso. Tente novamente mais tarde.", 429);
    return respond("AI_UNAVAILABLE", "Não foi possível processar a evidência agora.", 503);
  }
}
