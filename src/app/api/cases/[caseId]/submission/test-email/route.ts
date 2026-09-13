import { NextResponse } from "next/server";
import { getAdminAuth, getAdminConfigurationStatus, getAdminDb } from "@/lib/firebase/admin";
import { CaseIdSchema, SubmissionRequestSchema } from "@/lib/submission/shared";
import { publicSubmission, SubmissionError, submitTestEmail } from "@/lib/submission/server";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ caseId: string }> };
const headers = { "Cache-Control": "private, no-store" };

async function authenticate(request: Request): Promise<string> {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new SubmissionError("AUTH_REQUIRED", 401, "Entre novamente para continuar.");
  if (getAdminConfigurationStatus() !== "configured") throw new SubmissionError("FIREBASE_ADMIN_NOT_CONFIGURED", 503, "O serviço de autenticação está indisponível.");
  try {
    return (await getAdminAuth().verifyIdToken(match[1])).uid;
  } catch {
    throw new SubmissionError("AUTH_REQUIRED", 401, "Sua sessão não pôde ser validada. Entre novamente.");
  }
}

function failure(error: unknown) {
  if (error instanceof SubmissionError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers });
  // Não expõe resposta bruta do provedor, credenciais, conteúdo jurídico ou dados do cidadão.
  return NextResponse.json({ error: "SUBMISSION_UNAVAILABLE", message: "Não foi possível confirmar o envio. Verifique o histórico antes de tentar novamente." }, { status: 503, headers });
}

export async function POST(request: Request, { params }: Context) {
  try {
    const uid = await authenticate(request);
    const { caseId } = await params;
    if (!CaseIdSchema.safeParse(caseId).success) throw new SubmissionError("VALIDATION_ERROR", 400, "Caso inválido.");
    // Limita antes de JSON.parse, inclusive para requests sem Content-Length confiável.
    if (Number(request.headers.get("content-length")) > 4096) throw new SubmissionError("VALIDATION_ERROR", 400, "Confirmação inválida.");
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) throw new SubmissionError("VALIDATION_ERROR", 400, "Confirmação inválida.");
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new SubmissionError("VALIDATION_ERROR", 400, "Confirmação inválida."); }
    const parsed = SubmissionRequestSchema.safeParse(json);
    if (!parsed.success) throw new SubmissionError("VALIDATION_ERROR", 400, "Confirme um e-mail válido e marque a ciência do envio de teste.");
    const result = await submitTestEmail(getAdminDb(), uid, caseId, parsed.data);
    const { status, ...body } = result;
    return NextResponse.json(body, { status, headers });
  } catch (error) { return failure(error); }
}

export async function GET(request: Request, { params }: Context) {
  try {
    const uid = await authenticate(request);
    const { caseId } = await params;
    if (!CaseIdSchema.safeParse(caseId).success) throw new SubmissionError("VALIDATION_ERROR", 400, "Caso inválido.");
    const db = getAdminDb();
    const caseRef = db.collection("cases").doc(caseId);
    const [legalCase, profile] = await Promise.all([caseRef.get(), db.collection("users").doc(uid).get()]);
    if (!legalCase.exists) throw new SubmissionError("CASE_NOT_FOUND", 404, "Caso não encontrado.");
    if (legalCase.data()!.citizenId !== uid || !profile.exists || profile.data()!.role !== "CITIZEN") throw new SubmissionError("FORBIDDEN", 403, "Histórico não disponível para este usuário.");
    const snapshot = await caseRef.collection("submissions").orderBy("createdAt", "desc").limit(50).get();
    return NextResponse.json({ submissions: snapshot.docs.map((doc) => publicSubmission(doc.id, doc.data())) }, { headers });
  } catch (error) { return failure(error); }
}
