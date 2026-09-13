import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DraftVersion, Evidence } from "@/types";
import { exportEvidences } from "./evidenceExport";

// Private local persistence, never public/ and never a client-supplied path.
// Deployment requires a durable private store; this adapter targets the local environment.
const root = () => path.join(process.cwd(), ".artifacts");
export const artifactHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function artifactBinding(draft: Pick<DraftVersion, "caseId" | "version" | "content">, records: Evidence[]) {
  return artifactHash(JSON.stringify([draft.caseId, draft.version, draft.content, exportEvidences(records),
    records.map((item) => [item.evidenceId, item.sha256 || ""]).sort((a, b) => a[0].localeCompare(b[0]))]));
}
export const originalBinding = (records: Evidence[]) => artifactHash(JSON.stringify(records.map((record) =>
  [record.evidenceId, record.original?.id || "", record.annexOriginal?.id || ""]).sort((a, b) => a[0].localeCompare(b[0]))));
export interface CompleteArtifact {
  id: string; caseId: string; version: number; binding: string; pdfHash: string; docxHash: string;
  imageCount: number; zipHash: string; pdfBytes: number; docxBytes: number;
  evidenceCount?: number;
  sourceBinding?: string;
}
export class ArtifactError extends Error {
  constructor(public readonly code: string) { super("O documento completo precisa ser montado e revisado para esta versão antes do envio."); }
}
function filePath(id: string, format: "pdf" | "docx") {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ArtifactError("DRAFT_ARTIFACT_INVALID");
  return path.join(root(), `${id}.${format}`);
}
export function validateArtifact(meta: CompleteArtifact, draft: DraftVersion, records: Evidence[]) {
  if (!meta || meta.caseId !== draft.caseId || meta.version !== draft.version || meta.binding !== artifactBinding(draft, records)
    || (meta.evidenceCount ?? meta.imageCount) !== exportEvidences(records).length
    || !Number.isInteger(meta.imageCount) || meta.imageCount < (meta.evidenceCount ?? meta.imageCount)
    || !meta.imageCount || meta.imageCount > 400) throw new ArtifactError("DRAFT_ARTIFACT_STALE");
  if (meta.sourceBinding && meta.sourceBinding !== originalBinding(records)) throw new ArtifactError("DRAFT_ARTIFACT_STALE");
  filePath(meta.id, "pdf");
}
export async function storeCompleteArtifact(draft: DraftVersion, records: Evidence[], pdf: Buffer, docx: Buffer, imageCount: number, zipHash: string, evidenceCount?: number): Promise<CompleteArtifact> {
  if (pdf.length < 5 || pdf.length > 8 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== "%PDF-"
    || docx.length < 4 || docx.length > 20 * 1024 * 1024 || docx.subarray(0, 2).toString() !== "PK") throw new ArtifactError("DRAFT_ARTIFACT_SIZE_INVALID");
  const binding = artifactBinding(draft, records);
  const pdfHash = artifactHash(pdf); const docxHash = artifactHash(docx);
  const id = artifactHash(`${binding}:${pdfHash}:${docxHash}:${zipHash}`);
  const meta = { id, caseId: draft.caseId, version: draft.version, binding, pdfHash, docxHash, imageCount, zipHash, pdfBytes: pdf.length, docxBytes: docx.length, ...(evidenceCount === undefined ? {} : { evidenceCount, sourceBinding: originalBinding(records) }) };
  validateArtifact(meta, draft, records);
  await mkdir(root(), { recursive: true });
  for (const [format, bytes] of [["pdf", pdf], ["docx", docx]] as const) {
    try { await writeFile(filePath(id, format), bytes, { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!bytes.equals(await readFile(filePath(id, format)))) throw new ArtifactError("DRAFT_ARTIFACT_CORRUPT"); }
  }
  return meta;
}
export async function readCompleteArtifact(meta: CompleteArtifact, draft: DraftVersion, records: Evidence[], format: "pdf" | "docx") {
  validateArtifact(meta, draft, records);
  let bytes: Buffer;
  try { bytes = await readFile(filePath(meta.id, format)); } catch { throw new ArtifactError("DRAFT_ARTIFACT_MISSING"); }
  if (artifactHash(bytes) !== (format === "pdf" ? meta.pdfHash : meta.docxHash)
    || bytes.length !== (format === "pdf" ? meta.pdfBytes : meta.docxBytes)) throw new ArtifactError("DRAFT_ARTIFACT_CORRUPT");
  return bytes;
}
