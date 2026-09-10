import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { inspectEvidenceZip } from "@/lib/evidence/package";

function fixture(includeCsv = true) {
  const entries: Record<string, Uint8Array> = {
    "pacote/001_EVIDENCIA_08.10_CONVERSA.jpg": strToU8("imagem"),
    "pacote/001_EVIDENCIA_08.10_CONVERSA.pdf": strToU8("pdf"),
    "pacote/002_EVIDENCIA_08.9_CONVERSA.jpg": strToU8("imagem"),
  };
  if (includeCsv) entries["pacote/00_Indice_das_Evidencias.csv"] = strToU8("ordem,referencia,titulo_na_peticao,arquivo_imagem,arquivo_pdf_pagina\n1,08.10,Conversa dez dez,001_EVIDENCIA_08.10_CONVERSA.jpg,001_EVIDENCIA_08.10_CONVERSA.pdf\n2,08.9,Conversa oito nove,002_EVIDENCIA_08.9_CONVERSA.jpg,");
  return Buffer.from(zipSync(entries));
}

describe("manifesto determinístico de pacotes ZIP", () => {
  it("colapsa JPG/PDF e preserva 08.10 como string", () => {
    const manifest = inspectEvidenceZip(fixture(), "modelo.zip");
    expect(manifest.evidenceCount).toBe(2);
    expect(manifest.items[0]).toMatchObject({ order: 1, reference: "08.10" });
    expect(manifest.items[0].variants).toHaveLength(2);
  });

  it("rejeita ZIP Slip e arquivo compactado aninhado", () => {
    expect(() => inspectEvidenceZip(Buffer.from(zipSync({ "../evil.pdf": strToU8("x") })), "bad.zip")).toThrow("ZIP_PATH_TRAVERSAL");
    expect(() => inspectEvidenceZip(Buffer.from(zipSync({ "nested.zip": strToU8("x") })), "bad.zip")).toThrow("ZIP_NESTED_ARCHIVE");
  });

  it("faz fallback determinístico sem índice", () => {
    const manifest = inspectEvidenceZip(fixture(false), "sem-indice.zip");
    expect(manifest.sourceIndexType).toBe("FILENAME");
    expect(manifest.items.map((item) => item.reference)).toEqual(["08.9", "08.10"]);
  });
});
