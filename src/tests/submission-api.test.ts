import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LegalCase, DraftVersion, Evidence } from "@/types";

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  tail: Promise.resolve(),
  verify: vi.fn(), send: vi.fn(), pdf: vi.fn(), getMessageId: vi.fn(),
  artifactRead: vi.fn(),
  adminStatus: "configured", failFinalization: false,
}));
vi.mock("@/lib/firebase/admin", () => ({ getAdminConfigurationStatus: () => state.adminStatus, getAdminAuth: () => ({ verifyIdToken: state.verify }), getAdminDb: () => fakeDb }));
vi.mock("@/lib/email/sendEmail", async (original) => ({ ...(await original<typeof import("@/lib/email/sendEmail")>()), sendEmail: (...args: unknown[]) => state.send(...args), getSentEmailMessageId: (...args: unknown[]) => state.getMessageId(...args) }));
vi.mock("@/lib/pdf/generateDraftPdf", () => ({ generateDraftPdf: (...args: unknown[]) => state.pdf(...args) }));
vi.mock("@/lib/drafts/completeArtifact", async (original) => ({ ...(await original<typeof import("@/lib/drafts/completeArtifact")>()), readCompleteArtifact: (...args: unknown[]) => state.artifactRead(...args) }));

function snapshot(path: string) { return { id: path.split("/").at(-1)!, exists: state.docs.has(path), data: () => state.docs.get(path) }; }
function document(path: string) { return { id: path.split("/").at(-1)!, path, get: async () => snapshot(path), collection: (name: string) => collection(`${path}/${name}`) }; }
function collection(path: string) {
  const query = { path, query: true, limit: () => query, get: async () => ({ docs: [...state.docs.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).map(snapshot).sort((a, b) => new Date(b.data()!.createdAt as string).getTime() - new Date(a.data()!.createdAt as string).getTime()) }) };
  return { ...query, doc: (id: string) => document(`${path}/${id}`), orderBy: () => query };
}
const fakeDb = {
  collection,
  runTransaction: <T,>(callback: (tx: { get: (ref: { path: string }) => Promise<ReturnType<typeof snapshot>>; set: (ref: { path: string }, data: Record<string, unknown>) => void; update: (ref: { path: string }, data: Record<string, unknown>) => void }) => Promise<T>) => {
    const run = state.tail.then(async () => {
      const writes: { path: string; data: Record<string, unknown>; merge: boolean }[] = [];
      const result = await callback({ get: async (ref) => ({ ...snapshot(ref.path), docs: "query" in ref ? (await collection(ref.path).get()).docs : [] }), set: (ref, data) => { writes.push({ path: ref.path, data, merge: false }); }, update: (ref, data) => { writes.push({ path: ref.path, data, merge: true }); } });
      if (state.failFinalization && writes.some((write) => write.data.status === "SENT")) throw new Error("Simulated persistence outage");
      writes.forEach((write) => state.docs.set(write.path, write.merge ? { ...state.docs.get(write.path), ...write.data } : write.data));
      return result;
    });
    state.tail = run.then(() => undefined, () => undefined);
    return run;
  },
};

const caseId = "JF-2026-QAEMAIL";
const key = "11111111-1111-4111-8111-111111111111";
const key2 = "22222222-2222-4222-8222-222222222222";
const body = { approvedDraftId: "v2", copyEmail: "citizen.qa@example.com", acknowledgment: true, idempotencyKey: key };
const context = { params: Promise.resolve({ caseId }) };
const request = (changes: Record<string, unknown> = {}, token: string | null = "valid") => new Request(`http://localhost/api/cases/${caseId}/submission/test-email`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...body, ...changes }),
});
async function post(changes: Record<string, unknown> = {}, token: string | null = "valid") { return (await import("@/app/api/cases/[caseId]/submission/test-email/route")).POST(request(changes, token), context); }
const stored = () => state.docs.get(`cases/${caseId}/submissions/${key}`)!;

