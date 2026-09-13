import type { User } from "firebase/auth";

// randomUUID não está disponível em vários browsers no HTTP do IP local.
// getRandomValues continua disponível e evita IDs fracos no teste pelo celular.
export function createSubmissionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function submissionRequest(user: Pick<User, "getIdToken">, caseId: string, options: RequestInit = {}) {
  const send = async (refresh: boolean) => fetch(`/api/cases/${encodeURIComponent(caseId)}/submission/test-email`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(refresh)}` },
  });
  const response = await send(false);
  // Retry de autenticação conserva corpo e idempotencyKey; nunca reenvia após erro de provedor.
  return response.status === 401 ? send(true) : response;
}
