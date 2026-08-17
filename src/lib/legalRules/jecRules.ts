export interface JecRuleConfiguration {
  informationalLabel: string;
  reviewTriggers: readonly string[];
}

// Textos e gatilhos operacionais ficam centralizados para atualização sem editar telas.
// Limites monetários temporais devem vir de fonte jurídica revisada antes de produção.
export const JEC_RULES: JecRuleConfiguration = {
  informationalLabel:
    "A elegibilidade depende da natureza, do valor, da complexidade e do procedimento aplicável ao caso.",
  reviewTriggers: [
    "necessidade de representação profissional",
    "questão técnica ou pericial complexa",
    "inconsistências relevantes",
    "baixa confiança da análise preliminar",
    "procedimento incompatível com o autoatendimento",
  ],
};
