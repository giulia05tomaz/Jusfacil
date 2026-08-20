"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import {
  getCaseById,
  getCaseUpdates,
  getCaseDrafts,
  getCaseEvidences,
} from "@/lib/firebase/services";
import { LegalCase, CaseUpdate, DraftVersion, Evidence } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  ArrowLeft,
  Bot,
  FileText,
  Paperclip,
  Clock,
  AlertCircle,
  Scale,
  Download,
  UserCheck,
  ShieldAlert,
  FolderX,
} from "lucide-react";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";
import { getFriendlyError } from "@/lib/errors";

const STATUS_STEPS = [
  { key: "TRIAGEM", label: "Triagem" },
  { key: "COLETANDO_INFORMACOES", label: "Informações" },
  { key: "COLETANDO_EVIDENCIAS", label: "Evidências" },
  { key: "PREPARANDO_MINUTA", label: "Minuta" },
  { key: "AGUARDANDO_REVISAO", label: "Revisão" },
  { key: "CONCLUIDO", label: "Concluído" },
];

function getStatusStepIndex(status: string): number {
  switch (status) {
    case "TRIAGEM":
      return 0;
    case "COLETANDO_INFORMACOES":
    case "AGUARDANDO_INFORMACOES":
    case "ANALISANDO":
      return 1;
    case "COLETANDO_EVIDENCIAS":
    case "NECESSITA_ESCLARECIMENTO":
      return 2;
    case "PREPARANDO_MINUTA":
    case "AJUSTANDO_MINUTA":
    case "MINUTA_APROVADA":
    case "PRONTO_PARA_PROTOCOLO":
      return 3;
    case "AGUARDANDO_REVISAO":
    case "REVISAO_HUMANA":
    case "ENCAMINHADO_ADVOGADO":
    case "EM_ANDAMENTO":
      return 4;
    case "CONCLUIDO":
      return 5;
    default:
      return 0;
  }
}

