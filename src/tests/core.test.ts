import { describe, expect, it } from "vitest";
import { serverTimestamp } from "firebase/firestore";
import { evaluateCaseEligibility } from "@/lib/cases/eligibility";
import { canTransitionCaseStatus } from "@/lib/cases/statusMachine";
import { nextDraftVersion } from "@/lib/drafts/versioning";
import { sanitizeFileName, validateEvidenceFile, withoutUndefined } from "@/lib/firebase/services";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";

describe("regras centrais", () => {
  it("encaminha baixa confiança para revisão humana", () => {
    expect(evaluateCaseEligibility({ confidenceLevel: "LOW" }).path).toBe("HUMAN_REVIEW");
  });

  it("mantém autoatendimento sem gatilhos críticos", () => {
    expect(evaluateCaseEligibility({ confidenceLevel: "HIGH", missingInformation: [] }).path).toBe("SELF_SERVICE");
  });

  it("bloqueia regressão de caso concluído", () => {
    expect(canTransitionCaseStatus("CONCLUIDO", "TRIAGEM")).toBe(false);
    expect(canTransitionCaseStatus("TRIAGEM", "COLETANDO_INFORMACOES")).toBe(true);
  });

  it("calcula a próxima versão sem sobrescrever histórico", () => {
    expect(nextDraftVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toBe(4);
  });
});

describe("isolamento de casos", () => {
  const ownCase = { citizenId: "citizen-a", assignedLawyerId: "lawyer-a" };
  it("permite cidadão proprietário e bloqueia cidadão alheio", () => {
    expect(isAuthorizedForCase("citizen-a", { role: "CITIZEN" }, ownCase)).toBe(true);
    expect(isAuthorizedForCase("citizen-b", { role: "CITIZEN" }, ownCase)).toBe(false);
  });
  it("exige advogado aprovado e atribuído", () => {
    expect(isAuthorizedForCase("lawyer-a", { role: "LAWYER", lawyerStatus: "PENDING" }, ownCase)).toBe(false);
    expect(isAuthorizedForCase("lawyer-b", { role: "LAWYER", lawyerStatus: "APPROVED" }, ownCase)).toBe(false);
    expect(isAuthorizedForCase("lawyer-a", { role: "LAWYER", lawyerStatus: "APPROVED" }, ownCase)).toBe(true);
  });
});

describe("validação de evidência", () => {
  it("aceita MIME e extensão coerentes", () => {
    expect(() => validateEvidenceFile({ name: "nota fiscal.pdf", type: "application/pdf", size: 100 })).not.toThrow();
  });
  it("rejeita arquivo vazio e MIME disfarçado", () => {
    expect(() => validateEvidenceFile({ name: "vazio.txt", type: "text/plain", size: 0 })).toThrow();
    expect(() => validateEvidenceFile({ name: "malware.pdf", type: "application/x-msdownload", size: 100 })).toThrow();
  });
  it("normaliza nome usado no Storage", () => {
    expect(sanitizeFileName("Minha nota çã 2026.pdf")).toBe("Minha_nota_ca_2026.pdf");
  });
});

describe("persistência no Firestore", () => {
  it("preserva sentinelas de timestamp ao remover campos indefinidos", () => {
    const timestamp = serverTimestamp();
    const result = withoutUndefined({ timestamp, ignored: undefined });

    expect(result.timestamp).toBe(timestamp);
    expect(result).not.toHaveProperty("ignored");
  });
});

describe("petição inicial em PDF", () => {
  it("mantém a petição separada do índice de evidências", () => {
    const pdf = generateDraftPdf(
      { caseId: "JF-2026-TESTE", title: "Caso QA", citizenId: "citizen-a", category: "Consumidor", summary: "Caso QA", originalStory: "Relato QA", status: "AGUARDANDO_REVISAO", requiresHumanReview: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
      { version: 1, caseId: "JF-2026-TESTE", title: "Petição Inicial", content: "1. DOS FATOS\nRelato confirmado.\nDOS PEDIDOS\n a) Restituição.", approved: false, createdBy: "citizen-a", source: "AI", createdAt: "2026-01-01" },
      [{ evidenceId: "evidence-a", caseId: "JF-2026-TESTE", originalName: "nota.pdf", mimeType: "application/pdf", size: 100, status: "PROCESSED", uploadedAt: "2026-01-01", uploadedBy: "citizen-a", description: "Nota fiscal" }],
    );
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(pdf.output()).toContain("ANEXO PROBATÓRIO");
  });
});
