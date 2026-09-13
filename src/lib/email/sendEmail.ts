import { z } from "zod";
import { Resend, type Response as ResendResponse } from "resend";
import { CopyEmailSchema } from "@/lib/submission/shared";

export class EmailProviderError extends Error {
  constructor(public readonly code: string, public readonly deliveryUncertain = false) {
    super("Não foi possível enviar o e-mail de teste.");
    this.name = "EmailProviderError";
  }
}

export interface EmailMessage {
  to: string;
  cc: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; contentType: "application/pdf"; content: Buffer }[];
  idempotencyKey: string;
}

// O SDK atual registra respostas brutas em desenvolvimento. A fronteira pública
// de transporte é especializada para impor timeout e nunca registrar segredos.
export class ResendEmailProvider extends Resend {
  override async fetchRequest<T>(path: string, options: RequestInit = {}): Promise<ResendResponse<T>> {
    try {
      const response = await fetch(`https://api.resend.com${path}`, { ...options, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) {
        const raw = await response.json().catch(() => null);
        const restricted = [400, 403, 422].includes(response.status) && /domain|recipient|sender|verif|own email/i.test(typeof raw?.message === "string" ? raw.message : "");
        return { data: null, error: { name: "application_error", statusCode: response.status, message: restricted ? "RESEND_SENDER_DOMAIN_RESTRICTION" : "EMAIL_PROVIDER_REJECTED" }, headers: null };
      }
      return { data: await response.json(), error: null, headers: null };
    } catch {
      return { data: null, error: { name: "application_error", statusCode: null, message: "EMAIL_DELIVERY_UNKNOWN" }, headers: null };
    }
  }
}

// Única fronteira com o provedor, importada somente pelo servidor.
// Sem SMTP pessoal, fallback ou provisionamento/billing automático.
export async function sendEmail(message: EmailMessage): Promise<{ providerMessageId: string }> {
  if (typeof window !== "undefined") throw new EmailProviderError("EMAIL_SERVER_ONLY");
  if (process.env.FORUM_SUBMISSION_MODE !== "test") throw new EmailProviderError("SUBMISSION_MODE_DISABLED");
  const configuredRecipient = CopyEmailSchema.safeParse(process.env.FORUM_TEST_RECIPIENT);
  if (!configuredRecipient.success || message.to !== configuredRecipient.data) {
    throw new EmailProviderError("TEST_RECIPIENT_INVALID");
  }
  const from = process.env.RESEND_FROM?.trim() || "";
  const fromAddress = from.match(/^[^<>\r\n]{1,80}<([^<>\r\n]+)>$/)?.[1] || from;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (process.env.EMAIL_PROVIDER !== "resend" || !apiKey || !CopyEmailSchema.safeParse(fromAddress.trim()).success || /[\r\n]/.test(from)) {
    throw new EmailProviderError("EMAIL_NOT_CONFIGURED");
  }
  if (!CopyEmailSchema.safeParse(message.cc).success || !message.subject.includes("TESTE") || message.attachments.length !== 1) {
    throw new EmailProviderError("EMAIL_MESSAGE_INVALID");
  }
  const attachment = message.attachments[0];
  if (attachment.contentType !== "application/pdf" || attachment.content.length < 5 || attachment.content.length > 8 * 1024 * 1024 || attachment.content.subarray(0, 5).toString() !== "%PDF-") {
    throw new EmailProviderError("PDF_INVALID");
  }
  const copyRecipientDeduplicated = message.cc.toLowerCase() === message.to.toLowerCase();
  let result;
  try {
    const resend = new ResendEmailProvider(apiKey);
    result = await resend.emails.send({
        from,
        to: [message.to],
        ...(copyRecipientDeduplicated ? {} : { cc: [message.cc] }),
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: [{ filename: attachment.filename, content: attachment.content, contentType: attachment.contentType }],
      }, { idempotencyKey: message.idempotencyKey });
  } catch {
    // Timeout/conexão perdida não provam que o provedor deixou de enviar.
    throw new EmailProviderError("EMAIL_DELIVERY_UNKNOWN", true);
  }
  if (result.error) {
    const status = result.error.statusCode;
    const uncertain = status == null || status >= 500 || status === 408 || status === 409;
    throw new EmailProviderError(result.error.message === "RESEND_SENDER_DOMAIN_RESTRICTION" ? "RESEND_SENDER_DOMAIN_RESTRICTION" : uncertain ? "EMAIL_DELIVERY_UNKNOWN" : "EMAIL_PROVIDER_REJECTED", uncertain);
  }
  const parsed = z.object({ id: z.string().min(1).max(256) }).safeParse(result.data);
  if (!parsed.success) throw new EmailProviderError("EMAIL_DELIVERY_UNKNOWN", true);
  return { providerMessageId: parsed.data.id };
}
