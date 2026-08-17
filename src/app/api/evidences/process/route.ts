import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { EVIDENCE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { EvidenceAnalysisSchema } from "@/lib/ai/schemas";
import { extractEvidenceText } from "@/lib/evidence/extract";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { logger } from "@/lib/logger";
import type { LegalCase, UserProfile } from "@/types";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

function respond(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond("AUTH_REQUIRED", "Faça login para continuar.", 401);
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return respond("AUTH_REQUIRED", "Sessão inválida ou expirada.", 401);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const caseId = String(form.get("caseId") || "");
    const evidenceId = String(form.get("evidenceId") || "");
    if (!(file instanceof File) || !caseId || !evidenceId || file.size === 0 || file.size > MAX_BYTES) {
      return respond("VALIDATION_ERROR", "Arquivo ou identificadores inválidos.", 400);
    }

    const adminDb = getAdminDb();
    const [caseSnapshot, userSnapshot, evidenceSnapshot] = await Promise.all([
      adminDb.collection("cases").doc(caseId).get(),
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("cases").doc(caseId).collection("evidences").doc(evidenceId).get(),
    ]);
    if (!caseSnapshot.exists || !evidenceSnapshot.exists) return respond("CASE_NOT_FOUND", "Caso ou evidência não encontrado.", 404);
    if (!userSnapshot.exists || !isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, caseSnapshot.data() as LegalCase)) {
      return respond("FORBIDDEN", "Você não tem acesso a esta evidência.", 403);
    }
    const evidenceRef = evidenceSnapshot.ref;
    await evidenceRef.update({ status: "PROCESSING", processingError: null });

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type === "image/png" || file.type === "image/jpeg";
    const extraction = isImage ? null : await extractEvidenceText(buffer, file.type, file.name);
    if (!isImage && (!extraction || !extraction.text)) {
      await evidenceRef.update({ status: "UNSUPPORTED", extractionMethod: file.type === "application/pdf" ? "SCANNED_PDF_OCR_UNAVAILABLE" : "UNSUPPORTED", processingError: "Não foi possível analisar este documento." });
      return respond("EVIDENCE_UNSUPPORTED", "Não foi possível analisar este documento.", 422);
    }
    if (!process.env.OPENAI_API_KEY) {
      await evidenceRef.update({ status: "UPLOADED", processingError: "Análise de IA não configurada." });
      return respond("AI_UNAVAILABLE", "A análise automática não está configurada neste ambiente.", 503);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = isImage
      ? [
          { type: "text", text: "Extraia e analise somente o conteúdo visível desta evidência." },
          { type: "image_url", image_url: { url: `data:${file.type};base64,${buffer.toString("base64")}`, detail: "high" } },
        ]
      : [{ type: "text", text: `EVIDENCIA_NAO_CONFIAVEL\n${extraction!.text}\nFIM_EVIDENCIA` }];
    const completion = await openai.chat.completions.parse({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages: [{ role: "system", content: EVIDENCE_SYSTEM_PROMPT }, { role: "user", content }],
      response_format: zodResponseFormat(EvidenceAnalysisSchema, "evidence_analysis"),
    });
    const analysis = completion.choices[0]?.message.parsed;
    if (!analysis) throw new Error("invalid_ai_response");

    await evidenceRef.update({
      status: "PROCESSED",
      extractedText: extraction?.text || "",
      extractionMethod: isImage ? "OPENAI_VISION" : extraction?.method,
      analysis,
      confidence: analysis.confidence,
      processedAt: new Date(),
      processingError: null,
    });
    return NextResponse.json({ status: "PROCESSED", analysis, truncated: extraction?.truncated ?? false });
  } catch (error) {
    logger.error("evidence_processing_failed", { uid, errorType: error instanceof Error ? error.name : "unknown" });
    return respond("AI_UNAVAILABLE", "Não foi possível processar a evidência.", 503);
  }
}
