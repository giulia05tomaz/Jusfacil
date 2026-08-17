"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Scale, ArrowRight, CheckCircle2, Clock, Sparkles, Heart } from "lucide-react";

export default function CitizenHomePage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);

  useEffect(() => {
    async function loadData() {
      if (profile?.uid) setCases(await getUserCases(profile.uid, "CITIZEN"));
    }
    loadData();
  }, [profile]);

  const activeCases = cases.filter((c) => c.status !== "CONCLUIDO");
  const completedCases = cases.filter((c) => c.status === "CONCLUIDO");

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-jus-petroleum to-jus-petroleum-dark rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-jus-caramel-light backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-jus-caramel" />
            <span>Assistente Jurídico Digital</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">
            Olá, {profile?.fullName ? profile.fullName.split(" ")[0] : "Cidadão"}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Acompanhe a movimentação das suas demandas jurídicas ou inicie um novo atendimento guiado pelo JurisBot.
          </p>
        </div>

        <div className="z-10 flex-shrink-0">
          <Link href="/app/processos/novo">
            <Button
              variant="secondary"
              size="lg"
              className="shadow-xl hover:scale-105 transition-transform font-bold text-sm tracking-wide"
              icon={<Scale className="w-5 h-5" />}
            >
              Abrir Novo Processo
            </Button>
          </Link>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-jus-caramel/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Cases Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Active Cases Updates */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-jus-petroleum" />
                <h2 className="text-lg font-bold text-jus-petroleum">Atualizações de Processos</h2>
              </div>
              <Link href="/app/processos" className="text-xs font-semibold text-jus-caramel hover:underline">
                Ver Todos ({activeCases.length})
              </Link>
            </div>

            {activeCases.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 mb-3">Você ainda não possui processos ativos em andamento.</p>
                <Link href="/app/processos/novo">
                  <Button variant="outline" size="sm">
                    Iniciar primeiro caso agora
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCases.map((c) => (
                  <div
                    key={c.caseId}
                    className="p-4 rounded-xl border border-slate-100 hover:border-jus-petroleum/30 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/app/jurisbot/${c.caseId}`}
                        className="text-sm font-semibold text-jus-petroleum hover:underline flex items-center gap-1.5"
                      >
                        <span>{c.title}</span>
                      </Link>
                      <p className="text-xs text-slate-500 line-clamp-1">{c.summary}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge status={c.status} />
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <Link href={`/app/jurisbot/${c.caseId}`}>
                      <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                        Continuar
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section 2: Completed Cases */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-jus-petroleum">Processos Concluídos</h2>
              </div>
            </div>

            {completedCases.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                Nenhum processo concluído até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {completedCases.map((c) => (
                  <div
                    key={c.caseId}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <span className="text-xs font-medium text-slate-700">{c.title}</span>
                    <Badge status="CONCLUIDO" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Column: Promotional CTAs matching Prototype */}
        <div className="space-y-6">
          {/* Card: Abrir novo processo (Matching Prototype PDF Page 3) */}
          <div className="bg-jus-petroleum text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-72">
            <div className="space-y-2 z-10">
              <h3 className="text-2xl font-bold font-serif">Abrir novo processo</h3>
              <p className="text-xs text-slate-200">
                Descreva seus fatos ao JurisBot e obtenha a petição pronta para ingresso em pequenas causas.
              </p>
            </div>

            <div className="absolute right-2 bottom-2 opacity-90 hover:scale-105 transition-transform pointer-events-none">
              <Image
                src="/img/robo_home.png"
                alt="JurisBot Robo"
                width={120}
                height={120}
                className="object-contain"
              />
            </div>

            <div className="z-10 pt-4">
              <Link href="/app/processos/novo">
                <Button
                  variant="secondary"
                  className="bg-white text-jus-petroleum hover:bg-slate-100 font-bold text-xs py-2.5 px-6"
                >
                  Abrir agora
                </Button>
              </Link>
            </div>
          </div>

          {/* Card: Ajude nosso aplicativo (Matching Prototype PDF Page 3) */}
          <div className="bg-jus-caramel-50 border border-jus-caramel-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-64 relative overflow-hidden">
            <div className="space-y-2 z-10">
              <div className="flex items-center gap-1.5 text-jus-caramel font-bold text-xs uppercase tracking-wider">
                <Heart className="w-4 h-4 fill-current text-jus-caramel" />
                <span>Iniciativa Social</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Ajude nosso aplicativo</h3>
              <p className="text-xs text-slate-600">
                Apoie a JusFácil na democratização do acesso à Justiça no Brasil.
              </p>
            </div>

            <div className="absolute right-3 bottom-3 pointer-events-none">
              <Image
                src="/img/help_us.png"
                alt="Apoiar JusFácil"
                width={90}
                height={90}
                style={{ width: 90, height: 90 }}
                className="object-contain opacity-80"
              />
            </div>

            <div className="z-10 pt-4">
              <Link href="/app/suporte">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-jus-caramel hover:bg-jus-caramel-hover text-white font-bold text-xs py-2 px-5"
                >
                  Apoiar agora
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
