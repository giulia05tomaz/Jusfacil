"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  getCaseUpdates,
} from "@/lib/firebase/services";
import { LegalCase, CaseMessage, DraftVersion, Evidence, CaseUpdate } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  Clock,
  Info,
  RotateCw,
  MoreHorizontal,
  LayoutDashboard,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Minus,
  CloudUpload,
} from "lucide-react";
import { generateDraftPdf } from "@/lib/pdf/generateDraftPdf";
import { getFriendlyError } from "@/lib/errors";
import { DraftVersionList } from "@/components/drafts/DraftVersionList";
import { UploadProgress } from "@/components/evidence/UploadProgress";
import { UI_DEV_MODE } from "@/lib/devMode";
import { devApproveDraft, devCreateDraftRevision, devGenerateBotReply, devRequestHumanReview } from "@/lib/dev/mockStore";

function formatMessageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Horário indisponível"
    : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function JurisBotChatClient({ caseId }: { caseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobilePreview = UI_DEV_MODE ? searchParams.get("preview") : null;
  const { user, profile } = useAuth();

  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [caseUpdates, setCaseUpdates] = useState<CaseUpdate[]>([]);

  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);

  // Active view tab in right column (Draft, Updates, Evidences, Summary)
  const [activeTab, setActiveTab] = useState<"draft" | "updates" | "evidence" | "summary">("draft");
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
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
  const [showMobileFeedback, setShowMobileFeedback] = useState(false);

  // 3-dots menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (!caseId) return;
    try {
      const [c, msgs, drfs, evs, upds] = await Promise.all([
        getCaseById(caseId),
        getCaseMessages(caseId),
        getCaseDrafts(caseId),
        getCaseEvidences(caseId),
        getCaseUpdates(caseId).catch(() => []),
      ]);
      setLegalCase(c);
      setMessages(msgs);
      setDrafts(drfs);
      setEvidences(evs);
      setCaseUpdates(upds);
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
      if (UI_DEV_MODE) {
        const botMsgObj: CaseMessage = {
          messageId: crypto.randomUUID(),
          caseId,
          sender: "BOT",
          senderName: "JurisBot",
          content: devGenerateBotReply(userText),
          timestamp: new Date().toISOString(),
        };
        await addCaseMessage(botMsgObj);
        await loadData();
        return;
      }

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
          "Assistente JurisBot temporariamente indisponível. Tente novamente mais tarde.";
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
      const uploaded = await uploadEvidenceFile(
        selectedFile,
        caseId,
        user.uid,
        evidenceDesc || evidenceName,
        setUploadProgress
      );
      if (!UI_DEV_MODE) {
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
      if (UI_DEV_MODE) {
        await devApproveDraft(caseId, current.version);
        setShowApproveDialog(false);
        await loadData();
        return;
      }
      const response = await fetch(
        `/api/cases/${caseId}/drafts/${current.version}/approve`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Não foi possível aprovar a minuta.");
      setShowApproveDialog(false);
      await loadData();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  };

  const handleRequestLawyerReview = async () => {
    if (!legalCase || !user || legalCase.requiresHumanReview || requestingReview)
      return;
    setRequestingReview(true);
    setErrorMessage("");
    try {
      if (UI_DEV_MODE) {
        await devRequestHumanReview(caseId, feedbackText || "Solicitada revisão humana pelo cidadão no modo DEV.");
        setFeedbackText("");
        await loadData();
        return;
      }
      const response = await fetch(`/api/cases/${caseId}/request-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          reason: feedbackText || "Solicitada revisão humana pelo cidadão.",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Não foi possível solicitar a revisão humana.");
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
      if (UI_DEV_MODE) {
        await devCreateDraftRevision(caseId, feedbackText.trim());
        setFeedbackText("");
        setSelectedDraftVersion(null);
        await loadData();
        return;
      }
      const response = await fetch("/api/chat/jurisbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          caseId,
          messages: [
            {
              role: "user",
              content: `Solicitação de alteração da minuta: ${feedbackText.trim()}`,
            },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Não foi possível gerar a nova versão.");
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
    if (!currentDraft || !legalCase) return;
    generateDraftPdf(legalCase, currentDraft).save(
      `Minuta_JusFacil_${caseId}_v${currentDraft.version}.pdf`
    );
  };

  const currentDraft =
    drafts.find((draft) => draft.version === selectedDraftVersion) || drafts[0];

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100%+1rem)] w-[calc(100%+2rem)] min-w-0 max-w-none flex-col space-y-0 overflow-hidden animate-fadeIn pb-0 sm:mx-0 sm:mt-0 sm:w-full sm:max-w-full sm:space-y-6 sm:pb-8 lg:h-auto lg:overflow-visible">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            className="font-semibold underline cursor-pointer"
            onClick={() => {
              setErrorMessage("");
              void loadData();
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Mobile Figma Header */}
      <div className="relative border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-1.5 text-slate-500" aria-label="Menu de opções do JurisBot">
            <MoreHorizontal className="h-6 w-6" />
          </button>
          <span className="text-base font-medium text-slate-500">JurisBot</span>
          <div className="flex items-center gap-2 text-slate-500">
            <Minus className="h-5 w-5" aria-hidden="true" />
            <button type="button" onClick={() => router.push("/app")} aria-label="Fechar conversa"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#C7DEDD]">
              <Image src="/img/robo_logo.png" alt="JurisBot" fill sizes="40px" className="object-contain" />
            </div>
            <span className="text-base font-medium text-slate-600">JurisBot</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500" aria-label="Avaliar atendimento">
            <button type="button" aria-label="Gostei"><ThumbsUp className="h-5 w-5" /></button>
            <button type="button" aria-label="Não gostei"><ThumbsDown className="h-5 w-5" /></button>
          </div>
        </div>
        {menuOpen && (
          <div role="menu" className="absolute left-4 top-12 z-50 w-[290px] overflow-hidden rounded-xl border border-slate-400 bg-white p-1 shadow-xl">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setShowRestartConfirm(true); }} className="w-full border-b border-slate-300 px-4 py-3 text-left text-sm text-slate-600">Reiniciar conversa</button>
            <button type="button" role="menuitem" onClick={() => router.push("/app/jurisbot")} className="w-full border-b border-slate-300 px-4 py-3 text-left text-sm text-slate-600">Voltar para Início JurisBot</button>
            <button type="button" role="menuitem" onClick={() => router.push("/app/dashboard")} className="w-full border-b border-slate-300 px-4 py-3 text-left text-sm text-slate-600">Ir para Dashboard</button>
            <button type="button" role="menuitem" onClick={() => router.push("/app/perfil")} className="w-full px-4 py-3 text-left text-sm text-slate-600">Ir para Perfil</button>
          </div>
        )}
      </div>

      {/* Desktop Header Bar */}
      <div className="hidden w-full min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-card border border-slate-200/80 shadow-card lg:flex">
        <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
          {/* 3-dots popover menu */}
          <div className="relative" ref={menuRef}>
            <button
              id="jurisbot-more-menu-btn"
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-slate-500 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Menu de opções"
              aria-label="Menu de opções do JurisBot"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] sm:w-80 bg-white border border-[#D7D7D7] rounded-2xl shadow-xl z-50 overflow-hidden py-2 animate-fadeIn"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowRestartConfirm(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#202020] hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-[#002B43]" />
                  <span>Reiniciar conversa</span>
                </button>

                <div className="h-[1px] bg-[#E7E5EB] my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/app/jurisbot");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#202020] hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-[#002B43]" />
                  <span>Voltar para início do JurisBot</span>
                </button>

                <div className="h-[1px] bg-[#E7E5EB] my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/app/dashboard");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#202020] hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-[#002B43]" />
                  <span>Ir para Dashboard</span>
                </button>

                <div className="h-[1px] bg-[#E7E5EB] my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/app/perfil");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[#202020] hover:bg-slate-50 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#002B43]" />
                  <span>Ir para Perfil</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push("/app/processos")}
            className="p-2 text-slate-400 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Voltar aos Casos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="break-words text-base sm:text-lg font-bold text-jus-petroleum">
                {legalCase?.title || "Carregando Caso..."}
              </h1>
              {legalCase && <Badge status={legalCase.status} />}
            </div>
            <p className="text-xs text-slate-500 line-clamp-1">{legalCase?.summary}</p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 flex-wrap sm:w-auto">
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
            {legalCase?.requiresHumanReview
              ? "Advogado Solicitado"
              : "Chamar Advogado"}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-0 sm:gap-6 lg:h-[720px] lg:flex-none lg:grid-cols-12">
        {/* Left Column: Interactive Chat Box (7 cols) */}
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden border-y border-slate-200 bg-white shadow-sm sm:rounded-card sm:border lg:col-span-7 lg:h-full">
          {/* Chat Header */}
          <div className="hidden p-3 sm:p-4 border-b border-slate-100 bg-jus-petroleum text-white lg:flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/20">
                <Image
                  src="/img/robo_home.png"
                  alt="JurisBot"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>JurisBot</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h2>
                <p className="text-[10px] text-jus-caramel-light font-medium">
                  Assistente Jurídico Inteligente
                </p>
              </div>
            </div>
            <span className="max-w-[44%] flex-shrink-0 truncate text-[10px] bg-white/10 px-2.5 py-1 rounded-full text-slate-200 font-mono">
              {caseId}
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto bg-[#EFEFEF] p-4 space-y-4">
            {messages.map((m) => {
              const isUser = m.sender === "USER";
              const isSystem = m.sender === "SYSTEM";

              if (isSystem) {
                return (
                  <div key={m.messageId} className="my-3 text-center">
                    <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 text-xs px-3.5 py-1.5 rounded-full font-medium shadow-sm">
                      {m.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={m.messageId}
                  className={`flex items-start gap-2.5 ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`hidden w-8 h-8 rounded-full items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm lg:flex ${
                      isUser ? "bg-jus-caramel" : "bg-jus-petroleum"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`min-w-0 max-w-[82%] break-words rounded-[10px] p-3 sm:p-4 text-xs leading-relaxed shadow-sm lg:rounded-2xl ${
                      isUser
                        ? "bg-jus-petroleum text-white"
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span
                        className={`font-bold text-[10px] ${
                          isUser ? "text-jus-caramel-light" : "text-jus-petroleum"
                        }`}
                      >
                        {m.senderName || (isUser ? "Você" : "JurisBot")}
                      </span>
                      <span
                        className={`text-[9px] ${
                          isUser ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {formatMessageTime(m.timestamp)}
                      </span>
                    </div>

                    <p className="break-words whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              );
            })}
            {legalCase?.status === "COLETANDO_EVIDENCIAS" && (
              <div className="ml-auto w-[86%] rounded-xl bg-white p-3 shadow-[0_3px_8px_rgba(0,0,0,0.12)] lg:hidden">
                <p className="mb-3 text-xs leading-relaxed text-slate-600">Agora envie as evidências solicitadas para darmos continuidade ao seu processo.</p>
                <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 text-center">
                  <CloudUpload className="mb-3 h-12 w-12 text-jus-petroleum" />
                  <span className="text-xs font-medium text-slate-600">Arraste os arquivos aqui,<br />ou clique para enviar</span>
                  <span className="mt-3 text-[9px] text-slate-400">PDF, Word, PNG, JPG, CSV e XLSX</span>
                  <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" onChange={(e) => { const file=e.target.files?.[0]; if(file){setSelectedFile(file);setEvidenceName(file.name);} }} />
                </label>
              </div>
            )}
            {mobilePreview === "analyzing" && (
              <div className="space-y-3 lg:hidden">
                <div className="mr-auto max-w-[82%] rounded-[10px] bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-sm">Recebi as informações. Estou analisando os documentos e preparando sua minuta.</div>
                <div className="mr-auto inline-flex rounded-[10px] bg-white px-4 py-2 text-base tracking-[0.25em] text-slate-500 shadow-sm" aria-label="JurisBot está analisando">•••</div>
              </div>
            )}
            {currentDraft && mobilePreview !== "chat" && mobilePreview !== "analyzing" && (
              <div className="space-y-3 lg:hidden">
                <div className="mr-auto max-w-[78%] rounded-[10px] bg-white p-3 text-xs text-slate-600 shadow-sm">{drafts.length > 1 ? "Uma nova versão da minuta está disponível" : "Temos atualizações do seu processo"}</div>
                {!currentDraft.approved && <div className="mr-auto inline-flex rounded-[10px] bg-white px-4 py-2 text-base tracking-[0.25em] text-slate-500 shadow-sm" aria-label="JurisBot está analisando">•••</div>}
                <button type="button" onClick={downloadPDF} className="mr-auto block w-[62%] rounded-[10px] bg-white px-4 py-3 text-left text-xs font-medium text-[#0069B4] underline shadow-sm">Baixar Documento</button>
                {currentDraft.approved ? (
                  <div className="ml-auto w-32 rounded-[10px] bg-jus-petroleum px-4 py-3 text-center text-xs font-medium text-white">Minuta aprovada</div>
                ) : showMobileFeedback ? (
                  <div className="space-y-3">
                    <div className="mr-auto max-w-[82%] rounded-[10px] bg-white p-3 text-xs text-slate-600 shadow-sm">O que você gostaria que fosse alterado na minuta?</div>
                    <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Descreva a alteração" className="ml-auto block min-h-20 w-[78%] rounded-[10px] border border-slate-300 bg-jus-petroleum p-3 text-xs text-white placeholder:text-slate-300" />
                    {feedbackText.trim() && <div className="mr-auto max-w-[82%] rounded-[10px] bg-white p-3 text-xs text-slate-600 shadow-sm">Sua solicitação está pronta para ser enviada para análise.</div>}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowApproveDialog(true)} className="flex-1 rounded-lg bg-sky-300 px-3 py-3 text-xs font-medium text-emerald-800">Aprovar</button>
                    <button type="button" onClick={() => setShowMobileFeedback(true)} className="flex-1 rounded-lg bg-sky-300 px-3 py-3 text-xs font-medium text-red-700">Solicitar alteração</button>
                  </div>
                )}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="flex w-full min-w-0 items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              placeholder="Digite aqui o que precisa"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-white px-2 py-2.5 text-xs text-slate-700 focus:outline-none lg:rounded-full lg:border lg:border-slate-200 lg:bg-slate-100 lg:px-4"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={sending}
              icon={<Send className="w-4 h-4" />}
              className="flex-shrink-0 rounded-full px-3 sm:px-4"
            >
              Enviar
            </Button>
          </form>
        </div>

        <footer className="border-b border-slate-200 bg-white py-3 text-center text-xs text-slate-500 lg:hidden">Desenvolvido por <strong className="text-slate-700">Webtech</strong></footer>

        {/* Right Column: Case Control Panel (5 cols) */}
        <div className="hidden w-full min-w-0 max-w-full overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-card flex-col lg:col-span-5 lg:flex lg:h-full">
          {/* Navigation Tabs */}
          <div className="flex max-w-full overflow-x-auto border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveTab("draft")}
                className={`min-w-max flex-none px-3 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer sm:min-w-0 sm:flex-1 ${
                activeTab === "draft"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Minuta ({drafts.length})
            </button>
            <button
              onClick={() => setActiveTab("updates")}
                className={`min-w-max flex-none px-3 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer sm:min-w-0 sm:flex-1 ${
                activeTab === "updates"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Linha do Tempo ({caseUpdates.length})
            </button>
            <button
              onClick={() => setActiveTab("evidence")}
                className={`min-w-max flex-none px-3 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer sm:min-w-0 sm:flex-1 ${
                activeTab === "evidence"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Provas ({evidences.length})
            </button>
            <button
              onClick={() => setActiveTab("summary")}
                className={`min-w-max flex-none px-3 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer sm:min-w-0 sm:flex-1 ${
                activeTab === "summary"
                  ? "border-jus-petroleum text-jus-petroleum bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Resumo
            </button>
          </div>

          <div className="min-w-0 flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
            {/* TAB 1: MINUTA / DRAFT (Tela 9) */}
            {activeTab === "draft" && (
              <div className="space-y-4">
                {currentDraft ? (
                  <div className="space-y-4">
                    {drafts.length > 1 && (
                      <DraftVersionList
                        drafts={drafts}
                        selectedVersion={currentDraft.version}
                        onSelect={setSelectedDraftVersion}
                      />
                    )}
                    <div className="p-4 bg-jus-petroleum-50 border border-jus-petroleum/20 rounded-2xl space-y-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-xs font-bold text-jus-petroleum">
                          Versão {currentDraft.version} — {currentDraft.title}
                        </span>
                        <Badge status={legalCase?.status} />
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Elaborada em {new Date(currentDraft.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>

                    {/* JEC Limit Info */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Juizado Especial Cível (JEC):</strong> causas até 20 salários mínimos dispensam advogado para protocolo.
                      </span>
                    </div>

                    <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] max-h-56 overflow-y-auto leading-relaxed border border-slate-800">
                      <pre className="break-words whitespace-pre-wrap">{currentDraft.content}</pre>
                    </div>

                    {/* Action Buttons: Approve, Change, Download */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        variant="approve"
                        size="sm"
                        onClick={() => setShowApproveDialog(true)}
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

                    {/* Feedback / Request Changes */}
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                      <label
                        htmlFor="draft-feedback"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Solicitar ajustes na minuta ao JurisBot:
                      </label>
                      <textarea
                        id="draft-feedback"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs focus:outline-none focus:border-jus-petroleum resize-none"
                        placeholder="Ex: Gostaria de enfatizar que entrei em contato 3 vezes por telefone..."
                      />
                      <Button
                        type="button"
                        variant="request_changes"
                        size="sm"
                        onClick={handleRequestDraftChange}
                        disabled={!feedbackText.trim() || sending}
                        className="w-full"
                      >
                        Solicitar Alteração
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <FileCode className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-700 font-bold">
                      A minuta está sendo preparada pelo JurisBot.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Responda às perguntas no chat para fornecer os detalhes essenciais à estruturação da petição inicial.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LINHA DO TEMPO & ATUALIZAÇÕES */}
            {activeTab === "updates" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-jus-petroleum uppercase tracking-wide">
                    Linha do Tempo do Caso
                  </h3>
                  <button
                    onClick={() => void loadData()}
                    className="text-[11px] text-jus-petroleum hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" /> Atualizar
                  </button>
                </div>

                {caseUpdates.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Clock className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-600 font-medium">
                      Nenhuma atualização recente registrada.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      As movimentações feitas pelo advogado ou tribunal aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caseUpdates.map((upd) => (
                      <div
                        key={upd.updateId}
                        className="p-3.5 bg-white border border-slate-200/90 rounded-xl space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-jus-petroleum">
                            {upd.authorName} ({upd.authorRole === "LAWYER" ? "Advogado" : "Sistema"})
                          </span>
                          <span className="text-slate-400">
                            {formatDateTime(upd.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {upd.message}
                        </p>
                        {upd.courtProcessNumber && (
                          <div className="text-[11px] text-slate-500 font-mono pt-1">
                            Nº Processo: <strong>{upd.courtProcessNumber}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EVIDÊNCIAS & PROVAS */}
            {activeTab === "evidence" && (
              <div className="space-y-4">
                <form
                  onSubmit={handleUploadEvidence}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                >
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Anexar Prova / Documento
                  </h3>
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
                    className="w-full min-w-0 max-w-full text-xs bg-white border border-slate-300 rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-jus-petroleum file:text-white hover:file:bg-jus-petroleum-dark cursor-pointer"
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
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={uploading}
                    icon={<Upload className="w-4 h-4" />}
                    className="w-full"
                  >
                    {uploading ? `Enviando ${uploadProgress}%` : "Enviar Evidência"}
                  </Button>
                  {uploading && <UploadProgress progress={uploadProgress} />}
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">
                    Documentos Anexados ({evidences.length})
                  </h3>
                  {evidences.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Nenhum documento anexado ainda.
                    </p>
                  ) : (
                    evidences.map((ev) => (
                      <div
                        key={ev.evidenceId}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex min-w-0 flex-col items-start justify-between gap-2 text-xs sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Paperclip className="w-4 h-4 text-jus-petroleum" />
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-slate-800">
                              {ev.originalName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {ev.description} • {ev.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            {new Date(ev.uploadedAt).toLocaleDateString("pt-BR")}
                          </span>
                          {ev.uploadedBy === user?.uid && (
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-red-600 hover:underline cursor-pointer"
                              onClick={async () => {
                                try {
                                  await removeEvidence(ev);
                                  await loadData();
                                } catch (error) {
                                  setErrorMessage(getFriendlyError(error));
                                }
                              }}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: RESUMO DO CASO */}
            {activeTab === "summary" && (
              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">
                    Categoria
                  </span>
                  <p className="font-semibold text-jus-petroleum">
                    {legalCase?.category || "Direito do Consumidor"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">
                    Histórico Original
                  </span>
                  <p className="leading-relaxed">{legalCase?.originalStory}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">
                    Status Atual
                  </span>
                  <Badge status={legalCase?.status} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Approving Draft */}
      <ConfirmDialog
        isOpen={showApproveDialog}
        onClose={() => setShowApproveDialog(false)}
        onConfirm={handleApproveDraft}
        title="Aprovar Minuta de Petição?"
        description="Ao aprovar a minuta, você confirma que os fatos descritos correspondem à verdade e que o documento está pronto para ser utilizado ou encaminhado para análise."
        confirmText="Sim, Aprovar Minuta"
        cancelText="Revisar mais"
        variant="approve"
      />

      {/* Confirmation Dialog for Restarting Conversation */}
      <ConfirmDialog
        isOpen={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={() => {
          setShowRestartConfirm(false);
          router.push("/app/processos/novo");
        }}
        title="Deseja iniciar um novo atendimento?"
        description="O caso atual continuará salvo no seu histórico."
        confirmText="Iniciar novo atendimento"
        cancelText="Continuar neste caso"
        variant="primary"
      />

      {/* Full Modal for Reading Minuta (Tela 9) */}
      {showDraftModal && currentDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-jus-petroleum text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-jus-caramel-light" />
                <h3 className="font-bold text-sm">Visualização da Minuta da Petição</h3>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed bg-slate-50 text-slate-800 whitespace-pre-wrap">
              {currentDraft.content}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPDF}
                icon={<Download className="w-4 h-4" />}
              >
                Exportar PDF
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDraftModal(false)}
                >
                  Fechar
                </Button>
                <Button
                  variant="approve"
                  size="sm"
                  onClick={() => {
                    setShowDraftModal(false);
                    setShowApproveDialog(true);
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
