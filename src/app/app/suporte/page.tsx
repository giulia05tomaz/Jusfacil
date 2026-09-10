"use client";

import { useState } from "react";
import { CheckCircle2, Headphones, HelpCircle, Send } from "lucide-react";
import { useAuth } from "@/lib/firebase/authContext";
import { createSupportTicket } from "@/lib/firebase/services";
import { getFriendlyError } from "@/lib/errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SupportPage() {
  const { profile } = useAuth();
  const [category, setCategory] = useState("TECHNICAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSending(true);
    setErrorMessage("");
    try {
      await createSupportTicket({ userId: profile.uid, category, subject, message });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setSending(false);
    }
  };

  return <div className="mx-auto max-w-4xl space-y-8 animate-fadeIn">
    <div className="flex items-center gap-3"><div className="rounded-2xl bg-jus-petroleum p-3 text-white"><Headphones className="h-6 w-6" /></div><div><h1 className="text-2xl font-serif font-bold text-jus-petroleum">Suporte JusFácil</h1><p className="text-xs text-slate-500">Abra um chamado operacional ou técnico.</p></div></div>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-bold text-jus-petroleum"><Send className="h-4 w-4 text-jus-caramel" />Fale conosco</h2>
        {sent && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" />Chamado registrado com sucesso.</p>}
        {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="TECHNICAL">Problema técnico</option><option value="ACCOUNT">Conta e acesso</option><option value="CASE">Caso JusFácil</option><option value="SUGGESTION">Sugestão</option></select></label>
          <label className="block text-xs font-semibold text-slate-700">Assunto<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} required className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
          <label className="block text-xs font-semibold text-slate-700">Mensagem<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={4_000} required className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
          <Button type="submit" variant="primary" size="sm" loading={sending} className="w-full">Enviar chamado</Button>
        </form>
      </Card>
      <Card className="space-y-4 p-6"><h2 className="flex items-center gap-2 font-bold text-jus-petroleum"><HelpCircle className="h-5 w-5 text-jus-caramel" />Informações importantes</h2><div className="space-y-4 text-xs leading-relaxed text-slate-600"><section><h3 className="font-bold text-slate-800">O JurisBot substitui um advogado?</h3><p>Não. Ele organiza informações e oferece análise preliminar. Casos que exigem ou recomendam revisão profissional seguem para atribuição explícita.</p></section><section><h3 className="font-bold text-slate-800">A minuta está pronta para protocolo?</h3><p>Não automaticamente. Ela deve ser conferida, complementada quando houver informações pendentes e revisada conforme o caso.</p></section><section><h3 className="font-bold text-slate-800">Apoio financeiro</h3><p>Pagamentos e doações não estão configurados nesta versão. Nenhuma chave de pagamento é apresentada.</p></section></div></Card>
    </div>
  </div>;
}
