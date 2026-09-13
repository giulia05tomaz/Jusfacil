import { z } from "zod";

export const RevisionProposalSchema = z.object({
  reviewId: z.uuid(), baseVersion: z.number().int().positive(), revisionRequest: z.string().min(1).max(2000),
  advice: z.string().min(1).max(3000), ready: z.boolean(), questions: z.array(z.string().max(500)).max(3),
  changeSummary: z.string().min(1).max(1000), proposedClaimValue: z.number().nonnegative().nullable(),
});
export type RevisionProposal = z.infer<typeof RevisionProposalSchema>;

export function isRevisionConfirmation(message: string) {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[.!]+$/, "");
  return /^(?:sim[, ]+)?(?:confirmo(?: a alteracao| a proposta| essa alteracao| a revisao)?|pode (?:aplicar|gerar a nova versao)(?: a alteracao| a proposta)?)$/.test(text);
}

export function revisionAdviceMessage(proposal: RevisionProposal) {
  return `Proposta de alteração — o documento ainda não foi alterado.\n\n${proposal.advice}\n\n${proposal.questions.join("\n")}\n\n${proposal.ready ? 'Confira a proposta e clique em “Confirmar alteração e gerar nova versão” ou escreva “Confirmo a alteração”.' : 'Responda às perguntas para continuar. Nenhuma nova versão foi criada.'}`;
}
