import { jsPDF } from "jspdf";
import type { DraftVersion, Evidence, LegalCase } from "@/types";

function evidenceLabel(index: number, reference?: string): string {
  return `EVIDÊNCIA ${reference || String(index + 1).padStart(2, "0")}`;
}

export function generateDraftPdf(legalCase: LegalCase, draft: DraftVersion, evidences: Evidence[] = []): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 22;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bodyWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 13;
  let y = 28;

  const footer = () => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text("Documento preparado pelo JusFácil para revisão. Não substitui orientação profissional.", margin, footerY);
    pdf.setTextColor(0);
  };

  const header = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("JUSFÁCIL - PETIÇÃO INICIAL", margin, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Protocolo interno: ${legalCase.caseId} - Versão ${draft.version}`, margin, 19);
    pdf.line(margin, 22, pageWidth - margin, 22);
    y = 30;
  };

  const newPage = () => {
    footer();
    pdf.addPage();
    header();
  };

  const ensureSpace = (height: number) => {
    if (y + height > footerY - 5) newPage();
  };

  const drawLines = (text: string, options: { bold?: boolean; size?: number; gap?: number } = {}) => {
    const size = options.size ?? 10.5;
    const gap = options.gap ?? 4.8;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, bodyWidth) as string[];
    ensureSpace(lines.length * gap + 2);
    lines.forEach((line) => {
      pdf.text(line, margin, y);
      y += gap;
    });
  };

  header();
  for (const rawLine of draft.content.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      y += 3;
      continue;
    }
    const heading = /^(?:\d+(?:\.\d+)*\.|[A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇ\s-]{8,})/.test(line);
    drawLines(line, { bold: heading, size: heading ? 11 : 10.5, gap: heading ? 5.4 : 4.8 });
    if (heading) y += 1.5;
  }

  if (evidences.length > 0) {
    newPage();
    drawLines("ANEXO PROBATÓRIO - ÍNDICE DAS EVIDÊNCIAS", { bold: true, size: 12, gap: 6 });
    drawLines("Relacionam-se abaixo as evidências processadas e efetivamente associadas a este caso. A numeração é estável para as referências da petição.");
    const ordered = [...evidences].sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999) || String(a.uploadedAt).localeCompare(String(b.uploadedAt)));
    ordered.forEach((evidence, index) => {
      const description = evidence.description?.trim() || evidence.analysis?.summary?.trim() || "Descrição não informada";
      drawLines(`${evidenceLabel(index, evidence.reference)} - ${evidence.title || evidence.originalName} - ${description}`, { size: 10, gap: 4.6 });
    });
    y += 3;
    drawLines("ANEXO PROBATÓRIO - DOCUMENTOS", { bold: true, size: 12, gap: 6 });
    drawLines("Os arquivos originais não são retidos nesta versão do JusFácil. O índice acima registra somente documentos efetivamente processados; nenhum anexo visual foi inventado ou incorporado sem arquivo disponível.");
  }
  footer();

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }
  return pdf;
}
