import { describe, expect, it } from "vitest";
import { draftNeedsEvidenceRevision, exportEvidences } from "@/lib/drafts/evidenceExport";
import type { Evidence } from "@/types";

const draft = { content: "DOS DOCUMENTOS E EVIDÊNCIAS", createdAt: "2026-09-12T10:00:00.000Z" };
const evidence = { evidenceId: "1", caseId: "JF-QA-EXPORT", originalName: "imagem.jpg", mimeType: "image/jpeg", size: 200,
  uploadedBy: "citizen", uploadedAt: "2026-09-12T09:00:00.000Z", status: "PROCESSED" } as Evidence;

describe("exportação determinística de evidências sem IA", () => {
  it("exclui itens não processados e não inventa descrição", () => {
    expect(exportEvidences([{ ...evidence, status: "FAILED" }, evidence])).toEqual([expect.objectContaining({ description: "Descrição não informada" })]);
  });
  it("preserva referência textual e ordena com desempate estável", () => {
    const a = { ...evidence, evidenceId: "a", order: 2, reference: "08.10" };
    const b = { ...evidence, evidenceId: "b", order: 1 };
    const c = { ...b, evidenceId: "c" };
    expect(exportEvidences([a, c, b]).map((item) => item.evidenceId)).toEqual(["b", "c", "a"]);
    expect(exportEvidences([a])[0].reference).toBe("08.10");
  });
  it("normaliza Date e Timestamp sem alterar o registro original", () => {
    const timestamp = { toDate: () => new Date(evidence.uploadedAt) };
    const record = { ...evidence, uploadedAt: timestamp } as unknown as Evidence;
    expect(exportEvidences([record])[0].uploadedAt).toBe(evidence.uploadedAt);
    expect(record.uploadedAt).toBe(timestamp);
    expect(draftNeedsEvidenceRevision(draft, [record])).toBe(false);
  });
  it("bloqueia minuta com data inválida quando há documentos", () => {
    expect(draftNeedsEvidenceRevision({ ...draft, createdAt: "invalid" }, [evidence])).toBe(true);
  });
  it("minuta sem evidências continua compatível", () => {
    expect(draftNeedsEvidenceRevision({ ...draft, content: "CASO SEM DOCUMENTOS" }, [])).toBe(false);
  });
  it("documento posterior ainda em processamento exige revisão", () => {
    expect(draftNeedsEvidenceRevision(draft, [{ ...evidence, status: "PROCESSING", uploadedAt: "2026-09-12T11:00:00.000Z" }])).toBe(true);
  });
});
