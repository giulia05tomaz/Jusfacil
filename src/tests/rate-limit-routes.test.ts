import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDraftRateLimit,
  checkEvidenceRateLimit,
  resetInMemoryRateLimitsForTests,
} from "@/lib/security/inMemoryRateLimit";

const verifyIdToken = vi.fn();
const parseAi = vi.fn();
const priorDraftRequest = vi.fn();
const priorEvidence = vi.fn();

const completeStructuredData = {
  caseSummary: "Caso sintético completo.", category: "Consumidor",
  parties: [], facts: [], timeline: [], values: [], evidence: [], legalIssues: [], requestedRelief: [],
  missingInformation: [], contradictions: [], riskFlags: [], draftReady: true, nextQuestions: [],
  confidenceLevel: "HIGH", requiresHumanReview: false, humanReviewReason: null,
};

const requestRef = { get: priorDraftRequest, update: vi.fn(), id: "draft-request" };
const evidenceRef = { get: priorEvidence, update: vi.fn(), id: "evidence-request" };
const caseRef = {
  collection: (name: string) => {
    if (name === "draftRequests") return { doc: () => requestRef };
    if (name === "evidences") return {
      doc: () => evidenceRef,
      limit: () => ({ get: async () => ({ size: 0, docs: [] }) }),
      where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
    };
    if (name === "messages") return { orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
    if (name === "drafts") return { orderBy: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) };
    throw new Error(`Coleção inesperada: ${name}`);
  },
};
const caseSnapshot = {
  exists: true,
  data: () => ({ citizenId: "citizen-rate", summary: "Caso sintético", structuredData: completeStructuredData }),
  ref: caseRef,
};

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: () => name === "cases"
        ? { get: async () => caseSnapshot }
        : { get: async () => ({ exists: true, data: () => ({ role: "CITIZEN" }) }) },
    }),
    runTransaction: vi.fn(),
  }),
}));

vi.mock("@/lib/ai/openai", () => ({
  OPENAI_CHAT_MODEL: "gpt-5.6-luna",
  OPENAI_DRAFT_MODEL: "gpt-5.6-luna",
  createOpenAIClient: () => ({ responses: { parse: parseAi } }),
  estimateLunaCost: () => 0,
  safeOpenAIError: () => ({ type: "Error" }),
}));

vi.mock("openai/helpers/zod", () => ({ zodTextFormat: () => ({ type: "json_schema" }) }));
vi.mock("@/lib/evidence/extract", () => ({ extractEvidenceText: vi.fn() }));

function authHeaders(contentType?: string) {
  return { authorization: "Bearer header.citizen-rate.signature", ...(contentType ? { "content-type": contentType } : {}) };
}

describe("limites temporais dos endpoints pagos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryRateLimitsForTests();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_DRAFT_RATE_LIMIT_MAX = "1";
    process.env.OPENAI_EVIDENCE_RATE_LIMIT_MAX = "1";
    verifyIdToken.mockResolvedValue({ uid: "citizen-rate" });
    priorDraftRequest.mockResolvedValue({ exists: false, data: () => undefined });
    priorEvidence.mockResolvedValue({ exists: false, data: () => undefined });
  });

  it("bloqueia geração de minuta acima do limite sem chamar OpenAI", async () => {
    checkDraftRateLimit("citizen-rate", "CASE12345");
    const { POST } = await import("@/app/api/cases/[caseId]/draft/route");
    const request = new Request("http://localhost/api/cases/CASE12345/draft", {
      method: "POST",
      headers: authHeaders("application/json"),
      body: JSON.stringify({ clientRequestId: "33333333-3333-4333-8333-333333333333", action: "generate" }),
    });
    const response = await POST(request, { params: Promise.resolve({ caseId: "CASE12345" }) });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("reaproveita solicitação de minuta concluída sem chamar OpenAI", async () => {
    priorDraftRequest.mockResolvedValue({ exists: true, data: () => ({ processingState: "COMPLETED", version: 2, title: "Versão 2", changeSummary: "Revisada" }) });
    const { POST } = await import("@/app/api/cases/[caseId]/draft/route");
    const request = new Request("http://localhost/api/cases/CASE12345/draft", {
      method: "POST",
      headers: authHeaders("application/json"),
      body: JSON.stringify({ clientRequestId: "44444444-4444-4444-8444-444444444444", action: "generate" }),
    });
    const response = await POST(request, { params: Promise.resolve({ caseId: "CASE12345" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: 2, idempotent: true });
    expect(parseAi).not.toHaveBeenCalled();
  });

  it("bloqueia análise de evidência acima do limite sem chamar OpenAI", async () => {
    checkEvidenceRateLimit("citizen-rate", "CASE12345");
    const form = new FormData();
    form.set("caseId", "CASE12345");
    form.set("evidenceId", "55555555-5555-4555-8555-555555555555");
    form.set("description", "Documento sintético");
    form.set("file", new File(["conteúdo sintético"], "qa.txt", { type: "text/plain" }));
    const { POST } = await import("@/app/api/evidences/process/route");
    const response = await POST(new Request("http://localhost/api/evidences/process", {
      method: "POST", headers: authHeaders(), body: form,
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(parseAi).not.toHaveBeenCalled();
  });
});
