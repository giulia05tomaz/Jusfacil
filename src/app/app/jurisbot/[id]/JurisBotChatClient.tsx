"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/authContext";
import { auth } from "@/lib/firebase/config";
import {
  getCaseById,
  getCaseMessages,
  getCaseDrafts,
  getCaseEvidences,
  validateEvidenceFile,
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
import { exportEvidences } from "@/lib/drafts/evidenceExport";
import { getFriendlyError } from "@/lib/errors";
import { DraftVersionList } from "@/components/drafts/DraftVersionList";
import { UploadProgress } from "@/components/evidence/UploadProgress";
import { SubmissionActions, SubmissionFlow, type SubmissionFlowHandle } from "@/components/submission/SubmissionFlow";
import { currentApprovedDraftVersion } from "@/lib/submission/shared";
import { assembleDocument, retrieveDocument } from "@/lib/drafts/documentClient";
import { createDraftRequestId, draftRequest } from "@/lib/drafts/revisionClient";
import { RevisionProposalSchema, type RevisionProposal } from "@/lib/drafts/revisionShared";

type PackageManifest = {
  packageName: string;
  evidenceCount: number;
  sourceIndexType: "CSV" | "TXT" | "FILENAME";
  warnings: string[];
  items: Array<{ id: string; order: number; reference: string; title: string; variants: Array<{ fileName: string; type: string; size: number; sha256: string; canonical: boolean }>; processingStatus: string }>;
};

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
  const [generatingDraft, setGeneratingDraft] = useState(false);

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
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [packageManifest, setPackageManifest] = useState<PackageManifest | null>(null);
  const [inspectingPackage, setInspectingPackage] = useState(false);
  const [processingPackage, setProcessingPackage] = useState(false);
  const [packageProcessed, setPackageProcessed] = useState(false);
  const [generatingEvidenceDocx, setGeneratingEvidenceDocx] = useState(false);
  const [buildingDocument, setBuildingDocument] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<{ caseId: string; version: number; url: string; page: number; pages: number; firstAnnexPage: number } | null>(null);

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");
  const [revisionReview, setRevisionReview] = useState<RevisionProposal | null>(null);
  const [revisionInChat, setRevisionInChat] = useState(false);
  const revisionHydratedCase = useRef<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState("");
  const [revisingDraft, setRevisingDraft] = useState(false);
  const revisionBusy = useRef(false);
  const revisionAttempt = useRef<{ signature: string; clientRequestId: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const submissionFlowRef = useRef<SubmissionFlowHandle>(null);

  const packageRequest = async (url: string, form: FormData, forceRefresh = false) => {
    const currentUser = auth.currentUser || user;
    console.info("ZIP_CLIENT_AUTH", { currentUserPresent: Boolean(currentUser), tokenObtained: false, authHeaderAdded: false, caseIdPresent: Boolean(caseId) });
    if (!currentUser) throw new Error("Sua sessão não pôde ser validada. Entre novamente.");
    const token = await currentUser.getIdToken(forceRefresh);
    console.info("ZIP_CLIENT_AUTH", { currentUserPresent: true, tokenObtained: token.length > 0, authHeaderAdded: token.length > 0, caseIdPresent: Boolean(caseId) });
    const send = (value: string) => fetch(url, { method: "POST", headers: { Authorization: `Bearer ${value}` }, body: form });
    let response = await send(token);
    if (response.status === 401 && !forceRefresh) response = await send(await currentUser.getIdToken(true));
    return response;
  };

  const loadData = async () => {
    if (!caseId) return;
    try {
      const [c, msgs, drfs, evs] = await Promise.all([getCaseById(caseId), getCaseMessages(caseId), getCaseDrafts(caseId), getCaseEvidences(caseId)]);
      setLegalCase(c);
      setMessages(msgs);
      setDrafts(drfs);
      setEvidences(evs);
      if (revisionHydratedCase.current !== caseId) {
        revisionHydratedCase.current = caseId;
        const saved = [...msgs].reverse().filter(item => item.createdBy === user?.uid).map(item => RevisionProposalSchema.safeParse(item.revisionReview)).find(item => item.success && item.data.baseVersion === c?.currentDraftVersion);
        if (saved?.success) { setRevisionReview(saved.data); setFeedbackText(saved.data.revisionRequest); setRevisionInChat(true); }
      }
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

  useEffect(() => () => { if (documentPreview) URL.revokeObjectURL(documentPreview.url); }, [documentPreview]);

  const previewCompleteDocument = async (version: number, assemble = false, page = 1) => {
    const currentUser = auth.currentUser || user;
    if (!currentUser || buildingDocument) return;
    setBuildingDocument(true);
    setErrorMessage("");
    try {
      if (assemble) await assembleDocument(currentUser, caseId, version);
      const response = await retrieveDocument(currentUser, caseId, version, "page", page);
      if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.message || "Não foi possível visualizar o documento completo."); }
      setDocumentPreview({ caseId, version, url: URL.createObjectURL(await response.blob()), page, pages: Number(response.headers.get("X-Document-Pages")), firstAnnexPage: Number(response.headers.get("X-First-Annex-Page")) });
      setActiveTab("draft");
      return true;
    } catch (error) { setErrorMessage(getFriendlyError(error)); return false; }
    finally { setBuildingDocument(false); }
  };

  const finishDraftRevision = async (version: number) => {
    setFeedbackText(""); setRevisionReview(null); revisionAttempt.current = null;
    setSelectedDraftVersion(version); setActiveTab("draft");
    await loadData();
    setRevisionNotice(`Versão ${version} salva para revisão. A versão anterior foi preservada. Confira o documento completo e aprove esta nova versão antes de enviá-la.`);
    if (evidences.length) {
      const mounted = await previewCompleteDocument(version, true);
      if (!mounted) setRevisionNotice(`O texto da versão ${version} foi salvo, mas a montagem com evidências não foi concluída. Use “Visualizar documento completo com evidências” para retomar a montagem sem gerar outra versão. Ainda não aprove nem envie.`);
    }
  };

  const sendMessage = async (userText: string) => {
    if (!userText.trim() || sending || !user) return;

    setRetryMessage(null);
    setErrorMessage("");
    setInputMsg("");
    setSending(true);

    const userMsgObj: CaseMessage = {
      messageId: createDraftRequestId(),
      caseId,
      sender: "USER",
      senderName: profile?.fullName || "Você",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsgObj]);
    try {
      const idToken = await user.getIdToken();

      const res = await fetch("/api/chat/jurisbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          caseId,
          clientMessageId: userMsgObj.messageId,
          message: userText,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg =
          data.message ||
          "Assistente JurisBot temporariamente indisponível. Tente novamente mais tarde ou solicite revisão por um advogado.";

        setErrorMessage(errorMsg);
        setRetryMessage(userText);
        return;
      }

      if (data.reply) {
        const proposal = RevisionProposalSchema.safeParse(data.revisionReview);
        if (proposal.success) { setRevisionReview(proposal.data); setFeedbackText(proposal.data.revisionRequest); setRevisionInChat(true); setRevisionNotice(""); }
        const botMsgObj: CaseMessage = {
          messageId: createDraftRequestId(),
          caseId,
          sender: "BOT",
          senderName: "JurisBot",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsgObj]);
        if (Number.isInteger(data.version) && legalCase?.currentDraftVersion && data.version > legalCase.currentDraftVersion) await finishDraftRevision(data.version);
        else await loadData();
      }
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
      setRetryMessage(userText);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(inputMsg);
  };

  const handleRetryMessage = async () => {
    if (retryMessage) await sendMessage(retryMessage);
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
      validateEvidenceFile(selectedFile);
      const evidenceId = createDraftRequestId();
      setUploadProgress(25);
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("caseId", caseId);
      form.set("evidenceId", evidenceId);
      form.set("description", evidenceDesc || evidenceName);
      form.set("title", evidenceName);
      const response = await fetch("/api/evidences/process", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível analisar a evidência.");
      setUploadProgress(100);
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

  const inspectPackage = async () => {
    if (!zipFile || !user) return;
    setInspectingPackage(true); setErrorMessage("");
    try {
      const form = new FormData(); form.set("file", zipFile);
      const response = await packageRequest(`/api/cases/${caseId}/evidence-package/inspect`, form, true);
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Não foi possível ler o pacote ZIP.");
      setPackageManifest(data.manifest);
    } catch (error) { setErrorMessage(getFriendlyError(error)); } finally { setInspectingPackage(false); }
  };

  const processPackage = async () => {
    if (!zipFile || !packageManifest || !user) return;
    setProcessingPackage(true); setErrorMessage("");
    try {
      const form = new FormData(); form.set("file", zipFile); form.set("manifest", JSON.stringify(packageManifest));
      const response = await packageRequest(`/api/cases/${caseId}/evidence-package/process`, form);
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Não foi possível processar o pacote.");
      setPackageProcessed(true); await loadData();
      if (data.failed) setErrorMessage(`${data.completed} evidências concluídas; ${data.failed} ficaram com erro e podem ser reprocessadas.`);
    } catch (error) {
      // Even when the long-running analysis request is interrupted, the API persists each logical item before analyzing it.
      await loadData().catch(() => undefined);
      setErrorMessage(getFriendlyError(error));
    } finally { setProcessingPackage(false); }
  };

  const downloadEvidenceDocx = async () => {
    const draft = drafts.find((item) => item.version === selectedDraftVersion) || drafts[0];
    if (!draft || generatingEvidenceDocx) return;
    setGeneratingEvidenceDocx(true);
    setErrorMessage("");
    try {
      const currentUser = auth.currentUser || user;
      if (!currentUser) throw new Error("Entre novamente para baixar o documento.");
      const response = await retrieveDocument(currentUser, caseId, draft.version, "docx");
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message || "Não foi possível montar o Word com as evidências.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const serverName = disposition.match(/filename="([^"]+)"/i)?.[1];
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = serverName || `peticao-inicial-${caseId}-v${draft.version}-com-evidencias.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setGeneratingEvidenceDocx(false);
    }
  };

  const handleApproveDraft = async () => {
    const current = drafts[0];
    if (!legalCase || !current || !user || buildingDocument || generatingDraft || sending) return;
    try {
      if (evidences.length) await assembleDocument(user, caseId, current.version);
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

  const handleRequestDraftChange = async (confirm = false) => {
    if (!feedbackText.trim() || !user || revisionBusy.current || !legalCase?.currentDraftVersion) return;
    if (confirm && (!revisionReview?.ready || revisionReview.baseVersion !== legalCase.currentDraftVersion)) return;
    revisionBusy.current = true;
    setRevisingDraft(true);
    setSending(true);
    setErrorMessage("");
    setRevisionNotice("");
    if (!confirm) setRevisionInChat(false);
    try {
      const payload = { action: confirm ? "revise" : "review_revision", revisionRequest: feedbackText.trim(), baseVersion: legalCase.currentDraftVersion, ...(confirm ? { reviewId: revisionReview!.reviewId, confirmation: true } : {}) };
      const signature = JSON.stringify(payload);
      if (revisionAttempt.current?.signature !== signature) revisionAttempt.current = { signature, clientRequestId: createDraftRequestId() };
      const response = await draftRequest(user, caseId, { ...payload, clientRequestId: revisionAttempt.current.clientRequestId });
      const data = await response.json();
      if (!response.ok) {
        if (data.error !== "REQUEST_ALREADY_RECEIVED") revisionAttempt.current = null;
        throw new Error(data.message || "Não foi possível revisar a alteração.");
      }
      if (!confirm) {
        if (typeof data.reviewId !== "string" || data.baseVersion !== legalCase.currentDraftVersion || typeof data.advice !== "string" || typeof data.ready !== "boolean" || !Array.isArray(data.questions) || !data.questions.every((item: unknown) => typeof item === "string") || typeof data.changeSummary !== "string") throw new Error("Não foi possível validar a orientação.");
        setRevisionReview(data);
        revisionAttempt.current = null;
        await loadData();
        return;
      }
      if (!Number.isInteger(data.version) || data.version <= legalCase.currentDraftVersion) throw new Error("Não foi possível confirmar a nova versão.");
      await finishDraftRevision(data.version);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      revisionBusy.current = false;
      setRevisingDraft(false);
      setSending(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!user || generatingDraft) return;
    setGeneratingDraft(true);
    setErrorMessage("");
    try {
      const response = await draftRequest(user, caseId, { clientRequestId: createDraftRequestId(), action: "generate" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível gerar a minuta.");
      setSelectedDraftVersion(null);
      await loadData();
      if (evidences.length) await previewCompleteDocument(data.version, true);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setGeneratingDraft(false);
    }
  };

  const downloadPDF = async () => {
    const currentDraft = drafts.find((item) => item.version === selectedDraftVersion) || drafts[0];
    if (!currentDraft) return;

    if (!legalCase) return;
    if (evidences.length) {
      try {
        const currentUser = auth.currentUser || user;
        if (!currentUser) throw new Error("Entre novamente para baixar o documento.");
        const response = await retrieveDocument(currentUser, caseId, currentDraft.version, "pdf");
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a"); link.href = url; link.download = `peticao-inicial-${caseId}-v${currentDraft.version}-com-evidencias.pdf`;
        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) { setErrorMessage(getFriendlyError(error)); }
      return;
    }
    generateDraftPdf(legalCase, currentDraft, exportEvidences(evidences)).save(`peticao-inicial-${caseId}-v${currentDraft.version}.pdf`);
  };

  const currentDraft = drafts.find((draft) => draft.version === selectedDraftVersion) || drafts[0];
  const approvedDraft = legalCase ? drafts.find((draft) => draft.approved && draft.version === currentApprovedDraftVersion(legalCase)) : undefined;
  const newEvidenceAvailable = Boolean(currentDraft && evidences.some((evidence) => new Date(evidence.uploadedAt).getTime() > new Date(currentDraft.createdAt).getTime()));
  const revisionProposalPanel = revisionReview && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-800" aria-live="polite">
    <p className="font-semibold">Orientação preliminar do JurisBot — não substitui revisão por advogado</p>
    <p className="font-semibold">Proposta — o documento ainda não foi alterado</p>
    <p className="whitespace-pre-wrap break-words">{revisionReview.advice}</p>
    {revisionReview.questions.map((question, index) => <p key={index}>{index + 1}. {question}</p>)}
    {!revisionReview.ready && <p>{revisionInChat ? "Responda às perguntas no chat para continuar." : "Complemente a solicitação acima com as respostas e clique em Solicitar alteração novamente."} Nenhum documento foi alterado.</p>}
    {revisionReview.ready && <>
      <p className="font-semibold">Alteração proposta</p><p className="break-words">{revisionReview.changeSummary}</p>
      {revisionReview.proposedClaimValue != null && <p>Valor da causa proposto: {revisionReview.proposedClaimValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
      <p>Confirme somente se a proposta corresponde aos fatos e pedidos que você informou. Também pode escrever “Confirmo a alteração” no chat.</p>
      <Button type="button" size="sm" className="w-full whitespace-normal" onClick={() => void handleRequestDraftChange(true)} loading={revisingDraft} disabled={sending || generatingDraft || buildingDocument || revisionReview.baseVersion !== legalCase?.currentDraftVersion}>Confirmar alteração e gerar nova versão</Button>
    </>}
  </div>;

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
            className="p-2 text-slate-500 hover:text-jus-petroleum hover:bg-slate-100 rounded-xl transition-colors"
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

      {legalCase && profile?.role === "CITIZEN" && <SubmissionFlow
        key={`${caseId}:${user?.uid}:${approvedDraft?.version || "none"}`}
        ref={submissionFlowRef}
        legalCase={legalCase}
        approvedDraft={approvedDraft}
        onRequestChange={() => {
          setActiveTab("draft");
          setSelectedDraftVersion(legalCase.currentDraftVersion || null);
          setShowDraftModal(false);
          window.requestAnimationFrame(() => {
            const field = document.getElementById("draft-feedback");
            field?.scrollIntoView({ behavior: "smooth", block: "center" });
            field?.focus();
          });
        }}
      />}

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[680px]">
        {/* Left Column: Interactive Chat Box (7 cols) */}
        <div className="min-w-0 lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
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
                      <span className={`text-[9px] ${isUser ? "text-slate-300" : "text-slate-600"}`}>
                        {formatMessageTime(m.timestamp)}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              );
            })}
            {approvedDraft && profile?.role === "CITIZEN" && <div data-testid="jurisbot-submission-cta" className="space-y-3 rounded-2xl border border-jus-petroleum/20 bg-white p-4 text-xs text-slate-800">
              <p className="font-bold text-jus-petroleum">JurisBot</p>
              <p>Sua petição está aprovada. Você deseja realizar um envio de teste ou prefere buscar o auxílio de um advogado?</p>
              <SubmissionActions onSend={() => submissionFlowRef.current?.start()} onLawyer={() => submissionFlowRef.current?.showLawyerInfo()} />
              <p className="text-[11px] text-slate-600">Este envio não representa protocolo judicial real.</p>
            </div>}
            {sending && (
              <div role="status" className="mx-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-700 shadow-sm">
                JurisBot está analisando...
              </div>
            )}
            {revisionInChat && revisionProposalPanel}
            {revisionInChat && revisionNotice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950">{revisionNotice}</p>}
            <div ref={chatEndRef} />
            {retryMessage && !sending && (
              <div role="alert" className="mx-auto flex max-w-[90%] items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <span className="min-w-0 break-words">{errorMessage || "Não consegui responder a essa mensagem. Tente novamente."}</span>
                <button type="button" className="shrink-0 font-semibold underline" onClick={() => void handleRetryMessage()}>
                  Tentar novamente
                </button>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder={legalCase?.currentDraftVersion ? "Descreva a alteração ou confirme a proposta..." : "Digite sua resposta ou dúvida ao JurisBot..."}
              maxLength={legalCase?.currentDraftVersion ? 2000 : 4000}
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="min-w-0 flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-jus-petroleum focus:bg-white transition-all"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={sending}
              disabled={!inputMsg.trim() || sending}
              icon={<Send className="w-4 h-4" />}
              className="rounded-full px-4"
            >
              Enviar
            </Button>
          </form>
        </div>

        {/* Right Column: Case Control Panel (5 cols) */}
        <div className="min-w-0 lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
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
                      <p className="mb-2 font-sans font-semibold">Prévia textual — os arquivos das evidências aparecem no documento completo abaixo.</p>
                      <pre className="whitespace-pre-wrap">{currentDraft.content}</pre>
                    </div>

                    {evidences.length > 0 && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-700">Confira a petição com as evidências anexadas e referenciadas antes de aprovar. Novas versões reutilizam os arquivos deste caso.</p>
                      <Button variant="outline" size="sm" loading={buildingDocument} disabled={buildingDocument || generatingDraft || sending} onClick={() => void previewCompleteDocument(currentDraft.version)} className="w-full">{buildingDocument ? "Montando documento completo..." : "Visualizar documento completo com evidências"}</Button>
                      {documentPreview?.caseId === caseId && documentPreview.version === currentDraft.version && <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                          <Button variant="outline" size="sm" disabled={buildingDocument || documentPreview.page <= 1} onClick={() => void previewCompleteDocument(currentDraft.version, false, documentPreview.page - 1)}>Anterior</Button>
                          <span>Página {documentPreview.page} de {documentPreview.pages}</span>
                          <Button variant="outline" size="sm" disabled={buildingDocument || documentPreview.page >= documentPreview.pages} onClick={() => void previewCompleteDocument(currentDraft.version, false, documentPreview.page + 1)}>Próxima</Button>
                          {!!documentPreview.firstAnnexPage && <Button variant="outline" size="sm" disabled={buildingDocument} onClick={() => void previewCompleteDocument(currentDraft.version, false, documentPreview.firstAnnexPage)}>Ver anexos das evidências</Button>}
                        </div>
                        <Image alt={`Petição completa, versão ${currentDraft.version}, página ${documentPreview.page} de ${documentPreview.pages}`} src={documentPreview.url} width={1000} height={1414} unoptimized className="h-auto w-full rounded-lg border border-slate-300 bg-white" />
                        <p className="text-[11px] text-slate-600">Use Baixar PDF ou Baixar Word para obter o documento inteiro com os anexos.</p>
                      </>}
                    </div>}

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleApproveDraft}
                        disabled={buildingDocument || generatingDraft || sending || currentDraft.version !== drafts[0]?.version || currentDraft.approved || newEvidenceAvailable}
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
                      {evidences.length > 0 && <Button variant="outline" size="sm" onClick={() => void downloadEvidenceDocx()} loading={generatingEvidenceDocx} icon={<Download className="w-4 h-4" />}>Baixar Word</Button>}
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label htmlFor="draft-feedback" className="block text-xs font-semibold text-slate-700">O que você gostaria que fosse corrigido?</label>
                      <p className="text-xs text-slate-600">A alteração será feita na versão atual ({legalCase?.currentDraftVersion}). A versão aprovada e seus anexos serão preservados; a nova versão precisará de aprovação.</p>
                      <textarea id="draft-feedback" value={feedbackText} disabled={sending || generatingDraft || buildingDocument} onChange={(event) => { setFeedbackText(event.target.value); setRevisionReview(null); setRevisionNotice(""); revisionAttempt.current = null; }} maxLength={2000} rows={3} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs disabled:opacity-70" placeholder="Ex.: Quero alterar o valor da causa para R$ 3.000. Informe a composição dos valores e quais pedidos deseja corrigir." />
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleRequestDraftChange()} loading={revisingDraft} disabled={!feedbackText.trim() || sending || generatingDraft || buildingDocument}>Solicitar alteração</Button>
                      {!revisionInChat && revisionProposalPanel}
                      {!revisionInChat && revisionNotice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950">{revisionNotice}</p>}
                      {currentDraft.changeSummary && <p className="text-xs text-slate-700">Alterações desta versão: {currentDraft.changeSummary}</p>}
                      {currentDraft.revisionAdvice && <p className="whitespace-pre-wrap break-words text-xs text-slate-700">Orientação preliminar registrada: {currentDraft.revisionAdvice}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <FileCode className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 font-medium">A minuta ainda está sendo gerada pelo JurisBot.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Responda às perguntas no chat para disponibilizar a primeira versão.
                    </p>
                    {legalCase?.structuredData?.draftReady && (
                      <Button type="button" variant="primary" size="sm" className="mt-4" loading={generatingDraft} onClick={handleGenerateDraft}>Gerar minuta de petição inicial</Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: EVIDÊNCIAS */}
            {activeTab === "evidence" && (
              <div className="space-y-4">
                {newEvidenceAvailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Novas evidências foram adicionadas após a criação da minuta atual.</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void handleGenerateDraft()}>Gerar nova versão com as evidências</Button><p className="mt-1 text-[10px]">A versão anterior permanece intacta.</p></div>}
                <div className="p-4 bg-jus-petroleum-100/50 border border-jus-petroleum/20 rounded-2xl space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-jus-petroleum uppercase tracking-wide">Enviar pacote ZIP de evidências</h3>
                    <p className="text-[10px] text-slate-600 mt-1">Você pode enviar um arquivo individual ou um pacote ZIP contendo várias evidências. Se houver índice ou numeração, preservaremos a ordem e os nomes.</p>
                  </div>
                  <input type="file" accept=".zip" aria-label="Selecionar pacote ZIP" onChange={(event) => { setZipFile(event.target.files?.[0] || null); setPackageManifest(null); setPackageProcessed(false); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-jus-petroleum file:text-white" />
                  <Button type="button" variant="outline" size="sm" onClick={() => void inspectPackage()} disabled={!zipFile || inspectingPackage} loading={inspectingPackage} className="w-full">{inspectingPackage ? "Lendo pacote..." : "Revisar evidências"}</Button>
                  {packageManifest && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold text-slate-800">Pacote identificado: {packageManifest.evidenceCount} evidências</p>
                      <p className="text-[10px] text-slate-500">Fonte da ordem: {packageManifest.sourceIndexType}. JPG + PDF aparecem como uma única evidência lógica.</p>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {packageManifest.items.map((item) => <div key={item.id} className="space-y-1 rounded-lg border border-slate-100 p-2 text-[10px]">
                          <div className="flex min-w-0 gap-2">
                            <input aria-label={`Ordem de ${item.title}`} type="number" min={1} max={9999} value={item.order} disabled={packageProcessed} onChange={(event) => setPackageManifest({...packageManifest, items: packageManifest.items.map((value) => value.id === item.id ? {...value, order: Number(event.target.value)} : value)})} className="w-12 rounded border border-slate-300 p-1 text-slate-800" />
                            <input aria-label={`Referência de ${item.title}`} maxLength={40} value={item.reference} disabled={packageProcessed} onChange={(event) => setPackageManifest({...packageManifest, items: packageManifest.items.map((value) => value.id === item.id ? {...value, reference: event.target.value} : value)})} className="w-16 rounded border border-slate-300 p-1 text-slate-800" />
                            <input aria-label={`Título da evidência ${item.reference}`} maxLength={500} value={item.title} disabled={packageProcessed} onChange={(event) => setPackageManifest({...packageManifest, items: packageManifest.items.map((value) => value.id === item.id ? {...value, title: event.target.value} : value)})} className="min-w-0 flex-1 rounded border border-slate-300 p-1 text-slate-800" />
                          </div>
                          <span className="text-slate-500">{item.variants.length} formato(s). Ordem, referência e título são definidos por você; não podem repetir os já existentes no caso.</span>
                        </div>)}
                      </div>
                      {packageManifest.warnings.length > 0 && <p className="text-[10px] text-amber-700">{packageManifest.warnings.join(" ")}</p>}
                      <Button type="button" variant="outline" size="sm" onClick={() => void downloadEvidenceDocx()} loading={generatingEvidenceDocx} disabled={!drafts[0]} icon={<Download className="h-4 w-4" />} className="w-full">{generatingEvidenceDocx ? "Montando Word..." : "Baixar Word com evidências"}</Button>
                      <p className="text-[10px] leading-relaxed text-slate-500">Confirme primeiro a inclusão das evidências. O documento completo usa imagens e páginas de PDFs preservadas no caso, na ordem informada. A montagem em Python não chama OpenAI nem duplica JPG/PDF equivalentes.</p>
                      <div className="flex gap-2"><Button type="button" variant="primary" size="sm" onClick={() => void processPackage()} loading={processingPackage} disabled={packageProcessed} className="flex-1">{packageProcessed ? "Evidências adicionadas" : "Confirmar e analisar"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setPackageManifest(null); setZipFile(null); setPackageProcessed(false); }}>Cancelar</Button></div>
                      <p className="text-[10px] leading-relaxed text-slate-500">Os originais ficam preservados de forma privada neste ambiente local para compor os anexos nas próximas versões. Isso não representa análise visual pela IA nem armazenamento durável de uma implantação pública.</p>
                    </div>
                  )}
                  {errorMessage && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-800">{errorMessage}</p>}
                </div>
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
                  <p className="text-[10px] leading-relaxed text-slate-500">O original fica preservado neste ambiente local. JPG, PNG e todas as páginas de PDFs podem integrar o documento completo; PDF digitalizado sem texto não é tratado como analisado pela IA.</p>
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">Documentos Anexados ({evidences.length})</h3>
                  {evidences.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Nenhum documento anexado ainda.</p>
                  ) : (
                    evidences.map((ev) => (
                      <div key={ev.evidenceId} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-jus-petroleum" />
                          <div>
                            <p className="font-semibold text-slate-800">{ev.originalName}</p>
                            <p className="text-[10px] text-slate-600">{ev.description} • {ev.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600">{new Date(ev.uploadedAt).toLocaleDateString("pt-BR")}</span>
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
                <h3 className="font-bold text-sm">Prévia textual da minuta</h3>
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
                  disabled={buildingDocument || generatingDraft || sending || currentDraft.version !== drafts[0]?.version || currentDraft.approved || newEvidenceAvailable}
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
