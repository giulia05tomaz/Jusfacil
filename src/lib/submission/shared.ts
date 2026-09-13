import { z } from "zod";

export const TEST_SUBMISSION_DISCLAIMER = "Este envio é apenas uma simulação funcional do JusFácil e não representa protocolo judicial, distribuição processual ou comunicação oficial com qualquer tribunal.";
export const TEST_SUBMISSION_ACKNOWLEDGMENT = "Estou ciente de que este envio é apenas um teste e não representa protocolo judicial real.";
export const CopyEmailSchema = z.string().trim().min(1).max(254).email();
export const CaseIdSchema = z.string().regex(/^JF-[A-Za-z0-9-]{4,76}$/);
export const SubmissionRequestSchema = z.object({
  approvedDraftId: z.string().regex(/^v[1-9]\d{0,4}$/).refine((id) => Number(id.slice(1)) <= 10_000),
  copyEmail: CopyEmailSchema,
  acknowledgment: z.literal(true),
  idempotencyKey: z.uuid(),
  replyToSubmissionId: z.uuid().optional(),
}).strict();

export type SubmissionRequest = z.infer<typeof SubmissionRequestSchema>;
export interface TestEmailSubmission {
  submissionId: string;
  type: "TEST_EMAIL";
  draftId: string;
  draftVersion: number;
  status: "PENDING" | "SENT" | "FAILED";
  recipientMode: "TEST";
  copyEmail: string;
  createdAt: string;
  sentAt?: string;
  errorCode?: string;
  replyToSubmissionId?: string;
  replyToDraftVersion?: number;
}

export function currentApprovedDraftVersion(legalCase: {
  status: string;
  currentDraftVersion?: number;
  approvedVersion?: number;
}): number | null {
  if (legalCase.status !== "MINUTA_APROVADA") return null;
  const version = legalCase.approvedVersion ?? legalCase.currentDraftVersion;
  return version && version === legalCase.currentDraftVersion ? version : null;
}
