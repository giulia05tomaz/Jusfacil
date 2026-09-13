import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftVersion, Evidence } from "@/types";
import { retainOriginal } from "@/lib/evidence/originals";
import { buildCompleteArtifact } from "@/lib/drafts/buildCompleteArtifact";
import { readCompleteArtifact } from "@/lib/drafts/completeArtifact";

const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), spawn: vi.fn(), manifest: [] as Record<string, unknown>[] }));
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => state.spawn(...args) }));
const caseId = "JF-QA-ASSEMBLY";
function doc(refPath: string) { return { path: refPath, id: refPath.split("/").at(-1)!, get: async () => ({ exists: state.docs.has(refPath), data: () => state.docs.get(refPath) }), collection: (name: string) => collection(`${refPath}/${name}`) }; }
function collection(refPath: string) { return { path: refPath, doc: (id: string) => doc(`${refPath}/${id}`), get: async () => ({ docs: [...state.docs.keys()].filter((key) => key.startsWith(`${refPath}/`) && !key.slice(refPath.length + 1).includes("/")).map((key) => ({ id: key.split("/").at(-1)!, data: () => state.docs.get(key) })) }) }; }
const fake = { collection, runTransaction: async <T,>(callback: (tx: { get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>; set: (ref: { path: string }, data: Record<string, unknown>) => void }) => Promise<T>) => callback({ get: ref => ref.get(), set: (ref, data) => { state.docs.set(ref.path, data); } }) };
const db = fake as unknown as FirebaseFirestore.Firestore;
function draft(version: number): DraftVersion { return { caseId, version, content: `PETIÇÃO QA V${version}\nDOS DOCUMENTOS E EVIDÊNCIAS\nSomente texto sintético.`, title: "QA", createdAt: "2026-09-12T12:00:00Z", approved: false, source: "AI", createdBy: "qa" }; }
async function evidence(id: string, order: number): Promise<Evidence> {
  const original = await retainOriginal(caseId, id, Buffer.from(`Synthetic original ${id}`), "image/jpeg", `${id}.jpg`);
  return { evidenceId: id, caseId, order, reference: String(order).padStart(2, "0"), title: `Título informado ${id}`, status: "PROCESSED", originalName: `${id}.jpg`, mimeType: "image/jpeg", size: original.size, sha256: original.sha256,
    original, annexOriginal: original, originalRetained: true, uploadedAt: "2026-09-12T10:00:00Z", uploadedBy: "qa" };
}
beforeEach(async () => {
  state.docs.clear(); state.spawn.mockReset(); state.manifest = [];
  state.docs.set(`cases/${caseId}/drafts/v2`, draft(2) as unknown as Record<string, unknown>);
  for (const item of [await evidence("qa-two", 2), await evidence("qa-one", 1)]) state.docs.set(`cases/${caseId}/evidences/${item.evidenceId}`, item as unknown as Record<string, unknown>);
  state.spawn.mockImplementation((_executable: string, args: string[]) => {
    const child = new FakeChild();
    queueMicrotask(async () => {
      const { readFile, writeFile } = await import("node:fs/promises");
      state.manifest = JSON.parse(await readFile(args[args.indexOf("--evidence-manifest") + 1], "utf8")).items;
      await writeFile(args[args.indexOf("--output") + 1], Buffer.from("PK synthetic docx"));
      await writeFile(args[args.indexOf("--pdf-output") + 1], Buffer.from(`%PDF-synthetic ${args[args.indexOf("--version") + 1]}`));
      child.stdout.emit("data", Buffer.from(JSON.stringify({ evidenceCount: 2, insertedCount: 2 })));
      child.emit("close", 0);
    });
    return child;
  });
});
import { EventEmitter } from "node:events";
class FakeChild extends EventEmitter { stdout = new EventEmitter(); stderr = new EventEmitter(); kill() {} }
describe("persisted case to immutable complete artifact — Python mocked, no AI/email", () => {
  it("passes all original bytes in citizen order and persists version binding", async () => {
    const meta = await buildCompleteArtifact(db, caseId, 2);
    expect(state.manifest.map(item => item.reference)).toEqual(["01", "02"]);
    expect(meta).toMatchObject({ version: 2, evidenceCount: 2, imageCount: 2 });
    expect(await readCompleteArtifact(meta, draft(2), [...state.docs.values()].filter(item => item.evidenceId) as unknown as Evidence[], "pdf")).toEqual(Buffer.from("%PDF-synthetic 2"));
    expect(state.docs.get(`cases/${caseId}/drafts/v2`)!.approved).toBe(false);
  });
  it("replay/refresh and concurrent mounts invoke Python only once", async () => {
    const [a, b] = await Promise.all([buildCompleteArtifact(db, caseId, 2), buildCompleteArtifact(db, caseId, 2)]);
    expect(a).toEqual(b); expect(await buildCompleteArtifact(db, caseId, 2)).toEqual(a); expect(state.spawn).toHaveBeenCalledOnce();
  });
  it("new version reuses all retained case files without ZIP reupload", async () => {
    const previous = await buildCompleteArtifact(db, caseId, 2);
    state.docs.set(`cases/${caseId}/drafts/v3`, draft(3) as unknown as Record<string, unknown>);
    const next = await buildCompleteArtifact(db, caseId, 3);
    expect(next.version).toBe(3); expect(next.id).not.toBe(previous.id); expect(state.manifest).toHaveLength(2);
    expect(state.docs.get(`cases/${caseId}/draftArtifacts/v2`)).toEqual(previous);
  });
  it("missing legacy originals never fall back to textual references", async () => {
    const item = state.docs.get(`cases/${caseId}/evidences/qa-one`)!; delete item.original; delete item.annexOriginal;
    await expect(buildCompleteArtifact(db, caseId, 2)).rejects.toThrow(); expect(state.spawn).not.toHaveBeenCalled();
  });
  it("new evidence requires new draft; old artifact cannot silently lose it", async () => {
    const item = state.docs.get(`cases/${caseId}/evidences/qa-one`)!; item.uploadedAt = "2026-09-12T13:00:00Z";
    await expect(buildCompleteArtifact(db, caseId, 2)).rejects.toMatchObject({ code: "DRAFT_EVIDENCE_REVISION_REQUIRED" }); expect(state.spawn).not.toHaveBeenCalled();
  });
  it("failed evidence and cross-case original block assembly", async () => {
    state.docs.get(`cases/${caseId}/evidences/qa-one`)!.status = "FAILED";
    await expect(buildCompleteArtifact(db, caseId, 2)).rejects.toMatchObject({ code: "EVIDENCES_NOT_READY" });
    state.docs.get(`cases/${caseId}/evidences/qa-one`)!.status = "PROCESSED"; state.docs.get(`cases/${caseId}/evidences/qa-one`)!.caseId = "JF-OTHER-CASE";
    await expect(buildCompleteArtifact(db, caseId, 2)).rejects.toMatchObject({ code: "DOCUMENT_CASE_MISMATCH" });
  });
});
