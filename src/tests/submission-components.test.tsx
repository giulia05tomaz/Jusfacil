// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubmissionFlow } from "@/components/submission/SubmissionFlow";
import { createSubmissionKey } from "@/lib/submission/client";
import { SubmissionRequestSchema, TEST_SUBMISSION_ACKNOWLEDGMENT } from "@/lib/submission/shared";
import { JurisBotRequestSchema } from "@/lib/ai/schemas";
import type { DraftVersion, LegalCase } from "@/types";

const state = vi.hoisted(() => ({ getIdToken: vi.fn(), fetch: vi.fn(), history: [] as Record<string, unknown>[], messages: [] as Record<string, unknown>[], post: vi.fn(), push: vi.fn(), version: 2, hasEvidence: false, assemble: vi.fn(), retrieve: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => { const clean = { ...props }; delete clean.priority; delete clean.unoptimized; return React.createElement("img", clean); } }));
vi.mock("@/lib/firebase/authContext", () => ({ useAuth: () => ({ user: { uid: "citizen-a", email: "account.qa@example.com", getIdToken: state.getIdToken }, profile: { uid: "citizen-a", role: "CITIZEN", fullName: "Cidadã QA" } }) }));
vi.mock("@/lib/firebase/config", () => ({ auth: { currentUser: null } }));
vi.mock("@/lib/firebase/services", () => ({ getCaseById: async () => state.version === 3 ? { ...legalCase, currentDraftVersion: 3, status: "AGUARDANDO_REVISAO" } : legalCase, getCaseMessages: async () => state.messages, getCaseDrafts: async () => state.version === 3 ? [{ ...draft, version: 3, approved: false, title: "Petição Inicial — Versão 3", changeSummary: "Valor R$ 3.000", revisionAdvice: "Orientação preliminar registrada" }, draft] : [draft], getCaseEvidences: async () => state.hasEvidence ? [{ evidenceId: "e1", caseId: legalCase.caseId, status: "PROCESSED", uploadedAt: "2026-09-01T00:00:00Z", order: 1, reference: "01", title: "Comprovante", originalName: "01.jpg" }] : [], validateEvidenceFile: vi.fn(), removeEvidence: vi.fn() }));
vi.mock("@/lib/drafts/documentClient", () => ({ assembleDocument: (...args: unknown[]) => state.assemble(...args), retrieveDocument: (...args: unknown[]) => state.retrieve(...args) }));

const legalCase = { caseId: "JF-2026-QAEMAIL", citizenId: "citizen-a", title: "Caso QA", summary: "Caso totalmente fictício", status: "MINUTA_APROVADA", currentDraftVersion: 2, approvedVersion: 2 } as LegalCase;
const draft = { caseId: legalCase.caseId, version: 2, approved: true, content: "Fatos confirmados.", createdAt: "2026-09-12T00:00:00.000Z", title: "Petição Inicial" } as DraftVersion;
const submission = { submissionId: "qa-id", type: "TEST_EMAIL", draftId: "v2", draftVersion: 2, status: "SENT", recipientMode: "TEST", copyEmail: "account.qa@example.com", createdAt: "2026-09-12T00:00:00.000Z" };
const renderFlow = (onRequestChange = vi.fn()) => render(<SubmissionFlow legalCase={legalCase} approvedDraft={draft} onRequestChange={onRequestChange} />);
const start = () => fireEvent.click(screen.getByRole("button", { name: "Enviar para o fórum" }));
const getConfirm = async () => {
  start(); fireEvent.click(screen.getByRole("button", { name: "Não, continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar para confirmação" }));
};

