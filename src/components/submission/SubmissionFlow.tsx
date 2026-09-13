"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Mail, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/firebase/authContext";
import { createSubmissionKey, submissionRequest } from "@/lib/submission/client";
import { CopyEmailSchema, currentApprovedDraftVersion, TEST_SUBMISSION_ACKNOWLEDGMENT, TEST_SUBMISSION_DISCLAIMER, type TestEmailSubmission } from "@/lib/submission/shared";
import type { DraftVersion, LegalCase } from "@/types";

export function SubmissionActions({ onSend, onLawyer }: { onSend: () => void; onLawyer: () => void }) {
  return <div className="flex flex-col gap-3 sm:flex-row">
    <Button type="button" onClick={onSend} icon={<Mail className="h-4 w-4" />} className="w-full sm:w-auto">Enviar para o fórum</Button>
    <Button type="button" variant="outline" onClick={onLawyer} icon={<Scale className="h-4 w-4" />} className="w-full sm:w-auto">
      Buscar um advogado <span className="ml-1 rounded-full bg-jus-caramel-light px-2 py-0.5 text-[10px] text-jus-petroleum">Em breve</span>
    </Button>
  </div>;
}

export interface SubmissionFlowHandle { start: () => void; showLawyerInfo: () => void }
interface Props { legalCase: LegalCase; approvedDraft?: DraftVersion; onRequestChange: () => void }
type Step = "choice" | "change" | "email" | "confirm";

