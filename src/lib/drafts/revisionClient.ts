import type { User } from "firebase/auth";
import { createSubmissionKey } from "@/lib/submission/client";

export { createSubmissionKey as createDraftRequestId };

export async function draftRequest(user: Pick<User, "getIdToken">, caseId: string, body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  const send = async (refresh: boolean) => fetch(`/api/cases/${encodeURIComponent(caseId)}/draft`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(refresh)}` },
    body: payload,
  });
  const response = await send(false);
  return response.status === 401 ? send(true) : response;
}
