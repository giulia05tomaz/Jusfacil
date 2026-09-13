import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOriginal, retainOriginal } from "@/lib/evidence/originals";
import { ArtifactError } from "@/lib/drafts/completeArtifact";
import { assembleDocument, retrieveDocument } from "@/lib/drafts/documentClient";
import { zipSync, strToU8 } from "fflate";

const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), verify: vi.fn(), build: vi.fn(), analyze: vi.fn(), extract: vi.fn(), status: "configured", tail: Promise.resolve() }));
vi.mock("@/lib/firebase/admin", () => ({ getAdminConfigurationStatus: () => state.status, getAdminAuth: () => ({ verifyIdToken: state.verify }), getAdminDb: () => db }));
vi.mock("@/lib/drafts/buildCompleteArtifact", () => ({ buildCompleteArtifact: (...args: unknown[]) => state.build(...args) }));
vi.mock("@/lib/ai/openai", () => ({ createOpenAIClient: () => ({ responses: { parse: state.analyze } }), estimateLunaCost: () => 0, OPENAI_CHAT_MODEL: "mock", safeOpenAIError: () => ({ type: "mock" }) }));
vi.mock("@/lib/evidence/extract", () => ({ extractEvidenceText: (...args: unknown[]) => state.extract(...args) }));
vi.mock("@/lib/security/inMemoryRateLimit", () => ({ checkEvidenceRateLimit: () => ({ allowed: true }) }));
const caseId = "JF-2026-DOCUMENTQA";
function doc(refPath: string) {
  const ref = { id: refPath.split("/").at(-1)!, path: refPath, collection: (name: string) => collection(`${refPath}/${name}`), get: async () => snapshot(refPath),
    set: async (data: Record<string, unknown>) => { state.docs.set(refPath, data); }, update: async (data: Record<string, unknown>) => { state.docs.set(refPath, { ...state.docs.get(refPath), ...data }); } };
  return ref;
}
function snapshot(refPath: string) { return { id: refPath.split("/").at(-1)!, ref: doc(refPath), exists: state.docs.has(refPath), data: () => state.docs.get(refPath) }; }
function collection(refPath: string, filter?: { key: string; value: unknown }) {
  const query = { path: refPath, query: true, limit: () => query, doc: (id = "qa-notification") => doc(`${refPath}/${id}`), where: (key: string, _op: string, value: unknown) => collection(refPath, { key, value }),
    get: async (): Promise<{ docs: ReturnType<typeof snapshot>[]; size: number; empty: boolean }> => {
      const docs = [...state.docs.keys()].filter((key) => key.startsWith(`${refPath}/`) && !key.slice(refPath.length + 1).includes("/"))
        .map(snapshot).filter((item) => !filter || item.data()?.[filter.key] === filter.value);
      return { docs, size: docs.length, empty: !docs.length };
    } };
  return query;
}
const db = { collection, runTransaction: async <T,>(callback: (tx: { get: (ref: ReturnType<typeof doc> | ReturnType<typeof collection>) => Promise<unknown>; set: (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => void; update: (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => void }) => Promise<T>) => {
  const run = state.tail.then(() => callback({ get: (ref) => ref.get(), set: (ref, data) => { state.docs.set(ref.path, data); }, update: (ref, data) => { state.docs.set(ref.path, { ...state.docs.get(ref.path), ...data }); } }));
  state.tail = run.then(() => undefined, () => undefined);
  return run;
} };
beforeEach(() => {
  vi.clearAllMocks(); state.docs.clear(); state.tail = Promise.resolve(); state.status = "configured";
  state.verify.mockResolvedValue({ uid: "citizen-a" }); state.build.mockResolvedValue({ version: 2, imageCount: 3, evidenceCount: 2 });
  state.docs.set(`cases/${caseId}`, { caseId, citizenId: "citizen-a", currentDraftVersion: 2 }); state.docs.set("users/citizen-a", { role: "CITIZEN" });
  state.extract.mockResolvedValue({ text: "Texto fornecido", method: "MOCK" });
  state.analyze.mockResolvedValue({ output_parsed: { summary: "MOCK", confidence: "LOW" }, usage: {} });
  vi.stubEnv("OPENAI_API_KEY", "test-not-a-real-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const context = { params: Promise.resolve({ caseId, version: "2" }) };
async function assemble(token: string | null = "valid", body?: string) {
  return (await import("@/app/api/cases/[caseId]/drafts/[version]/artifact/route")).POST(new Request("http://localhost/api/artifact", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body }), context);
}
describe("complete document assembly API — no real OpenAI or email", () => {
  it("401 without token", async () => { expect((await assemble(null)).status).toBe(401); expect(state.build).not.toHaveBeenCalled(); });
  it("401 invalid token", async () => { state.verify.mockRejectedValue(new Error()); expect((await assemble()).status).toBe(401); });
  it("503 unconfigured Admin", async () => { state.status = "missing"; expect((await assemble()).status).toBe(503); });
  it("404 missing case", async () => { state.docs.delete(`cases/${caseId}`); expect((await assemble()).status).toBe(404); });
  it("403 other citizen/cross-case", async () => { state.docs.get(`cases/${caseId}`)!.citizenId = "other"; expect((await assemble()).status).toBe(403); expect(state.build).not.toHaveBeenCalled(); });
  it("rejects arbitrary PDF/body/path", async () => { expect((await assemble("valid", JSON.stringify({ pdf: "arbitrary", path: "../" }))).status).toBe(400); expect(state.build).not.toHaveBeenCalled(); });
  it("builds only selected persisted version; no approval", async () => { const response = await assemble(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ version: 2, evidenceCount: 2, annexPages: 3 }); expect(state.build).toHaveBeenCalledWith(db, caseId, 2); expect(state.docs.get(`cases/${caseId}`)!.approvedVersion).toBeUndefined(); expect(state.analyze).not.toHaveBeenCalled(); });
  it("blocks stale version instead of omitting annexes", async () => { state.build.mockRejectedValue(new ArtifactError("DRAFT_EVIDENCE_REVISION_REQUIRED")); expect((await assemble()).status).toBe(409); });
});
describe("private original retention", () => {
  it("keeps exact bytes and identity on repeat", async () => { const bytes = Buffer.from("QA original only"); const meta = await retainOriginal(caseId, "qa-original", bytes, "image/jpeg", "01.jpg"); expect(await readOriginal(meta, caseId, "qa-original")).toEqual(bytes); expect(await retainOriginal(caseId, "qa-original", bytes, "image/jpeg", "01.jpg")).toEqual(meta); });
  it("rejects missing, cross-case and altered metadata", async () => { const meta = await retainOriginal(caseId, "qa-original", Buffer.from("QA"), "application/pdf", "QA.pdf"); await expect(readOriginal(undefined, caseId, "qa-original")).rejects.toThrow(); await expect(readOriginal(meta, "JF-OTHER-CASE", "qa-original")).rejects.toThrow(); await expect(readOriginal({ ...meta, id: "../secret" }, caseId, "qa-original")).rejects.toThrow(); await expect(readOriginal({ ...meta, sha256: "a".repeat(64) }, caseId, "qa-original")).rejects.toThrow(); });
});
describe("client generation/mount/retrieve separation", () => {
  it("assembles missing artifact once then retrieves same version", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "DRAFT_ARTIFACT_REQUIRED" }, { status: 409 })).mockResolvedValueOnce(Response.json({ version: 3 })).mockResolvedValueOnce(new Response("%PDF-QA")); vi.stubGlobal("fetch", fetcher);
    await retrieveDocument({ getIdToken: async () => "token" }, caseId, 3, "pdf");
    expect(fetcher.mock.calls.map((call) => call[1].method)).toEqual(["GET", "POST", "GET"]); expect(fetcher.mock.calls.every((call) => call[0].includes("drafts/3/artifact"))).toBe(true);
  });
  it("refreshes token once on 401", async () => { const token = vi.fn().mockResolvedValue("token"); vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ version: 2 }))); await assembleDocument({ getIdToken: token }, caseId, 2); expect(token.mock.calls).toEqual([[false], [true]]); });
  it("assembly retry never calls draft/AI endpoint", async () => { const fetcher = vi.fn().mockResolvedValue(Response.json({ message: "Missing original" }, { status: 409 })); vi.stubGlobal("fetch", fetcher); await expect(assembleDocument({ getIdToken: async () => "token" }, caseId, 2)).rejects.toThrow("Missing original"); expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0][0]).toContain("/artifact"); });
});
describe("individual and ZIP files become available for future versions", () => {
  it("individual upload retains original, title, order and reference", async () => {
    const form = new FormData(); form.set("caseId", caseId); form.set("evidenceId", "11111111-1111-4111-8111-111111111111"); form.set("title", "Título informado"); form.set("file", new File(["QA image mock"], "01.jpg", { type: "image/jpeg" }));
    const response = await (await import("@/app/api/evidences/process/route")).POST(new Request("http://localhost/api/evidence", { method: "POST", headers: { Authorization: "Bearer valid" }, body: form })); expect(response.status).toBe(200);
    const record = state.docs.get(`cases/${caseId}/evidences/11111111-1111-4111-8111-111111111111`)!; expect(record).toMatchObject({ originalRetained: true, title: "Título informado", order: 1, reference: "01", status: "PROCESSED" }); expect(await readOriginal(record.original as never, caseId, String(record.evidenceId))).toEqual(Buffer.from("QA image mock"));
  });
  it("scanned PDF retained for all-page annexing, without fake OCR/AI", async () => {
    state.extract.mockResolvedValue(null); const form = new FormData(); form.set("caseId", caseId); form.set("evidenceId", "22222222-2222-4222-8222-222222222222"); form.set("file", new File(["%PDF-QA mock"], "scan.pdf", { type: "application/pdf" }));
    const response = await (await import("@/app/api/evidences/process/route")).POST(new Request("http://localhost/api/evidence", { method: "POST", headers: { Authorization: "Bearer valid" }, body: form })); expect(response.status).toBe(200); expect(state.analyze).not.toHaveBeenCalled(); expect(state.docs.get(`cases/${caseId}/evidences/22222222-2222-4222-8222-222222222222`)).toMatchObject({ originalRetained: true, extractionMethod: "SCANNED_PDF_NO_OCR" });
  });
  it("ZIP JPG+PDF becomes one logical original/annex; reupload restores without duplicates", async () => {
    const bytes = Buffer.from(zipSync({ "01_EVIDENCIA_01_QA.jpg": strToU8("QA JPG only"), "01_EVIDENCIA_01_QA.pdf": strToU8("%PDF-QA only") }));
    const manifest = (await import("@/lib/evidence/package")).inspectEvidenceZip(bytes, "QA.zip");
    const upload = async () => { const form = new FormData(); form.set("file", new File([bytes], "QA.zip", { type: "application/zip" })); form.set("manifest", JSON.stringify(manifest)); return (await import("@/app/api/cases/[caseId]/evidence-package/process/route")).POST(new Request("http://localhost/api/package", { method: "POST", headers: { Authorization: "Bearer a.b.c" }, body: form }), { params: Promise.resolve({ caseId }) }); };
    expect((await upload()).status).toBe(200); const records = [...state.docs.values()].filter((item) => item.evidenceId); expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ originalRetained: true, original: { mimeType: "application/pdf" }, annexOriginal: { mimeType: "image/jpeg" } });
    const uploadedAt = records[0].uploadedAt; records[0].originalRetained = false; delete records[0].original; delete records[0].annexOriginal;
    expect((await upload()).status).toBe(200); expect([...state.docs.values()].filter((item) => item.evidenceId)).toHaveLength(1); expect([...state.docs.values()].find((item) => item.evidenceId)!.uploadedAt).toBe(uploadedAt); expect(state.analyze).not.toHaveBeenCalled();
    const current = [...state.docs.values()].find(item => item.evidenceId)!;
    current.packageHash = "same-files-in-a-different-zip-container"; delete current.original; delete current.annexOriginal; current.originalRetained = false;
    expect((await upload()).status).toBe(200); const restored = [...state.docs.values()].find(item => item.evidenceId)!;
    expect(restored.originalRetained).toBe(true); expect(restored.packageHash).toBe("same-files-in-a-different-zip-container");
    expect([...state.docs.values()].filter(item => item.evidenceId)).toHaveLength(1);
  });
});