beforeEach(async () => {
  vi.clearAllMocks();
  state.docs.clear(); state.tail = Promise.resolve(); state.adminStatus = "configured"; state.failFinalization = false;
  vi.stubEnv("FORUM_SUBMISSION_MODE", "test"); vi.stubEnv("FORUM_TEST_RECIPIENT", "forum.qa@example.com"); vi.stubEnv("RESEND_FROM", "JusFacil <sender@example.com>");
  state.verify.mockResolvedValue({ uid: "citizen-a" });
  state.send.mockResolvedValue({ providerMessageId: "provider-qa-id" });
  state.getMessageId.mockResolvedValue("<previous@resend.dev>");
  const actual = await vi.importActual<typeof import("@/lib/pdf/generateDraftPdf")>("@/lib/pdf/generateDraftPdf");
  state.pdf.mockImplementation((legalCase: LegalCase, draft: DraftVersion, evidences: Evidence[]) => actual.generateDraftPdf(legalCase, draft, evidences));
  state.docs.set("users/citizen-a", { role: "CITIZEN" });
  state.docs.set(`cases/${caseId}`, { caseId, citizenId: "citizen-a", currentDraftVersion: 2, approvedVersion: 2, status: "MINUTA_APROVADA" });
  state.docs.set(`cases/${caseId}/drafts/v2`, { caseId, version: 2, approved: true, content: "FATOS CONFIRMADOS V2\nDOS DOCUMENTOS E EVIDENCIAS\nDocumento 01 confirmado.", createdAt: "2026-09-12T00:00:00.000Z" });
  state.docs.set(`cases/${caseId}/drafts/v1`, { caseId, version: 1, approved: true, content: "VERSAO ANTIGA V1", createdAt: "2026-09-11T00:00:00.000Z" });
});
afterEach(() => vi.unstubAllEnvs());

