"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { createLegalCase } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Scale, Sparkles, MessageSquare, ShieldAlert } from "lucide-react";
import { JEC_RULES } from "@/lib/legalRules/jecRules";
import { getFriendlyError } from "@/lib/errors";

export default function NewCasePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story.trim() || !user || !profile) return;

    setLoading(true);

    setErrorMessage("");
    const caseId = `JF-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const citizenId = profile.uid;
    const citizenName = profile.fullName;

    const newCase: LegalCase = {
      caseId,
      citizenId,
      citizenName,
      title: `Caso JusFácil — ${caseId}`,
      category: "Aguardando Triagem",
      summary: story.length > 180 ? `${story.slice(0, 180)}…` : story,
      originalStory: story,
      status: "TRIAGEM",
      requiresHumanReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createLegalCase(newCase);
      const clientMessageId = crypto.randomUUID();
      const response = await fetch("/api/chat/jurisbot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ caseId, clientMessageId, message: story }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "O JurisBot está temporariamente indisponível. Tente novamente.");
      router.push(`/app/jurisbot/${caseId}`);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-jus-petroleum text-white rounded-2xl shadow">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Abrir novo Caso JusFácil</h1>
          <p className="text-xs text-slate-500">Conte o que aconteceu em suas palavras. O JurisBot cuidará da triagem.</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 border-jus-petroleum/20 shadow-md">
        <div className="bg-jus-petroleum-100/50 border border-jus-petroleum/20 p-4 rounded-2xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-jus-petroleum flex-shrink-0 mt-0.5" />
          <div className="text-xs text-jus-petroleum space-y-1">
            <span className="font-bold block">Como funciona a triagem do JusFácil:</span>
            <p className="text-slate-700 leading-relaxed">
              Não se preocupe com termos jurídicos técnicos. Escreva livremente o problema. O JurisBot organizará as informações, indicará lacunas e poderá preparar uma minuta quando houver dados suficientes.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="story-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Descreva o seu caso com detalhes:
            </label>
            <textarea
              id="story-input"
              rows={6}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Exemplo: Comprei um notebook no dia 05/02/2026 e ele veio com a tela trincada. A loja se recusa a realizar a troca dentro dos 30 dias..."
              className="w-full p-4 bg-white border border-slate-300 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-jus-petroleum focus:ring-4 focus:ring-jus-petroleum-100 transition-all resize-none placeholder-slate-400"
              required
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-800 flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Análise preliminar:</strong> {JEC_RULES.informationalLabel}
            </span>
          </div>

          {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              loading={loading}
              icon={<MessageSquare className="w-5 h-5" />}
              className="px-8 font-bold text-sm tracking-wide"
            >
              Iniciar Atendimento com JurisBot
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
