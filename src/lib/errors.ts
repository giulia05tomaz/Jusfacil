export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "CASE_NOT_FOUND"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE"
  | "UPLOAD_FAILED"
  | "EVIDENCE_UNSUPPORTED"
  | "FIREBASE_UNAVAILABLE"
  | "FIREBASE_NOT_CONFIGURED"
  | "VALIDATION_ERROR";

const FRIENDLY_MESSAGES: Record<AppErrorCode, string> = {
  AUTH_REQUIRED: "Faça login para continuar.",
  FORBIDDEN: "Você não tem autorização para realizar esta ação.",
  CASE_NOT_FOUND: "O caso solicitado não foi encontrado.",
  AI_UNAVAILABLE: "O JurisBot está temporariamente indisponível. Tente novamente.",
  AI_INVALID_RESPONSE: "Não foi possível validar a resposta do JurisBot.",
  UPLOAD_FAILED: "Não foi possível enviar o arquivo. Tente novamente.",
  EVIDENCE_UNSUPPORTED: "Este arquivo não pode ser analisado automaticamente.",
  FIREBASE_UNAVAILABLE: "Não foi possível acessar seus dados. Tente novamente.",
  FIREBASE_NOT_CONFIGURED: "O Firebase não está configurado neste ambiente.",
  VALIDATION_ERROR: "Revise os dados informados e tente novamente.",
};

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message = FRIENDLY_MESSAGES[code],
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown, fallback: AppErrorCode): AppError {
  if (error instanceof AppError) return error;
  return new AppError(fallback, FRIENDLY_MESSAGES[fallback], error);
}

export function getFriendlyError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Ocorreu um erro inesperado. Tente novamente.";
}
