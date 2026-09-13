import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminConfigurationStatus } from "@/lib/firebase/admin";
import { ArtifactError, readCompleteArtifact, type CompleteArtifact } from "@/lib/drafts/completeArtifact";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import type { DraftVersion, Evidence, LegalCase, UserProfile } from "@/types";
import { buildCompleteArtifact } from "@/lib/drafts/buildCompleteArtifact";
import { OriginalError } from "@/lib/evidence/originals";
import { renderArtifactPage } from "@/lib/drafts/renderArtifactPage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string; version: string }> }) {
  const { caseId, version } = await params;
  if (!/^JF-[A-Za-z0-9-]{4,76}$/.test(caseId) || !/^[1-9]\d{0,3}$/.test(version)) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (getAdminConfigurationStatus() !== "configured") return NextResponse.json({ error: "FIREBASE_NOT_CONFIGURED" }, { status: 503 });
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(token.slice(7).trim())).uid; }
  catch { return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sua sessão não pôde ser validada. Entre novamente." }, { status: 401 }); }
  try {
    // No arbitrary PDF, body, path or recipient is accepted from the browser.
    if ((await request.text()).trim()) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
    const db = getAdminDb();
    const [caseDoc, userDoc] = await Promise.all([db.collection("cases").doc(caseId).get(), db.collection("users").doc(uid).get()]);
    if (!caseDoc.exists) return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (!userDoc.exists || !isAuthorizedForCase(uid, userDoc.data() as UserProfile, caseDoc.data() as LegalCase)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const meta = await buildCompleteArtifact(db, caseId, Number(version));
    return NextResponse.json({ version: meta.version, evidenceCount: meta.evidenceCount ?? meta.imageCount, annexPages: meta.imageCount });
  } catch (error) {
    const code = error instanceof ArtifactError || error instanceof OriginalError ? error.code : "DOCUMENT_BUILD_FAILED";
    const message = error instanceof OriginalError ? error.message
      : code === "EVIDENCE_ANNEX_FORMAT_UNSUPPORTED" ? "Para anexar o conteúdo visual, envie esta evidência em PDF, JPG ou PNG. Nenhum arquivo será omitido silenciosamente."
      : code === "DRAFT_EVIDENCE_REVISION_REQUIRED" ? "As evidências atuais ainda não constam no texto. Solicite uma nova versão antes de montar o documento."
      : code === "EVIDENCES_NOT_READY" ? "Conclua o processamento de todas as evidências antes de montar o documento."
      : "Não foi possível montar o documento completo desta versão. Tente montar novamente, sem gerar outra minuta.";
    return NextResponse.json({ error: code, message }, { status: code === "DRAFT_NOT_FOUND" ? 404 : error instanceof ArtifactError || error instanceof OriginalError ? 409 : 503 });
  }
}
export async function GET(request: Request, { params }: { params: Promise<{ caseId: string; version: string }> }) {
  const { caseId, version } = await params;
  if (!/^JF-[A-Za-z0-9-]{4,76}$/.test(caseId) || !/^[1-9]\d{0,3}$/.test(version)) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sua sessão não pôde ser validada. Entre novamente." }, { status: 401 });
  if (getAdminConfigurationStatus() !== "configured") return NextResponse.json({ error: "FIREBASE_NOT_CONFIGURED" }, { status: 503 });
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(token.slice(7).trim())).uid; }
  catch { return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sua sessão não pôde ser validada. Entre novamente." }, { status: 401 }); }
  const format = new URL(request.url).searchParams.get("format");
  const page = new URL(request.url).searchParams.get("page") || "1";
  if ((format !== "pdf" && format !== "docx" && format !== "page") || (format === "page" && !/^[1-9]\d{0,2}$/.test(page))) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  try {
    const db = getAdminDb(); const ref = db.collection("cases").doc(caseId);
    const [caseDoc, userDoc] = await Promise.all([ref.get(), db.collection("users").doc(uid).get()]);
    if (!caseDoc.exists) return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (!userDoc.exists || !isAuthorizedForCase(uid, userDoc.data() as UserProfile, caseDoc.data() as LegalCase)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const [draftDoc, artifactDoc, evidenceDocs] = await Promise.all([ref.collection("drafts").doc(`v${version}`).get(), ref.collection("draftArtifacts").doc(`v${version}`).get(), ref.collection("evidences").get()]);
    if (!draftDoc.exists || !artifactDoc.exists) return NextResponse.json({ error: "DRAFT_ARTIFACT_REQUIRED", message: "Monte o documento completo desta versão com as evidências preservadas no caso." }, { status: 409 });
    const draft = draftDoc.data() as DraftVersion;
    if (draft.caseId !== caseId || draft.version !== Number(version)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const records = evidenceDocs.docs.map((doc) => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
    if (records.some((record) => record.caseId !== caseId)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const bytes = await readCompleteArtifact(artifactDoc.data() as CompleteArtifact, draft, records, format === "page" ? "pdf" : format);
    if (format === "page") {
      const preview = await renderArtifactPage(bytes, Number(page));
      return new NextResponse(new Uint8Array(preview.bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Document-Pages": String(preview.pages), "X-First-Annex-Page": String(preview.firstAnnexPage || "") } });
    }
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="peticao-inicial-${caseId}-v${version}-com-evidencias.${format}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ArtifactError ? error.code : "ARTIFACT_UNAVAILABLE", message: "Não foi possível recuperar o documento completo desta versão." }, { status: error instanceof ArtifactError ? 409 : 503 });
  }
}
