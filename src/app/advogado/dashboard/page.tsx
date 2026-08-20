"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases, getCaseUpdates } from "@/lib/firebase/services";
import { LegalCase, CaseUpdate } from "@/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  ArrowLeft,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Inbox,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function LawyerDashboardPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [lawyerUpdates, setLawyerUpdates] = useState<CaseUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile?.uid || profile.lawyerStatus !== "APPROVED") {
        setLoading(false);
        return;
      }

      try {
        const assignedCases = await getUserCases(profile.uid, "LAWYER");
        setCases(assignedCases);

        // Fetch updates from all assigned cases
        const allUpdates: CaseUpdate[] = [];
        for (const c of assignedCases) {
          try {
            const ups = await getCaseUpdates(c.caseId);
            // Filter only updates sent by this lawyer
            const authored = ups.filter((u) => u.createdBy === profile.uid);
            allUpdates.push(...authored);
          } catch {
            // Ignore single case error
          }
        }

        setLawyerUpdates(allUpdates);
      } catch (err) {
        console.error("Error loading lawyer dashboard analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [profile]);

  // CARD 1: Atualizações enviadas (últimos 6 meses)
  const updatesData = React.useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    const result: { month: string; total: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const count = lawyerUpdates.filter((u) => {
        if (!u.createdAt) return false;
        const uDate = new Date(u.createdAt);
        return uDate.getMonth() === mIdx && uDate.getFullYear() === yr;
      }).length;

      result.push({ month: `${monthNames[mIdx]}`, total: count });
    }

    return result;
  }, [lawyerUpdates]);

  const hasAnyUpdates = lawyerUpdates.length > 0;

  // CARD 2: Casos (Em andamento x Concluídos)
  const { casesDonutData, inProgressCount, completedCount, totalAssigned } = React.useMemo(() => {
    const completed = cases.filter((c) => c.status === "CONCLUIDO").length;
    const inProgress = cases.filter((c) => c.status !== "CONCLUIDO").length;
    const total = cases.length;

    const data = [
      { name: "Em andamento", value: inProgress },
      { name: "Concluídos", value: completed },
    ].filter((item) => item.value > 0);

    return {
      casesDonutData: data,
      inProgressCount: inProgress,
      completedCount: completed,
      totalAssigned: total,
    };
  }, [cases]);

  const awaitingReviewCount = cases.filter(
    (c) => c.status === "AGUARDANDO_REVISAO" || c.status === "REVISAO_HUMANA" || c.requiresHumanReview
  ).length;

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-5 animate-fadeIn pb-12">
      {/* Header com estilo padrão */}
      <div className="-mx-4 -mt-6 bg-[#E4E1E9] px-4 py-7 sm:mx-0 sm:mt-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="space-y-1">
          <div className="relative flex items-center justify-center gap-2 sm:justify-start">
            <Link
              href="/advogado"
              className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#002B43] hover:bg-slate-100 transition-colors shadow-sm sm:static"
              title="Voltar à Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-3xl font-bold text-[#002B43] tracking-tight">
              Dashboard
            </h1>
          </div>
          <p className="hidden text-xs text-[#6E7580] sm:block">
            Métricas de desempenho e acompanhamento de casos atribuídos
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD 1: ATUALIZAÇÕES ENVIADAS */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 bg-white rounded-[18px] border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                  <BarChart3 className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                  <span>Atualizações enviadas</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Por mês</span>
              </div>
            </div>

            <div className="h-64 w-full min-w-0 flex items-center justify-center">
              {!hasAnyUpdates ? (
                <EmptyState
                  icon={Inbox}
                  title="Sem dados de atualizações"
                  description="Ainda não há dados suficientes para gerar este gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={updatesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6E7580" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6E7580" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      formatter={(val) => [`${val ?? 0} atualização(ões)`, "Total"]}
                    />
                    <Bar dataKey="total" fill="#002B43" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* CARD 2: CASOS */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 bg-white rounded-[18px] border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                    <PieChartIcon className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                    <span>Casos</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Em andamento x Concluídos
                  </p>
                </div>
                {totalAssigned > 0 && (
                  <span className="text-xs font-bold text-[#002B43] bg-slate-100 px-2 py-1 rounded-md">
                    Total: {totalAssigned}
                  </span>
                )}
              </div>
            </div>

            <div className="h-64 w-full min-w-0 flex items-center justify-center">
              {totalAssigned === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Sem casos atribuídos"
                  description="Ainda não há dados suficientes para gerar este gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={casesDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      <Cell fill="#002B43" />
                      <Cell fill="#C08A4E" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      formatter={(val, name) => {
                        const num = Number(val) || 0;
                        const pct = totalAssigned > 0 ? Math.round((num / totalAssigned) * 100) : 0;
                        return [`${num} caso(s) (${pct}%)`, String(name)];
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span className="text-xs text-slate-700 font-medium">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* CARD 3: ATIVIDADE */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 bg-white rounded-[18px] border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.12)] md:col-span-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                  <Activity className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                  <span>Atividade</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Resumo operacional</span>
              </div>
            </div>

            {totalAssigned === 0 ? (
              <div className="py-8">
                <EmptyState
                  icon={Inbox}
                  title="Sem atividade registrada"
                  description="Ainda não há dados suficientes para gerar este gráfico."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold font-serif text-amber-800 block">
                    {awaitingReviewCount}
                  </span>
                  <span className="text-xs text-amber-900 font-medium">Aguardando revisão</span>
                </div>

                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold font-serif text-blue-900 block">
                    {inProgressCount}
                  </span>
                  <span className="text-xs text-blue-900 font-medium">Em andamento</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold font-serif text-emerald-800 block">
                    {completedCount}
                  </span>
                  <span className="text-xs text-emerald-900 font-medium">Concluídos</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
