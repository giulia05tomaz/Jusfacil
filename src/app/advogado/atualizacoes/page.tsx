"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases, addCaseMessage, updateCaseStatus } from "@/lib/firebase/services";
import { LegalCase, CaseStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Send, CheckCircle2, Scale } from "lucide-react";

export default function LawyerUpdatesPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [newStatus, setNewStatus] = useState<CaseStatus>("EM_ANDAMENTO");
  const [updateMsg, setUpdateMsg] = useState("");

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (profile?.uid && profile.lawyerStatus === "APPROVED") {
        const list = await getUserCases(profile.uid, "LAWYER");
        setCases(list);
        if (list.length > 0) setSelectedCaseId(list[0].caseId);
      }
    }
    load();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !updateMsg) return;

    setSending(true);
    setSuccess(false);

    // Update case status
    await updateCaseStatus(selectedCaseId, newStatus);

    // Post lawyer update message to case chat
    await addCaseMessage({
      messageId: "msg-lawyer-" + Date.now(),
      caseId: selectedCaseId,
      sender: "LAWYER",
      senderName: profile?.fullName || "Dr. Advogado",
      content: `⚖️ **ATUALIZAÇÃO DO ADVOGADO**: ${updateMsg}`,
      timestamp: new Date().toISOString(),
    });

    setSending(false);
    setSuccess(true);
    setUpdateMsg("");

    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-jus-petroleum text-white rounded-2xl">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Enviar Atualizações do Processo</h1>
          <p className="text-xs text-slate-500">Notifique os cidadãos sobre andamentos, prazos e protocolo de petições</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Atualização enviada com sucesso para o cidadão!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1.5">
              Selecione o Caso / Processo
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum"
              required
            >
              {cases.map((c) => (
                <option key={c.caseId} value={c.caseId}>
                  {c.title} - ({c.citizenName || "Cidadão"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1.5">
              Novo Status do Processo
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum"
            >
              <option value="PREPARANDO_MINUTA">Preparando Minuta</option>
              <option value="AGUARDANDO_REVISAO">Aguardando Revisão</option>
              <option value="MINUTA_APROVADA">Minuta Aprovada</option>
              <option value="PRONTO_PARA_PROTOCOLO">Pronto para Protocolo</option>
              <option value="EM_ANDAMENTO">Em Andamento no Tribunal</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1.5">
              Mensagem de Atualização ao Cidadão
            </label>
            <textarea
              rows={5}
              placeholder="Ex: Sua petição foi revisada e protocolada no Juizado Especial Cível da Comarca. Aguardamos a designação da audiência de conciliação."
              value={updateMsg}
              onChange={(e) => setUpdateMsg(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={sending}
            icon={<Send className="w-4 h-4" />}
            className="w-full py-3 font-semibold uppercase text-xs tracking-wider"
          >
            Transmitir Atualização
          </Button>
        </form>
      </Card>
    </div>
  );
}