describe("approval requires the current complete artifact", () => {
  const approve = async () => (await import("@/app/api/cases/[caseId]/drafts/[version]/approve/route")).POST(new Request("http://localhost/api/approve", { method: "POST", headers: { Authorization: "Bearer valid" } }), context);
  beforeEach(() => {
    state.docs.get(`cases/${caseId}`)!.status = "AGUARDANDO_REVISAO";
    state.docs.set(`cases/${caseId}/drafts/v2`, { caseId, version: 2, title: "QA", content: "DOS DOCUMENTOS E EVIDÊNCIAS\nTexto QA", approved: false, createdAt: "2026-09-13T12:00:00Z" });
    state.docs.set(`cases/${caseId}/evidences/e1`, { caseId, evidenceId: "e1", status: "PROCESSED", originalName: "QA.jpg", mimeType: "image/jpeg", size: 20, uploadedBy: "citizen-a", uploadedAt: "2026-09-13T10:00:00Z" });
  });
  it("cannot approve textual references without the complete file", async () => { expect((await approve()).status).toBe(409); expect(state.docs.get(`cases/${caseId}/drafts/v2`)!.approved).toBe(false); });
  it("cannot approve old version while newer one exists", async () => { state.docs.get(`cases/${caseId}`)!.currentDraftVersion = 3; expect((await approve()).status).toBe(409); });
  it("new evidence or failed evidence blocks approval", async () => { state.docs.get(`cases/${caseId}/evidences/e1`)!.uploadedAt = "2026-09-13T13:00:00Z"; expect((await approve()).status).toBe(409); state.docs.get(`cases/${caseId}/evidences/e1`)!.status = "FAILED"; expect((await approve()).status).toBe(409); });
  it("complete artifact permits explicit approval without email or AI", async () => {
    const { storeCompleteArtifact } = await import("@/lib/drafts/completeArtifact");
    const draft = state.docs.get(`cases/${caseId}/drafts/v2`) as unknown as import("@/types").DraftVersion;
    const records = [state.docs.get(`cases/${caseId}/evidences/e1`)] as unknown as import("@/types").Evidence[];
    const meta = await storeCompleteArtifact(draft, records, Buffer.from("%PDF-QA-approved-artifact"), Buffer.from("PK QA"), 1, "qa");
    state.docs.set(`cases/${caseId}/draftArtifacts/v2`, meta as unknown as Record<string, unknown>);
    expect((await approve()).status).toBe(200); expect(state.docs.get(`cases/${caseId}/drafts/v2`)!.approved).toBe(true); expect(state.analyze).not.toHaveBeenCalled();
  });
});
