import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DraftVersion, Evidence } from "@/types";
import { readOriginal } from "@/lib/evidence/originals";
import { ArtifactError, artifactBinding, artifactHash, originalBinding, readCompleteArtifact, storeCompleteArtifact, type CompleteArtifact } from "./completeArtifact";
import { draftNeedsEvidenceRevision, exportEvidences } from "./evidenceExport";

const builds = new Map<string, Promise<CompleteArtifact>>();
function runPython(args: string[]): Promise<{ insertedCount: number; evidenceCount: number }> {
  return new Promise((resolve, reject) => {
    const executable = process.env.JUSFACIL_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
    // Python is provisioned outside the JS bundle; config traces only our scripts/template.
    const child = spawn(/*turbopackIgnore: true*/ executable, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => { child.kill(); reject(new ArtifactError("DOCUMENT_BUILD_TIMEOUT")); }, 110_000);
    child.stdout.on("data", (chunk: Buffer) => { if (output.length < 8000) output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { if (errors.length < 8000) errors += chunk.toString(); });
    child.on("error", () => { clearTimeout(timeout); reject(new ArtifactError("PYTHON_NOT_CONFIGURED")); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new ArtifactError(errors.includes("EVIDENCE_ANNEX_FORMAT_UNSUPPORTED") ? "EVIDENCE_ANNEX_FORMAT_UNSUPPORTED" : "DOCUMENT_BUILD_FAILED"));
      try {
        const result = JSON.parse(output);
        if (!Number.isInteger(result.insertedCount) || !Number.isInteger(result.evidenceCount)) throw new Error();
        resolve(result);
      } catch { reject(new ArtifactError("DOCUMENT_BUILD_FAILED")); }
    });
  });
}

export async function buildCompleteArtifact(db: FirebaseFirestore.Firestore, caseId: string, version: number): Promise<CompleteArtifact> {
  const key = `${caseId}:${version}`;
  const running = builds.get(key);
  if (running) return running;
  const promise = assemble(db, caseId, version);
  builds.set(key, promise);
  try { return await promise; } finally { if (builds.get(key) === promise) builds.delete(key); }
}

async function assemble(db: FirebaseFirestore.Firestore, caseId: string, version: number): Promise<CompleteArtifact> {
  const caseRef = db.collection("cases").doc(caseId);
  const draftRef = caseRef.collection("drafts").doc(`v${version}`);
  const artifactRef = caseRef.collection("draftArtifacts").doc(`v${version}`);
  const [draftDoc, evidenceDocs, prior] = await Promise.all([draftRef.get(), caseRef.collection("evidences").get(), artifactRef.get()]);
  if (!draftDoc.exists) throw new ArtifactError("DRAFT_NOT_FOUND");
  const draft = draftDoc.data() as DraftVersion;
  const records = evidenceDocs.docs.map((doc) => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
  if (draft.caseId !== caseId || draft.version !== version || records.some((record) => record.caseId !== caseId)) throw new ArtifactError("DOCUMENT_CASE_MISMATCH");
  if (prior.exists) {
    const meta = prior.data() as CompleteArtifact;
    await readCompleteArtifact(meta, draft, records, "pdf");
    await readCompleteArtifact(meta, draft, records, "docx");
    return meta;
  }
  if (!records.length || records.some((record) => record.status !== "PROCESSED")) throw new ArtifactError("EVIDENCES_NOT_READY");
  if (draftNeedsEvidenceRevision(draft, records)) throw new ArtifactError("DRAFT_EVIDENCE_REVISION_REQUIRED");
  const ordered = exportEvidences(records);
  const originals = await Promise.all(ordered.map(async (item) => {
    const record = records.find((value) => value.evidenceId === item.evidenceId)!;
    const meta = record.annexOriginal || record.original;
    const bytes = await readOriginal(meta, caseId, record.evidenceId);
    if (!meta || !["image/png", "image/jpeg", "application/pdf"].includes(meta.mimeType)) throw new ArtifactError("EVIDENCE_ANNEX_FORMAT_UNSUPPORTED");
    return { record, meta, bytes };
  }));
  const directory = await mkdtemp(path.join(tmpdir(), "jusfacil-document-"));
  try {
    const items = await Promise.all(originals.map(async ({ record, meta, bytes }, index) => {
      const file = `original-${index}.bin`;
      await writeFile(path.join(directory, file), bytes, { mode: 0o600 });
      return { file, mimeType: meta.mimeType, sha256: meta.sha256, order: record.order ?? index + 1,
        reference: record.reference || String(index + 1).padStart(2, "0"), title: record.title || record.originalName };
    }));
    await Promise.all([writeFile(path.join(directory, "evidences.json"), JSON.stringify({ items })), writeFile(path.join(directory, "draft.txt"), draft.content, "utf8")]);
    const output = await runPython([path.join(process.cwd(), "scripts", "append_zip_evidence_to_docx.py"),
      "--draft-text", path.join(directory, "draft.txt"), "--evidence-manifest", path.join(directory, "evidences.json"),
      "--output", path.join(directory, "petition.docx"), "--pdf-output", path.join(directory, "petition.pdf"), "--case-id", caseId, "--version", String(version)]);
    if (output.evidenceCount !== records.length) throw new ArtifactError("DOCUMENT_EVIDENCE_COUNT_MISMATCH");
    const meta = await storeCompleteArtifact(draft, records, await readFile(path.join(directory, "petition.pdf")), await readFile(path.join(directory, "petition.docx")),
      output.insertedCount, artifactHash(JSON.stringify(items.map((item) => [item.sha256, item.order, item.reference, item.title]))), output.evidenceCount);
    return await db.runTransaction(async (transaction) => {
      const [freshDraft, freshEvidence, existing] = await Promise.all([transaction.get(draftRef), transaction.get(caseRef.collection("evidences")), transaction.get(artifactRef)]);
      const current = freshEvidence.docs.map((doc) => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
      if (!freshDraft.exists || meta.binding !== artifactBinding(freshDraft.data() as DraftVersion, current)
        || meta.sourceBinding !== originalBinding(current)
        || current.some((record) => record.status !== "PROCESSED")) throw new ArtifactError("DRAFT_ARTIFACT_STALE");
      if (existing.exists) {
        const persisted = existing.data() as CompleteArtifact;
        await readCompleteArtifact(persisted, freshDraft.data() as DraftVersion, current, "pdf");
        return persisted;
      }
      transaction.set(artifactRef, meta);
      return meta;
    });
  } finally {
    // mkdtemp generated this exact child of tmpdir; no user-supplied cleanup path.
    if (directory.startsWith(path.join(tmpdir(), "jusfacil-document-"))) await rm(directory, { recursive: true, force: true });
  }
}
