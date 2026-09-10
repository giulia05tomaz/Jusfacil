import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { inspectEvidenceZip, ZIP_LIMITS } from "@/lib/evidence/package";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import type { DraftVersion, LegalCase, UserProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function response(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function runPython(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("DOCX_TIMEOUT"));
    }, 110_000);
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8_000) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(stderr.includes("ZIP_") ? stderr : "DOCX_GENERATION_FAILED"));
    });
  });
}

function safeDownloadName(caseId: string, version: number): string {
  return `peticao-inicial-${caseId.replace(/[^A-Za-z0-9_-]/g, "-")}-v${version}-com-evidencias.docx`;
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const caseId = (await params).caseId;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(caseId)) return response("VALIDATION_ERROR", "Identificador de caso inválido.", 400);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return response("AUTH_REQUIRED", "Faça login para continuar.", 401);
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authorization.slice(7).trim())).uid;
  } catch {
    return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401);
  }

  let temporaryDirectory = "";
  try {
    const form = await request.formData();
    const file = form.get("file");
    const requestedVersion = Number.parseInt(String(form.get("version") || ""), 10);
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) return response("VALIDATION_ERROR", "Selecione um arquivo ZIP.", 400);
    if (file.size <= 0 || file.size > ZIP_LIMITS.compressedBytes) return response("VALIDATION_ERROR", "O ZIP deve ter no máximo 50 MB.", 400);

    const db = getAdminDb();
    const [caseSnapshot, userSnapshot] = await Promise.all([
      db.collection("cases").doc(caseId).get(),
      db.collection("users").doc(uid).get(),
    ]);
    if (!caseSnapshot.exists) return response("CASE_NOT_FOUND", "Caso não encontrado.", 404);
    if (!userSnapshot.exists || !isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, caseSnapshot.data() as LegalCase)) {
      return response("FORBIDDEN", "Você não tem acesso a este caso.", 403);
    }

    const version = Number.isInteger(requestedVersion) && requestedVersion > 0
      ? requestedVersion
      : Number(caseSnapshot.data()?.currentDraftVersion || 0);
    if (!version) return response("DRAFT_NOT_FOUND", "Gere uma minuta antes de montar o Word com as evidências.", 409);
    const draftSnapshot = await caseSnapshot.ref.collection("drafts").doc(`v${version}`).get();
    if (!draftSnapshot.exists) return response("DRAFT_NOT_FOUND", "A versão selecionada da minuta não foi encontrada.", 404);
    const draft = draftSnapshot.data() as DraftVersion;

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const manifest = inspectEvidenceZip(zipBuffer, file.name);
    if (!manifest.items.length) return response("ZIP_WITHOUT_EVIDENCE", "O pacote não contém evidências compatíveis.", 400);

    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "jusfacil-docx-"));
    const zipPath = path.join(temporaryDirectory, "evidencias.zip");
    const textPath = path.join(temporaryDirectory, "minuta.txt");
    const outputPath = path.join(temporaryDirectory, "peticao-com-evidencias.docx");
    await Promise.all([
      writeFile(zipPath, zipBuffer),
      writeFile(textPath, draft.content, "utf8"),
    ]);

    const pythonExecutable = process.env.JUSFACIL_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
    const scriptPath = path.join(process.cwd(), "scripts", "append_zip_evidence_to_docx.py");
    await runPython(pythonExecutable, [
      scriptPath,
      "--draft-text", textPath,
      "--zip", zipPath,
      "--output", outputPath,
      "--case-id", caseId,
      "--version", String(version),
    ]);
    const output = await readFile(outputPath);
    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeDownloadName(caseId, version)}"`,
        "Cache-Control": "no-store",
        "X-Evidence-Count": String(manifest.evidenceCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOCX_GENERATION_FAILED";
    if (/ENOENT|not recognized|cannot find/i.test(message)) {
      return response("PYTHON_NOT_CONFIGURED", "A automação do Word ainda não encontrou o Python configurado neste ambiente.", 503);
    }
    if (message.includes("ZIP_")) return response("ZIP_INVALID", "O pacote de evidências não pôde ser processado com segurança.", 400);
    return response("DOCX_GENERATION_FAILED", "Não foi possível montar o Word com as evidências.", 500);
  } finally {
    const safePrefix = path.join(tmpdir(), "jusfacil-docx-");
    if (temporaryDirectory?.startsWith(safePrefix)) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