describe("envio exclusivamente de teste — provedor mockado, zero e-mails reais", () => {
  const parentKey = "33333333-3333-4333-8333-333333333333";
  const parentProviderId = "44444444-4444-4444-8444-444444444444";
  function addParent(changes: Record<string, unknown> = {}) {
    state.docs.set(`cases/${caseId}/submissions/${parentKey}`, { type: "TEST_EMAIL", recipientMode: "TEST", status: "SENT", draftId: "v1", draftVersion: 1, createdBy: "citizen-a", provider: "resend", providerMessageId: parentProviderId, copyEmail: body.copyEmail, createdAt: "2026-09-11T00:00:00Z", ...changes });
  }
  it("responde ao envio anterior com PDF aprovado atual e Message-ID RFC, sem alterar o parent", async () => {
    addParent(); const before = structuredClone(state.docs.get(`cases/${caseId}/submissions/${parentKey}`));
    expect((await post({ replyToSubmissionId: parentKey })).status).toBe(200);
    expect(state.getMessageId).toHaveBeenCalledWith(parentProviderId, `[JusFácil — TESTE] Petição Inicial — ${caseId}`);
    expect(state.send.mock.calls[0][0]).toMatchObject({ subject: `Re: [JusFácil — TESTE] Petição Inicial — ${caseId}`, thread: { inReplyTo: "<previous@resend.dev>", references: ["<previous@resend.dev>"] }, text: expect.stringContaining("substitui a Versão 1") });
    expect(state.send.mock.calls[0][0].attachments[0].filename).toContain("v2.pdf");
    expect(stored()).toMatchObject({ status: "SENT", replyToSubmissionId: parentKey, replyToDraftVersion: 1, thread: { inReplyTo: "<previous@resend.dev>" } });
    expect(state.docs.get(`cases/${caseId}/submissions/${parentKey}`)).toEqual(before);
  });
  it("preserva References da conversa e não duplica Re", async () => {
    addParent({ emailSubject: `Re: [JusFácil — TESTE] Petição Inicial — ${caseId}`, thread: { inReplyTo: "<root@resend.dev>", references: ["<root@resend.dev>"] } });
    await post({ replyToSubmissionId: parentKey }); expect(state.send.mock.calls[0][0].thread.references).toEqual(["<root@resend.dev>", "<previous@resend.dev>"]); expect(state.send.mock.calls[0][0].subject).not.toContain("Re: Re:");
  });
  it.each([{ status: "FAILED" }, { status: "PENDING" }, { createdBy: "citizen-b" }, { draftVersion: 2, draftId: "v2" }, { provider: "other" }, { emailSubject: "Other case" }])("parent inválido não consulta provedor nem envia %j", async (changes) => {
    addParent(changes); expect((await post({ replyToSubmissionId: parentKey })).status).toBe(409); expect(state.getMessageId).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  });
  it("parent em outro caso ou inexistente é bloqueado", async () => {
    addParent(); state.docs.set(`cases/JF-2026-OTHER/submissions/${parentKey}`, state.docs.get(`cases/${caseId}/submissions/${parentKey}`)!); state.docs.delete(`cases/${caseId}/submissions/${parentKey}`);
    expect((await post({ replyToSubmissionId: parentKey })).status).toBe(409); expect(state.send).not.toHaveBeenCalled(); expect(state.getMessageId).not.toHaveBeenCalled();
  });
  it("browser não pode fornecer Message-ID, subject ou headers", async () => {
    for (const changes of [{ headers: { "In-Reply-To": "attacker" } }, { messageId: "arbitrary" }, { subject: "arbitrary" }, { replyToSubmissionId: "../other" }]) expect((await post(changes)).status).toBe(400);
    expect(state.send).not.toHaveBeenCalled(); expect(state.getMessageId).not.toHaveBeenCalled();
  });
  it("falha na referência persiste FAILED e nunca envia como e-mail novo", async () => {
    addParent(); const { EmailProviderError } = await import("@/lib/email/sendEmail"); state.getMessageId.mockRejectedValue(new EmailProviderError("EMAIL_THREAD_UNAVAILABLE"));
    const response = await post({ replyToSubmissionId: parentKey }); expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ error: "EMAIL_THREAD_UNAVAILABLE" }); expect(stored().status).toBe("FAILED"); expect(state.send).not.toHaveBeenCalled();
  });
  it("resposta concorrente e replay geram apenas uma consulta e um envio", async () => {
    addParent(); await Promise.all([post({ replyToSubmissionId: parentKey }), post({ replyToSubmissionId: parentKey, idempotencyKey: key2 })]); await post({ replyToSubmissionId: parentKey });
    expect(state.send).toHaveBeenCalledOnce(); expect(state.getMessageId).toHaveBeenCalledOnce();
  });
  it("retry conserva headers congelados e tentativa FAILED anterior", async () => {
    addParent(); state.send.mockRejectedValueOnce(new Error("timeout")); await post({ replyToSubmissionId: parentKey });
    state.getMessageId.mockResolvedValue("<changed@resend.dev>"); await post({ replyToSubmissionId: parentKey, idempotencyKey: key2 });
    expect(state.getMessageId).toHaveBeenCalledOnce(); expect(state.send.mock.calls[0][0]).toEqual(state.send.mock.calls[1][0]); expect(stored().status).toBe("FAILED");
  });
  it("não move nem reenvia uma versão SENT avulsa ao escolher resposta depois", async () => {
    addParent(); await post(); const response = await post({ replyToSubmissionId: parentKey, idempotencyKey: key2 }); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "SUBMISSION_THREAD_CONFLICT" }); expect(state.send).toHaveBeenCalledOnce(); expect(state.getMessageId).not.toHaveBeenCalled();
  });
  it("401 sem token", async () => { expect((await post({}, null)).status).toBe(401); expect(state.send).not.toHaveBeenCalled(); });
  it("401 com token inválido", async () => { state.verify.mockRejectedValue(new Error("invalid")); expect((await post()).status).toBe(401); expect(state.send).not.toHaveBeenCalled(); });
  it("503 para Admin indisponível, sem disfarçar erro como sessão inválida", async () => { state.adminStatus = "not_configured"; expect((await post()).status).toBe(503); expect(state.send).not.toHaveBeenCalled(); });
  it("403 para cidadão errado", async () => { state.docs.get(`cases/${caseId}`)!.citizenId = "citizen-b"; expect((await post()).status).toBe(403); expect(state.send).not.toHaveBeenCalled(); });
  it("403 para papel advogado, mesmo com ownership", async () => { state.docs.set("users/citizen-a", { role: "LAWYER" }); expect((await post()).status).toBe(403); expect(state.send).not.toHaveBeenCalled(); });
  it("404 para caso inexistente", async () => { state.docs.delete(`cases/${caseId}`); expect((await post()).status).toBe(404); expect(state.send).not.toHaveBeenCalled(); });
  it("404 para draft inexistente", async () => { state.docs.delete(`cases/${caseId}/drafts/v2`); expect((await post()).status).toBe(404); expect(state.send).not.toHaveBeenCalled(); });
  it("409 para draft não aprovado", async () => { state.docs.get(`cases/${caseId}/drafts/v2`)!.approved = false; const response = await post(); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "DRAFT_APPROVAL_REQUIRED" }); expect(state.send).not.toHaveBeenCalled(); });
  it("409 para versão antiga, mesmo que aprovada", async () => { expect((await post({ approvedDraftId: "v1" })).status).toBe(409); expect(state.send).not.toHaveBeenCalled(); });
  it("409 quando nova versão aguarda aprovação", async () => { Object.assign(state.docs.get(`cases/${caseId}`)!, { status: "AGUARDANDO_REVISAO", currentDraftVersion: 3 }); expect((await post()).status).toBe(409); expect(state.send).not.toHaveBeenCalled(); });
  it("V3 revisada só envia após aprovação, sem reutilizar envio SENT da V2", async () => {
    expect((await post()).status).toBe(200); const oldSubmission = structuredClone(stored());
    state.docs.set(`cases/${caseId}/drafts/v3`, { caseId, version: 3, approved: false, content: "PECA REVISADA V3 — VALOR DA CAUSA R$ 3.000,00", createdAt: "2026-09-13T00:00:00Z" });
    Object.assign(state.docs.get(`cases/${caseId}`)!, { currentDraftVersion: 3, status: "AGUARDANDO_REVISAO" });
    expect((await post({ approvedDraftId: "v3", idempotencyKey: key2 })).status).toBe(409); expect(state.send).toHaveBeenCalledOnce();
    Object.assign(state.docs.get(`cases/${caseId}`)!, { approvedVersion: 3, status: "MINUTA_APROVADA" }); state.docs.get(`cases/${caseId}/drafts/v3`)!.approved = true;
    expect((await post({ approvedDraftId: "v3", idempotencyKey: key2 })).status).toBe(200); expect(state.send).toHaveBeenCalledTimes(2);
    expect(state.send.mock.calls[1][0].attachments[0].filename).toBe(`peticao-inicial-${caseId}-v3.pdf`);
    expect(state.send.mock.calls[1][0].attachments[0].content.toString("latin1")).toContain("PECA REVISADA V3");
    expect(state.docs.get(`cases/${caseId}/submissions/${key2}`)).toMatchObject({ status: "SENT", draftVersion: 3 }); expect(stored()).toEqual(oldSubmission);
  });
  it("403 para draft apontando a outro caso", async () => { state.docs.get(`cases/${caseId}/drafts/v2`)!.caseId = "JF-OTHER-CASE"; expect((await post()).status).toBe(403); expect(state.send).not.toHaveBeenCalled(); });
  it.each([false, "true", null, undefined])("bloqueia ciência diferente de true: %s", async (acknowledgment) => { expect((await post({ acknowledgment })).status).toBe(400); expect(state.send).not.toHaveBeenCalled(); });
  it.each(["", "invalid", "a\r\n@example.com", `${"x".repeat(255)}@example.com`])("400 para e-mail inválido", async (copyEmail) => { expect((await post({ copyEmail })).status).toBe(400); expect(state.send).not.toHaveBeenCalled(); });
  it.each(["production", "real-court", ""])("mode %s bloqueado", async (mode) => { vi.stubEnv("FORUM_SUBMISSION_MODE", mode); const response = await post(); expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: "SUBMISSION_MODE_DISABLED" }); expect(state.send).not.toHaveBeenCalled(); });
  it("bloqueia destinatário de teste não configurado", async () => { vi.stubEnv("FORUM_TEST_RECIPIENT", ""); expect((await post()).status).toBe(503); expect(state.send).not.toHaveBeenCalled(); });
  it.each([{ to: "attacker@example.com" }, { pdf: "arbitrary" }, { content: "arbitrary legal text" }])("rejeita campos arbitrários do browser", async (changes) => { expect((await post(changes)).status).toBe(400); expect(state.send).not.toHaveBeenCalled(); });
  it("success: TO do ambiente, CC trim, PDF da versão persistida, SENT e status jurídico intacto", async () => {
    const legalStatus = state.docs.get(`cases/${caseId}`)!.status;
    const response = await post({ copyEmail: "  citizen.qa@example.com  " });
    expect(response.status).toBe(200);
    expect(state.pdf).toHaveBeenCalledWith(expect.objectContaining({ caseId }), expect.objectContaining({ version: 2, content: expect.stringContaining("FATOS CONFIRMADOS V2") }), []);
    const message = state.send.mock.calls[0][0];
    expect(message).toMatchObject({ to: "forum.qa@example.com", cc: "citizen.qa@example.com", subject: expect.stringContaining("TESTE"), text: expect.stringContaining("não representa protocolo judicial") });
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toMatchObject({ filename: `peticao-inicial-${caseId}-v2.pdf`, contentType: "application/pdf" });
    const pdfText = message.attachments[0].content.toString("latin1");
    expect(pdfText).toMatch(/^%PDF-/); expect(pdfText).toContain("FATOS CONFIRMADOS V2"); expect(pdfText).not.toContain("VERSAO ANTIGA V1");
    expect(stored()).toMatchObject({ status: "SENT", draftId: "v2", draftVersion: 2, createdBy: "citizen-a", provider: "resend", copyRecipientDeduplicated: false, providerMessageId: "provider-qa-id", sentAt: expect.any(Date) });
    expect(state.docs.get(`cases/${caseId}`)!.status).toBe(legalStatus);
  });
  it("reserva PENDING antes da chamada ao provedor", async () => { state.send.mockImplementation(async () => { expect(stored().status).toBe("PENDING"); return { providerMessageId: "qa" }; }); expect((await post()).status).toBe(200); });
  function addEvidence(changes: Record<string, unknown> = {}) {
    state.docs.set(`cases/${caseId}/evidences/e1`, { evidenceId: "e1", caseId, originalName: "01-imagem.jpg", mimeType: "image/jpeg", size: 120,
      status: "PROCESSED", uploadedAt: "2026-09-11T23:00:00.000Z", uploadedBy: "citizen-a", order: 1, reference: "01", title: "Imagem fornecida para QA", ...changes });
  }
  async function addArtifact() {
    const { artifactBinding, artifactHash } = await import("@/lib/drafts/completeArtifact");
    const records = (await collection(`cases/${caseId}/evidences`).get()).docs.map(doc => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
    const draft = state.docs.get(`cases/${caseId}/drafts/v2`) as unknown as DraftVersion;
    const bytes = Buffer.from(`%PDF-1.7\nFULL_APPROVED_ARTIFACT_WITH_IMAGE\n${draft.content}\n${records.map(item => item.title).join("\n")}`);
    const meta = { id: "a".repeat(64), caseId, version: 2, binding: artifactBinding(draft, records), pdfHash: artifactHash(bytes), docxHash: "b".repeat(64), imageCount: records.length, pdfBytes: bytes.length, docxBytes: 50, zipHash: "c".repeat(64) };
    state.docs.set(`cases/${caseId}/draftArtifacts/v2`, meta); state.artifactRead.mockResolvedValue(bytes);
    return bytes;
  }
  it("anexa o índice de evidências persistidas do caso e registra snapshot da entrega", async () => {
    addEvidence(); await addArtifact(); expect((await post()).status).toBe(200);
    expect(state.pdf).not.toHaveBeenCalled(); expect(state.artifactRead).toHaveBeenCalledOnce();
    expect(state.send.mock.calls[0][0].attachments[0].content.toString("latin1")).toContain("Imagem fornecida para QA");
    expect(stored().evidenceIndex).toEqual([expect.objectContaining({ evidenceId: "e1" })]);
    expect(stored().evidenceFingerprint).toEqual(expect.any(String));
  });
  it("409 para evidência adicionada depois da minuta, sem e-mail ou nova submission", async () => {
    addEvidence({ uploadedAt: "2026-09-12T01:00:00.000Z" });
    const response = await post(); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "DRAFT_EVIDENCE_REVISION_REQUIRED" });
    expect(state.send).not.toHaveBeenCalled(); expect(stored()).toBeUndefined();
  });
  it("409 para minuta sem seção de documentos mesmo se aprovada", async () => {
    addEvidence(); state.docs.get(`cases/${caseId}/drafts/v2`)!.content = "MINUTA ANTIGA SEM DOCUMENTOS";
    expect((await post()).status).toBe(409); expect(state.send).not.toHaveBeenCalled();
  });
  it.each(["", "invalid"])("bloqueia data de evidência não verificável %s", async (uploadedAt) => {
    addEvidence({ uploadedAt }); expect((await post()).status).toBe(409); expect(state.send).not.toHaveBeenCalled();
  });
  it("403 para evidência que aponta a outro caso", async () => {
    addEvidence({ caseId: "JF-2026-OTHER" }); expect((await post()).status).toBe(403); expect(state.send).not.toHaveBeenCalled();
  });
  it("retry de entrega incerta bloqueado se o índice foi editado", async () => {
    addEvidence(); await addArtifact(); state.send.mockRejectedValueOnce(new Error("timeout")); await post();
    addEvidence({ title: "Outro título" }); expect((await post({ idempotencyKey: key2 })).status).toBe(409); expect(state.send).toHaveBeenCalledOnce();
  });
  it("replay SENT conserva o envio antigo mesmo com evidências posteriores, sem reenvio", async () => {
    await post(); addEvidence({ uploadedAt: "2026-09-12T01:00:00.000Z" });
    expect((await post()).status).toBe(200); expect((await post({ idempotencyKey: key2 })).status).toBe(200);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it("bloqueia imagens sem artefato completo, sem fallback para índice e sem submission", async () => {
    addEvidence(); const response = await post(); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "DRAFT_ARTIFACT_REQUIRED" });
    expect(state.pdf).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled(); expect(stored()).toBeUndefined();
  });
  it("anexa exatamente os bytes completos da versão aprovada e registra hash/imagens", async () => {
    addEvidence(); const bytes = await addArtifact(); expect((await post()).status).toBe(200);
    expect(state.send.mock.calls[0][0].attachments[0].content).toEqual(bytes); expect(stored()).toMatchObject({ attachedImageCount: 1, completeArtifactId: "a".repeat(64), attachedPdfHash: expect.any(String) });
  });
  it("bloqueia artefato de outro caso", async () => {
    addEvidence(); await addArtifact(); state.docs.get(`cases/${caseId}/draftArtifacts/v2`)!.caseId = "JF-OTHER-CASE";
    expect((await post()).status).toBe(409); expect(state.send).not.toHaveBeenCalled();
  });
  it("bloqueia artefato após alteração do conteúdo persistido", async () => {
    addEvidence(); await addArtifact(); state.docs.get(`cases/${caseId}/drafts/v2`)!.content += " EDIT";
    expect((await post()).status).toBe(409); expect(state.send).not.toHaveBeenCalled();
  });
  it("artefato ausente em disco falha sem enviar nem usar fallback", async () => {
    addEvidence(); await addArtifact(); const { ArtifactError } = await import("@/lib/drafts/completeArtifact"); state.artifactRead.mockRejectedValue(new ArtifactError("DRAFT_ARTIFACT_MISSING"));
    expect((await post()).status).toBe(502); expect(stored().status).toBe("FAILED"); expect(state.send).not.toHaveBeenCalled(); expect(state.pdf).not.toHaveBeenCalled();
  });
  const download = async (format = "pdf", token: string | null = "valid") => (await import("@/app/api/cases/[caseId]/drafts/[version]/artifact/route")).GET(
    new Request(`http://localhost/api/cases/${caseId}/drafts/2/artifact?format=${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    { params: Promise.resolve({ caseId, version: "2" }) });
  it("download completo exige token, sem envio de email", async () => { expect((await download("pdf", null)).status).toBe(401); expect(state.artifactRead).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled(); });
  it("download completo rejeita outro cidadão", async () => { state.verify.mockResolvedValue({ uid: "citizen-b" }); state.docs.set("users/citizen-b", { role: "CITIZEN" }); expect((await download()).status).toBe(403); expect(state.artifactRead).not.toHaveBeenCalled(); });
  it("download completo sem arquivo não faz fallback", async () => { expect((await download()).status).toBe(409); expect(state.pdf).not.toHaveBeenCalled(); });
  it.each(["pdf", "docx"])("download %s recupera a mesma versão persistida, inclusive antes da aprovação", async (format) => {
    addEvidence(); const bytes = await addArtifact(); state.docs.get(`cases/${caseId}/drafts/v2`)!.approved = false;
    const response = await download(format); expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(state.artifactRead.mock.calls[0][3]).toBe(format); expect(state.send).not.toHaveBeenCalled(); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("download inválido e Admin indisponível distinguem configuração de sessão", async () => {
    expect((await download("../../secret")).status).toBe(400); state.adminStatus = "invalid";
    expect((await download()).status).toBe(503);
  });
  it("registra deduplicação quando a cópia corresponde ao TO", async () => { expect((await post({ copyEmail: "forum.qa@example.com" })).status).toBe(200); expect(stored().copyRecipientDeduplicated).toBe(true); });
  it("idempotência: replay não envia novamente", async () => { await post(); const second = await post(); expect(second.status).toBe(200); expect(await second.json()).toMatchObject({ idempotent: true, submission: { status: "SENT" } }); expect(state.send).toHaveBeenCalledOnce(); });
  it("double submit concorrente com a mesma chave envia só uma vez", async () => { await Promise.all([post(), post()]); expect(state.send).toHaveBeenCalledOnce(); });
  it("double submit concorrente com chaves diferentes envia só uma vez", async () => { await Promise.all([post(), post({ idempotencyKey: key2 })]); expect(state.send).toHaveBeenCalledOnce(); });
  it("refresh/nova chave depois de SENT não inicia uma segunda entrega", async () => { await post(); await post({ idempotencyKey: key2 }); expect(state.send).toHaveBeenCalledOnce(); });
  it("SENT com nova chave e outro CC retorna 409, não sucesso antigo nem nova submission", async () => {
    await post(); const before = JSON.stringify(stored());
    const response = await post({ idempotencyKey: key2, copyEmail: "craftofgames@gmail.com" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "SUBMISSION_COPY_EMAIL_CONFLICT", message: expect.stringContaining("Nenhum novo e-mail foi enviado") });
    expect(state.send).toHaveBeenCalledOnce(); expect(JSON.stringify(stored())).toBe(before);
    expect(state.docs.has(`cases/${caseId}/submissions/${key2}`)).toBe(false);
    expect(state.docs.get(`cases/${caseId}/submissionLocks/v2`)!.status).toBe("SENT");
  });
  it("PENDING com outro CC bloqueia sem iniciar uma segunda chamada ao provedor", async () => {
    state.failFinalization = true; await post();
    const response = await post({ idempotencyKey: key2, copyEmail: "other@example.com" });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: "SUBMISSION_COPY_EMAIL_CONFLICT" });
    expect(state.send).toHaveBeenCalledOnce(); expect(stored().status).toBe("PENDING");
    expect(state.docs.has(`cases/${caseId}/submissions/${key2}`)).toBe(false);
  });
  it("SENT com mesmo CC e nova chave explica que nenhum novo e-mail foi enviado", async () => {
    await post(); const response = await post({ idempotencyKey: key2 });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotent: true, message: expect.stringContaining("Nenhum novo e-mail"), submission: { copyEmail: "citizen.qa@example.com" } });
    expect(state.send).toHaveBeenCalledOnce();
  });
  it("comparação do CC da trava normaliza caixa e trim, preservando destinatário gravado", async () => {
    await post(); const response = await post({ idempotencyKey: key2, copyEmail: "  CITIZEN.QA@example.com  " });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ idempotent: true });
    expect(state.send).toHaveBeenCalledOnce(); expect(stored().copyEmail).toBe("citizen.qa@example.com");
  });
  it("replay com corpo alterado gera conflito, não envia", async () => { await post(); expect((await post({ copyEmail: "other@example.com" })).status).toBe(409); expect(state.send).toHaveBeenCalledOnce(); });
  it("provider error persiste FAILED sem segredos/erro bruto", async () => {
    state.send.mockRejectedValue(new Error("secret from provider must never appear"));
    const response = await post(); expect(response.status).toBe(502);
    expect(stored()).toMatchObject({ status: "FAILED", errorCode: "EMAIL_DELIVERY_UNKNOWN" }); expect(stored().sentAt).toBeUndefined();
    expect(JSON.stringify(stored())).not.toContain("secret"); expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
  it("retry explícito cria nova tentativa e conserva FAILED anterior", async () => {
    const { EmailProviderError } = await import("@/lib/email/sendEmail");
    state.send.mockRejectedValueOnce(new EmailProviderError("EMAIL_PROVIDER_REJECTED")); await post();
    expect((await post()).status).toBe(409); expect(state.send).toHaveBeenCalledTimes(1);
    expect((await post({ idempotencyKey: key2 })).status).toBe(200);
    expect(stored().status).toBe("FAILED"); expect(state.docs.get(`cases/${caseId}/submissions/${key2}`)!.status).toBe("SENT");
    expect(state.send.mock.calls[0][0].idempotencyKey).toBe(state.send.mock.calls[1][0].idempotencyKey);
    expect(state.send.mock.calls[0][0].attachments[0].content).toEqual(state.send.mock.calls[1][0].attachments[0].content);
  });
  it("não repete entrega incerta fora da janela de deduplicação do provedor", async () => {
    state.send.mockRejectedValue(new Error("timeout")); await post();
    state.docs.get(`cases/${caseId}/submissionLocks/v2`)!.deliveryCreatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect((await post({ idempotencyKey: key2 })).status).toBe(409); expect(state.send).toHaveBeenCalledOnce();
  });
  it("PDF vazio bloqueia provedor e persiste FAILED", async () => {
    state.pdf.mockReturnValue({ setCreationDate: vi.fn(), setFileId: vi.fn(), output: () => new ArrayBuffer(0) });
    expect((await post()).status).toBe(502); expect(state.send).not.toHaveBeenCalled(); expect(stored()).toMatchObject({ status: "FAILED", errorCode: "PDF_INVALID" });
  });
  it("falha Firestore depois da aceitação nunca resulta em segundo e-mail", async () => {
    state.failFinalization = true; expect((await post()).status).toBe(503); expect(stored().status).toBe("PENDING");
    expect((await post({ idempotencyKey: key2 })).status).toBe(202); expect(state.send).toHaveBeenCalledOnce();
  });
  it("GET histórico autenticado persiste após recarregar e não expõe destino/provedor", async () => {
    await post();
    const { GET } = await import("@/app/api/cases/[caseId]/submission/test-email/route");
    const response = await GET(new Request("http://localhost", { headers: { Authorization: "Bearer valid" } }), context);
    const data = await response.json(); expect(response.status).toBe(200); expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0]).toMatchObject({ status: "SENT", draftVersion: 2 });
    expect(data.submissions[0].providerMessageId).toBeUndefined(); expect(JSON.stringify(data)).not.toContain("forum.qa@example.com");
    state.verify.mockResolvedValue({ uid: "citizen-b" }); expect((await GET(new Request("http://localhost", { headers: { Authorization: "Bearer valid" } }), context)).status).toBe(403);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(401);
  });
});
