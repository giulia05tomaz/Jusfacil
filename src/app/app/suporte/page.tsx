"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Headphones,
  HelpCircle,
  Send,
  Clock,
  Shield,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/authContext";
import { createSupportTicket, getUserSupportTickets } from "@/lib/firebase/services";
import { SupportTicket } from "@/types";
import { getFriendlyError } from "@/lib/errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const FAQS = [
  {
    q: "O JurisBot substitui um advogado ou defensor público?",
    a: "Não. O JurisBot é uma inteligência artificial criada para organizar os fatos, verificar a adequação preliminar ao Juizado Especial Cível (JEC) e estruturar a minuta da petição. Em casos complexos ou acima de 20 salários mínimos, a atuação de um advogado ou defensor é necessária.",
  },
  {
    q: "O que é o Juizado Especial Cível (Pequenas Causas)?",
    a: "É um órgão do Poder Judiciário destinado a resolver causas de menor complexidade de forma rápida e gratuita em primeira instância. Para causas de até 20 salários mínimos, você mesmo pode dar entrada sem advogado.",
  },
  {
    q: "Quais documentos preciso anexar ao meu caso?",
    a: "Recomenda-se anexar documento com foto (RG ou CNH), comprovante de residência e todas as provas do ocorrido (notas fiscais, contratos, capturas de tela de conversas, e-mails ou protocolos de atendimento).",
  },
  {
    q: "Meus dados e documentos estão seguros?",
    a: "Sim. A plataforma JusFácil segue rigorosos padrões de segurança, criptografia e conformidade com a LGPD (Lei Geral de Proteção de Dados Pessoais).",
  },
];

export default function SupportPage() {
  const { profile } = useAuth();
  const [category, setCategory] = useState("TECHNICAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const loadTickets = async () => {
    if (profile?.uid) {
      try {
        const list = await getUserSupportTickets(profile.uid);
        setTickets(list);
      } catch (err) {
        console.error("Error loading user tickets:", err);
      }
    }
  };

  useEffect(() => {
    // Initial data is loaded after auth state is available
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSending(true);
    setErrorMessage("");
    try {
      await createSupportTicket({
        userId: profile.uid,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSent(true);
      setSubject("");
      setMessage("");
      await loadTickets();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-jus-petroleum text-white flex items-center justify-center shadow-sm">
          <Headphones className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-jus-petroleum">
            Central de Suporte
          </h1>
          <p className="text-xs sm:text-sm text-jus-text-muted mt-0.5">
            Tire dúvidas sobre a plataforma ou abra um chamado com nossa equipe
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="space-y-4 p-6 sm:p-8">
            <h2 className="flex items-center gap-2 font-bold text-base text-jus-petroleum border-b border-slate-100 pb-3">
              <Send className="h-4 w-4 text-jus-caramel" />
              <span>Abrir Novo Chamado</span>
            </h2>

            {sent && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Chamado registrado com sucesso! Responderemos em breve.</span>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {errorMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Categoria do Chamado
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white transition-all"
                >
                  <option value="TECHNICAL">Dúvida Técnica / Erro no Sistema</option>
                  <option value="CASE">Dúvida sobre Caso / Minuta</option>
                  <option value="ACCOUNT">Conta, Login e Segurança</option>
                  <option value="SUGGESTION">Sugestão de Melhoria</option>
                  <option value="OTHER">Outros Assuntos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Assunto
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Ex: Dúvida sobre download da minuta"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Descrição detalhada
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Explique sua dúvida ou problema com o máximo de detalhes possível..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={sending}
                  className="w-full font-bold text-xs"
                >
                  Enviar Chamado
                </Button>
              </div>
            </form>
          </Card>

          {/* User's Previous Tickets List */}
          {tickets.length > 0 && (
            <Card className="space-y-3 p-6">
              <h3 className="font-bold text-sm text-jus-petroleum flex items-center gap-2">
                <Clock className="w-4 h-4 text-jus-caramel" />
                <span>Meus Chamados Recentes ({tickets.length})</span>
              </h3>
              <div className="space-y-2.5 divide-y divide-slate-100">
                {tickets.map((t) => (
                  <div key={t.ticketId} className="pt-2.5 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{t.subject}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          t.status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {t.status === "RESOLVED" ? "Resolvido" : "Em Aberto"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{t.message}</p>
                    <div className="text-[10px] text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: FAQs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-4 p-6 sm:p-8">
            <h2 className="flex items-center gap-2 font-bold text-base text-jus-petroleum border-b border-slate-100 pb-3">
              <HelpCircle className="h-5 w-5 text-jus-caramel" />
              <span>Dúvidas Frequentes</span>
            </h2>

            <div className="space-y-3">
              {FAQS.map((faq, index) => {
                const isOpen = expandedFaq === index;
                return (
                  <div
                    key={index}
                    className="border border-slate-200/80 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : index)}
                      className="w-full p-3.5 text-left text-xs font-bold text-slate-800 flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                          isOpen ? "rotate-180 text-jus-petroleum" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-200/50 bg-white">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Social Impact / Info Box */}
          <div className="bg-jus-petroleum text-white rounded-card p-6 space-y-2 shadow-card">
            <div className="flex items-center gap-2 text-jus-caramel-light font-bold text-xs uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Democratização do Acesso à Justiça</span>
            </div>
            <h3 className="font-serif font-bold text-base">JusFácil com IA</h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              Desenvolvido com foco no cidadão brasileiro para descomplicar o acesso ao Direito e ao Juizado Especial Cível de maneira ágil, transparente e segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
