import type { CaseEligibilityResult, StructuredCaseData } from "@/types";

export function evaluateCaseEligibility(data: StructuredCaseData): CaseEligibilityResult {
  const reasons: string[] = [];

  if (data.requiresHumanReview) reasons.push(data.humanReviewReason || "Revisão humana sinalizada na triagem.");
  if (data.confidenceLevel === "LOW") reasons.push("Baixa confiança na organização preliminar das informações.");
  if ((data.missingInformation?.length ?? 0) >= 5) reasons.push("Há informações essenciais ainda não confirmadas.");
  if ((data.category ?? "").toLowerCase().includes("criminal")) reasons.push("A natureza informada não é adequada ao fluxo de autoatendimento atual.");

  return {
    path: reasons.length ? "HUMAN_REVIEW" : "SELF_SERVICE",
    reasons,
    confidence: data.confidenceLevel ?? "LOW",
  };
}