export const SubmissionFlow = forwardRef<SubmissionFlowHandle, Props>(function SubmissionFlow({ legalCase, approvedDraft, onRequestChange }, ref) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("choice");
  const [copyEmail, setCopyEmail] = useState(user?.email || "");
  const [acknowledgment, setAcknowledgment] = useState(false);
  const [history, setHistory] = useState<TestEmailSubmission[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [lawyerInfo, setLawyerInfo] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestEmailSubmission | null>(null);
  const [reusedResult, setReusedResult] = useState(false);
  const [replySelection, setReplySelection] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasApproved = Boolean(approvedDraft?.approved && approvedDraft.caseId === legalCase.caseId && approvedDraft.version === currentApprovedDraftVersion(legalCase));
  const previousSent = history.filter((item) => item.status === "SENT" && item.draftVersion < (approvedDraft?.version || 0)).sort((a, b) => b.draftVersion - a.draftVersion);
  const replyToSubmissionId = replySelection === null ? previousSent[0]?.submissionId : replySelection || undefined;
  const replyParent = previousSent.find((item) => item.submissionId === replyToSubmissionId);

  const fetchHistory = useCallback(async (signal?: AbortSignal): Promise<TestEmailSubmission[]> => {
    if (!user) return [];
    const response = await submissionRequest(user, legalCase.caseId, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Não foi possível carregar o histórico de envios.");
    return data.submissions;
  }, [user, legalCase.caseId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHistory(controller.signal).then((items) => { if (!controller.signal.aborted) setHistory(items); }).catch((reason: Error) => { if (!controller.signal.aborted) setHistoryError(reason.message); });
    return () => controller.abort();
  }, [fetchHistory]);

  const hasPending = history.some((item) => item.status === "PENDING") || result?.status === "PENDING";
  useEffect(() => {
    if (!hasPending) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void fetchHistory(controller.signal).then((items) => {
        if (controller.signal.aborted) return;
        setHistory(items);
        setHistoryError("");
        setResult((previous) => previous ? items.find((item) => item.submissionId === previous.submissionId) || previous : previous);
      }).catch((reason: Error) => { if (!controller.signal.aborted) setHistoryError(reason.message); });
    }, 4000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [hasPending, fetchHistory]);

  const moveTo = (next: Step) => {
    setStep(next);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };
  const start = () => {
    if (!hasApproved || sendingRef.current) return;
    setCopyEmail(user?.email || "");
    setAcknowledgment(false);
    setError("");
    setResult(null);
    setReusedResult(false);
    setReplySelection(null);
    moveTo("change");
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showLawyerInfo = () => {
    setLawyerInfo(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useImperativeHandle(ref, () => ({ start, showLawyerInfo }));

  const confirmEmail = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = CopyEmailSchema.safeParse(copyEmail);
    if (!parsed.success) { setError("Informe um e-mail válido, com até 254 caracteres."); return; }
    setCopyEmail(parsed.data);
    setAcknowledgment(false);
    setError("");
    moveTo("confirm");
  };

  const send = async () => {
    if (!user || !hasApproved || !approvedDraft || !acknowledgment || sendingRef.current) return;
    const parsedEmail = CopyEmailSchema.safeParse(copyEmail);
    if (!parsedEmail.success) { setError("Confirme um e-mail válido antes do envio."); return; }
    sendingRef.current = true;
    setSending(true);
    setError("");
    setResult(null);
    setReusedResult(false);
    try {
      const response = await submissionRequest(user, legalCase.caseId, {
        method: "POST",
        body: JSON.stringify({ approvedDraftId: `v${approvedDraft.version}`, copyEmail: parsedEmail.data, acknowledgment: true, idempotencyKey: createSubmissionKey(), ...(replyToSubmissionId ? { replyToSubmissionId } : {}) }),
      });
      const data = await response.json();
      // Defesa contra resposta antiga/inconsistente: SENT de outro CC não é sucesso desta confirmação.
      if (data.submission && (data.submission.status === "SENT" || data.submission.status === "PENDING") &&
        (data.submission.draftId !== `v${approvedDraft.version}` || data.submission.draftVersion !== approvedDraft.version ||
          typeof data.submission.copyEmail !== "string" || data.submission.copyEmail.trim().toLowerCase() !== parsedEmail.data.toLowerCase() || (data.submission.replyToSubmissionId || "") !== (replyToSubmissionId || ""))) {
        throw new Error("O servidor retornou um envio anterior com outra versão ou e-mail de cópia. Nenhum novo envio foi confirmado para o endereço informado. Consulte o histórico.");
      }
      if (data.submission) {
        setResult(data.submission);
        setReusedResult(data.idempotent === true);
        setHistory((items) => [data.submission, ...items.filter((item) => item.submissionId !== data.submission.submissionId)]);
      }
      if (!response.ok || data.submission?.status === "FAILED") {
        throw new Error(data.message || "Não foi possível enviar o documento. Tente novamente.");
      }
      if (data.submission?.status !== "SENT" && data.submission?.status !== "PENDING") {
        throw new Error("Não foi possível confirmar o envio. Verifique o histórico antes de tentar novamente.");
      }
      // O SENT do servidor não prova recebimento; a UI não afirma entrega no inbox.
      setAcknowledgment(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o documento. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setSending(false);
      void fetchHistory().then((items) => { setHistory(items); setHistoryError(""); }).catch((reason: Error) => setHistoryError(reason.message));
    }
  };

  if (!hasApproved && !history.length && !historyError) return null;
  return <section ref={sectionRef} aria-label="Etapa final da petição" className="min-w-0 scroll-mt-6 space-y-4 rounded-2xl border border-jus-petroleum/20 bg-white p-4 shadow-sm sm:p-6">
    {hasApproved && <>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-jus-petroleum focus:outline-none">
          {step === "choice" ? "O que você deseja fazer agora?" : step === "change" ? "Antes de continuar" : step === "email" ? "Confirmar e-mail" : "Confirmar envio de teste"}
        </h2>
        <p className="mt-1 text-sm text-slate-700">Sua petição foi aprovada. Petição Inicial — Versão {approvedDraft!.version}.</p>
        <p className="mt-2 text-xs font-medium text-jus-caramel-contrast">O botão “Enviar para o fórum” realiza somente um envio de teste.</p>
      </div>
      <SubmissionActions onSend={start} onLawyer={showLawyerInfo} />
      {lawyerInfo && <p role="status" className="rounded-xl border border-jus-caramel/30 bg-jus-caramel-light/30 p-3 text-sm text-jus-petroleum">Em breve você poderá encontrar profissionais cadastrados no JusFácil para auxiliar no seu caso.</p>}
      {step === "change" && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-700">Status: <span className="font-semibold text-jus-petroleum">Aprovada</span></p>
        <p className="text-sm font-semibold text-slate-800">Você deseja fazer alguma alteração antes do envio?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => { setStep("choice"); setAcknowledgment(false); onRequestChange(); }}>Sim, quero alterar</Button>
          <Button type="button" onClick={() => moveTo("email")}>Não, continuar</Button>
        </div>
        <p className="text-xs text-slate-600">Alterações geram uma nova versão pelo fluxo existente. A versão aprovada permanece intacta.</p>
      </div>}
      {step === "email" && <form onSubmit={confirmEmail} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Input id="submission-copy-email" label="E-mail para receber uma cópia" type="email" value={copyEmail} onChange={(event) => setCopyEmail(event.target.value)} maxLength={254} required autoComplete="email" />
        {previousSent.length > 0 && <div className="space-y-2 text-sm text-slate-800">
          <label htmlFor="submission-reply-parent" className="block font-semibold">Conversa do e-mail</label>
          <select id="submission-reply-parent" value={replyToSubmissionId || ""} onChange={(event) => { setReplySelection(event.target.value); setAcknowledgment(false); setError(""); }} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 focus:outline-jus-petroleum">
            {previousSent.map((item) => <option key={item.submissionId} value={item.submissionId}>Responder ao envio da Versão {item.draftVersion}</option>)}
            <option value="">Enviar como novo e-mail</option>
          </select>
          <p className="text-xs text-slate-600">Escolha o envio anterior que receberá esta atualização. O agrupamento da conversa depende do aplicativo de e-mail.</p>
        </div>}
        <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="ghost" onClick={() => moveTo("change")}>Voltar</Button><Button type="submit">Continuar para confirmação</Button></div>
      </form>}
      {step === "confirm" && <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <dl className="space-y-2 text-sm text-slate-700">
          <div><dt className="font-semibold">Documento</dt><dd>Petição Inicial — Versão {approvedDraft!.version}</dd></div>
          <div><dt className="font-semibold">Destino</dt><dd>Ambiente de testes JusFácil</dd></div>
          <div><dt className="font-semibold">Cópia</dt><dd className="break-all">{copyEmail}</dd></div>
          <div><dt className="font-semibold">Conversa</dt><dd>{replyParent ? `Resposta ao envio da Versão ${replyParent.draftVersion}` : "Novo e-mail"}</dd></div>
        </dl>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{TEST_SUBMISSION_DISCLAIMER}</p>
        <label className="flex items-start gap-3 text-sm text-slate-800"><input type="checkbox" checked={acknowledgment} onChange={(event) => setAcknowledgment(event.target.checked)} disabled={sending || result?.status === "SENT" || result?.status === "PENDING"} className="mt-1 h-4 w-4 shrink-0 accent-jus-petroleum" /><span>{TEST_SUBMISSION_ACKNOWLEDGMENT}</span></label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={sending} onClick={() => { setAcknowledgment(false); setResult(null); moveTo("email"); }}>Corrigir e-mail</Button>
          <Button type="button" onClick={() => void send()} loading={sending} disabled={!acknowledgment || result?.status === "SENT" || result?.status === "PENDING"}>{sending ? "Enviando documento..." : result?.status === "FAILED" || error ? "Tentar novamente" : "Confirmar envio de teste"}</Button>
        </div>
      </div>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {result?.status === "SENT" && !error && <div role="status" className={`space-y-1 rounded-xl border p-4 text-sm ${reusedResult ? "border-slate-200 bg-slate-50 text-slate-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <p className="font-bold">{reusedResult ? "Esta versão já foi enviada anteriormente" : "✓ Envio de teste realizado"}</p>
        {reusedResult ? <p>Nenhum novo e-mail foi enviado nesta tentativa. Consulte a data e o e-mail de cópia no histórico abaixo.</p> : <p>Uma cópia foi enviada para o e-mail confirmado: <span className="break-all">{result.copyEmail}</span>.</p>}
        <p>Este envio não representa protocolo judicial real.</p>
      </div>}
      {result?.status === "PENDING" && <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Envio de teste em processamento. Aguarde a atualização do histórico; nenhum envio duplicado será iniciado.</p>}
    </>}
    {(history.length > 0 || historyError) && <div className="space-y-3 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-jus-petroleum">Histórico de envios</h3>
      {historyError && <div role="alert" className="text-xs text-red-800">{historyError}<button type="button" className="ml-2 underline" onClick={() => { void fetchHistory().then((items) => { setHistory(items); setHistoryError(""); }).catch((reason: Error) => setHistoryError(reason.message)); }}>Atualizar histórico</button></div>}
      <ul className="space-y-2">{history.map((item) => <li key={item.submissionId} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:flex-row sm:items-center">
        <div className="min-w-0"><p className="font-semibold">Envio de teste — Petição Inicial — Versão {item.draftVersion}</p>{item.replyToDraftVersion && <p>Resposta ao envio da Versão {item.replyToDraftVersion}</p>}<p>{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "Data indisponível"}</p><p className="break-all">E-mail de cópia: {item.copyEmail}</p></div>
        <span className={`font-semibold ${item.status === "SENT" ? "text-emerald-800" : item.status === "FAILED" ? "text-red-800" : "text-slate-700"}`}>{item.status === "SENT" ? "Enviado" : item.status === "FAILED" ? "Falhou" : "Em processamento"}</span>
      </li>)}</ul>
      <p className="text-xs text-slate-600">Este envio não representa protocolo judicial real.</p>
    </div>}
  </section>;
});
