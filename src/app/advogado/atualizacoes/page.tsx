"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import {
  getUserCases,
  uploadEvidenceFile,
} from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { UI_DEV_MODE } from "@/lib/devMode";
import { devAddCaseUpdate } from "@/lib/dev/mockStore";
import {
  Search,
  UploadCloud,
  FileText,
  File,
  X,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

function UpdatesWizardInner() {
  const searchParams = useSearchParams();
  const preselectedCaseId = searchParams.get("caseId");
  const previewMode = UI_DEV_MODE ? searchParams.get("preview") : null;
  const previewStep = previewMode === "success" ? 4 : previewMode === "notes" ? 3 : previewMode === "document" ? 2 : 1;

  const { profile, user } = useAuth();

  // Wizard state (1: Select Case, 2: Attach Document, 3: Notes, 4: Success)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(previewStep);

  // Data state
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseSearch, setCaseSearch] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(preselectedCaseId || "");

  // Document state
  const [selectedFile, setSelectedFile] = useState<File | null>(() =>
    previewMode === "document" || previewMode === "notes"
      ? ({ name: "peticao-atualizada.pdf", size: 24, type: "application/pdf" } as File)
      : null
  );
  const [isDragOver, setIsDragOver] = useState(false);

  // Notes state
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!profile?.uid || profile.lawyerStatus !== "APPROVED") {
        setLoading(false);
        return;
      }
      try {
        const list = await getUserCases(profile.uid, "LAWYER");
        setCases(list);
        if (preselectedCaseId && list.some((c) => c.caseId === preselectedCaseId)) {
          setSelectedCaseId(preselectedCaseId);
        }
      } catch (err) {
        console.error("Error loading cases for updates wizard:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [profile, preselectedCaseId]);

  const selectedCase = cases.find((c) => c.caseId === selectedCaseId);

  const filteredCases = cases.filter((c) => {
    if (!caseSearch.trim()) return true;
    const q = caseSearch.toLowerCase();
    return (
      c.caseId.toLowerCase().includes(q) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  });

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !notes.trim() || sending || !profile?.uid) return;

    setSending(true);
    setErrorMessage("");

    try {
      let documentEvidenceId: string | undefined;

      // Upload file if attached
      if (selectedFile) {
        const uploaded = await uploadEvidenceFile(
          selectedFile,
          selectedCaseId,
          profile.uid,
          `Anexo de atualização: ${selectedFile.name}`
        );
        documentEvidenceId = uploaded.evidenceId;
      }

      if (UI_DEV_MODE) {
        await devAddCaseUpdate(selectedCaseId, profile.uid, notes.trim(), documentEvidenceId);
        setStep(4);
        return;
      }

      if (!user) throw new Error("Sessão expirada.");
      const token = await user.getIdToken();
      const response = await fetch(`/api/cases/${encodeURIComponent(selectedCaseId)}/updates`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: notes.trim(),
          ...(documentEvidenceId ? { documentEvidenceId } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || "Não foi possível registrar a atualização.");
      }

      // Advance to step 4 only after the server confirms update + notification.
      setStep(4);
    } catch (err) {
      console.error("Failed to send case update:", err);
      setErrorMessage("Não foi possível enviar a atualização. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  // STEP 4: SUCESSO (Figma Page 25)
  if (step === 4) {
    return (
      <div className="-mx-4 -mt-6 min-h-[calc(100vh-8rem)] w-auto min-w-0 bg-[#ECECEC] px-8 py-8 flex flex-col items-center justify-center text-center animate-fadeIn sm:mx-auto sm:mt-0 sm:max-w-lg sm:bg-transparent">
        {/* Imagem do Robô Institucional */}
        <div className="order-2 relative mb-2 w-[min(75vw,280px)] max-w-full sm:mb-6 sm:w-56">
          <Image
            src="/img/robo_home.png"
            alt="Sucesso"
            width={280}
            height={280}
            className="h-auto w-full max-w-full object-contain"
            priority
          />
        </div>

        {/* Título de Sucesso (#002B43, 34-40px mobile) */}
        <h1 className="order-1 mb-3 max-w-full break-words px-1 text-left text-[40px] leading-[1.08] sm:mb-8 sm:text-3xl md:text-4xl font-bold text-[#002B43] tracking-tight">
          Atualizações enviadas com sucesso !
        </h1>

        <p className="order-3 hidden text-xs sm:text-sm text-[#6E7580] mb-8 max-w-md sm:block">
          A notificação foi registrada no histórico do caso e o cidadão foi devidamente comunicado.
        </p>

        {/* Botão Voltar aos Casos */}
        <Link href="/advogado/casos" className="order-4 hidden w-full max-w-[280px] sm:block">
          <button
            type="button"
            className="w-full h-12 bg-[#002B43] hover:bg-[#003A58] text-white font-semibold rounded-[14px] text-sm shadow-md transition-all active:scale-95"
          >
            Voltar aos casos
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Stepper Header */}
      <div className="-mx-4 -mt-6 flex flex-col items-stretch justify-between gap-2 bg-[#E3E0E8] px-4 py-8 sm:mx-0 sm:mt-0 sm:flex-row sm:items-center sm:border-b sm:border-slate-200 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-3">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#002B43] hover:bg-slate-100 transition-colors mr-1"
              title="Voltar etapa"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <span className="hidden text-[11px] font-bold text-[#C08A4E] uppercase tracking-wider sm:block">
              Etapa {step} de 3
            </span>
            <h1 className="w-full text-center text-2xl font-medium text-[#202020] sm:text-left sm:font-bold sm:text-[#002B43]">
              {step === 1 && "Atualizações dos casos"}
              {step === 2 && "Anexar documento"}
              {step === 3 && "Observações"}
            </h1>
          </div>
        </div>

        {selectedCase && (
          <span className="max-w-full break-words self-start text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-full sm:self-auto">
            Caso {selectedCase.caseId}
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-[14px] text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: SELECIONAR CASO (Figma Page 22) */}
      {/* ======================================================== */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="order-3 text-3xl font-bold leading-tight text-[#202020] sm:order-none sm:text-xs sm:font-normal sm:text-[#6E7580]">
            Selecione os casos que deseja atualizar
          </p>

          {/* Search Input */}
          <div className="order-1 relative flex gap-3 sm:order-none">
            <Search className="hidden" />
            <input
              type="text"
              placeholder="Pesquisar Notificação"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              className="min-w-0 flex-1 bg-[#F6F4F8] border border-slate-200 rounded-[14px] px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#002B43] shadow-sm"
            />
            <button type="button" aria-label="Pesquisar" className="flex h-12 w-14 flex-none items-center justify-center rounded-[14px] border border-slate-200 bg-white text-[#202020] shadow-sm">
              <Search className="h-7 w-7" />
            </button>
          </div>

          <div className="order-2 flex items-center justify-between px-1 text-sm font-semibold text-[#686270] sm:hidden">
            <span>Notificações <strong className="ml-2 rounded-full bg-slate-300 px-2.5 py-1 text-[#202020]">16</strong></span>
            <span>Visualizadas <strong className="ml-2 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">8</strong></span>
          </div>

          {/* Cases Radio List */}
          {loading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="bg-white rounded-[18px] p-8 text-center border border-slate-100">
              <p className="text-xs text-slate-500">Nenhum caso atribuído localizado.</p>
            </div>
          ) : (
            <div className="order-4 space-y-3 max-h-[420px] overflow-y-auto pr-1 sm:order-none">
              {filteredCases.map((c) => {
                const isSelected = selectedCaseId === c.caseId;

                return (
                  <label
                    key={c.caseId}
                    htmlFor={`radio-${c.caseId}`}
                    className={`block w-full min-w-0 max-w-full rounded-[14px] p-5 transition-all cursor-pointer border shadow-sm ${
                      isSelected
                        ? "bg-[#E3DFE8] border-[#002B43]"
                        : "bg-[#E3DFE8] border-[#CEC8D5] hover:bg-[#DDD8E3]"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        id={`radio-${c.caseId}`}
                        type="radio"
                        name="selectedCase"
                        value={c.caseId}
                        checked={isSelected}
                        onChange={() => setSelectedCaseId(c.caseId)}
                        className="w-4 h-4 text-[#002B43] focus:ring-[#002B43] accent-[#002B43] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <span className="max-w-full break-words text-sm font-normal text-[#202020] underline underline-offset-4 sm:font-bold sm:text-[#002B43] sm:no-underline">
                            Processo nº {c.caseId}
                          </span>
                          <span className="hidden sm:block"><Badge status={c.status} /></span>
                        </div>
                        {c.category && (
                          <span className="hidden text-xs text-[#4A4A4A] mt-0.5 sm:block">
                            {c.category}
                          </span>
                        )}
                        {c.citizenName && (
                          <span className="hidden text-[11px] text-slate-500 sm:block">
                            Cidadão: {c.citizenName}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Botão Avançar */}
          <div className="order-5 pt-4 flex justify-stretch sm:order-none sm:justify-end">
            <button
              type="button"
              disabled={!selectedCaseId}
              onClick={() => setStep(2)}
              className="mx-auto h-14 w-4/5 px-8 bg-[#002B43] hover:bg-[#003A58] disabled:bg-slate-300 text-white font-bold rounded-[24px] text-xl shadow-md transition-all flex items-center justify-center gap-2 sm:mx-0 sm:h-12 sm:w-auto sm:rounded-[14px] sm:text-sm sm:font-semibold"
            >
              <span>Avançar</span>
              <ArrowRight className="hidden w-4 h-4 sm:block" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: ANEXAR DOCUMENTO (Figma Page 23) */}
      {/* ======================================================== */}
      {step === 2 && (
        <div className="-mx-4 -mt-6 min-h-[calc(100vh-9rem)] space-y-6 bg-[#ECECEC] px-8 py-14 sm:mx-0 sm:mt-0 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-0">
          <p className="hidden text-xs text-[#6E7580] sm:block">
            Anexe petições protocoladas, despachos, certidões ou comprovantes (opcional).
          </p>

          {!selectedFile ? (
            /* Dropzone Central Grande */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              className={`w-full min-w-0 max-w-full rounded-none border-0 p-10 text-center transition-all bg-white flex min-h-[430px] flex-col items-center justify-center cursor-pointer shadow-sm sm:min-h-0 sm:rounded-[18px] sm:border-2 sm:border-dashed sm:p-14 ${
                isDragOver
                  ? "sm:border-[#002B43] sm:bg-[#002B43]/5"
                  : "sm:border-slate-300 sm:hover:border-[#002B43]"
              }`}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload-input"
                className="flex w-full min-w-0 max-w-full flex-col items-center cursor-pointer space-y-3"
              >
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-[#002B43]">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#002B43]">
                    Arraste o arquivo aqui
                  </p>
                  <p className="text-xs text-slate-500">ou clique para selecionar</p>
                </div>
                <span className="text-[10px] text-slate-400 block pt-2">
                  Formatos aceitos: PDF, PNG, JPG, DOCX, XLSX (máx. 10MB)
                </span>
              </label>
            </div>
          ) : (
            /* Arquivo Selecionado Preview */
            <div className="w-full min-w-0 max-w-full space-y-4">
              <div className="flex min-h-[430px] flex-col items-center justify-center bg-white p-4 shadow-sm sm:hidden" aria-label="Pré-visualização do documento anexado">
                <div className="w-[64vw] max-w-[240px] scale-[1.17] space-y-3 border border-slate-200 bg-white p-6 shadow-md">
                  <div className="h-2 w-2/3 rounded bg-slate-500" />
                  <div className="h-1.5 w-full rounded bg-slate-300" />
                  <div className="h-1.5 w-11/12 rounded bg-slate-300" />
                  <div className="h-1.5 w-full rounded bg-slate-300" />
                  <div className="h-1.5 w-4/5 rounded bg-slate-300" />
                  <div className="pt-4 space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-1.5 w-full rounded bg-slate-200" />)}
                  </div>
                </div>
                <p className="mt-4 max-w-full truncate text-xs font-medium text-slate-600">{selectedFile.name}</p>
              </div>
              <div className="hidden w-full min-w-0 max-w-full bg-white rounded-[18px] p-4 sm:block sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#002B43] flex items-center justify-center flex-shrink-0">
                    {selectedFile.name.endsWith(".pdf") ? (
                      <FileText className="w-6 h-6 text-red-600" />
                    ) : (
                      <File className="w-6 h-6 text-[#002B43]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || "Arquivo"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="file-replace-input"
                    className="p-2 text-slate-600 hover:text-[#002B43] hover:bg-slate-100 rounded-lg cursor-pointer transition-colors text-xs font-semibold flex items-center gap-1"
                    title="Substituir arquivo"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Substituir</span>
                    <input
                      id="file-replace-input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                    title="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remover</span>
                  </button>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="hidden h-12 w-full px-6 rounded-[14px] border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors sm:block"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mx-auto h-14 w-4/5 px-5 sm:px-8 bg-[#002B43] hover:bg-[#003A58] text-white font-bold rounded-[24px] text-xl shadow-md transition-all flex items-center justify-center gap-2 sm:mx-0 sm:h-12 sm:w-full sm:rounded-[14px] sm:text-sm sm:font-semibold"
            >
              <span>{selectedFile ? "Continuar" : "Anexar Doc"}</span>
              <ArrowRight className="hidden w-4 h-4 sm:block" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: OBSERVAÇÕES (Figma Page 24) */}
      {/* ======================================================== */}
      {step === 3 && (
        <form onSubmit={handleSubmitUpdate} className="-mx-4 -mt-6 min-h-[calc(100vh-9rem)] space-y-6 bg-[#ECECEC] px-8 py-12 sm:mx-0 sm:mt-0 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-0">
          {/* Preview do Documento se Anexado */}
          {selectedFile && (
            <div className="space-y-4">
              <div className="mx-auto flex h-44 w-32 flex-col justify-center space-y-2 border border-slate-200 bg-white p-4 shadow-md sm:hidden" aria-label="Miniatura do documento anexado">
                {Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-1 w-full rounded bg-slate-200" />)}
              </div>
              <div className="bg-slate-50 rounded-[14px] p-3.5 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 max-w-[80%]">
                <FileText className="w-4 h-4 text-[#C08A4E] flex-shrink-0" />
                <span className="text-slate-700 font-medium truncate">
                  Anexo: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-[11px] font-semibold text-[#002B43] hover:underline"
              >
                Alterar
              </button>
              </div>
            </div>
          )}

          {/* Textarea Grande */}
          <div className="space-y-2">
            <label className="mb-8 block text-center text-2xl font-normal normal-case tracking-normal text-[#202020] sm:mb-0 sm:text-left sm:text-xs sm:font-bold sm:uppercase sm:tracking-wide sm:text-slate-800">
              Observações
            </label>
            <textarea
              required
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva a atualização para o cidadão..."
            className="w-full min-w-0 max-w-full bg-white border border-slate-400 rounded-[16px] p-4 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#002B43] focus:ring-1 focus:ring-[#002B43] min-h-[240px] shadow-md leading-relaxed"
            />
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => setStep(2)}
              className="hidden h-12 w-full px-6 rounded-[14px] border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50 sm:block"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={!notes.trim() || sending}
              className="mx-auto h-14 w-4/5 px-6 sm:px-8 bg-[#002B43] hover:bg-[#003A58] disabled:bg-slate-300 text-white font-bold rounded-[24px] text-xl shadow-md transition-all flex items-center justify-center gap-2 sm:mx-0 sm:h-12 sm:w-full sm:rounded-[14px] sm:text-sm sm:font-semibold"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <span>Enviar atualização</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function LawyerUpdatesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-12">
          <CardSkeleton />
        </div>
      }
    >
      <UpdatesWizardInner />
    </Suspense>
  );
}
