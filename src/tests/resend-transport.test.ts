import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "@/lib/email/sendEmail";

vi.mock("resend", () => ({ Resend: class {} }));
const network = vi.fn<typeof fetch>();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", network); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("transporte seguro — SDK e rede sempre mockados", () => {
  it("impõe timeout e preserva headers/payload sem registrar erro bruto", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    network.mockResolvedValue(new Response(JSON.stringify({ message: "secret upstream content" }), { status: 500 }));
    const result = await new ResendEmailProvider().fetchRequest("/emails", { method: "POST", headers: { "Idempotency-Key": "qa" }, body: "mocked payload" });
    expect(network).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: { "Idempotency-Key": "qa" }, body: "mocked payload", signal: expect.any(AbortSignal) }));
    expect(result).toMatchObject({ data: null, error: { statusCode: 500, message: "EMAIL_PROVIDER_REJECTED" } });
    expect(JSON.stringify(result)).not.toContain("secret"); expect(logs).not.toHaveBeenCalled();
  });
  it("sanitiza restrição de domínio/destinatário sem tentar novamente", async () => {
    network.mockResolvedValue(new Response(JSON.stringify({ message: "You can only send testing emails to your own email address. Please verify a domain." }), { status: 403 }));
    expect(await new ResendEmailProvider().fetchRequest("/emails")).toMatchObject({ error: { statusCode: 403, message: "RESEND_SENDER_DOMAIN_RESTRICTION" } });
    expect(network).toHaveBeenCalledOnce();
  });
  it("falha de conexão permanece incerta sem expor exceção", async () => {
    network.mockRejectedValue(new Error("private upstream stack"));
    expect(await new ResendEmailProvider().fetchRequest("/emails")).toMatchObject({ error: { statusCode: null, message: "EMAIL_DELIVERY_UNKNOWN" } });
    expect(network).toHaveBeenCalledOnce();
  });
});
