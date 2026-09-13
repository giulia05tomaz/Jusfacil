import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceOriginal } from "@/types";

// Local private adapter. Never public/, never a path supplied by the browser.
// A deployed installation needs a durable private store, not an ephemeral filesystem.
const root = () => path.join(process.cwd(), ".evidence-originals");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const identity = (meta: Omit<EvidenceOriginal, "id">) => hash(JSON.stringify([
  meta.caseId, meta.evidenceId, meta.sha256, meta.size, meta.mimeType, meta.originalName,
]));
export class OriginalError extends Error {
  constructor(public readonly code: string) {
    super("Os arquivos originais desta evidência não estão disponíveis. Anexe-os novamente antes de montar uma nova versão.");
  }
}
function originalPath(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new OriginalError("EVIDENCE_ORIGINAL_INVALID");
  return path.join(root(), `${id}.bin`);
}
export async function retainOriginal(caseId: string, evidenceId: string, bytes: Buffer, mimeType: string, originalName: string): Promise<EvidenceOriginal> {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(caseId) || !/^[A-Za-z0-9_-]{1,100}$/.test(evidenceId)
    || !bytes.length || bytes.length > 10 * 1024 * 1024) throw new OriginalError("EVIDENCE_ORIGINAL_INVALID");
  const values = { caseId, evidenceId, sha256: hash(bytes), size: bytes.length, mimeType, originalName: originalName.slice(0, 300) };
  const meta = { ...values, id: identity(values) };
  await mkdir(root(), { recursive: true });
  try { await writeFile(originalPath(meta.id), bytes, { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (!bytes.equals(await readFile(originalPath(meta.id)))) throw new OriginalError("EVIDENCE_ORIGINAL_CORRUPT");
  }
  return meta;
}
export async function readOriginal(meta: EvidenceOriginal | undefined, caseId: string, evidenceId: string): Promise<Buffer> {
  if (!meta || meta.caseId !== caseId || meta.evidenceId !== evidenceId || meta.id !== identity(meta)) throw new OriginalError("EVIDENCE_ORIGINAL_INVALID");
  let bytes: Buffer;
  try { bytes = await readFile(originalPath(meta.id)); } catch { throw new OriginalError("EVIDENCE_ORIGINAL_MISSING"); }
  if (bytes.length !== meta.size || hash(bytes) !== meta.sha256) throw new OriginalError("EVIDENCE_ORIGINAL_CORRUPT");
  return bytes;
}