beforeEach(() => {
  vi.clearAllMocks(); state.history = []; state.messages = [];
  state.version = 2; state.hasEvidence = false;
  state.assemble.mockResolvedValue({ version: 3 });
  state.retrieve.mockResolvedValue(new Response("mock-page", { headers: { "X-Document-Pages": "2", "X-First-Annex-Page": "2" } }));
  URL.createObjectURL = vi.fn().mockReturnValue("blob:qa-preview"); URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("fetch", state.fetch);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  state.getIdToken.mockResolvedValue("firebase-token-qa");
  state.post.mockImplementation(async (_url: string, options: RequestInit) => {
    const input = JSON.parse(options.body as string);
    const result = { ...submission, submissionId: input.idempotencyKey, copyEmail: input.copyEmail };
    state.history = [result];
    return new Response(JSON.stringify({ submission: result }), { status: 200 });
  });
  state.fetch.mockImplementation(async (url: string, options: RequestInit) => options.method === "POST" ? state.post(url, options) : new Response(JSON.stringify({ submissions: state.history }), { status: 200 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("jornada de teste do cidadão — zero e-mails reais", () => {
  it("CTA persistente só aparece para a versão atualmente aprovada", async () => {
    const view = render(<SubmissionFlow legalCase={{ ...legalCase, status: "AGUARDANDO_REVISAO", currentDraftVersion: 3 }} approvedDraft={draft} onRequestChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Enviar para o fórum" })).not.toBeInTheDocument();
    view.rerender(<SubmissionFlow legalCase={legalCase} approvedDraft={draft} onRequestChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "O que você deseja fazer agora?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar para o fórum" })).toBeVisible();
  });
  it("botão advogado só informa Em breve, sem POST/backend", async () => {
    renderFlow(); fireEvent.click(screen.getByRole("button", { name: /Buscar um advogado/ }));
    expect(screen.getByText(/Em breve você poderá encontrar profissionais/)).toBeVisible();
    expect(state.post).not.toHaveBeenCalled();
    expect(screen.getByText("Em breve")).toBeVisible();
  });
  it("clicar Enviar não envia: alterações usam callback existente", async () => {
    const onChange = vi.fn(); renderFlow(onChange); start();
    expect(screen.getByText("Você deseja fazer alguma alteração antes do envio?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sim, quero alterar" }));
    expect(onChange).toHaveBeenCalledOnce(); expect(state.post).not.toHaveBeenCalled(); expect(draft.approved).toBe(true);
  });
  it("e-mail inicial é o da conta Firebase, editável e trim antes da confirmação", async () => {
    renderFlow(); start(); fireEvent.click(screen.getByRole("button", { name: "Não, continuar" }));
    const field = screen.getByLabelText("E-mail para receber uma cópia"); expect(field).toHaveValue("account.qa@example.com"); expect(field).toHaveAttribute("maxlength", "254");
    fireEvent.change(field, { target: { value: "  corrected.qa@example.com  " } });
    fireEvent.submit(field.closest("form")!);
    expect(screen.getByText("corrected.qa@example.com")).toBeVisible(); expect(state.post).not.toHaveBeenCalled();
  });
  it("e-mail inválido não avança", async () => {
    renderFlow(); start(); fireEvent.click(screen.getByRole("button", { name: "Não, continuar" }));
    const field = screen.getByLabelText("E-mail para receber uma cópia"); fireEvent.change(field, { target: { value: "invalid" } }); fireEvent.submit(field.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido"); expect(state.post).not.toHaveBeenCalled();
  });
  it("confirmação exibe destino de QA e checkbox obrigatório", async () => {
    renderFlow(); await getConfirm(); expect(screen.getByText("Ambiente de testes JusFácil")).toBeVisible();
    expect(screen.getByText(/Este envio é apenas uma simulação funcional/)).toBeVisible();
    const confirm = screen.getByRole("button", { name: "Confirmar envio de teste" }); expect(confirm).toBeDisabled();
    fireEvent.click(confirm); expect(state.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT)); expect(confirm).toBeEnabled();
  });
  it("double click usa só um POST; loading/disabled continuam visíveis", async () => {
    let finish!: (value: Response) => void; state.post.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    renderFlow(); await getConfirm(); fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT));
    const confirm = screen.getByRole("button", { name: "Confirmar envio de teste" }); fireEvent.click(confirm); fireEvent.click(confirm);
    const loading = screen.getByRole("button", { name: "Enviando documento..." }); expect(loading).toBeVisible(); expect(loading).toBeDisabled();
    await waitFor(() => expect(state.post).toHaveBeenCalledOnce());
    finish(new Response(JSON.stringify({ submission }), { status: 200 }));
    expect(await screen.findByText("✓ Envio de teste realizado")).toBeVisible();
    expect(screen.getAllByText("Este envio não representa protocolo judicial real.").length).toBeGreaterThan(0);
    const payload = JSON.parse(state.post.mock.calls[0][1].body); expect(SubmissionRequestSchema.safeParse(payload).success).toBe(true); expect(Object.keys(payload).sort()).toEqual(["acknowledgment", "approvedDraftId", "copyEmail", "idempotencyKey"]);
  });
  it("falha não mostra Enviado; retry exige ciência e gera nova chave", async () => {
    state.post.mockImplementationOnce(async (_url: string, options: RequestInit) => {
      const input = JSON.parse(options.body as string); const failed = { ...submission, submissionId: input.idempotencyKey, status: "FAILED" };
      state.history = [failed]; return new Response(JSON.stringify({ submission: failed, message: "Não foi possível enviar o documento. Tente novamente." }), { status: 502 });
    });
    renderFlow(); await getConfirm(); fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT)); fireEvent.click(screen.getByRole("button", { name: "Confirmar envio de teste" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar"); expect(screen.queryByText("✓ Envio de teste realizado")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); await screen.findByText("✓ Envio de teste realizado");
    expect(state.post).toHaveBeenCalledTimes(2); expect(JSON.parse(state.post.mock.calls[0][1].body).idempotencyKey).not.toBe(JSON.parse(state.post.mock.calls[1][1].body).idempotencyKey);
  });
  it("histórico é reobtido da API no remount/refresh", async () => {
    state.history = [submission]; const view = renderFlow(); expect(await screen.findByText("Enviado")).toBeVisible(); view.unmount();
    renderFlow(); expect(await screen.findByText("Enviado")).toBeVisible(); expect(state.post).not.toHaveBeenCalled();
  });
  it("replay SENT não mostra novo sucesso e identifica histórico/data/CC anteriores", async () => {
    state.history = [submission];
    state.post.mockResolvedValue(new Response(JSON.stringify({ submission, idempotent: true }), { status: 200 }));
    renderFlow(); await getConfirm(); fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio de teste" }));
    expect(await screen.findByText("Esta versão já foi enviada anteriormente")).toBeVisible();
    expect(screen.getByText(/Nenhum novo e-mail foi enviado nesta tentativa/)).toBeVisible();
    expect(screen.queryByText("✓ Envio de teste realizado")).not.toBeInTheDocument();
    expect(screen.getByText("E-mail de cópia: account.qa@example.com")).toBeVisible();
    expect(state.post).toHaveBeenCalledOnce();
  });
  it("409 por CC diferente mantém histórico, sem mensagem de sucesso", async () => {
    state.history = [submission];
    state.post.mockResolvedValue(new Response(JSON.stringify({ error: "SUBMISSION_COPY_EMAIL_CONFLICT", message: "Esta versão já foi enviada com outro e-mail de cópia. Nenhum novo e-mail foi enviado para o endereço informado. Consulte o histórico." }), { status: 409 }));
    renderFlow(); await screen.findByText("Enviado"); start(); fireEvent.click(screen.getByRole("button", { name: "Não, continuar" }));
    fireEvent.change(screen.getByLabelText("E-mail para receber uma cópia"), { target: { value: "craftofgames@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar para confirmação" }));
    fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT)); fireEvent.click(screen.getByRole("button", { name: "Confirmar envio de teste" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum novo e-mail foi enviado para o endereço informado");
    expect(screen.queryByText("✓ Envio de teste realizado")).not.toBeInTheDocument();
    expect(screen.getByText("E-mail de cópia: account.qa@example.com")).toBeVisible();
  });
  it.each(["SENT", "PENDING"])("resposta antiga %s com outro CC é rejeitada mesmo com HTTP 200", async (status) => {
    state.post.mockResolvedValue(new Response(JSON.stringify({ submission: { ...submission, status, copyEmail: "other@example.com" }, idempotent: true }), { status: 200 }));
    renderFlow(); await getConfirm(); fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio de teste" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum novo envio foi confirmado para o endereço informado");
    expect(screen.queryByText("✓ Envio de teste realizado")).not.toBeInTheDocument();
    expect(screen.queryByText("Esta versão já foi enviada anteriormente")).not.toBeInTheDocument();
  });
  it("401 renova token uma vez com o mesmo corpo/chave", async () => {
    state.post.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    renderFlow(); await getConfirm(); fireEvent.click(screen.getByLabelText(TEST_SUBMISSION_ACKNOWLEDGMENT)); fireEvent.click(screen.getByRole("button", { name: "Confirmar envio de teste" }));
    await screen.findByText("✓ Envio de teste realizado"); expect(state.post).toHaveBeenCalledTimes(2); expect(state.post.mock.calls[0][1].body).toBe(state.post.mock.calls[1][1].body); expect(state.getIdToken).toHaveBeenCalledWith(true);
  });
  it("gera UUID seguro também para HTTP do IP local, sem depender de randomUUID", () => { expect(SubmissionRequestSchema.shape.idempotencyKey.safeParse(createSubmissionKey()).success).toBe(true); });
  it("CTA do JurisBot inicia o MESMO fluxo e alteração foca o campo existente sem OpenAI", async () => {
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient");
    render(<Chat caseId={legalCase.caseId} />);
    const chatCta = await screen.findByTestId("jurisbot-submission-cta");
    fireEvent.click(within(chatCta).getByRole("button", { name: "Enviar para o fórum" }));
    expect(screen.getByRole("heading", { name: "Antes de continuar" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sim, quero alterar" }));
    expect(screen.getByLabelText("O que você gostaria que fosse corrigido?")).toHaveFocus(); expect(state.post).not.toHaveBeenCalled();
    fireEvent.click(within(chatCta).getByRole("button", { name: /Buscar um advogado/ })); expect(screen.getByText(/Em breve você poderá encontrar/)).toBeVisible(); expect(state.post).not.toHaveBeenCalled();
  });
  it("solicitação orienta antes de alterar; confirmação gera V3 e remonta anexos da nova versão", async () => {
    state.hasEvidence = true;
    state.post.mockImplementation(async (_url: string, options: RequestInit) => {
      const input = JSON.parse(options.body as string);
      if (input.action === "review_revision") return Response.json({ reviewId: input.clientRequestId, baseVersion: 2, advice: "Orientação preliminar: confira os pedidos com um advogado.", ready: true, questions: [], changeSummary: "Valor R$ 3.000 conforme pedidos confirmados", proposedClaimValue: 3000 });
      expect(input).toMatchObject({ action: "revise", confirmation: true, baseVersion: 2, reviewId: expect.any(String) });
      state.version = 3; return Response.json({ version: 3 });
    });
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient"); render(<Chat caseId={legalCase.caseId} />);
    fireEvent.change(await screen.findByLabelText("O que você gostaria que fosse corrigido?"), { target: { value: "Confirmo R$ 3.000 conforme os pedidos e valores esclarecidos." } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar alteração" }));
    expect(await screen.findByText(/Orientação preliminar do JurisBot/)).toBeVisible(); expect(state.post).toHaveBeenCalledOnce(); expect(state.assemble).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração e gerar nova versão" }));
    expect(await screen.findByText(/Versão 3 salva para revisão/)).toBeVisible();
    await waitFor(() => expect(state.assemble).toHaveBeenCalledWith(expect.anything(), legalCase.caseId, 3));
    expect(state.retrieve).toHaveBeenCalledWith(expect.anything(), legalCase.caseId, 3, "page", 1);
    expect(screen.queryByTestId("jurisbot-submission-cta")).not.toBeInTheDocument();
    expect(screen.getByText(/Orientação preliminar registrada:/)).toBeVisible();
    expect(state.post.mock.calls.every(call => String(call[0]).endsWith("/draft"))).toBe(true);
  });
  it("pedido ambíguo mostra perguntas sem botão de aplicar, editar invalida orientação", async () => {
    state.post.mockResolvedValue(Response.json({ reviewId: "11111111-1111-4111-8111-111111111111", baseVersion: 2, advice: "Precisamos esclarecer a composição.", ready: false, questions: ["Quais pedidos compõem os R$ 3.000?"], changeSummary: "Pendente", proposedClaimValue: null }));
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient"); render(<Chat caseId={legalCase.caseId} />);
    const field = await screen.findByLabelText("O que você gostaria que fosse corrigido?"); fireEvent.change(field, { target: { value: "Quero R$ 3.000" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar alteração" }));
    expect(await screen.findByText(/Quais pedidos compõem/)).toBeVisible(); expect(screen.queryByRole("button", { name: "Confirmar alteração e gerar nova versão" })).not.toBeInTheDocument(); expect(state.post).toHaveBeenCalledOnce();
    fireEvent.change(field, { target: { value: "Resposta: ..." } }); expect(screen.queryByText(/Precisamos esclarecer/)).not.toBeInTheDocument();
  });
  it("double click não duplica revisão; loading e disabled permanecem visíveis", async () => {
    let finish!: (value: Response) => void; state.post.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient"); render(<Chat caseId={legalCase.caseId} />);
    fireEvent.change(await screen.findByLabelText("O que você gostaria que fosse corrigido?"), { target: { value: "Solicito alteração" } });
    const button = screen.getByRole("button", { name: "Solicitar alteração" }); fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeVisible(); expect(button).toBeDisabled(); await waitFor(() => expect(state.post).toHaveBeenCalledOnce());
    finish(Response.json({ message: "Não foi possível orientar agora." }, { status: 503 })); expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível orientar agora."); expect(button).toBeEnabled();
  });
  it("proposta recebida pelo chat confirma no mesmo endpoint e monta V3 com evidências", async () => {
    state.hasEvidence = true;
    const proposal = { reviewId: "11111111-1111-4111-8111-111111111111", baseVersion: 2, revisionRequest: "Mude o nome da loja", advice: "Apenas o nome será corrigido.", ready: true, questions: [], changeSummary: "Nome da loja corrigido", proposedClaimValue: 1429.9 };
    state.post.mockImplementation(async (url: string, options: RequestInit) => {
      if (url === "/api/chat/jurisbot") return Response.json({ reply: "Proposta de alteração", revisionReview: proposal });
      expect(JSON.parse(options.body as string)).toMatchObject({ action: "revise", reviewId: proposal.reviewId, confirmation: true });
      state.version = 3; return Response.json({ version: 3 });
    });
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient"); render(<Chat caseId={legalCase.caseId} />);
    const input = await screen.findByPlaceholderText("Descreva a alteração ou confirme a proposta...");
    fireEvent.change(input, { target: { value: proposal.revisionRequest } }); fireEvent.submit(input.closest("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar alteração e gerar nova versão" }));
    await waitFor(() => expect(state.assemble).toHaveBeenCalledWith(expect.anything(), legalCase.caseId, 3));
    expect(state.post).toHaveBeenCalledTimes(2); expect(screen.queryByTestId("jurisbot-submission-cta")).not.toBeInTheDocument();
  });
  it("proposta persistida reaparece após refresh sem nova chamada de AI", async () => {
    const proposal = { reviewId: "11111111-1111-4111-8111-111111111111", baseVersion: 2, revisionRequest: "Corrija o nome", advice: "Confira o nome proposto.", ready: true, questions: [], changeSummary: "Nome corrigido", proposedClaimValue: 1429.9 };
    state.messages = [{ messageId: "revision-review", sender: "BOT", content: "Proposta pendente", timestamp: "2026-09-13T00:00:00Z", createdBy: "citizen-a", revisionReview: proposal }];
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient");
    const view = render(<Chat caseId={legalCase.caseId} />);
    expect(await screen.findByRole("button", { name: "Confirmar alteração e gerar nova versão" })).toBeVisible();
    view.unmount(); render(<Chat caseId={legalCase.caseId} />);
    expect(await screen.findByRole("button", { name: "Confirmar alteração e gerar nova versão" })).toBeVisible();
    expect(state.post).not.toHaveBeenCalled();
  });
  it("chat e solicitação de alteração funcionam em HTTP sem randomUUID", async () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto); vi.stubGlobal("crypto", { getRandomValues });
    state.post.mockImplementation(async (url: string, options: RequestInit) => {
      const input = JSON.parse(options.body as string);
      if (url === "/api/chat/jurisbot") { expect(JurisBotRequestSchema.safeParse(input).success).toBe(true); return Response.json({ reply: "Resposta mock" }); }
      expect(input.action).toBe("review_revision"); return Response.json({ reviewId: input.clientRequestId, baseVersion: 2, advice: "Orientação mock", ready: false, questions: ["Qual alteração?"], changeSummary: "Pendente", proposedClaimValue: null });
    });
    const { default: Chat } = await import("@/app/app/jurisbot/[id]/JurisBotChatClient"); render(<Chat caseId={legalCase.caseId} />);
    const chat = await screen.findByPlaceholderText("Descreva a alteração ou confirme a proposta..."); fireEvent.change(chat, { target: { value: "Pergunta fictícia" } }); fireEvent.submit(chat.closest("form")!);
    await waitFor(() => expect(state.post).toHaveBeenCalledOnce()); await waitFor(() => expect(chat).toBeEnabled());
    fireEvent.change(screen.getByLabelText("O que você gostaria que fosse corrigido?"), { target: { value: "Revisar valor" } }); fireEvent.click(screen.getByRole("button", { name: "Solicitar alteração" }));
    expect(await screen.findByText("Orientação mock")).toBeVisible(); expect(state.post).toHaveBeenCalledTimes(2);
  });
});
