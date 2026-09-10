import nextEnv from "@next/env";
import OpenAI from "openai";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.ALLOW_REAL_OPENAI_SMOKE !== "1") {
  console.error(
    "Smoke test real bloqueado. Defina ALLOW_REAL_OPENAI_SMOKE=1 explicitamente para autorizar uma chamada paga.",
  );
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY não configurada.");
  process.exit(1);
}

const model = "gpt-5.6-luna";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

try {
  const response = await client.responses.create({
    model,
    input: "Responda somente: OK",
    max_output_tokens: 32,
    reasoning: { effort: "none" },
  });
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const estimatedCostUsd = (inputTokens * 0.2 + outputTokens * 1.2) / 1_000_000;

  console.log(JSON.stringify({
    status: response.status,
    model,
    output: response.output_text.trim(),
    inputTokens,
    outputTokens,
    totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: error?.status ?? null,
    code: error?.code ?? error?.error?.code ?? "OPENAI_ERROR",
    message: error instanceof Error ? error.message : "Falha desconhecida",
  }));
  process.exit(1);
}
