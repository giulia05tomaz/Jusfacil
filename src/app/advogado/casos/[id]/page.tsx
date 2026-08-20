"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import {
  getCaseById,
  getCaseEvidences,
  getCaseDrafts,
  getCaseUpdates,
} from "@/lib/firebase/services";
import { LegalCase, Evidence, DraftVersion, CaseUpdate } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";
import {
  ArrowLeft,
  FileText,
  Paperclip,
  Clock,
  ShieldAlert,
  FolderX,
  Download,
  Send,
  AlertTriangle,
  User,
  Info,
} from "lucide-react";

export default function LawyerCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<DraftVersion | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    async function load() {
      if (authLoading) return;

      if (!profile || profile.role !== "LAWYER" || profile.lawyerStatus !== "APPROVED") {
        setIsForbidden(true);
        setLoading(false);
        return;
      }

      try {
        const caseData = await getCaseById(caseId);
        if (!caseData) {
          setError("Caso não encontrado.");
          setLoading(false);
          return;
        }

        // Authorization check: assigned lawyer only
        if (caseData.assignedLawyerId !== profile.uid) {
          setIsForbidden(true);
          setLoading(false);
          return;
        }

        setLegalCase(caseData);

        const [evList, drList, upList] = await Promise.all([
          getCaseEvidences(caseId).catch(() => []),
          getCaseDrafts(caseId).catch(() => []),
          getCaseUpdates(caseId).catch(() => []),
        ]);

        setEvidences(evList);
        setDrafts(drList);
        setUpdates(upList);
        if (drList.length > 0) setSelectedDraft(drList[0]);
      } catch (err) {
        console.error("Error loading case detail for lawyer:", err);
        setError("Não foi possível carregar os dados deste caso.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [caseId, profile, authLoading]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const handleDownloadDraft = async (draft: DraftVersion) => {
    if (!legalCase) return;
    setDownloadingPdf(true);
    try {
      const pdf = generateDraftPdf(legalCase, draft);
      pdf.save(`minuta-caso-${legalCase.caseId}-v${draft.version}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="max-w-md mx-auto py-16">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso não autorizado"
          description="Você não possui permissão para visualizar este caso ou não é o advogado responsável."
          actionText="Voltar aos Meus Casos"
          onAction={() => router.push("/advogado/casos")}
        />
      </div>
    );
  }

  if (error || !legalCase) {
    return (
      <div className="max-w-md mx-auto py-16">
        <EmptyState
          icon={FolderX}
          title="Caso não encontrado"
          description={error || "O caso solicitado não foi localizado."}
          actionText="Voltar aos Meus Casos"
          onAction={() => router.push("/advogado/casos")}
        />
      </div>
    );
  }

  const structured = legalCase.structuredData;

  return (
    <div className="w-full min-w-0 max-w-3xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header with Back Button */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Link
          href="/advogado/casos"
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#002B43] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para meus casos</span>
        </Link>

        <Link href={`/advogado/atualizacoes?caseId=${caseId}`} className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            className="w-full rounded-[14px] bg-[#002B43] hover:bg-[#003A58] text-white flex items-center gap-1.5 text-xs sm:w-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar atualização</span>
          </Button>
        </Link>
      </div>

      {/* Main Header Card */}
      <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl sm:text-2xl font-bold text-[#002B43]">
              Caso {legalCase.caseId}
            </h1>
            {legalCase.courtProcessNumber ? (
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                Processo judicial nº {legalCase.courtProcessNumber}
              </p>
            ) : null}
          </div>
          <Badge status={legalCase.status} />
        </div>

        {legalCase.humanReviewReason && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-[12px] text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block">Motivo do encaminhamento para revisão:</strong>
              <p>{legalCase.humanReviewReason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Categoria</span>
            <span className="font-semibold text-slate-800">{legalCase.category || "Geral"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Cidadão</span>
            <span className="font-semibold text-slate-800">
              {legalCase.citizenName || "Cidadão vinculado"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Criado em</span>
            <span className="font-semibold text-slate-800">
              {formatDate(legalCase.createdAt)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Última atualização</span>
            <span className="font-semibold text-slate-800">
              {formatDate(legalCase.updatedAt || legalCase.createdAt)}
            </span>
          </div>
        </div>
      </Card>

      {/* BLOCO RESUMO DOS FATOS */}
      <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-3">
        <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
          <Info className="w-4 h-4 text-[#C08A4E]" />
          <span>Resumo dos Fatos</span>
        </h2>
        <p className="break-words text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
          {legalCase.originalStory || legalCase.summary || "Nenhum relato detalhado registrado."}
        </p>
      </Card>

      {/* DADOS ESTRUTURADOS JURÍDICOS */}
      {structured && (
        <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-4">
          <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C08A4E]" />
            <span>Dados Estruturados do Caso</span>
          </h2>

          <div className="space-y-3 text-xs">
            {structured.involvedParties && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Partes Envolvidas:</span>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {typeof structured.involvedParties === "string"
                    ? structured.involvedParties
                    : JSON.stringify(structured.involvedParties)}
                </p>
              </div>
            )}

            {structured.facts && Array.isArray(structured.facts) && structured.facts.length > 0 && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Fatos Relevantes:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  {structured.facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {structured.timeline && Array.isArray(structured.timeline) && structured.timeline.length > 0 && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Linha do Tempo dos Fatos:</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {structured.timeline.map((t, idx) => (
                    <div key={idx} className="relative">
                      <span className="text-[11px] font-semibold text-slate-800 block">
                        {t.date || "Data não especificada"}
                      </span>
                      <p className="text-slate-600">{t.event}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {structured.userGoal && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Objetivo do Cidadão:</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  {structured.userGoal}
                </p>
              </div>
            )}

            {structured.claimValue !== undefined && structured.claimValue !== null && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Valor Informado:</span>
                <p className="text-slate-600 font-mono">
                  {typeof structured.claimValue === "number"
                    ? `R$ ${structured.claimValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : String(structured.claimValue)}
                </p>
              </div>
            )}

            {structured.missingInformation && Array.isArray(structured.missingInformation) && structured.missingInformation.length > 0 && (
              <div>
                <span className="font-bold text-amber-700 block mb-1">Informações Pendentes / Faltantes:</span>
                <ul className="list-disc pl-4 space-y-1 text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  {structured.missingInformation.map((m: string, idx: number) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* MINUTAS JURÍDICAS */}
      <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C08A4E]" />
            <span>Minutas Jurídicas</span>
          </h2>
          <span className="text-xs text-slate-400">{drafts.length} versão(ões)</span>
        </div>

        {drafts.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhuma minuta gerada para este caso até o momento.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Version Selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {drafts.map((d) => (
                <button
                  key={d.version}
                  type="button"
                  onClick={() => setSelectedDraft(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedDraft?.version === d.version
                      ? "bg-[#002B43] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Versão {d.version} {d.approved ? "(Aprovada)" : ""}
                </button>
              ))}
            </div>

            {selectedDraft && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-200 pb-2 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-800">
                      {selectedDraft.title || `Minuta v${selectedDraft.version}`}
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      Criada em: {formatDate(selectedDraft.createdAt)}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadDraft(selectedDraft)}
                    disabled={downloadingPdf}
                    className="text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    <span>{downloadingPdf ? "Gerando..." : "Baixar PDF"}</span>
                  </Button>
                </div>

                <div className="text-xs text-slate-700 font-serif leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto bg-white p-4 rounded-lg border border-slate-200">
                  {selectedDraft.content}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* EVIDÊNCIAS & DOCUMENTOS */}
      <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-[#C08A4E]" />
            <span>Evidências e Documentos Anexados</span>
          </h2>
          <span className="text-xs text-slate-400">{evidences.length} arquivo(s)</span>
        </div>

        {evidences.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhum documento ou evidência anexado a este caso.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {evidences.map((ev) => (
              <div
                key={ev.evidenceId}
                className="py-3 flex min-w-0 flex-col items-start justify-between gap-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-0.5 sm:max-w-[70%]">
                  <span className="break-words font-semibold text-slate-800 block">
                    {ev.originalName}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{ev.mimeType || "Arquivo"}</span>
                    <span>•</span>
                    <span>{formatDate(ev.uploadedAt)}</span>
                  </div>
                  {ev.description && (
                    <p className="text-[11px] text-slate-500">{ev.description}</p>
                  )}
                </div>

                {ev.fileUrl && (
                  <a
                    href={ev.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#002B43] hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Abrir</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* HISTÓRICO DE ATUALIZAÇÕES (CaseUpdates) */}
      <Card className="min-w-0 bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 sm:p-6 border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C08A4E]" />
            <span>Histórico de Atualizações do Caso</span>
          </h2>
          <span className="text-xs text-slate-400">{updates.length} registro(s)</span>
        </div>

        {updates.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhuma atualização formal registrada ainda para este caso.
          </p>
        ) : (
          <div className="space-y-3">
            {updates.map((u) => (
              <div
                key={u.updateId}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-1.5 font-semibold text-[#002B43]">
                    <User className="w-3.5 h-3.5" />
                    <span>{u.createdByName || "Advogado"}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(u.createdAt)}
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed">{u.message}</p>

                {u.documentName && u.documentUrl && (
                  <div className="pt-2 border-t border-slate-200 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <span className="min-w-0 break-words text-[11px] text-slate-600 font-medium">
                      Documento: {u.documentName}
                    </span>
                    <a
                      href={u.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#002B43] hover:underline inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Baixar anexo</span>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
