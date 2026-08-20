"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import {
  getUserCases,
  getCaseUpdates,
  getCaseDrafts,
  getUserNotifications,
} from "@/lib/firebase/services";
import { CaseUpdate, DraftVersion, NotificationItem } from "@/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton } from "@/components/ui/LoadingSkeleton";
import { ArrowLeft, BarChart3, PieChart as PieChartIcon, Bell, Inbox } from "lucide-react";
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

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function CitizenDashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updatesData, setUpdatesData] = useState<{ month: string; total: number }[]>([]);
  const [draftsData, setDraftsData] = useState<{ name: string; value: number }[]>([]);
  const [notifData, setNotifData] = useState<{ month: string; unread: number; read: number }[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!profile?.uid) return;
      setLoading(true);

      try {
        // 1. Obter todos os casos do cidadão
        const userCases = await getUserCases(profile.uid, "CITIZEN");

        // 2. Obter atualizações reais de todos os casos
        const caseUpdatesPromises = userCases.map((c) =>
          getCaseUpdates(c.caseId).catch(() => [] as CaseUpdate[])
        );
        const caseDraftsPromises = userCases.map((c) =>
          getCaseDrafts(c.caseId).catch(() => [] as DraftVersion[])
        );
        const notificationsPromise = getUserNotifications(profile.uid).catch(() => [] as NotificationItem[]);

        const [allUpdatesNested, allDraftsNested, allNotifs] = await Promise.all([
          Promise.all(caseUpdatesPromises),
          Promise.all(caseDraftsPromises),
          notificationsPromise,
        ]);

        const allUpdates = allUpdatesNested.flat();
        const allDrafts = allDraftsNested.flat();

        // 3. Montar Bar Chart 1: Atualizações por Mês (últimos 6 meses)
        const now = new Date();
        const last6Months: { key: string; label: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = MONTH_NAMES[d.getMonth()];
          last6Months.push({ key, label, total: 0 });
        }

        allUpdates.forEach((upd) => {
          if (upd.createdAt) {
            const updDate = new Date(upd.createdAt);
            const key = `${updDate.getFullYear()}-${String(updDate.getMonth() + 1).padStart(2, "0")}`;
            const target = last6Months.find((m) => m.key === key);
            if (target) {
              target.total += 1;
            }
          }
        });

        const totalUpdatesCount = last6Months.reduce((acc, m) => acc + m.total, 0);
        setUpdatesData(totalUpdatesCount > 0 ? last6Months.map((m) => ({ month: m.label, total: m.total })) : []);

        // 4. Montar Donut Chart 2: Minutas (Aprovadas x Alterações Solicitadas)
        let approvedCount = 0;
        let changeRequestedCount = 0;

        allDrafts.forEach((draft) => {
          if (draft.approved) {
            approvedCount++;
          } else {
            changeRequestedCount++;
          }
        });

        if (approvedCount > 0 || changeRequestedCount > 0) {
          setDraftsData([
            { name: "Aprovadas", value: approvedCount },
            { name: "Alterações solicitadas", value: changeRequestedCount },
          ].filter((d) => d.value > 0));
        } else {
          setDraftsData([]);
        }

        // 5. Montar Bar Chart 3: Notificações por Mês (Recebidas / Não lidas x Visualizadas)
        const notifMonths: { key: string; label: string; unread: number; read: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = MONTH_NAMES[d.getMonth()];
          notifMonths.push({ key, label, unread: 0, read: 0 });
        }

        allNotifs.forEach((n) => {
          if (n.createdAt) {
            const nDate = new Date(n.createdAt);
            const key = `${nDate.getFullYear()}-${String(nDate.getMonth() + 1).padStart(2, "0")}`;
            const target = notifMonths.find((m) => m.key === key);
            if (target) {
              if (n.read) {
                target.read += 1;
              } else {
                target.unread += 1;
              }
            }
          }
        });

        const totalNotifsCount = notifMonths.reduce((acc, m) => acc + m.read + m.unread, 0);
        setNotifData(
          totalNotifsCount > 0
            ? notifMonths.map((m) => ({
                month: m.label,
                unread: m.unread,
                read: m.read,
              }))
            : []
        );
      } catch (err) {
        console.error("Erro ao carregar dados analíticos do cidadão:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [profile]);

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Fiel ao Figma */}
      <div className="relative -mx-4 -mt-4 flex min-h-14 w-[calc(100%+2rem)] min-w-0 items-center justify-center border-b border-slate-200 bg-white px-12 py-3 shadow-sm sm:mx-0 sm:mt-0 sm:w-full sm:justify-start sm:rounded-[18px] sm:border sm:p-5">
        <button
          onClick={() => router.push("/app")}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors cursor-pointer md:hidden"
          title="Voltar ao Início"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-medium text-slate-700 sm:text-2xl sm:font-bold sm:font-serif sm:text-[#002B43]">
            Dashboard
          </h1>
          <p className="hidden text-xs text-slate-500 mt-0.5 sm:block">
            Acompanhe o andamento geral e o histórico de interações com seus casos
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CARD 1: ATUALIZAÇÕES */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                  <BarChart3 className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                  <span>Atualizações</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Últimos 6 meses</span>
              </div>
            </div>

            <div className="h-64 w-full min-w-0 flex items-center justify-center">
              {updatesData.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Sem atualizações"
                  description="Ainda não há atualizações suficientes para gerar este gráfico."
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

          {/* CARD 2: MINUTAS */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                    <PieChartIcon className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                    <span>Minutas</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Aprovadas x alterações solicitadas
                  </p>
                </div>
              </div>
            </div>

            <div className="h-64 w-full min-w-0 flex items-center justify-center">
              {draftsData.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Sem minutas"
                  description="Ainda não há minutas suficientes para gerar este gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={draftsData}
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

          {/* CARD 3: NOTIFICAÇÕES */}
          <Card className="min-w-0 overflow-hidden p-4 sm:p-6 flex flex-col justify-between space-y-4 shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-[#002B43] flex items-center gap-2">
                  <Bell className="hidden w-4 h-4 text-[#C08A4E] sm:block" />
                  <span>Notificações</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Por mês</span>
              </div>
            </div>

            <div className="h-64 w-full min-w-0 flex items-center justify-center">
              {notifData.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Sem notificações"
                  description="Ainda não há notificações suficientes para gerar este gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={notifData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6E7580" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6E7580" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => (
                        <span className="text-xs text-slate-700 font-medium">
                          {val === "unread" ? "Não lidas" : "Visualizadas"}
                        </span>
                      )}
                    />
                    <Bar dataKey="unread" name="unread" fill="#C08A4E" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="read" name="read" fill="#002B43" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
