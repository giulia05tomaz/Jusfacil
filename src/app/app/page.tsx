"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Scale, ArrowRight, CheckCircle2, Clock, Sparkles, Heart, FolderKanban } from "lucide-react";

export default function CitizenHomePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (profile?.uid) {
        try {
          const userCases = await getUserCases(profile.uid, "CITIZEN");
          setCases(userCases);
        } catch (error) {
          console.error("Error loading citizen cases:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    loadData();
  }, [profile]);

  const activeCases = cases.filter((c) => c.status !== "CONCLUIDO");
  const completedCases = cases.filter((c) => c.status === "CONCLUIDO");

  const formatCaseNumber = (c: LegalCase) => {
    if (c.courtProcessNumber) return c.courtProcessNumber;
    return `Caso ${c.caseId}`;
  };

  const formatDate = (dateValue: unknown) => {
    if (!dateValue) return "";
    const d = new Date(dateValue as string | number | Date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="hidden bg-gradient-to-r from-jus-petroleum via-jus-petroleum-dark to-slate-900 rounded-card p-4 sm:p-8 text-white shadow-card-elevated relative overflow-hidden lg:flex w-full min-w-0 max-w-full flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
        <div className="z-10 min-w-0 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-jus-caramel-light backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-jus-caramel" />
            <span>Assistente Jurídico com IA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Olá, {profile?.fullName ? profile.fullName.split(" ")[0] : "Cidadão"}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Acompanhe o andamento dos seus casos, consulte petições e receba orientações jurídicas personalizadas.
          </p>
        </div>

        <div className="z-10 w-full flex-shrink-0 sm:w-auto">
          <Link href="/app/processos/novo" className="block w-full sm:w-auto">
            <Button
              variant="secondary"
              size="lg"
              className="w-full visible opacity-100 shadow-xl hover:scale-105 transition-transform font-bold text-sm tracking-wide sm:w-auto"
              icon={<Scale className="w-5 h-5" />}
            >
              Abrir novo caso
            </Button>
          </Link>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-jus-caramel/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left 2 Columns: Cases Lists */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          {/* Section 1: Active Cases Updates (Tela 3 - Bloco 1) */}
          <Card className="space-y-4 p-5 shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="hidden w-5 h-5 text-jus-petroleum md:block" />
                <h2 className="text-base sm:text-lg font-bold text-jus-petroleum">
                  Atualizações dos casos
                </h2>
              </div>
              <Link
                href="/app/processos"
                className="hidden text-xs font-semibold text-jus-caramel hover:underline md:block"
              >
                Ver todos ({activeCases.length})
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : activeCases.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Nenhum caso ativo em andamento"
                description="Você ainda não possui casos ativos. Inicie um novo atendimento com o JurisBot para analisar seu direito e gerar sua petição."
                actionText="Abrir meu primeiro caso"
                onAction={() => router.push("/app/processos/novo")}
              />
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {activeCases.slice(0, 3).map((c) => (
                  <div
                    key={c.caseId}
                    className="flex min-w-0 items-start justify-between gap-3"
                  >
                    <Link
                      href={`/app/jurisbot/${c.caseId}`}
                      className="min-w-0 break-words text-xs font-medium text-[#0069B4] underline underline-offset-2"
                    >
                      {formatCaseNumber(c)}
                    </Link>
                    <span className="flex-shrink-0 text-[10px] text-slate-500">{formatDate(c.updatedAt)}</span>
                  </div>
                ))}
                <Link href="/app/processos" className="block pt-2 text-center text-sm font-medium text-slate-900 underline underline-offset-4">Ver Mais</Link>
              </div>
              <div className="hidden space-y-3 md:block">
                {activeCases.slice(0, 3).map((c) => (
                  <div key={c.caseId} className="p-4 rounded-xl border border-slate-200/80 hover:border-jus-petroleum/40 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between gap-3 group">
                    <div className="min-w-0 space-y-1"><div className="flex items-center gap-2 flex-wrap"><Link href={`/app/jurisbot/${c.caseId}`} className="break-words text-sm font-bold text-jus-petroleum hover:underline">{formatCaseNumber(c)}</Link><Badge status={c.status} /></div><p className="text-xs text-slate-600 font-medium line-clamp-1">{c.title || "Sem título"}</p><p className="text-[11px] text-slate-400">Última atualização: {formatDate(c.updatedAt)}</p></div>
                    <Link href={`/app/jurisbot/${c.caseId}`}><Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>Acessar</Button></Link>
                  </div>
                ))}
              </div>
              </>
            )}
          </Card>

          {/* Section 2: Completed Cases (Tela 3 - Bloco 2) */}
          <Card className="space-y-4 p-5 shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="hidden w-5 h-5 text-emerald-600 md:block" />
                <h2 className="text-base sm:text-lg font-bold text-jus-petroleum">
                  Casos concluídos
                </h2>
              </div>
              {completedCases.length > 0 && (
                <span className="hidden text-xs text-slate-500 font-medium md:block">
                  Total: {completedCases.length}
                </span>
              )}
            </div>

            {loading ? (
              <CardSkeleton />
            ) : completedCases.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                Nenhum caso concluído até o momento.
              </div>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {completedCases.slice(0, 3).map((c) => (
                  <div key={c.caseId} className="flex min-w-0 items-start justify-between gap-3">
                    <Link href={`/app/processos/${c.caseId}`} className="min-w-0 break-words text-xs font-medium text-[#0069B4] underline underline-offset-2">{formatCaseNumber(c)}</Link>
                    <span className="flex-shrink-0 text-[10px] text-slate-500">{formatDate(c.updatedAt)}</span>
                  </div>
                ))}
                <Link href="/app/processos" className="block pt-2 text-center text-sm font-medium text-slate-900 underline underline-offset-4">Ver Mais</Link>
              </div>
              <div className="hidden space-y-2 md:block">
                {completedCases.slice(0, 3).map((c) => (
                  <div
                    key={c.caseId}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="break-words text-xs font-bold text-slate-800 block">
                        {formatCaseNumber(c)}
                      </span>
                      <span className="break-words text-[11px] text-slate-500">{c.title}</span>
                    </div>
                    <Badge status="CONCLUIDO" />
                  </div>
                ))}
              </div>
              </>
            )}
          </Card>
        </div>

        {/* Right 1 Column: Promotional Banners (Tela 3 - Banners) */}
        <div className="min-w-0 space-y-6">
          {/* Banner 1: Abrir novo caso (Fundo Azul Petróleo) */}
          <div className="bg-jus-petroleum text-white rounded-[16px] p-6 shadow-[0_4px_10px_rgba(0,0,0,0.18)] relative overflow-hidden flex flex-col justify-between min-h-[220px] md:min-h-[260px]">
            <div className="z-10 max-w-[58%] space-y-2 sm:max-w-[200px]">
              <h3 className="text-2xl font-bold leading-tight md:text-xl md:font-serif">
                Abrir novo caso
              </h3>
              <p className="hidden text-xs text-slate-200 leading-relaxed md:block">
                Descreva sua situação ao JurisBot e receba uma minuta pronta em minutos.
              </p>
            </div>

            <div className="absolute right-3 top-1/2 w-36 -translate-y-1/2 opacity-100 pointer-events-none sm:w-[140px] md:right-0 md:top-auto md:bottom-0 md:translate-x-2 md:translate-y-2">
              <Image
                src="/img/robo_home.png"
                alt="JurisBot Robô"
                width={140}
                height={140}
                className="h-auto w-full object-contain"
              />
            </div>

            <div className="z-10 pt-4">
              <Link href="/app/processos/novo">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white text-jus-petroleum hover:bg-slate-100 font-bold text-xs py-2 px-5 shadow"
                >
                  Abrir agora
                </Button>
              </Link>
            </div>
          </div>

          {/* Banner 2: Ajude nosso aplicativo (Visual Bege/Caramelo) */}
          <div className="bg-[#E7D6C4] border border-jus-caramel-100 rounded-[16px] p-6 shadow-[0_4px_10px_rgba(0,0,0,0.16)] flex flex-col justify-between min-h-[220px] md:min-h-[240px] relative overflow-hidden">
            <div className="z-10 max-w-[64%] space-y-2 sm:max-w-[200px]">
              <div className="hidden items-center gap-1 text-jus-caramel font-bold text-[11px] uppercase tracking-wider md:flex">
                <Heart className="w-3.5 h-3.5 fill-current text-jus-caramel" />
                <span>Iniciativa Cidadã</span>
              </div>
              <h3 className="text-2xl font-bold text-[#634349] leading-tight md:text-lg md:text-slate-800">
                Ajude nosso aplicativo
              </h3>
              <p className="hidden text-xs text-slate-600 leading-relaxed md:block">
                Apoie o JusFácil na missão de democratizar a Justiça para todos os cidadãos.
              </p>
            </div>

            <div className="absolute right-2 bottom-2 pointer-events-none">
              <Image
                src="/img/help_us.png"
                alt="Apoiar JusFácil"
                width={132}
                height={132}
                className="object-contain opacity-90"
              />
            </div>

            <div className="z-10 pt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSupportModal(true)}
                className="bg-jus-caramel hover:bg-jus-caramel-hover text-white font-bold text-xs py-2 px-5 border-0"
              >
                Apoiar agora
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Support Modal */}
      <ConfirmDialog
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        onConfirm={() => setShowSupportModal(false)}
        title="Sobre a Iniciativa JusFácil"
        description="O JusFácil é uma plataforma dedicada a aproximar o cidadão brasileiro dos seus direitos fundamentais através de tecnologia, inteligência artificial e facilitação ao Juizado Especial Cível (Pequenas Causas). Agradecemos imensamente o seu apoio e engajamento!"
        confirmText="Concluir"
        cancelText="Fechar"
        variant="primary"
      />
    </div>
  );
}
