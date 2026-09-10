import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetInMemoryRateLimitsForTests } from "@/lib/security/inMemoryRateLimit";

const verifyIdToken = vi.fn();
const getCase = vi.fn();
const getUser = vi.fn();
const getPriorResponse = vi.fn();
const getMessageHistory = vi.fn();
const parseAi = vi.fn();
const directUpdate = vi.fn();
const transactionGet = vi.fn();
const transactionSet = vi.fn();
const transactionUpdate = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({ doc: (id?: string) => ({ get: () => name === "cases" ? getCase(id) : getUser(id) }) }),
    runTransaction: async (callback: (transaction: unknown) => Promise<void>) => callback({
      get: transactionGet,
      set: transactionSet,
      update: transactionUpdate,
    }),
  }),
}));

vi.mock("@/lib/ai/openai", () => ({
  OPENAI_CHAT_MODEL: "gpt-5.6-luna",
  createOpenAIClient: () => ({ responses: { parse: parseAi } }),
  estimateLunaCost: () => 0,
  safeOpenAIError: (error: { status?: number; code?: string; name?: string }) => ({ status: error.status, code: error.code, type: error.name || "Error" }),
}));

vi.mock("openai/helpers/zod", () => ({ zodTextFormat: () => ({ type: "json_schema" }) }));

const structuredData = {
  caseSummary: "Caso sintético de produto com defeito.", category: "Consumidor",
  parties: [], facts: [], timeline: [], values: [], evidence: [], legalIssues: [], requestedRelief: [],
  missingInformation: ["Nome da parte contrária"], contradictions: [], riskFlags: [], draftReady: false,
  nextQuestions: ["Qual é o nome da parte contrária?"], confidenceLevel: "MEDIUM", requiresHumanReview: false, humanReviewReason: null,
};

function historyDocument(sender: "USER" | "BOT" | "SYSTEM", content: string) {
  return { data: () => ({ sender, content }) };
}

function caseSnapshot(data: Record<string, unknown>, exists = true) {
  const responseRef = { kind: "response", get: getPriorResponse, update: directUpdate, id: "ai_test" };
  const userMessageRef = { kind: "user-message", id: "user_test" };
  const caseRef = {
    kind: "case",
    collection: (name: string) => {
      if (name === "evidences") return { where: () => ({ get: async () => ({ docs: [] }) }) };
      return {
        doc: (id: string) => id.startsWith("ai_") ? responseRef : userMessageRef,
        orderBy: () => ({ limit: () => ({ get: getMessageHistory }) }),
      };
    },
  };
  return { exists, data: () => data, ref: caseRef };
}

