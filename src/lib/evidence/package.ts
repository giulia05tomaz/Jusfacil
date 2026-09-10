import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

export const ZIP_LIMITS = {
  compressedBytes: 50 * 1024 * 1024,
  entries: 400,
  logicalItems: 150,
  uncompressedBytes: 200 * 1024 * 1024,
  individualBytes: 10 * 1024 * 1024,
  compressionRatio: 100,
} as const;

const ALLOWED = new Map([
  [".pdf", "application/pdf"], [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"], [".csv", "text/csv"], [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
]);
const ARCHIVE_EXTENSIONS = /\.(zip|rar|7z|tar|gz)$/i;
const INDEX_NAMES = /(^|\/)(00[_ -]?indice|indice|index|leia[- _]?me)[^/]*\.(csv|txt)$/i;

export interface EvidencePackageVariant {
  fileName: string;
  type: string;
  size: number;
  sha256: string;
  canonical: boolean;
}

export interface EvidencePackageItem {
  id: string;
  order: number;
  reference: string;
  title: string;
  originalTitle: string;
  variants: EvidencePackageVariant[];
  source: "CSV" | "TXT" | "FILENAME";
  processingStatus: "READY" | "ERROR";
  warning?: string;
}

export interface EvidencePackageManifest {
  packageName: string;
  evidenceCount: number;
  sourceIndexType: "CSV" | "TXT" | "FILENAME";
  warnings: string[];
  items: EvidencePackageItem[];
}

interface Entry { path: string; name: string; data: Uint8Array; }

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\/+/, "");
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

function referenceCompare(a: string, b: string): number {
  const parse = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10));
  const aa = parse(a); const bb = parse(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const diff = (aa[i] ?? -1) - (bb[i] ?? -1);
    if (diff) return diff;
  }
  return 0;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"' && quoted) { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue;
    }
    cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function fileNameTitle(name: string): { reference: string | null; title: string } {
  const base = name.replace(/\.[^.]+$/, "").replace(/^\d+[_ -]?/, "");
  const match = base.match(/EVID[ÊE]NCIA[_ -]?([0-9]+(?:\.[0-9]+)*)[_ -]*(.*)$/i);
  const title = (match?.[2] || base).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return { reference: match?.[1] || null, title: title || "Evidência sem título" };
}

function sha256(data: Uint8Array): string { return createHash("sha256").update(data).digest("hex"); }

function mimeFor(name: string): string {
  return ALLOWED.get(name.slice(name.lastIndexOf(".")).toLowerCase()) || "application/octet-stream";
}

