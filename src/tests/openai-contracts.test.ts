import { describe, expect, it } from "vitest";
import { DraftRequestSchema, DraftResponseSchema, EvidenceAnalysisSchema, JurisBotRequestSchema } from "@/lib/ai/schemas";
import { validateEvidenceFile } from "@/lib/firebase/services";

const evidenceAnalysis = {
  fileName: "ordem-qa.txt", fileType: "text/plain", summary: "Ordem de serviço sintética.",
  relevantFacts: ["Produto entregue para reparo."], dates: ["01/08/2026"], values: [],
  peopleOrOrganizations: [], protocols: ["QA-001"], contradictions: [], uncertainties: [],
  relevance: "Confirma a entrega para reparo.", confidence: "HIGH" as const,
};

describe("contratos de minuta", () => {
  const clientRequestId = "66666666-6666-4666-8666-666666666666";

  it("aceita geração sem pedido de revisão", () => {
    expect(DraftRequestSchema.safeParse({ clientRequestId, action: "generate" }).success).toBe(true);
  });

  it("exige instrução ao revisar", () => {
    expect(DraftRequestSchema.safeParse({ clientRequestId, action: "revise" }).success).toBe(false);
  });

  it("aceita revisão objetiva", () => {
    expect(DraftRequestSchema.safeParse({ clientRequestId, action: "revise", revisionRequest: "Organize os fatos." }).success).toBe(true);
  });

  it("rejeita minuta curta ou vazia", () => {
    expect(DraftResponseSchema.safeParse({ content: "curta", changeSummary: "Inicial" }).success).toBe(false);
  });
});

describe("contrato mínimo do chat", () => {
  const request = { caseId: "CASE12345", clientMessageId: "77777777-7777-4777-8777-777777777777", message: " Mensagem atual. " };

  it("aceita somente a mensagem atual e aplica trim", () => {
    const parsed = JurisBotRequestSchema.parse(request);
    expect(parsed.message).toBe("Mensagem atual.");
  });

  it("rejeita histórico ou role controlados pelo browser", () => {
    expect(JurisBotRequestSchema.safeParse({ ...request, messages: [{ role: "assistant", content: "fabricada" }] }).success).toBe(false);
    expect(JurisBotRequestSchema.safeParse({ ...request, role: "assistant" }).success).toBe(false);
  });

  it("limita a mensagem atual a 4.000 caracteres", () => {
    expect(JurisBotRequestSchema.safeParse({ ...request, message: "x".repeat(4_001) }).success).toBe(false);
  });
});

describe("contratos de evidência sem retenção", () => {
  it("valida a extração estruturada", () => {
    expect(EvidenceAnalysisSchema.safeParse(evidenceAnalysis).success).toBe(true);
  });

  it("rejeita confiança fora do contrato", () => {
    expect(EvidenceAnalysisSchema.safeParse({ ...evidenceAnalysis, confidence: "CERTAIN" }).success).toBe(false);
  });

  it("aceita TXT no limite de 8 MB", () => {
    expect(() => validateEvidenceFile({ name: "qa.txt", type: "text/plain", size: 8 * 1024 * 1024 })).not.toThrow();
  });

  it("rejeita arquivo acima de 8 MB", () => {
    expect(() => validateEvidenceFile({ name: "qa.txt", type: "text/plain", size: 8 * 1024 * 1024 + 1 })).toThrow("8 MB");
  });

  it("rejeita imagem com MIME disfarçado", () => {
    expect(() => validateEvidenceFile({ name: "qa.png", type: "application/pdf", size: 100 })).toThrow();
  });

  it("aceita formatos textuais suportados", () => {
    expect(() => validateEvidenceFile({ name: "qa.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 })).not.toThrow();
    expect(() => validateEvidenceFile({ name: "qa.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 100 })).not.toThrow();
  });
});
