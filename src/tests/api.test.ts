import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
const getCase = vi.fn();
const getUser = vi.fn();
const setMessage = vi.fn();
const parseAi = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => ({
        get: () => name === "cases" ? getCase(id) : getUser(id),
      }),
    }),
  }),
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { parse: parseAi } };
  },
}));

vi.mock("openai/helpers/zod", () => ({ zodResponseFormat: () => ({ type: "json_schema" }) }));

function caseSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists,
    data: () => data,
    ref: {
      collection: () => ({
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
        orderBy: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
        doc: () => ({ set: setMessage }),
      }),
    },
  };
}

function request(token?: string, caseId = "CASE12345") {
  return new Request("http://localhost/api/chat/jurisbot", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ caseId, messages: [{ role: "user", content: "Relato fictício para teste." }] }),
  });
}

describe("POST /api/chat/jurisbot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === "invalid") throw new Error("invalid");
      return { uid: token };
    });
    getUser.mockResolvedValue({ exists: true, data: () => ({ role: "CITIZEN" }) });
    parseAi.mockResolvedValue({ choices: [{ message: { parsed: { reply: "Pergunta seguinte", structuredData: null } } }] });
    setMessage.mockResolvedValue(undefined);
  });

  it("retorna 401 sem token", async () => {
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request())).status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("invalid"))).status).toBe(401);
  });

  it("retorna 404 para caso inexistente", async () => {
    getCase.mockResolvedValue(caseSnapshot({}, false));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-a"))).status).toBe(404);
  });

  it("retorna 403 para caso alheio sem chamar IA", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-b" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    expect((await POST(request("citizen-a"))).status).toBe(403);
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("retorna 200 para o cidadão proprietário com OpenAI mockada", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-a", originalStory: "Teste", status: "TRIAGEM" }));
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-a"));
    expect({ status: response.status, body: await response.json(), parseCalls: parseAi.mock.calls.length, messageCalls: setMessage.mock.calls.length }).toEqual({ status: 200, body: { reply: "Pergunta seguinte", structuredData: null }, parseCalls: 1, messageCalls: 1 });
  });

  it.each([
    [401, "invalid_api_key", "AI_AUTHENTICATION_FAILED", 503],
    [429, "credit_balance_exhausted", "AI_QUOTA_EXCEEDED", 503],
    [500, "server_error", "AI_UPSTREAM_ERROR", 503],
  ])("classifica erro OpenAI %i sem expor detalhes", async (upstreamStatus, code, expectedError, expectedStatus) => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-a", originalStory: "Teste", status: "TRIAGEM" }));
    parseAi.mockRejectedValueOnce({ status: upstreamStatus, code, request_id: "req-test" });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-a"));
    const body = await response.json();
    expect({ status: response.status, error: body.error }).toEqual({ status: expectedStatus, error: expectedError });
    expect(JSON.stringify(body)).not.toContain(code);
  });

  it("rejeita resposta estruturada malformada sem persistir mensagem", async () => {
    getCase.mockResolvedValue(caseSnapshot({ citizenId: "citizen-a", originalStory: "Teste", status: "TRIAGEM" }));
    parseAi.mockResolvedValueOnce({ choices: [{ message: { parsed: null } }] });
    const { POST } = await import("@/app/api/chat/jurisbot/route");
    const response = await POST(request("citizen-a"));
    expect({ status: response.status, body: await response.json(), messageCalls: setMessage.mock.calls.length }).toEqual({
      status: 502,
      body: { error: "AI_INVALID_RESPONSE", message: "Não foi possível validar a resposta do JurisBot." },
      messageCalls: 0,
    });
  });
});
