"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/authContext";
import {
  getCaseById,
  getCaseMessages,
  addCaseMessage,
  getCaseDrafts,
  getCaseEvidences,
  uploadEvidenceFile,
  removeEvidence,
} from "@/lib/firebase/services";
import { LegalCase, CaseMessage, DraftVersion, Evidence } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Send,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Shield,
  Bot,
  User,
  Paperclip,
  ArrowLeft,
  X,
  FileCode,
} from "lucide-react";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";
import { getFriendlyError } from "@/lib/errors";
import { DraftVersionList } from "@/components/drafts/DraftVersionList";
import { UploadProgress } from "@/components/evidence/UploadProgress";

function formatMessageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Horário indisponível" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function JurisBotChatClient({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);

  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);

  // Active view tab in right column (Draft, Evidences, Summary)
  const [activeTab, setActiveTab] = useState<"draft" | "evidence" | "summary">("draft");
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedDraftVersion, setSelectedDraftVersion] = useState<number | null>(null);

  // Evidence upload state
  const [uploading, setUploading] = useState(false);
  const [evidenceName, setEvidenceName] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (!caseId) return;
    try {
      const [c, msgs, drfs, evs] = await Promise.all([getCaseById(caseId), getCaseMessages(caseId), getCaseDrafts(caseId), getCaseEvidences(caseId)]);
      setLegalCase(c);
      setMessages(msgs);
      setDrafts(drfs);
      setEvidences(evs);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  };

  useEffect(() => {
    // Initial data is populated only after the asynchronous Firebase reads resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // loadData intentionally reloads all case panels for this route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending || !user) return;

    const userText = inputMsg;
    setInputMsg("");
    setSending(true);

    const userMsgObj: CaseMessage = {
      messageId: crypto.randomUUID(),
      caseId,
      sender: "USER",
      senderName: profile?.fullName || "Você",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsgObj]);
    await addCaseMessage(userMsgObj);

    try {
      // Format messages history for API
      const apiHistory = messages.map((m) => ({
        role: m.sender === "USER" ? "user" : "assistant",
        content: m.content,
      }));
      apiHistory.push({ role: "user", content: userText });

      const idToken = await user.getIdToken();

      const res = await fetch("/api/chat/jurisbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          caseId,
          messages: apiHistory,
          userStory: legalCase?.originalStory,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg =
          data.message ||
          "Assistente JurisBot temporariamente indisponível. Tente novamente mais tarde ou solicite revisão por um advogado.";

        setErrorMessage(errorMsg);
        return;
      }

      if (data.reply) {
        const botMsgObj: CaseMessage = {
          messageId: crypto.randomUUID(),
          caseId,
          sender: "BOT",
          senderName: "JurisBot",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsgObj]);
        await loadData();
      }
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setSending(false);
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) {
      setErrorMessage("Selecione um arquivo válido antes de enviar.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrorMessage("");
    try {
      const uploaded = await uploadEvidenceFile(selectedFile, caseId, user.uid, evidenceDesc || evidenceName, setUploadProgress);
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("caseId", caseId);
      form.set("evidenceId", uploaded.evidenceId);
      const response = await fetch("/api/evidences/process", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body: form,
      });
      if (!response.ok && response.status !== 422 && response.status !== 503) {
        throw new Error("Não foi possível iniciar o processamento da evidência.");
      }
      setEvidenceName("");
      setEvidenceDesc("");
      setSelectedFile(null);
      await loadData();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setUploading(false);
    }
  };

  const handleApproveDraft = async () => {
    const current = drafts[0];
    if (!legalCase || !current || !user) return;
    try {
      const response = await fetch(`/api/cases/${caseId}/drafts/${current.version}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível aprovar a minuta.");
      await loadData();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  };

  const handleRequestLawyerReview = async () => {
    if (!legalCase || !user || legalCase.requiresHumanReview || requestingReview) return;
    setRequestingReview(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/cases/${caseId}/request-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reason: feedbackText || "Solicitada revisão humana pelo cidadão." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível solicitar a revisão humana.");
      setFeedbackText("");
      await loadData();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setRequestingReview(false);
    }
  };

  const handleRequestDraftChange = async () => {
    if (!feedbackText.trim() || !user) return;
    setSending(true);
    try {
      const response = await fetch("/api/chat/jurisbot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ caseId, messages: [{ role: "user", content: `Solicitação de alteração da minuta: ${feedbackText.trim()}` }] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível gerar a nova versão.");
      setFeedbackText("");
      setSelectedDraftVersion(null);
      await loadData();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setSending(false);
    }
  };

  const downloadPDF = async () => {
    const currentDraft = drafts[0];
    if (!currentDraft) return;

    if (!legalCase) return;
    generateDraftPdf(legalCase, currentDraft).save(`Minuta_JusFacil_${caseId}_v${currentDraft.version}.pdf`);
  };

  const currentDraft = drafts.find((draft) => draft.version === selectedDraftVersion) || drafts[0];

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{errorMessage}</span>
          <button type="button" className="font-semibold underline" onClick={() => { setErrorMessage(""); void loadData(); }}>Tentar novamente</button>
        </div>
      )}
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/app/processos")}
            className="p-2 text-slate-400 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors"
            title="Voltar aos Processos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-jus-petroleum">
                {legalCase?.title || "Carregando Caso..."}
              </h1>
              {legalCase && <Badge status={legalCase.status} />}
            </div>
            <p className="text-xs text-slate-500">{legalCase?.summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDraftModal(true)}
              icon={<FileText className="w-4 h-4 text-jus-caramel" />}
            >
              Ver Minuta
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRequestLawyerReview}
            loading={requestingReview}
            disabled={Boolean(legalCase?.requiresHumanReview)}
            icon={<Shield className="w-4 h-4" />}
          >
            {legalCase?.requiresHumanReview ? "Advogado solicitado" : "Chamar Advogado"}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[680px]">
        {/* Left Column: Interactive Chat Box (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-100 bg-jus-petroleum text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/20">
                <Image
                  src="/img/robo_home.png"
                  alt="JurisBot"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>JurisBot</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h2>
                <p className="text-[10px] text-jus-caramel-light">Assistente Jurídico de Triagem</p>
              </div>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-200">
              Protocolo nº {caseId}
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((m) => {
              const isUser = m.sender === "USER";
              const isSystem = m.sender === "SYSTEM";

              if (isSystem) {
                return (
                  <div key={m.messageId} className="my-3 text-center">
                    <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 text-xs px-3 py-1.5 rounded-full font-medium shadow-sm">
                      {m.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={m.messageId}
                  className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm ${
                      isUser ? "bg-jus-caramel" : "bg-jus-petroleum"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-jus-petroleum text-white rounded-tr-none"
                        : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className={`font-bold text-[10px] ${isUser ? "text-jus-caramel-light" : "text-jus-petroleum"}`}>
                        {m.senderName || (isUser ? "Você" : "JurisBot")}
                      </span>
                      <span className={`text-[9px] ${isUser ? "text-slate-300" : "text-slate-400"}`}>
                        {formatMessageTime(m.timestamp)}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite sua resposta ou dúvida ao JurisBot..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white transition-all"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={sending}
              icon={<Send className="w-4 h-4" />}
              className="rounded-full px-4"
            >
              Enviar
            </Button>
          </form>
        </div>

        {/* Right Column: Case Control Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveTab("draft")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === "draft"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Minuta ({drafts.length})
            </button>
            <button
              onClick={() => setActiveTab("evidence")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === "evidence"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Evidências ({evidences.length})
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === "summary"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Resumo do Caso
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* TAB: MINUTA / DRAFT */}
            {activeTab === "draft" && (
              <div className="space-y-4">
                {currentDraft ? (
                  <div className="space-y-4">
                    {drafts.length > 1 && (
                      <DraftVersionList drafts={drafts} selectedVersion={currentDraft.version} onSelect={setSelectedDraftVersion} />
                    )}
                    <div className="p-4 bg-jus-petroleum-100/60 border border-jus-petroleum/20 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-jus-petroleum">
                          Versão {currentDraft.version} - {currentDraft.title}
                        </span>
                        <Badge status={legalCase?.status} />
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Gerada em {new Date(currentDraft.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800">
                      <pre className="whitespace-pre-wrap">{currentDraft.content}</pre>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleApproveDraft}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        className="flex-1"
                      >
                        Aprovar Minuta
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadPDF}
                        icon={<Download className="w-4 h-4" />}
                      >
                        Baixar PDF
                      </Button>
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label htmlFor="draft-feedback" className="block text-xs font-semibold text-slate-700">O que você gostaria que fosse corrigido?</label>
                      <textarea id="draft-feedback" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" placeholder="Descreva a alteração sem adicionar fatos não confirmados." />
                      <Button type="button" variant="outline" size="sm" onClick={handleRequestDraftChange} disabled={!feedbackText.trim() || sending}>Solicitar alteração</Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <FileCode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 font-medium">A minuta ainda está sendo gerada pelo JurisBot.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Responda às perguntas no chat para disponibilizar a primeira versão.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: EVIDÊNCIAS */}
            {activeTab === "evidence" && (
              <div className="space-y-4">
                <form onSubmit={handleUploadEvidence} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Anexar Nova Prova / Documento</h3>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx"
                    aria-label="Selecionar evidência"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!evidenceName) setEvidenceName(file.name);
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-jus-petroleum file:text-white hover:file:bg-jus-petroleum-dark cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="Nome do documento (ex: Nota Fiscal Eletrônica)"
                    value={evidenceName}
                    onChange={(e) => setEvidenceName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-jus-petroleum"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Descrição sumária"
                    value={evidenceDesc}
                    onChange={(e) => setEvidenceDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-jus-petroleum"
                  />
                  <Button type="submit" variant="secondary" size="sm" loading={uploading} icon={<Upload className="w-4 h-4" />} className="w-full">
                    {uploading ? `Enviando ${uploadProgress}%` : "Enviar evidência"}
                  </Button>
                  {uploading && <UploadProgress progress={uploadProgress} />}
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">Documentos Anexados ({evidences.length})</h3>
                  {evidences.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhum documento anexado ainda.</p>
                  ) : (
                    evidences.map((ev) => (
                      <div key={ev.evidenceId} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-jus-petroleum" />
                          <div>
                            <p className="font-semibold text-slate-800">{ev.originalName}</p>
                            <p className="text-[10px] text-slate-400">{ev.description} • {ev.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{new Date(ev.uploadedAt).toLocaleDateString("pt-BR")}</span>
                          {ev.uploadedBy === user?.uid && (
                            <button type="button" className="text-[10px] font-semibold text-red-600 hover:underline" onClick={async () => { try { await removeEvidence(ev); await loadData(); } catch (error) { setErrorMessage(getFriendlyError(error)); } }}>Remover</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: RESUMO DO CASO */}
            {activeTab === "summary" && (
              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Categoria</span>
                  <p className="font-semibold text-jus-petroleum">{legalCase?.category || "Direito do Consumidor"}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Histórico Original</span>
                  <p className="leading-relaxed">{legalCase?.originalStory}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Status Atual</span>
                  <Badge status={legalCase?.status} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Modal for Reading Minuta */}
      {showDraftModal && currentDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-jus-petroleum text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-jus-caramel-light" />
                <h3 className="font-bold text-sm">Visualização Completa da Minuta</h3>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed bg-slate-50 text-slate-800 whitespace-pre-wrap">
              {currentDraft.content}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={downloadPDF} icon={<Download className="w-4 h-4" />}>
                Exportar PDF
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDraftModal(false)}>
                  Fechar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleApproveDraft();
                    setShowDraftModal(false);
                  }}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Aprovar Minuta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
