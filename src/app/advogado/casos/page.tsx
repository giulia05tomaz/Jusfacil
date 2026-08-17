"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases, updateCaseStatus } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, CheckCircle2, AlertTriangle, Scale, ArrowRight } from "lucide-react";

export default function LawyerCasesPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);

  const loadData = async () => {
    if (profile?.uid && profile.lawyerStatus === "APPROVED") setCases(await getUserCases(profile.uid, "LAWYER"));
  };

  useEffect(() => {
    // State changes only after the asynchronous Firestore query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleApproveCaseByLawyer = async (caseId: string) => {
    await updateCaseStatus(caseId, "PRONTO_PARA_PROTOCOLO");
    await loadData();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-jus-petroleum to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-jus-caramel-light">
            <Shield className="w-4 h-4 text-jus-caramel" />
            <span>Portal do Advogado — OAB {profile?.oabNumber || "Credenciado"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">
            Casos em Fila de Revisão Humana
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-xl">
            Examine minutas geradas pela Inteligência Artificial do JurisBot, revise petições e autorize o protocolo das demandas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-4 rounded-2xl text-center border border-white/20">
            <span className="text-2xl font-bold font-serif text-jus-caramel-light">{cases.length}</span>
            <span className="text-[10px] text-slate-300 block uppercase font-medium">Casos Pendentes</span>
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-jus-petroleum flex items-center gap-2">
          <Scale className="w-5 h-5 text-jus-caramel" />
          <span>Fila de Análise e Parecer Jurídico</span>
        </h2>

        {cases.length === 0 ? (
          <Card className="p-12 text-center text-xs text-slate-500">
            Nenhum caso aguardando revisão humana de advogado no momento.
          </Card>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => (
              <Card key={c.caseId} className="p-6 space-y-4 border-l-4 border-l-jus-caramel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{c.title}</span>
                      <Badge status={c.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Cidadão: <strong>{c.citizenName || "José Maria"}</strong> | Categoria: {c.category}
                    </p>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Protocolo: <span className="font-mono text-slate-700">{c.caseId}</span>
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-jus-petroleum block">Resumo dos Fatos:</span>
                  <p className="leading-relaxed">{c.originalStory || c.summary}</p>
                </div>

                {c.humanReviewReason && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span><strong>Motivo do Acionamento:</strong> {c.humanReviewReason}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Link href={`/app/jurisbot/${c.caseId}`}>
                    <Button variant="outline" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                      Analisar Chat e Minuta
                    </Button>
                  </Link>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApproveCaseByLawyer(c.caseId)}
                    icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  >
                    Aprovar Petição para Protocolo
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
