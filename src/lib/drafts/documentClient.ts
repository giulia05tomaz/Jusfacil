type TokenUser = { getIdToken(forceRefresh?: boolean): Promise<string> };
export async function documentRequest(user: TokenUser, url: string, method: "GET" | "POST" = "GET") {
  const send = async (refresh = false) => fetch(url, { method, headers: { Authorization: `Bearer ${await user.getIdToken(refresh)}` } });
  let response = await send();
  if (response.status === 401) response = await send(true);
  return response;
}
export async function assembleDocument(user: TokenUser, caseId: string, version: number) {
  const response = await documentRequest(user, `/api/cases/${caseId}/drafts/${version}/artifact`, "POST");
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Não foi possível montar o documento completo. Tente montar novamente, sem gerar outra minuta.");
  return data;
}
export async function retrieveDocument(user: TokenUser, caseId: string, version: number, format: "pdf" | "docx" | "page", page = 1) {
  const url = `/api/cases/${caseId}/drafts/${version}/artifact?format=${format}${format === "page" ? `&page=${page}` : ""}`;
  let response = await documentRequest(user, url);
  if (response.status === 409) {
    const problem = await response.clone().json().catch(() => null);
    if (problem?.error === "DRAFT_ARTIFACT_REQUIRED") {
      await assembleDocument(user, caseId, version);
      response = await documentRequest(user, url);
    }
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Não foi possível recuperar o documento completo desta versão.");
  }
  return response;
}
