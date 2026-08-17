import { describe, expect, it } from "vitest";
import { serverTimestamp } from "firebase/firestore";
import { evaluateCaseEligibility } from "@/lib/cases/eligibility";
import { canTransitionCaseStatus } from "@/lib/cases/statusMachine";
import { nextDraftVersion } from "@/lib/drafts/versioning";
import { sanitizeFileName, validateEvidenceFile, withoutUndefined } from "@/lib/firebase/services";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";

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
