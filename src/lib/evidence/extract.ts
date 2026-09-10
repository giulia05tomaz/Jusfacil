import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ExtractionResult {
  text: string;
  method: "PDF_TEXT" | "PLAIN_TEXT" | "CSV" | "DOCX" | "XLSX";
  truncated: boolean;
}

const MAX_EXTRACTED_CHARS = 30_000;

function capped(text: string, method: ExtractionResult["method"]): ExtractionResult {
  const normalized = text.replace(/\0/g, "").trim();
  return { text: normalized.slice(0, MAX_EXTRACTED_CHARS), method, truncated: normalized.length > MAX_EXTRACTED_CHARS };
}

function csvToText(text: string): string {
  return text.split(/\r?\n/).slice(0, 200).map((line) => line.split(/[,;]/).slice(0, 50).join(" | ")).join("\n");
}

function cellValueToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    return "";
  }
  return String(value);
}

async function workbookToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS still publishes a non-generic Buffer type; Node 24 types use Buffer<ArrayBufferLike>.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook.worksheets.slice(0, 10).map((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 200) return;
      const values = Array.isArray(row.values) ? row.values.slice(1, 51) : [];
      rows.push(values.map((value) => cellValueToText(value)).join(" | "));
    });
    return `Planilha: ${worksheet.name}\n${rows.join("\n")}`;
  }).join("\n\n");
}

export async function extractEvidenceText(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult | null> {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (mimeType === "text/plain" && extension !== ".csv") return capped(buffer.toString("utf8"), "PLAIN_TEXT");
  if (extension === ".csv") return capped(csvToText(buffer.toString("utf8")), "CSV");
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return capped(result.value, "DOCX");
  }
  if (extension === ".xlsx") return capped(await workbookToText(buffer), "XLSX");
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ first: 50 });
      return result.text.trim() ? capped(result.text, "PDF_TEXT") : null;
    } finally {
      await parser.destroy();
    }
  }
  return null;
}
