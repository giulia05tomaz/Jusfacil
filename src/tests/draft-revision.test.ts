import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftRequest, createDraftRequestId } from "@/lib/drafts/revisionClient";
import { revisedClaimValueMatches, revisedPartyNamesMatch } from "@/lib/drafts/revisionValidation";
import { isRevisionConfirmation } from "@/lib/drafts/revisionShared";

const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), verify: vi.fn(), parse: vi.fn(), tail: Promise.resolve(), reviewAllowed: true }));
vi.mock("@/lib/firebase/admin", () => ({ getAdminAuth: () => ({ verifyIdToken: state.verify }), getAdminDb: () => db }));
vi.mock("@/lib/ai/openai", () => ({ createOpenAIClient: () => ({ responses: { parse: state.parse } }), OPENAI_DRAFT_MODEL: "mock-existing-model", estimateLunaCost: () => 0, safeOpenAIError: (error: { code?: string }) => ({ type: "mock", code: error.code }) }));
vi.mock("@/lib/security/inMemoryRateLimit", () => ({ checkDraftRateLimit: () => ({ allowed: true }), checkChatRateLimit: () => ({ allowed: state.reviewAllowed, retryAfter: 60 }) }));
const caseId = "JF-2026-REVISIONQA";
const reviewId = "11111111-1111-4111-8111-111111111111";
const applyId = "22222222-2222-4222-8222-222222222222";
const requestText = "Alterar o valor da causa para R$ 3.000: R$ 2.000 de restituição e R$ 1.000 de danos materiais já relatados. Confirmo esses pedidos e valores.";
const structured = { caseSummary: "Caso fictício", category: "Consumidor", parties: [], facts: [{ description: "Fato confirmado", date: null, source: "cidadão" }], timeline: [], values: [{ description: "Restituição", amount: 2000, currency: "BRL" }, { description: "Danos materiais relatados", amount: 1000, currency: "BRL" }], claimValue: 2000, evidence: [], legalIssues: [], requestedRelief: ["Restituição de R$ 2.000", "Danos materiais de R$ 1.000"], missingInformation: [], contradictions: [], riskFlags: ["Revisão profissional necessária"], draftReady: true, nextQuestions: [], confidenceLevel: "HIGH", requiresHumanReview: true, humanReviewReason: "Revisar pedidos" };
const proposed = () => ({ advice: "Orientação preliminar: confira a composição dos pedidos com um advogado. Não há garantia de resultado.", ready: true, questions: [], changeSummary: "Valor da causa R$ 3.000 conforme composição confirmada; nenhum dano novo.", structuredData: { ...structured, claimValue: 3000 } });
const aiResponse = (output: unknown) => ({ status: "completed", output_parsed: output, usage: { input_tokens: 10, output_tokens: 20 } });
const revisedContent = `I — DOS FATOS\n${"Fato confirmado. ".repeat(40)}\nII — DOS DOCUMENTOS E EVIDÊNCIAS\nEVIDÊNCIA 01 — Comprovante já anexado\nIII — VALOR DA CAUSA\nDá-se à causa o valor de R$ 3.000,00.\nMinuta para revisão.`;
function document(path: string) {
  return { id: path.split("/").at(-1)!, path, get: async () => snapshot(path), collection: (name: string) => collection(`${path}/${name}`), update: async (data: Record<string, unknown>) => { state.docs.set(path, { ...state.docs.get(path), ...data }); } };
}
function snapshot(path: string) { return { id: path.split("/").at(-1)!, ref: document(path), exists: state.docs.has(path), data: () => state.docs.get(path) }; }
function collection(path: string, filter?: { key: string; value: unknown }, sort?: string, max = Infinity) {
  const query = { doc: (id = "qa-notification") => document(`${path}/${id}`), where: (key: string, _op: string, value: unknown) => collection(path, { key, value }, sort, max), orderBy: (key: string) => collection(path, filter, key, max), limit: (count: number) => collection(path, filter, sort, count),
    get: async (): Promise<{ docs: ReturnType<typeof snapshot>[]; empty: boolean }> => {
      let docs = [...state.docs.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).map(snapshot).filter(item => !filter || item.data()?.[filter.key] === filter.value);
      if (sort) docs = docs.sort((a, b) => Number(b.data()?.[sort] || 0) - Number(a.data()?.[sort] || 0));
      docs = docs.slice(0, max); return { docs, empty: !docs.length };
    } };
  return query;
}
const db = { collection, runTransaction: async <T,>(callback: (tx: { get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>; set: (ref: { path: string }, data: Record<string, unknown>) => void; update: (ref: { path: string }, data: Record<string, unknown>) => void }) => Promise<T>) => {
  const run = state.tail.then(async () => {
    const writes: Array<{ path: string; data: Record<string, unknown>; merge: boolean }> = [];
    const result = await callback({ get: ref => ref.get(), set: (ref, data) => { writes.push({ path: ref.path, data, merge: false }); }, update: (ref, data) => { writes.push({ path: ref.path, data, merge: true }); } });
    for (const write of writes) state.docs.set(write.path, { ...(write.merge ? state.docs.get(write.path) : {}), ...write.data });
    return result;
  }); state.tail = run.then(() => undefined, () => undefined); return run;
} };
const casePath = `cases/${caseId}`;
async function post(changes: Record<string, unknown> = {}, token = true) {
  const { POST } = await import("@/app/api/cases/[caseId]/draft/route");
  return POST(new Request("http://localhost/api/draft", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer token" } : {}) }, body: JSON.stringify({ clientRequestId: reviewId, action: "review_revision", baseVersion: 2, revisionRequest: requestText, ...changes }) }), { params: Promise.resolve({ caseId }) });
}
async function review() { const response = await post(); expect(response.status).toBe(200); return response.json(); }
async function apply(changes: Record<string, unknown> = {}) { return post({ clientRequestId: applyId, action: "revise", reviewId, confirmation: true, ...changes }); }
async function chat(message: string, clientMessageId = reviewId) {
  const { POST } = await import("@/app/api/chat/jurisbot/route");
  return POST(new Request("http://localhost/api/chat/jurisbot", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer header.citizen.signature" }, body: JSON.stringify({ caseId, message, clientMessageId }) }));
}
beforeEach(() => {
  vi.clearAllMocks(); state.docs.clear(); state.tail = Promise.resolve(); state.reviewAllowed = true; vi.stubEnv("OPENAI_API_KEY", "mock-only");
  state.verify.mockResolvedValue({ uid: "citizen-a" }); state.parse.mockResolvedValue(aiResponse(proposed()));
  state.docs.set("users/citizen-a", { role: "CITIZEN" });
  state.docs.set(casePath, { caseId, citizenId: "citizen-a", currentDraftVersion: 2, approvedVersion: 2, status: "MINUTA_APROVADA", structuredData: structured });
  state.docs.set(`${casePath}/drafts/v2`, { caseId, version: 2, approved: true, content: "Peça anterior: valor R$ 2.000", createdAt: new Date(0) });
  state.docs.set(`${casePath}/evidences/e1`, { caseId, evidenceId: "e1", status: "PROCESSED", order: 1, reference: "01", title: "Comprovante", originalName: "01.jpg", original: { id: "retained-original" }, annexOriginal: { id: "retained-annex" } });
  state.docs.set(`${casePath}/submissions/old`, { draftVersion: 2, status: "SENT" });
  state.docs.set(`${casePath}/draftArtifacts/v2`, { pdfHash: "old-pdf", imageCount: 1 });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("revisão orientada — OpenAI mock, nenhum envio real", () => {
  it("sem token: 401, zero AI", async () => { expect((await post({}, false)).status).toBe(401); expect(state.parse).not.toHaveBeenCalled(); });
  it("token inválido: 401", async () => { state.verify.mockRejectedValue(new Error()); expect((await post()).status).toBe(401); });
  it("outro cidadão: 403", async () => { state.docs.get(casePath)!.citizenId = "citizen-b"; expect((await post()).status).toBe(403); expect(state.parse).not.toHaveBeenCalled(); });
  it("caso inexistente: 404", async () => { state.docs.delete(casePath); expect((await post()).status).toBe(404); });
  it("versão antiga: 409 sem AI", async () => { expect((await post({ baseVersion: 1 })).status).toBe(409); expect(state.parse).not.toHaveBeenCalled(); });
  it("orientação respeita limite de triagem sem chamar AI", async () => { state.reviewAllowed = false; const response = await post(); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60"); expect(state.parse).not.toHaveBeenCalled(); });
  it("revisão sem confirmação ou orientação: bloqueada", async () => {
    expect((await apply({ confirmation: false })).status).toBe(400);
    expect((await apply()).status).toBe(409); expect(state.parse).not.toHaveBeenCalled();
  });
  it("orientação é persistida sem mudar caso, peça, aprovação, originais e envio", async () => {
    const before = structuredClone([...state.docs]); const result = await review();
    expect(result).toMatchObject({ ready: true, proposedClaimValue: 3000, baseVersion: 2 });
    for (const [path, data] of before) expect(state.docs.get(path)).toEqual(data);
    expect(state.docs.get(`${casePath}/draftRequests/${reviewId}`)).toMatchObject({ processingState: "COMPLETED", model: "mock-existing-model", inputTokens: 10, outputTokens: 20 });
    expect(state.parse.mock.calls[0][0].instructions).toContain("Não crie danos morais");
  });
  it("valor ambíguo pede composição, preserva dados e bloqueia aplicação", async () => {
    state.parse.mockResolvedValue(aiResponse({ ...proposed(), ready: false, questions: ["Como os R$ 3.000 se distribuem entre seus pedidos?"] }));
    expect(await review()).toMatchObject({ ready: false, proposedClaimValue: null });
    expect(state.docs.get(`${casePath}/draftRequests/${reviewId}`)!.review).toMatchObject({ structuredData: structured });
    expect((await apply()).status).toBe(409); expect(state.parse).toHaveBeenCalledOnce();
  });
  it("não aceita ready=true com lacunas", async () => { state.parse.mockResolvedValue(aiResponse({ ...proposed(), questions: ["Confirme o dano"] })); expect((await post()).status).toBe(502); expect(state.docs.get(casePath)!.currentDraftVersion).toBe(2); });
  it("não aceita alterar a lista estruturada de evidências", async () => { const item = proposed(); item.structuredData.evidence = [{ name: "inexistente" }] as never; state.parse.mockResolvedValue(aiResponse(item)); expect((await post()).status).toBe(502); });
  it("gera V3, atualiza dados e preserva V2 aprovada, evidências e e-mail anterior", async () => {
    await review(); const oldDraft = structuredClone(state.docs.get(`${casePath}/drafts/v2`)); const oldEvidence = structuredClone(state.docs.get(`${casePath}/evidences/e1`));
    state.parse.mockResolvedValue(aiResponse({ content: revisedContent, changeSummary: "Valor corrigido para R$ 3.000" }));
    const response = await apply(); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ version: 3 });
    expect(state.docs.get(`${casePath}/drafts/v3`)).toMatchObject({ version: 3, approved: false, content: revisedContent, structuredData: { claimValue: 3000 }, baseVersion: 2, reviewId });
    expect(state.docs.get(casePath)).toMatchObject({ currentDraftVersion: 3, approvedVersion: 2, status: "AGUARDANDO_REVISAO", structuredData: { claimValue: 3000 } });
    expect(state.docs.get(`${casePath}/drafts/v2`)).toEqual(oldDraft); expect(state.docs.get(`${casePath}/evidences/e1`)).toEqual(oldEvidence);
    expect(state.docs.get(`${casePath}/draftArtifacts/v2`)).toEqual({ pdfHash: "old-pdf", imageCount: 1 }); expect(state.docs.get(`${casePath}/submissions/old`)!.status).toBe("SENT");
    expect(state.parse.mock.calls[1][0].input).toContain('"claimValue":3000');
  });
  it("falha se texto da peça mantém valor antigo, sem V3", async () => { await review(); state.parse.mockResolvedValue(aiResponse({ content: revisedContent.replace("3.000,00", "2.000,00"), changeSummary: "Alterei" })); expect((await apply()).status).toBe(502); expect(state.docs.has(`${casePath}/drafts/v3`)).toBe(false); });
  it("pedido alterado depois da orientação não é aceito", async () => { await review(); expect((await apply({ revisionRequest: "Quero R$ 50.000" })).status).toBe(409); expect(state.parse).toHaveBeenCalledOnce(); });
  it("dados ou evidências mudaram: requer nova orientação", async () => { await review(); state.docs.get(`${casePath}/evidences/e1`)!.title = "Título alterado"; expect((await apply()).status).toBe(409); expect(state.parse).toHaveBeenCalledOnce(); });
  it("corrida durante geração não sobrescreve versão/dados", async () => { await review(); state.parse.mockImplementation(async () => { state.docs.get(casePath)!.currentDraftVersion = 3; return aiResponse({ content: revisedContent, changeSummary: "Alterei" }); }); expect((await apply()).status).toBe(409); expect(state.docs.has(`${casePath}/drafts/v3`)).toBe(false); });
  it("replay da revisão/aplicação é idempotente; mesma chave com outro pedido é rejeitada", async () => {
    await review(); expect((await post()).status).toBe(200); expect(state.parse).toHaveBeenCalledOnce(); expect((await post({ revisionRequest: "Outro pedido" })).status).toBe(409);
    state.parse.mockResolvedValue(aiResponse({ content: revisedContent, changeSummary: "Alterei" })); expect((await apply()).status).toBe(200); expect((await apply()).status).toBe(200); expect(state.parse).toHaveBeenCalledTimes(2);
  });
  it("double submit da mesma chave só chama AI uma vez", async () => { const responses = await Promise.all([post(), post()]); expect(responses.map(item => item.status).sort()).toEqual([200, 409]); expect(state.parse).toHaveBeenCalledOnce(); });
  it("saída inválida/falha AI salva FAILED, não peça fictícia", async () => { state.parse.mockRejectedValue(new Error("Provider unavailable")); expect((await post()).status).toBe(503); expect(state.docs.get(`${casePath}/draftRequests/${reviewId}`)!.processingState).toBe("FAILED"); expect(state.docs.has(`${casePath}/drafts/v3`)).toBe(false); });
  it("falta de minuta anterior não deixa solicitação PROCESSING", async () => { state.docs.delete(`${casePath}/drafts/v2`); expect((await post()).status).toBe(404); expect(state.docs.get(`${casePath}/draftRequests/${reviewId}`)!.processingState).toBe("FAILED"); });
});

describe("chat aciona revisão real — somente mocks", () => {
  const nameRequest = "Mude somente o nome da loja para BH Lavanderias S.A.";
  const newParty = { role: "RE", name: "BH Lavanderias S.A.", document: null, address: null, details: null };
  const nameProposal = () => ({ ...proposed(), changeSummary: "Somente nome da loja corrigido", structuredData: { ...structured, parties: [newParty] } });
  const nameContent = () => revisedContent.replace("3.000,00", "2.000,00") + "\nRé: BH Lavanderias S.A.";
  it.each([25, 66])("revisa caso com %i referências, sem perda e sem copiar catálogo na saída da IA", async count => {
    const evidence = Array.from({ length: count }, (_, index) => ({ evidenceId: `e${index}`, name: `Evidência ${index}`, type: "image/jpeg", summary: "Documento QA", relevantFacts: [], uncertainties: [] }));
    state.docs.get(casePath)!.structuredData = { ...structured, evidence };
    state.parse.mockResolvedValue(aiResponse(nameProposal()));
    expect((await chat(nameRequest)).status).toBe(200);
    expect(state.docs.get(`${casePath}/draftRequests/${reviewId}`)!.review).toMatchObject({ structuredData: { evidence } });
    expect(state.parse.mock.calls[0][0].input).toContain('"evidence":[]');
    state.parse.mockResolvedValue(aiResponse({ content: nameContent(), changeSummary: "Nome corrigido" }));
    expect((await chat("Confirmo", applyId)).status).toBe(200);
    expect(state.docs.get(`${casePath}/drafts/v3`)).toMatchObject({ approved: false, structuredData: { evidence } });
    expect(state.docs.get(casePath)!.structuredData).toMatchObject({ evidence });
  });
  it("pedido no chat persiste proposta honesta, sem mudar V2 ou dados", async () => {
    state.parse.mockResolvedValue(aiResponse(nameProposal()));
    const before = structuredClone(state.docs.get(casePath));
    const response = await chat(nameRequest); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revisionReview: { reviewId, ready: true }, reply: expect.stringContaining("o documento ainda não foi alterado") });
    expect(state.docs.get(casePath)).toEqual(before); expect(state.docs.has(`${casePath}/drafts/v3`)).toBe(false);
    expect(state.docs.get(`${casePath}/messages/revision_${reviewId}`)).toMatchObject({ createdBy: "citizen-a", revisionReview: { revisionRequest: nameRequest } });
  });
  it("confirmar no chat salva V3 com nome novo; replay não cria V4", async () => {
    state.parse.mockResolvedValue(aiResponse(nameProposal())); await chat(nameRequest);
    state.parse.mockResolvedValue(aiResponse({ content: nameContent(), changeSummary: "Nome corrigido" }));
    expect((await chat("Confirmo a alteração", applyId)).status).toBe(200);
    expect(state.docs.get(`${casePath}/drafts/v3`)).toMatchObject({ approved: false, content: nameContent(), structuredData: { claimValue: 2000, parties: [newParty] } });
    expect(state.docs.get(`${casePath}/drafts/v2`)!.approved).toBe(true);
    expect(state.docs.get(`${casePath}/evidences/e1`)!.original).toEqual({ id: "retained-original" });
    expect((await chat("Confirmo a alteração", applyId)).status).toBe(200);
    expect(state.parse).toHaveBeenCalledTimes(2); expect(state.docs.has(`${casePath}/drafts/v4`)).toBe(false);
    expect((await chat("Outro pedido", applyId)).status).toBe(409);
  });
  it("nova revisão da V3 cria V4 sem sobrescrever V3, sem aprovação automática", async () => {
    state.parse.mockResolvedValue(aiResponse(nameProposal())); await chat(nameRequest);
    state.parse.mockResolvedValue(aiResponse({ content: nameContent(), changeSummary: "Nome corrigido" })); await chat("Confirmo", applyId);
    const oldV3 = structuredClone(state.docs.get(`${casePath}/drafts/v3`));
    const nextReview = "33333333-3333-4333-8333-333333333333";
    const nextApply = "44444444-4444-4444-8444-444444444444";
    state.parse.mockResolvedValue(aiResponse(nameProposal())); expect((await chat("Corrija apenas a grafia do nome da loja", nextReview)).status).toBe(200);
    state.parse.mockResolvedValue(aiResponse({ content: nameContent() + "\nGrafia conferida.", changeSummary: "Grafia conferida" }));
    expect((await chat("Pode aplicar", nextApply)).status).toBe(200);
    expect(state.docs.get(`${casePath}/drafts/v4`)).toMatchObject({ version: 4, approved: false, baseVersion: 3 });
    expect(state.docs.get(`${casePath}/drafts/v3`)).toEqual(oldV3);
    expect(state.docs.get(casePath)!.approvedVersion).toBe(2);
  });
  it("confirmação sem proposta pronta não gera documento", async () => {
    expect((await chat("Confirmo", applyId)).status).toBe(409); expect(state.parse).not.toHaveBeenCalled();
  });
  it("texto antigo sem nome confirmado é rejeitado sem criar V3", async () => {
    state.parse.mockResolvedValue(aiResponse(nameProposal())); await chat(nameRequest);
    state.parse.mockResolvedValue(aiResponse({ content: revisedContent.replace("3.000,00", "2.000,00"), changeSummary: "Nome corrigido" }));
    expect((await chat("Confirmo", applyId)).status).toBe(502); expect(state.docs.has(`${casePath}/drafts/v3`)).toBe(false);
  });
  it("snapshot da minuta atual prevalece sobre proposta não aplicada no caso", async () => {
    state.docs.get(`${casePath}/drafts/v2`)!.structuredData = structured;
    state.docs.get(casePath)!.structuredData = { ...structured, claimValue: 3000 };
    state.parse.mockResolvedValue(aiResponse(nameProposal())); await chat(nameRequest);
    expect(state.parse.mock.calls[0][0].input).toContain('"claimValue":2000');
  });
  it("normaliza nome, mas não aceita documento que só tem o nome antigo", () => {
    expect(revisedPartyNamesMatch("BH Lavanderias SA", [newParty])).toBe(true);
    expect(revisedPartyNamesMatch("Loja Horizonte Ltda.", [newParty])).toBe(false);
  });
  it("confirmação precisa ser explícita, não negativa ou dúvida", () => {
    expect(isRevisionConfirmation("Confirmo a alteração")).toBe(true);
    expect(isRevisionConfirmation("Não confirmo")).toBe(false);
    expect(isRevisionConfirmation("Você confirma a alteração?")).toBe(false);
  });
});

describe("HTTP local e consistência do valor", () => {
  it("UUID funciona sem crypto.randomUUID", () => { vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => { bytes.fill(123); return bytes; } }); expect(createDraftRequestId()).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); });
  it("401 renova token uma vez, conservando solicitação e chave", async () => { const token = vi.fn().mockResolvedValue("token"); const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ version: 3 })); vi.stubGlobal("fetch", fetcher); await draftRequest({ getIdToken: token }, caseId, { clientRequestId: applyId }); expect(token.mock.calls).toEqual([[false], [true]]); expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body); });
  it.each(["3.000,00", "3000,00", "3,000.00"])("valida formatação brasileira suportada %s", (value) => { expect(revisedClaimValueMatches(`VALOR DA CAUSA\nR$ ${value}`, 3000)).toBe(value !== "3,000.00"); });
  it("não aceita valor ausente ou contraditório em outro encerramento", () => { expect(revisedClaimValueMatches("Sem valor", 3000)).toBe(false); expect(revisedClaimValueMatches("VALOR DA CAUSA R$ 3.000,00\nDá-se à causa o valor de R$ 2.000,00", 3000)).toBe(false); });
});