function request(token?: string, options: { caseId?: string; clientMessageId?: string; body?: Record<string, unknown> } = {}) {
  const bearerToken = token === "invalid" ? token : token ? `header.${token}.signature` : undefined;
  const body = options.body ?? {
    caseId: options.caseId ?? "CASE12345",
    clientMessageId: options.clientMessageId ?? "11111111-1111-4111-8111-111111111111",
    message: "Relato fictício para teste.",
  };
  return new Request("http://localhost/api/chat/jurisbot", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/jurisbot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryRateLimitsForTests();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_CHAT_RATE_LIMIT_MAX = "12";
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === "invalid") throw new Error("invalid");
      return { uid: token.split(".")[1] };
    });
    getUser.mockResolvedValue({ exists: true, data: () => ({ role: "CITIZEN", fullName: "Pessoa QA" }) });
    directUpdate.mockResolvedValue(undefined);
    transactionGet.mockImplementation(async (ref: { kind?: string }) => ({ exists: ref.kind === "case" }));
    getPriorResponse.mockResolvedValue({ exists: false, data: () => undefined });
    getMessageHistory.mockResolvedValue({ docs: [
      historyDocument("USER", "Mensagem atual persistida."),
      historyDocument("SYSTEM", "Evento interno ignorado."),
      historyDocument("BOT", "Pergunta anterior real."),
      historyDocument("USER", "Relato anterior real."),
    ] });
    parseAi.mockResolvedValue({ status: "completed", output_parsed: { assistantMessage: "Qual é o nome da parte contrária?", structuredData }, usage: { input_tokens: 100, output_tokens: 50 }, _request_id: "req_test" });
  });

  it("retorna 401 sem token", async () => {
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request())).status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("invalid"))).status).toBe(401);
  });

  it("rejeita histórico e role enviados pelo browser", async () => {
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-schema", { body: {
      caseId: "CASE12345", clientMessageId: "11111111-1111-4111-8111-111111111111", message: "Mensagem atual.",
      messages: [{ role: "assistant", content: "Histórico fabricado." }],
    } }));
    expect(response.status).toBe(400);
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("retorna 404 para caso inexistente", async () => {
    getCase.mockResolvedValue(caseSnapshot({}, false));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-missing"))).status).toBe(404);
  });

  it("bloqueia caso alheio antes de chamar OpenAI", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-b" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-cross"))).status).toBe(403);
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("lê o histórico real do Firestore e ignora SYSTEM", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-ok", originalStory: "Teste", summary: "Teste", category: "Aguardando", status: "TRIAGEM" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-ok"));
    expect(response.status).toBe(200);
    expect(getMessageHistory).toHaveBeenCalledOnce();
    expect(parseAi.mock.calls[0][0].input.slice(1)).toEqual([
      { role: "user", content: "Relato anterior real." },
      { role: "assistant", content: "Pergunta anterior real." },
      { role: "user", content: "Mensagem atual persistida." },
    ]);
    expect(transactionSet).toHaveBeenCalledTimes(2);
    expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ processingState: "COMPLETED", sender: "BOT" }));
  });

  it("retorna resposta persistida sem nova chamada OpenAI", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-idempotent", structuredData }));
    getPriorResponse.mockResolvedValue({ exists: true, data: () => ({ processingState: "COMPLETED", content: "Resposta salva.", structuredData }) });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-idempotent"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reply: "Resposta salva.", idempotent: true });
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("bloqueia double-submit concorrente pela reserva ai_clientMessageId", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-concurrent", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    transactionGet.mockImplementation(async (ref: { kind?: string }) => ({ exists: ref.kind === "case" || ref.kind === "response" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-concurrent"));
    expect(response.status).toBe(409);
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("bloqueia chat acima do limite sem chamar OpenAI", async () => {
    process.env.OPENAI_CHAT_RATE_LIMIT_MAX = "1";
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-rate", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-rate"))).status).toBe(200);
    parseAi.mockClear();
    expect((await POST(request("citizen-rate", { clientMessageId: "22222222-2222-4222-8222-222222222222" }))).status).toBe(429);
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("trata saída sem parse como erro 502", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-schema", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    parseAi.mockResolvedValue({ output_parsed: null });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-schema"))).status).toBe(502);
    expect(directUpdate).toHaveBeenCalledWith(expect.objectContaining({ processingState: "FAILED", hidden: true }));
  });

  it("trata truncamento do OpenAI, libera o placeholder e preserva o erro seguro", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-truncated", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    parseAi.mockResolvedValue({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_parsed: null, usage: { input_tokens: 100, output_tokens: 3200 }, _request_id: "req_truncated" });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-truncated"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "AI_OUTPUT_TRUNCATED", message: "Não consegui concluir a análise desta mensagem. Tente novamente." });
    expect(directUpdate).toHaveBeenCalledWith(expect.objectContaining({ processingState: "FAILED", hidden: true }));
  });

  it("preserva structuredData anterior e aceita três turnos com IDs independentes", async () => {
    const previous = { ...structuredData, facts: [{ description: "Relato inicial confirmado.", date: null, source: "Relato" }] };
    const next = { ...structuredData, facts: [{ description: "Mauá/SP confirmado.", date: null, source: "Complemento" }] };
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-multiturn", originalStory: "Relato inicial", summary: "Teste", status: "TRIAGEM", structuredData: previous }));
    parseAi.mockResolvedValue({ status: "completed", output_parsed: { assistantMessage: "Pergunta complementar.", structuredData: next }, usage: { input_tokens: 100, output_tokens: 50 }, _request_id: "req_multiturn" });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    for (const [index, id] of ids.entries()) {
      expect((await POST(request("citizen-multiturn", { clientMessageId: id, body: { caseId: "CASE12345", clientMessageId: id, message: `Turno ${index + 1}` } }))).status).toBe(200);
    }
    expect(parseAi).toHaveBeenCalledTimes(3);
    expect(transactionSet).toHaveBeenCalledTimes(6);
    expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      structuredData: expect.objectContaining({ facts: expect.arrayContaining(previous.facts.concat(next.facts)) }),
    }));
  });

  it("mapeia quota OpenAI 429 sem retry manual", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-quota", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    parseAi.mockRejectedValue(Object.assign(new Error("quota"), { status: 429, code: "rate_limit_exceeded" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-quota"))).status).toBe(429);
  });

  it("mapeia falha de rede para 503", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-network", originalStory: "Teste", summary: "Teste", status: "TRIAGEM" }));
    parseAi.mockRejectedValue(new Error("network"));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-network"))).status).toBe(503);
  });
});