export function inspectEvidenceZip(buffer: Buffer, packageName: string): EvidencePackageManifest {
  if (buffer.length > ZIP_LIMITS.compressedBytes) throw new Error("ZIP_TOO_LARGE");
  const unpacked = unzipSync(new Uint8Array(buffer));
  const entries: Entry[] = Object.entries(unpacked).map(([path, data]) => ({ path, name: path.split("/").pop() || path, data }));
  if (entries.length > ZIP_LIMITS.entries) throw new Error("ZIP_TOO_MANY_ENTRIES");
  const warnings: string[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const normalized = normalizePath(entry.path);
    if (normalized.includes("..") || /^[A-Za-z]:/.test(entry.path) || entry.path.startsWith("/") || entry.path.startsWith("\\")) throw new Error("ZIP_PATH_TRAVERSAL");
    if (ARCHIVE_EXTENSIONS.test(entry.name)) throw new Error("ZIP_NESTED_ARCHIVE");
    totalBytes += entry.data.byteLength;
    if (entry.data.byteLength > ZIP_LIMITS.individualBytes) throw new Error("ZIP_ENTRY_TOO_LARGE");
  }
  if (totalBytes > ZIP_LIMITS.uncompressedBytes) throw new Error("ZIP_UNCOMPRESSED_TOO_LARGE");
  if (buffer.length > 0 && totalBytes / buffer.length > ZIP_LIMITS.compressionRatio) throw new Error("ZIP_COMPRESSION_RATIO");

  const files = entries.filter((entry) => !entry.path.endsWith("/") && !INDEX_NAMES.test(entry.path));
  const csvEntry = entries.find((entry) => /\.csv$/i.test(entry.name) && /indice|index/i.test(entry.name));
  const txtEntry = entries.find((entry) => /\.txt$/i.test(entry.name) && /indice|index/i.test(entry.name));
  const csvMap = new Map<string, { order: number; reference: string; title: string; image?: string; pdf?: string }>();
  if (csvEntry) {
    const rows = csvRows(strFromU8(csvEntry.data));
    const headers = rows.shift()?.map((value) => value.toLowerCase()) || [];
    const index = (name: string) => headers.findIndex((header) => header === name);
    const orderIndex = index("ordem"); const referenceIndex = index("referencia"); const titleIndex = index("titulo_na_peticao");
    const imageIndex = index("arquivo_imagem"); const pdfIndex = index("arquivo_pdf_pagina");
    if (orderIndex < 0 || referenceIndex < 0 || titleIndex < 0) warnings.push("CSV do índice não contém todos os campos obrigatórios; fallback para nomes.");
    else rows.forEach((row) => {
      const order = Number.parseInt(row[orderIndex], 10); const reference = row[referenceIndex]?.trim();
      if (!Number.isInteger(order) || !reference) return;
      csvMap.set(reference, { order, reference, title: row[titleIndex]?.trim() || `EVIDÊNCIA ${reference}`, image: row[imageIndex]?.trim(), pdf: row[pdfIndex]?.trim() });
    });
  }
  if (!csvEntry && txtEntry) warnings.push("Índice TXT identificado; a ordem será inferida deterministicamente pelos registros estruturados.");
  const groups = new Map<string, Entry[]>();
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.has(ext)) { warnings.push(`Arquivo ignorado por formato não permitido: ${file.name}`); continue; }
    const parsed = fileNameTitle(file.name);
    const key = parsed.reference || file.name;
    const list = groups.get(key) || []; list.push(file); groups.set(key, list);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (csvMap.has(a) && csvMap.has(b)) return csvMap.get(a)!.order - csvMap.get(b)!.order;
    if (/^\d+(?:\.\d+)*$/.test(a) && /^\d+(?:\.\d+)*$/.test(b)) return referenceCompare(a, b);
    return naturalCompare(a, b);
  });
  if (csvEntry) sortedKeys.sort((a, b) => (csvMap.get(a)?.order ?? Number.MAX_SAFE_INTEGER) - (csvMap.get(b)?.order ?? Number.MAX_SAFE_INTEGER));
  const items: EvidencePackageItem[] = sortedKeys.slice(0, ZIP_LIMITS.logicalItems).map((key, index) => {
    const filesForItem = groups.get(key)!.sort((a, b) => naturalCompare(a.name, b.name));
    const csv = csvMap.get(key); const parsed = fileNameTitle(filesForItem[0].name); const reference = csv?.reference || parsed.reference || String(index + 1).padStart(2, "0");
    const title = csv?.title || parsed.title;
    const variants = filesForItem.map((file, variantIndex) => ({ fileName: file.name, type: mimeFor(file.name), size: file.data.byteLength, sha256: sha256(file.data), canonical: variantIndex === 0 || file.name.toLowerCase().endsWith(".pdf") }));
    const canonicalIndex = variants.findIndex((variant) => variant.type === "application/pdf"); if (canonicalIndex >= 0) variants.forEach((variant, i) => { variant.canonical = i === canonicalIndex; });
    return { id: `package-${index + 1}`, order: csv?.order || index + 1, reference, title, originalTitle: title, variants, source: csv ? "CSV" : txtEntry ? "TXT" : "FILENAME", processingStatus: "READY" };
  });
  if (items.length > ZIP_LIMITS.logicalItems) throw new Error("ZIP_TOO_MANY_LOGICAL_ITEMS");
  return { packageName, evidenceCount: items.length, sourceIndexType: csvEntry ? "CSV" : txtEntry ? "TXT" : "FILENAME", warnings, items };
}

export function extractPackageEntries(buffer: Buffer): Record<string, Uint8Array> { return unzipSync(new Uint8Array(buffer)); }
