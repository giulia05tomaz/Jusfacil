import React from "react";
import { CaseStatus } from "@/types";

interface BadgeProps {
  status?: CaseStatus | string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, children }) => {
  const getStatusConfig = (st?: string) => {
    switch (st) {
      case "TRIAGEM":
      case "COLETANDO_INFORMACOES":
        return { label: "Triagem", style: "bg-blue-50 text-blue-700 border-blue-200" };
      case "COLETANDO_EVIDENCIAS":
        return { label: "Evidências", style: "bg-amber-50 text-amber-800 border-amber-200" };
      case "ANALISANDO":
      case "NECESSITA_ESCLARECIMENTO":
        return { label: "Em Análise", style: "bg-purple-50 text-purple-700 border-purple-200" };
      case "PREPARANDO_MINUTA":
        return { label: "Gerando Minuta", style: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "AGUARDANDO_REVISAO":
      case "AJUSTANDO_MINUTA":
        return { label: "Aguardando Revisão", style: "bg-jus-caramel-50 text-jus-caramel-contrast border-jus-caramel-light" };
      case "MINUTA_APROVADA":
      case "PRONTO_PARA_PROTOCOLO":
        return { label: "Minuta Aprovada", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "REVISAO_HUMANA":
      case "ENCAMINHADO_ADVOGADO":
        return { label: "Revisão por Advogado", style: "bg-orange-50 text-orange-800 border-orange-200" };
      case "EM_ANDAMENTO":
        return { label: "Em Andamento", style: "bg-sky-50 text-sky-700 border-sky-200" };
      case "CONCLUIDO":
        return { label: "Concluído", style: "bg-slate-100 text-slate-700 border-slate-300" };
      default:
        return { label: st || "Pendente", style: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const variants = {
    default: "bg-jus-petroleum-100 text-jus-petroleum border-jus-petroleum/20",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  if (status) {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.style}`}>
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variant ? variants[variant] : variants.default}`}>
      {children}
    </span>
  );
};
