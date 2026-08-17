import jsPDF from "jspdf";
import type { DraftVersion, LegalCase } from "@/types";

export function generateDraftPdf(legalCase: LegalCase, draft: DraftVersion): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bodyWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 10;
  let y = 20;

  const header = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("JUSFÁCIL — MINUTA PARA REVISÃO", margin, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Protocolo interno: ${legalCase.caseId} • Versão ${draft.version}`, margin, 19);
    pdf.line(margin, 22, pageWidth - margin, 22);
    y = 28;
  };

  const footer = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text("Minuta informativa. Revise antes de qualquer uso ou protocolo.", margin, footerY);
    pdf.setTextColor(0);
  };

  header();
  pdf.setFontSize(10);
  const lines = pdf.splitTextToSize(draft.content, bodyWidth) as string[];
  for (const line of lines) {
    if (y > footerY - 8) {
      footer();
      pdf.addPage();
      header();
      pdf.setFontSize(10);
    }
    pdf.text(line, margin, y);
    y += 5;
  }
  footer();

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }
  return pdf;
}
