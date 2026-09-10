import OpenAI from "openai";

export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
export const OPENAI_DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";

export function createOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 45_000 });
}

export function estimateLunaCost(inputTokens = 0, outputTokens = 0): number {
  // Estimador específico para gpt-5.6-luna; atualizar se algum modelo configurado mudar.
  return (inputTokens * 0.2 + outputTokens * 1.2) / 1_000_000;
}

export function safeOpenAIError(error: unknown): { status?: number; code?: string; type: string } {
  const candidate = error as { status?: number; code?: string; error?: { code?: string } };
  return { status: candidate.status, code: candidate.code || candidate.error?.code, type: error instanceof Error ? error.name : "unknown" };
}
