import { describe, it, expect } from "vitest";
import {
  StructuredCaseDataSchema,
  JurisBotResponseSchema,
} from "../lib/ai/schemas";

const completeStructuredData = {
  summary: "Caso de produto com defeito e recusa da garantia pelo fornecedor.",
  category: "Direito do Consumidor",
  facts: ["Compra efetuada em 10/01/2026", "Geladeira parou de funcionar em 16/01/2026"],
  timeline: [{ date: "10/01/2026", event: "Compra e pagamento" }],
  involvedParties: [{ name: "Eletro Shop S.A.", role: "Reclamada" }],
  claimValue: 3200,
  userGoal: "Restituição da quantia paga",
  missingInformation: [],
  evidenceNeeded: ["Nota Fiscal de Compra"],
  confidenceLevel: "HIGH" as const,
  requiresHumanReview: false,
  humanReviewReason: null,
  generateDraft: true,
  draftTitle: "Minuta de Petição Inicial - JEC",
  draftContent: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO...",
};

describe("JurisBot Zod Schemas Validation", () => {
  it("should validate a valid structured case data response", () => {
    const parseResult = StructuredCaseDataSchema.safeParse(completeStructuredData);
    expect(parseResult.success).toBe(true);
  });

  it("should reject invalid confidenceLevel enum", () => {
    const invalidData = { ...completeStructuredData, confidenceLevel: "UNKNOWN_LEVEL" };

    const parseResult = StructuredCaseDataSchema.safeParse(invalidData);
    expect(parseResult.success).toBe(false);
  });

  it("should validate full JurisBot response schema", () => {
    const mockFullPayload = {
      reply: "Entendi o seu relato. Vamos prosseguir com a minuta.",
      structuredData: completeStructuredData,
    };

    const parseResult = JurisBotResponseSchema.safeParse(mockFullPayload);
    expect(parseResult.success).toBe(true);
  });

  it("should reject empty reply in JurisBot response schema", () => {
    const mockEmptyPayload = {
      reply: "",
      structuredData: null,
    };

    const parseResult = JurisBotResponseSchema.safeParse(mockEmptyPayload);
    expect(parseResult.success).toBe(false);
  });
});
