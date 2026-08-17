import { z } from "zod";

export const StructuredCaseDataSchema = z.object({
  summary: z.string().nullable(),
  category: z.string().nullable(),
  facts: z.array(z.string()).nullable(),
  timeline: z
    .array(
      z.object({
        date: z.string().nullable(),
        event: z.string(),
      })
    )
    .nullable(),
  involvedParties: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
      })
    )
    .nullable(),
  claimValue: z.number().nullable(),
  userGoal: z.string().nullable(),
  missingInformation: z.array(z.string()).nullable(),
  evidenceNeeded: z.array(z.string()).nullable(),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable(),
  requiresHumanReview: z.boolean().nullable(),
  humanReviewReason: z.string().nullable(),
  generateDraft: z.boolean().nullable(),
  draftTitle: z.string().nullable(),
  draftContent: z.string().nullable(),
});

export const JurisBotResponseSchema = z.object({
  reply: z.string().min(1, "A resposta da IA não pode ser vazia"),
  structuredData: StructuredCaseDataSchema.nullable(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

export const JurisBotRequestSchema = z.object({
  caseId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  messages: z.array(ChatMessageSchema).max(40).default([]),
  userStory: z.string().trim().max(8_000).optional(),
}).superRefine((value, context) => {
  const total = value.messages.reduce((sum, message) => sum + message.content.length, 0) + (value.userStory?.length ?? 0);
  if (total > 30_000) context.addIssue({ code: "custom", message: "Conteúdo total acima do limite permitido." });
});

export const EvidenceAnalysisSchema = z.object({
  summary: z.string().min(1).max(2_000),
  documentType: z.string().min(1).max(100),
  dates: z.array(z.string().max(100)).max(50),
  amounts: z.array(z.string().max(100)).max(50),
  people: z.array(z.string().max(200)).max(50),
  companies: z.array(z.string().max(200)).max(50),
  protocols: z.array(z.string().max(200)).max(50),
  relevantFacts: z.array(z.string().max(500)).max(50),
  relationToCase: z.array(z.string().max(500)).max(30),
  uncertainties: z.array(z.string().max(500)).max(30),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export type StructuredCaseDataInput = z.infer<typeof StructuredCaseDataSchema>;
export type JurisBotResponseInput = z.infer<typeof JurisBotResponseSchema>;
export type JurisBotRequestInput = z.infer<typeof JurisBotRequestSchema>;
