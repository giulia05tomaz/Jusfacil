import { describe, expect, it } from "vitest";
import { JurisBotResponseSchema, StructuredCaseDataSchema } from "@/lib/ai/schemas";

const completeStructuredData = {
  caseSummary: "Caso sintético de produto com defeito.",
  category: "Direito do Consumidor",
  parties: [{ role: "Autor", name: "Pessoa QA", document: null, address: null, details: null }],
  facts: [{ description: "Produto apresentou defeito.", date: "10/01/2026", source: "Relato" }],
  timeline: [{ date: "10/01/2026", event: "Defeito informado" }],
  values: [{ description: "Preço", amount: 3200, currency: "BRL" }],
  evidence: [], legalIssues: ["Relação de consumo"], requestedRelief: ["Restituição"], missingInformation: [],
  contradictions: [], riskFlags: [], draftReady: true, nextQuestions: [], confidenceLevel: "HIGH" as const,
  requiresHumanReview: false, humanReviewReason: null,
};

describe("schemas estruturados do JurisBot", () => {
  it("valida dados completos e draftReady", () => {
    expect(StructuredCaseDataSchema.safeParse(completeStructuredData).success).toBe(true);
  });

  it("rejeita enum de confiança inválido", () => {
    expect(StructuredCaseDataSchema.safeParse({ ...completeStructuredData, confidenceLevel: "UNKNOWN" }).success).toBe(false);
  });

  it("limita perguntas progressivas a três", () => {
    expect(StructuredCaseDataSchema.safeParse({ ...completeStructuredData, nextQuestions: ["1", "2", "3", "4"] }).success).toBe(false);
  });

  it("valida resposta completa", () => {
    expect(JurisBotResponseSchema.safeParse({ assistantMessage: "Vamos continuar.", structuredData: completeStructuredData }).success).toBe(true);
  });

  it("rejeita mensagem vazia", () => {
    expect(JurisBotResponseSchema.safeParse({ assistantMessage: "", structuredData: completeStructuredData }).success).toBe(false);
  });
});