function formatDate(dateValue: unknown): string {
  if (!dateValue) return "";
  const d = new Date(dateValue as string | number | Date);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function CitizenCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = (params?.id as string) || "";
  const { profile } = useAuth();

  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  useEffect(() => {
    async function load() {
      if (!caseId || !profile?.uid) return;
      setLoading(true);
      setError(null);
      setIsForbidden(false);

      try {
        const c = await getCaseById(caseId);
        if (!c) {
          setError("Caso não encontrado.");
          return;
        }

        // Segurança: verificar se o caso pertence ao cidadão logado
        if (c.citizenId !== profile.uid && profile.role !== "ADMIN") {
          setIsForbidden(true);
          return;
        }

        setLegalCase(c);

        const [upds, drfs, evs] = await Promise.all([
          getCaseUpdates(caseId).catch(() => []),
          getCaseDrafts(caseId).catch(() => []),
          getCaseEvidences(caseId).catch(() => []),
        ]);

        setUpdates(upds);
        setDrafts(drfs);
        setEvidences(evs);
      } catch (err) {
        setError(getFriendlyError(err));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [caseId, profile]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn py-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="py-12">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso não autorizado"
          description="Você não tem permissão para visualizar os detalhes deste caso."
          actionText="Voltar aos Meus Casos"
          onAction={() => router.push("/app/processos")}
        />
      </div>
    );
  }

  if (error || !legalCase) {
    return (
      <div className="py-12">
        <EmptyState
          icon={FolderX}
          title="Caso não encontrado"
          description={error || "Não foi possível carregar os detalhes do caso informado."}
          actionText="Voltar aos Meus Casos"
          onAction={() => router.push("/app/processos")}
        />
      </div>
    );
  }

  const currentStep = getStatusStepIndex(legalCase.status);

  // Helper para determinar a recomendação do próximo passo
  const getNextStepMessage = () => {
    if (
      legalCase.status === "TRIAGEM" ||
      legalCase.status === "COLETANDO_INFORMACOES" ||
      legalCase.status === "AGUARDANDO_INFORMACOES" ||
      legalCase.status === "ANALISANDO"
    ) {
      return {
        text: "Continue respondendo às perguntas do JurisBot para estruturar as informações.",
        actionLabel: "Continuar no JurisBot",
        actionUrl: `/app/jurisbot/${caseId}`,
      };
    }
    if (
      legalCase.status === "COLETANDO_EVIDENCIAS" ||
      legalCase.status === "NECESSITA_ESCLARECIMENTO"
    ) {
      return {
        text: "Envie as evidências e comprovantes solicitados para anexar ao seu caso.",
        actionLabel: "Enviar evidências",
        actionUrl: `/app/jurisbot/${caseId}`,
      };
    }
    if (
      legalCase.status === "PREPARANDO_MINUTA" ||
      legalCase.status === "AJUSTANDO_MINUTA" ||
      legalCase.status === "MINUTA_APROVADA" ||
      legalCase.status === "PRONTO_PARA_PROTOCOLO"
    ) {
      return {
        text: "Sua minuta está pronta para conferência e aprovação.",
        actionLabel: "Revisar minuta",
        actionUrl: `/app/jurisbot/${caseId}`,
      };
    }
    if (
      legalCase.status === "AGUARDANDO_REVISAO" ||
      legalCase.status === "REVISAO_HUMANA" ||
      legalCase.status === "ENCAMINHADO_ADVOGADO" ||
      legalCase.status === "EM_ANDAMENTO"
    ) {
      return {
        text: "Seu caso está aguardando revisão humana por um advogado habilitado.",
        actionLabel: "Ver no JurisBot",
        actionUrl: `/app/jurisbot/${caseId}`,
      };
    }
    if (legalCase.status === "CONCLUIDO") {
      return {
        text: "Atendimento concluído. Você pode consultar o histórico e baixar a petição.",
        actionLabel: "Consultar histórico",
        actionUrl: `/app/jurisbot/${caseId}`,
      };
    }
    return {
      text: "Não há nenhuma ação necessária no momento.",
      actionLabel: "Abrir JurisBot",
      actionUrl: `/app/jurisbot/${caseId}`,
    };
  };

  const nextStep = getNextStepMessage();

  // Montar timeline combinando eventos reais
  interface TimelineEvent {
    id: string;
    date: string;
    title: string;
    description: string;
    icon: "create" | "update" | "draft" | "evidence" | "lawyer" | "complete";
  }

  const timelineEvents: TimelineEvent[] = [];

  if (legalCase.createdAt) {
    timelineEvents.push({
      id: "case-created",
      date: legalCase.createdAt,
      title: "Caso criado",
      description: "Atendimento iniciado pelo cidadão com auxílio do JurisBot.",
      icon: "create",
    });
  }

  evidences.forEach((e) => {
    timelineEvents.push({
      id: `ev-${e.evidenceId}`,
      date: e.uploadedAt,
      title: `Evidência: ${e.originalName}`,
      description: e.description || `Arquivo anexado (${e.mimeType || "documento"}).`,
      icon: "evidence",
    });
  });

  drafts.forEach((d) => {
    timelineEvents.push({
      id: `draft-v${d.version}`,
      date: d.createdAt,
      title: `Minuta - Versão ${d.version}`,
      description: d.approved ? "Minuta aprovada pelo cidadão." : "Versão da minuta gerada.",
      icon: "draft",
    });
  });

  updates.forEach((u) => {
    timelineEvents.push({
      id: `upd-${u.updateId}`,
      date: u.createdAt,
      title: `Atualização de ${u.createdByName || "Advogado"}`,
      description: u.message,
      icon: "update",
    });
  });

  if (legalCase.assignedLawyerName) {
    timelineEvents.push({
      id: "lawyer-assigned",
      date: legalCase.updatedAt,
      title: "Advogado atribuído",
      description: `Responsável técnico: ${legalCase.assignedLawyerName}.`,
      icon: "lawyer",
    });
  }

  if (legalCase.status === "CONCLUIDO") {
    timelineEvents.push({
      id: "case-completed",
      date: legalCase.updatedAt,
      title: "Caso concluído",
      description: "O atendimento deste caso foi finalizado com sucesso.",
      icon: "complete",
    });
  }

  // Ordenar cronologicamente decrescente
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full min-w-0 max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header com Navegação */}
      <div className="flex w-full min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-[18px] border border-slate-200/80 shadow-sm">
        <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
          <button
            onClick={() => router.push("/app/processos")}
            className="p-2 text-slate-400 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Voltar aos Meus Casos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="min-w-0 break-words text-base sm:text-xl font-bold text-jus-petroleum font-serif">
                {legalCase.courtProcessNumber
                  ? `Processo judicial nº ${legalCase.courtProcessNumber}`
                  : `Caso ${legalCase.caseId}`}
              </h1>
              <Badge status={legalCase.status} />
            </div>
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              {legalCase.title || "Atendimento Jurídico"}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 flex-wrap sm:w-auto">
          <Link href={`/app/jurisbot/${caseId}`} className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              icon={<Bot className="w-4 h-4" />}
              className="w-full bg-[#002B43] text-white sm:w-auto"
            >
              Continuar no JurisBot
            </Button>
          </Link>
        </div>
      </div>

      {/* Card de Próximo Passo Destacado */}
      <div className="w-full min-w-0 bg-gradient-to-r from-[#002B43] to-[#003A58] text-white p-4 sm:p-6 rounded-[18px] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1 max-w-2xl">
          <span className="text-[11px] uppercase tracking-wider text-[#E7D6C4] font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Próximo Passo Recomendado</span>
          </span>
          <p className="text-sm sm:text-base text-slate-100 font-medium">
            {nextStep.text}
          </p>
        </div>
        <Link href={nextStep.actionUrl} className="w-full flex-shrink-0 sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            className="w-full visible opacity-100 font-semibold shadow-sm sm:w-auto"
          >
            {nextStep.actionLabel}
          </Button>
        </Link>
      </div>

      {/* Barra Visual de Status / Progresso */}
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Andamento do Atendimento
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {STATUS_STEPS.map((step, idx) => {
            const isPassed = idx <= currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div
                key={step.key}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isCurrent
                    ? "bg-[#002B43] text-white border-[#002B43] shadow-sm"
                    : isPassed
                    ? "bg-slate-50 text-[#002B43] border-slate-200 font-medium"
                    : "bg-slate-50/50 text-slate-400 border-slate-100"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? "bg-[#C08A4E] text-white"
                      : isPassed
                      ? "bg-[#002B43] text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="text-xs font-semibold leading-tight">{step.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Grid de 2 Colunas: Detalhes & Minutas / Evidências */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda (2 cols): Resumo e Linha do Tempo */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          {/* Card Resumo */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-jus-petroleum flex items-center gap-2 border-b border-slate-100 pb-3">
              <Scale className="w-5 h-5 text-jus-caramel" />
              <span>Resumo do Caso</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Categoria</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {legalCase.legalArea || legalCase.category || "Direito do Consumidor"}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Status Atual</span>
                <Badge status={legalCase.status} />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Data de Criação</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(legalCase.createdAt)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Última Atualização</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(legalCase.updatedAt)}
                </span>
              </div>
            </div>

            {legalCase.assignedLawyerName && (
              <div className="bg-[#F1F4F8] border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-[#002B43] flex-shrink-0" />
                <span>
                  Advogado Responsável: <strong>{legalCase.assignedLawyerName}</strong>
                </span>
              </div>
            )}

            {legalCase.summary && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-bold text-slate-600 block uppercase">
                  Descrição dos Fatos
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {legalCase.summary}
                </p>
              </div>
            )}
          </Card>

          {/* Linha do Tempo */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-jus-petroleum flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5 text-jus-caramel" />
              <span>Linha do Tempo de Atualizações</span>
            </h2>

            {timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Nenhum evento registrado até o momento.
              </p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                {timelineEvents.map((evt) => (
                  <div key={evt.id} className="relative space-y-1">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#002B43] ring-4 ring-white" />
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <h3 className="min-w-0 break-words text-xs font-bold text-slate-800">{evt.title}</h3>
                      <span className="flex-shrink-0 text-[10px] text-slate-400">{formatDate(evt.date)}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Coluna Direita (1 col): Minutas & Evidências */}
        <div className="min-w-0 space-y-6">
          {/* Minutas de Petição */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-jus-petroleum flex items-center gap-2">
                <FileText className="w-4 h-4 text-jus-caramel" />
                <span>Minutas de Petição</span>
              </h2>
              <span className="text-xs text-slate-400">Total: {drafts.length}</span>
            </div>

            {drafts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                Ainda não há minuta gerada para este caso.
              </p>
            ) : (
              <div className="space-y-2.5">
                {drafts.map((d) => (
                  <div
                    key={d.version}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        Versão {d.version}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                          d.approved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.approved ? "Aprovada" : "Aguardando Revisão"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() =>
                          generateDraftPdf(legalCase, d).save(
                            `Minuta_${caseId}_v${d.version}.pdf`
                          )
                        }
                        icon={<Download className="w-3.5 h-3.5" />}
                      >
                        PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Evidências e Documentos */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-jus-petroleum flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-jus-caramel" />
                <span>Documentos & Provas</span>
              </h2>
              <span className="text-xs text-slate-400">Total: {evidences.length}</span>
            </div>

            {evidences.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                Nenhum documento anexado ainda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {evidences.map((e) => (
                  <div
                    key={e.evidenceId}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 break-words text-xs font-bold text-slate-800">
                        {e.originalName}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {e.status || "Enviado"}
                      </span>
                    </div>
                    {e.description && (
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {e.description}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      {formatDate(e.uploadedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
