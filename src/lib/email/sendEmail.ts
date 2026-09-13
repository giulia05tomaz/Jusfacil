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
  thread?: EmailThread;
}

export const EmailThreadSchema = z.object({
  inReplyTo: z.string().max(512).regex(/^<[^<>\s]+@[^<>\s]+>$/),
  references: z.array(z.string().max(512).regex(/^<[^<>\s]+@[^<>\s]+>$/)).min(1).max(50),
}).strict().refine((thread) => thread.references.at(-1) === thread.inReplyTo && thread.references.join(" ").length <= 4096);
export type EmailThread = z.infer<typeof EmailThreadSchema>;

// O ID retornado pelo envio é um UUID do Resend, não o Message-ID RFC do e-mail.
// Consulta somente a mensagem vinculada pelo servidor ao histórico deste caso.
export async function getSentEmailMessageId(providerId: string, expectedSubject: string): Promise<string> {
  if (typeof window !== "undefined") throw new EmailProviderError("EMAIL_SERVER_ONLY");
  if (process.env.FORUM_SUBMISSION_MODE !== "test") throw new EmailProviderError("SUBMISSION_MODE_DISABLED");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "";
  const fromAddress = from.match(/^[^<>\r\n]{1,80}<([^<>\r\n]+)>$/)?.[1] || from;
  const recipient = CopyEmailSchema.safeParse(process.env.FORUM_TEST_RECIPIENT);
  if (process.env.EMAIL_PROVIDER !== "resend" || !apiKey || !recipient.success || !CopyEmailSchema.safeParse(fromAddress).success || /[\r\n]/.test(from)) throw new EmailProviderError("EMAIL_NOT_CONFIGURED");
  if (!z.uuid().safeParse(providerId).success) throw new EmailProviderError("EMAIL_THREAD_UNAVAILABLE");
  try {
    const result = await new ResendEmailProvider(apiKey).emails.get(providerId);
    const parsed = z.object({ id: z.uuid(), message_id: z.string().max(512), subject: z.string().max(254), from: z.string().max(254), to: z.array(z.string()).max(1) }).safeParse(result.data);
    if (result.error || !parsed.success) throw new Error("unavailable");
    const email = parsed.data;
    const sender = email.from.match(/<([^<>\r\n]+)>$/)?.[1] || email.from;
    if (email.id !== providerId || email.subject !== expectedSubject || sender.toLowerCase() !== fromAddress.toLowerCase() || email.to.length !== 1 || email.to[0].toLowerCase() !== recipient.data.toLowerCase() || !EmailThreadSchema.safeParse({ inReplyTo: email.message_id, references: [email.message_id] }).success) throw new Error("mismatch");
    return email.message_id;
  } catch {
    // Nunca transforma uma falha de consulta em um novo e-mail avulso.
    throw new EmailProviderError("EMAIL_THREAD_UNAVAILABLE");
  }
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
  if (!CopyEmailSchema.safeParse(message.cc).success || !message.subject.includes("TESTE") || /[\r\n]/.test(message.subject) || message.subject.length > 254 || message.attachments.length !== 1 || (message.thread && !EmailThreadSchema.safeParse(message.thread).success)) {
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
        ...(message.thread ? { headers: { "In-Reply-To": message.thread.inReplyTo, "References": message.thread.references.join(" ") } } : {}),
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
