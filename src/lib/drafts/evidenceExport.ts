import type { DraftVersion, Evidence } from "@/types";

export const STALE_DRAFT_MESSAGE = "Novas evidências ainda não constam nesta minuta. Gere e revise uma nova versão antes do envio de teste.";

export function evidenceDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

// Apenas metadados necessários ao índice; nunca presume que os originais estão disponíveis.
export function exportEvidences(evidences: Evidence[]): Evidence[] {
  return evidences.filter((item) => item.status === "PROCESSED").map((item) => ({
    evidenceId: item.evidenceId, caseId: item.caseId, originalName: item.originalName,
    mimeType: item.mimeType, size: item.size, status: item.status,
    uploadedAt: evidenceDate(item.uploadedAt), uploadedBy: item.uploadedBy,
    description: item.description?.trim() || item.analysis?.summary?.trim() || "Descrição não informada",
    ...(item.order !== undefined ? { order: item.order } : {}),
    ...(item.reference ? { reference: item.reference } : {}),
    ...(item.title ? { title: item.title } : {}),
  })).sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999)
    || a.uploadedAt.localeCompare(b.uploadedAt) || a.evidenceId.localeCompare(b.evidenceId));
}

export function draftNeedsEvidenceRevision(draft: Pick<DraftVersion, "createdAt" | "content">, evidences: Evidence[]): boolean {
  if (!evidences.length) return false;
  const createdAt = new Date(evidenceDate(draft.createdAt)).getTime();
  if (!Number.isFinite(createdAt) || evidences.some((item) => {
    const uploadedAt = new Date(evidenceDate(item.uploadedAt)).getTime();
    return !Number.isFinite(uploadedAt) || uploadedAt > createdAt;
  })) return true;
  return evidences.some((item) => item.status === "PROCESSED")
    && !/DOCUMENTOS\s+E\s+EVID[ÊE]NCIAS|DOCUMENTOS\s+QUE\s+INSTRUEM/i.test(draft.content);
}
