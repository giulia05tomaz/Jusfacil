"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { createLegalCase, addCaseMessage } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Scale,
  Sparkles,
  MessageSquare,
  ShieldAlert,
  FileCheck,
  Calendar,
  DollarSign,
} from "lucide-react";
import { JEC_RULES } from "@/lib/legalRules/jecRules";
import { getFriendlyError } from "@/lib/errors";
import { UI_DEV_MODE } from "@/lib/devMode";
import { devGenerateBotReply } from "@/lib/dev/mockStore";

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

    const caseId = `JF-${new Date().getFullYear()}-${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase()}`;
    const citizenId = profile.uid;
    const citizenName = profile.fullName || "Cidadão";

    const newCase: LegalCase = {
      caseId,
      citizenId,
      citizenName,
      title: `Caso JusFácil — ${caseId}`,
      category: "Aguardando Triagem",
      legalArea: "Direito do Consumidor",
      summary: story.length > 180 ? `${story.slice(0, 180)}…` : story,
      originalStory: story,
      status: "TRIAGEM",
      requiresHumanReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createLegalCase(newCase);
      await addCaseMessage({
        messageId: crypto.randomUUID(),
        caseId,
        sender: "USER",
        senderName: citizenName,
        content: story,
        timestamp: new Date().toISOString(),
      });

      // No modo visual, o JurisBot responde localmente e nenhuma API paga é acionada.
      if (UI_DEV_MODE) {
        await addCaseMessage({
          messageId: crypto.randomUUID(),
          caseId,
          sender: "BOT",
          senderName: "JurisBot",
          content: devGenerateBotReply(story),
          timestamp: new Date().toISOString(),
        });
      } else {
        try {
          const token = await user.getIdToken();
          await fetch("/api/chat/jurisbot", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ caseId, messages: [], userStory: story }),
          });
        } catch (err) {
          console.warn("AI initial response warning:", err);
        }
      }

      router.push(`/app/jurisbot/${caseId}`);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-jus-petroleum text-white rounded-2xl shadow-sm flex items-center justify-center">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-jus-petroleum">
            Abrir Novo Atendimento
          </h1>
          <p className="text-xs sm:text-sm text-jus-text-muted mt-0.5">
            Conte o que aconteceu em suas próprias palavras. O JurisBot cuidará de tudo.
          </p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        <div className="bg-jus-petroleum-50 border border-jus-petroleum/20 p-4 sm:p-5 rounded-2xl flex items-start gap-3.5">
          <Sparkles className="w-5 h-5 text-jus-petroleum flex-shrink-0 mt-0.5" />
          <div className="text-xs text-jus-petroleum space-y-1">
            <span className="font-bold block text-sm">Como funciona o atendimento:</span>
            <p className="text-slate-700 leading-relaxed">
              Não se preocupe com jargões ou leis. Escreva como se estivesse explicando a um amigo. O JurisBot fará perguntas complementares se faltar algum detalhe importante e estruturará sua petição.
            </p>
          </div>
        </div>

        {/* Helpful Tips Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2">
            <Calendar className="w-4 h-4 text-jus-petroleum flex-shrink-0 mt-0.5" />
            <div>
              <strong>Quando ocorreu:</strong> mencione as datas aproximadas dos fatos.
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-jus-petroleum flex-shrink-0 mt-0.5" />
            <div>
              <strong>Valores envolvidos:</strong> informe valores pagos ou prejuízos.
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2">
            <FileCheck className="w-4 h-4 text-jus-petroleum flex-shrink-0 mt-0.5" />
            <div>
              <strong>Provas:</strong> guarde notas fiscais, prints e protocolos.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label
              htmlFor="story-input"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2"
            >
              Descreva o seu caso:
            </label>
            <textarea
              id="story-input"
              rows={6}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Exemplo: Comprei um produto pela internet no dia 10 de janeiro e até hoje não recebi. A loja não responde às minhas mensagens e se recusa a devolver o valor de R$ 450,00..."
              className="w-full p-4 bg-slate-50/50 border border-slate-300 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white focus:ring-4 focus:ring-jus-petroleum/10 transition-all resize-none placeholder-slate-400 leading-relaxed"
              required
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-800 flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Análise preliminar:</strong> {JEC_RULES.informationalLabel}
            </span>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              icon={<MessageSquare className="w-5 h-5" />}
              className="px-8 font-bold text-sm tracking-wide shadow-sm"
            >
              Iniciar Atendimento com JurisBot
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
