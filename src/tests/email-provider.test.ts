import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "@/lib/email/sendEmail";

const sdk = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({ Resend: class {
  emails = { send: sdk.send };
} }));
const fakeFetch = vi.fn(() => { throw new Error("External network forbidden in tests"); });
const message = {
  to: "forum.qa@example.com", cc: "citizen.qa@example.com", subject: "[JusFácil — TESTE] Petição Inicial — JF-QA",
  text: "Envio de teste, sem protocolo judicial real.", html: "<p>Envio de teste.</p>", idempotencyKey: "test-key",
  attachments: [{ filename: "peticao-inicial-JF-QA-v2.pdf", contentType: "application/pdf" as const, content: Buffer.from("%PDF-1.3\nQA") }],
};
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fakeFetch);
  vi.stubEnv("FORUM_SUBMISSION_MODE", "test"); vi.stubEnv("FORUM_TEST_RECIPIENT", "forum.qa@example.com");
  vi.stubEnv("EMAIL_PROVIDER", "resend"); vi.stubEnv("RESEND_FROM", "JusFacil <sender@example.com>"); vi.stubEnv("RESEND_API_KEY", "fake-key-for-unit-tests");
  sdk.send.mockResolvedValue({ data: { id: "provider-qa-id" }, error: null });
});
afterEach(() => { expect(fakeFetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("adapter de e-mail — SDK Resend sempre mockado", () => {
  it("mapeia remetente server-side, TO, CC, PDF e chave do provedor", async () => {
    expect(await sendEmail(message)).toEqual({ providerMessageId: "provider-qa-id" });
    expect(sdk.send).toHaveBeenCalledWith({ from: "JusFacil <sender@example.com>", to: [message.to], cc: [message.cc], subject: message.subject, text: message.text, html: message.html, attachments: [{ filename: message.attachments[0].filename, content: message.attachments[0].content, contentType: "application/pdf" }] }, { idempotencyKey: message.idempotencyKey });
  });
  it("sem credencial, não há chamada nem fallback", async () => { vi.stubEnv("RESEND_API_KEY", ""); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" }); expect(fakeFetch).not.toHaveBeenCalled(); });
  it("mode não test é bloqueado também na fronteira do provedor", async () => { vi.stubEnv("FORUM_SUBMISSION_MODE", "production"); await expect(sendEmail(message)).rejects.toMatchObject({ code: "SUBMISSION_MODE_DISABLED" }); expect(fakeFetch).not.toHaveBeenCalled(); });
  it("não permite outro TO", async () => { await expect(sendEmail({ ...message, to: "arbitrary@example.com" })).rejects.toMatchObject({ code: "TEST_RECIPIENT_INVALID" }); expect(fakeFetch).not.toHaveBeenCalled(); });
  it("bloqueia remetente com header injection", async () => { vi.stubEnv("RESEND_FROM", "sender@example.com\r\nBcc: arbitrary@example.com"); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" }); expect(sdk.send).not.toHaveBeenCalled(); });
  it("rejeição do provedor não é sucesso e não expõe resposta bruta", async () => { sdk.send.mockResolvedValue({ data: null, error: { statusCode: 403, message: "secret upstream" } }); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_PROVIDER_REJECTED", deliveryUncertain: false, message: "Não foi possível enviar o e-mail de teste." }); });
  it("timeout é entrega incerta, não sucesso", async () => { sdk.send.mockRejectedValue(new Error("connection lost")); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_UNKNOWN", deliveryUncertain: true }); });
  it("200 sem message id não é considerado sucesso", async () => { sdk.send.mockResolvedValue({ data: {}, error: null }); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_UNKNOWN" }); });
  it("sem RESEND_FROM não usa remetente inventado nem EMAIL_FROM antigo", async () => { vi.stubEnv("RESEND_FROM", ""); vi.stubEnv("EMAIL_FROM", "old@example.com"); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" }); expect(sdk.send).not.toHaveBeenCalled(); });
  it("deduplica CC igual ao destinatário principal", async () => { await sendEmail({ ...message, cc: message.to.toUpperCase() }); expect(sdk.send.mock.calls[0][0].cc).toBeUndefined(); expect(sdk.send.mock.calls[0][0].to).toEqual([message.to]); });
  it("restrição sender/domínio é bloqueada sem retry/fallback", async () => { sdk.send.mockResolvedValue({ data: null, error: { statusCode: 403, message: "RESEND_SENDER_DOMAIN_RESTRICTION" } }); await expect(sendEmail(message)).rejects.toMatchObject({ code: "RESEND_SENDER_DOMAIN_RESTRICTION", deliveryUncertain: false }); expect(sdk.send).toHaveBeenCalledOnce(); });
  it("erro sem status preserva entrega incerta", async () => { sdk.send.mockResolvedValue({ data: null, error: { statusCode: null } }); await expect(sendEmail(message)).rejects.toMatchObject({ code: "EMAIL_DELIVERY_UNKNOWN", deliveryUncertain: true }); });
  it("bloqueia PDF vazio e tamanho excessivo", async () => {
    for (const content of [Buffer.alloc(0), Buffer.alloc(8 * 1024 * 1024 + 1)]) {
      await expect(sendEmail({ ...message, attachments: [{ ...message.attachments[0], content }] })).rejects.toMatchObject({ code: "PDF_INVALID" });
    }
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
