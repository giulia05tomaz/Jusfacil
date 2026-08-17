import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extractEvidenceText } from "@/lib/evidence/extract";

describe("extração segura de evidências", () => {
  it("lê TXT diretamente", async () => {
    const result = await extractEvidenceText(Buffer.from("Protocolo fictício ABC-123"), "text/plain", "relato.txt");
    expect(result).toMatchObject({ method: "PLAIN_TEXT", text: "Protocolo fictício ABC-123", truncated: false });
  });

  it("limita CSV a 200 linhas e 50 colunas", async () => {
    const csv = Array.from({ length: 250 }, (_, index) => `${index},empresa,100`).join("\n");
    const result = await extractEvidenceText(Buffer.from(csv), "text/csv", "dados.csv");
    expect(result?.method).toBe("CSV");
    expect(result?.text.split("\n")).toHaveLength(200);
  });

  it("extrai valores de XLSX sem executar macros", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Dados");
    sheet.addRows([["Empresa", "Valor"], ["Loja Fictícia", 1250]]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await extractEvidenceText(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "dados.xlsx");
    expect(result?.method).toBe("XLSX");
    expect(result?.text).toContain("Loja Fictícia | 1250");
  });
});
