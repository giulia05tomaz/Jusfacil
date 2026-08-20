"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases, getCaseUpdates } from "@/lib/firebase/services";
import { LegalCase, CaseUpdate } from "@/types";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ChevronRight, ArrowRight } from "lucide-react";

export default function LawyerHomePage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [updates, setUpdates] = useState<{ caseItem: LegalCase; update: CaseUpdate }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.uid || profile.lawyerStatus !== "APPROVED") {
        setLoading(false);
        return;
      }

      try {
        const assignedCases = await getUserCases(profile.uid, "LAWYER");
        setCases(assignedCases);

        // Fetch recent updates for up to 10 assigned cases
        const updatesList: { caseItem: LegalCase; update: CaseUpdate }[] = [];
        const recentCasesSlice = assignedCases.slice(0, 10);

        for (const c of recentCasesSlice) {
          try {
            const caseUps = await getCaseUpdates(c.caseId);
            for (const u of caseUps) {
              updatesList.push({ caseItem: c, update: u });
            }
          } catch {
            // Ignore failure on single case update query
          }
        }

        // Sort updates by createdAt descending
        updatesList.sort((a, b) => {
          const tA = a.update.createdAt ? new Date(a.update.createdAt).getTime() : 0;
          const tB = b.update.createdAt ? new Date(b.update.createdAt).getTime() : 0;
          return tB - tA;
        });

        setUpdates(updatesList.slice(0, 3));
      } catch (err) {
        console.error("Error loading lawyer home:", err);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [profile]);

  const isPending = profile?.lawyerStatus === "PENDING";
  const isRejected = profile?.lawyerStatus === "REJECTED";
  const isSuspended = profile?.lawyerStatus === "SUSPENDED";

  if (isPending || isRejected || isSuspended) {
    const title = isPending
      ? "Seu cadastro profissional está em análise."
      : isSuspended
      ? "Seu acesso profissional está suspenso."
      : "Seu cadastro profissional não foi aprovado.";
    const subtext = isPending
      ? "Você poderá visualizar casos após a aprovação do seu cadastro."
      : "Entre em contato com a equipe de suporte para mais detalhes.";

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] p-8 text-center border border-slate-100 space-y-3">
          <h1 className="text-xl font-bold text-[#002B43]">{title}</h1>
          <p className="text-sm text-[#6E7580] leading-relaxed">{subtext}</p>
        </div>
      </div>
    );
  }

  const myCases = cases.slice(0, 3);
  const completedCases = cases.filter((c) => c.status === "CONCLUIDO").slice(0, 3);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto space-y-6 animate-fadeIn pb-8">
      {loading ? (
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* CARD 1: MEUS CASOS */}
          <Card className="bg-white rounded-[18px] shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-5 sm:p-6 border border-slate-100">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#202020] mb-4">
              Meus casos
            </h2>

            {myCases.length === 0 ? (
              <p className="text-xs text-[#6E7580] py-3">
                Você ainda não possui casos atribuídos.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myCases.map((c) => (
                  <Link
                    key={c.caseId}
                    href={`/advogado/casos/${c.caseId}`}
                    className="flex min-w-0 items-center justify-between gap-2 py-2 hover:bg-slate-50/80 px-1 rounded-xl transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="break-words text-sm font-semibold text-[#002B43] group-hover:underline block">
                        Caso {c.caseId}
                      </span>
                      <span className="text-xs text-[#6E7580]">
                        {formatDate(c.updatedAt || c.createdAt)}
                      </span>
                    </div>
                    <ChevronRight className="hidden w-4 h-4 text-slate-400 group-hover:text-[#002B43] transition-colors sm:block" />
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 mt-2 text-center sm:text-left">
              <Link
                href="/advogado/casos"
                className="text-xs font-semibold text-[#002B43] hover:underline inline-flex items-center gap-1"
              >
                <span>Ver mais</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Card>

          {/* CARD 2: ATUALIZAÇÕES DOS CASOS */}
          <Card className="bg-white rounded-[18px] shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-5 sm:p-6 border border-slate-100">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#202020] mb-4">
              Atualizações dos casos
            </h2>

            {updates.length === 0 ? (
              <p className="text-xs text-[#6E7580] py-3">
                Nenhuma atualização recente nos casos atribuídos.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {updates.map(({ caseItem, update }) => (
                  <Link
                    key={update.updateId}
                    href={`/advogado/casos/${caseItem.caseId}`}
                    className="flex min-w-0 items-center justify-between gap-2 py-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="break-words text-sm font-semibold text-[#002B43] group-hover:underline block">
                        Caso {caseItem.caseId}
                      </span>
                      <p className="hidden break-words text-xs text-[#6E7580] line-clamp-2 sm:block">{update.message}</p>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {formatDate(update.createdAt)}
                      </span>
                    </div>
                    <ChevronRight className="hidden w-4 h-4 text-slate-400 group-hover:text-[#002B43] transition-colors flex-shrink-0 sm:block" />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* CARD 3: CASOS CONCLUÍDOS */}
          <Card className="bg-white rounded-[18px] shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-5 sm:p-6 border border-slate-100">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#202020] mb-4">
              Casos concluídos
            </h2>

            {completedCases.length === 0 ? (
              <p className="text-xs text-[#6E7580] py-3">
                Nenhum caso concluído no momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedCases.map((c) => (
                  <Link
                    key={c.caseId}
                    href={`/advogado/casos/${c.caseId}`}
                    className="flex min-w-0 items-center justify-between gap-2 py-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="break-words text-sm font-semibold text-[#002B43] group-hover:underline block">
                        Caso {c.caseId}
                      </span>
                      <span className="text-xs text-[#6E7580]">
                        {formatDate(c.updatedAt || c.createdAt)}
                      </span>
                    </div>
                    <ChevronRight className="hidden w-4 h-4 text-slate-400 group-hover:text-[#002B43] transition-colors sm:block" />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* BANNER INFERIOR */}
          <div className="w-full min-w-0 bg-[#002B43] rounded-[18px] p-5 sm:p-7 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <h3 className="text-lg sm:text-xl font-bold text-center sm:text-left">
              Enviar atualização de caso
            </h3>

            <Link href="/advogado/atualizacoes" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto bg-white hover:bg-slate-100 text-[#002B43] font-bold px-6 py-3 rounded-[14px] text-sm transition-all shadow-sm active:scale-[0.98]"
              >
                Enviar agora
              </button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
