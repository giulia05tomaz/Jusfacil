import { z } from "zod";

const NullableText = z.string().max(2_000).nullable();

export const StructuredCaseDataSchema = z.object({
  caseSummary: z.string().max(4_000),
  category: NullableText,
  parties: z.array(z.object({ role: z.string().max(100), name: z.string().max(300).nullable(), document: z.string().max(200).nullable(), address: z.string().max(500).nullable(), details: z.string().max(1_000).nullable() })).max(20),
  facts: z.array(z.object({ description: z.string().max(1_000), date: z.string().max(100).nullable(), source: z.string().max(300).nullable() })).max(50),
  timeline: z.array(z.object({ date: z.string().max(100).nullable(), event: z.string().max(1_000) })).max(50),
  values: z.array(z.object({ description: z.string().max(300), amount: z.number().nonnegative().nullable(), currency: z.string().max(10).nullable() })).max(30),
  claimValue: z.number().nonnegative().nullable().optional(),
  evidence: z.array(z.object({ evidenceId: z.string().max(100).nullable(), name: z.string().max(300), type: z.string().max(100), summary: z.string().max(2_000), relevantFacts: z.array(z.string().max(500)).max(30), uncertainties: z.array(z.string().max(500)).max(30) })).max(20),
  legalIssues: z.array(z.string().max(500)).max(30),
  requestedRelief: z.array(z.string().max(500)).max(30),
  missingInformation: z.array(z.string().max(500)).max(30),
  contradictions: z.array(z.string().max(500)).max(30),
  riskFlags: z.array(z.string().max(500)).max(30),
  draftReady: z.boolean(),
  nextQuestions: z.array(z.string().max(500)).max(3),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  requiresHumanReview: z.boolean(),
  humanReviewReason: NullableText,
});

export const JurisBotResponseSchema = z.object({
  assistantMessage: z.string().min(1).max(4_000),
  structuredData: StructuredCaseDataSchema,
});

export const JurisBotRequestSchema = z.object({
  caseId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  clientMessageId: z.string().uuid(),
  message: z.string().trim().min(1).max(4_000),
}).strict();

export const EvidenceAnalysisSchema = z.object({
  fileName: z.string().min(1).max(300),
  fileType: z.string().min(1).max(100),
  summary: z.string().min(1).max(2_000),
  relevantFacts: z.array(z.string().max(500)).max(50),
  dates: z.array(z.string().max(100)).max(50),
  values: z.array(z.string().max(100)).max(50),
  peopleOrOrganizations: z.array(z.string().max(200)).max(50),
  protocols: z.array(z.string().max(200)).max(50),
  contradictions: z.array(z.string().max(500)).max(30),
  uncertainties: z.array(z.string().max(500)).max(30),
  relevance: z.string().max(1_000),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export const DraftRequestSchema = z.object({ clientRequestId: z.string().uuid(), action: z.enum(["generate", "revise"]), revisionRequest: z.string().trim().min(1).max(2_000).optional() }).strict().superRefine((value, context) => {
  if (value.action === "revise" && !value.revisionRequest) context.addIssue({ code: "custom", message: "Informe a alteração solicitada." });
});

export const DraftResponseSchema = z.object({ content: z.string().min(500).max(30_000), changeSummary: z.string().min(1).max(1_000) });

export type StructuredCaseDataInput = z.infer<typeof StructuredCaseDataSchema>;
export type JurisBotResponseInput = z.infer<typeof JurisBotResponseSchema>;
export type JurisBotRequestInput = z.infer<typeof JurisBotRequestSchema>;
