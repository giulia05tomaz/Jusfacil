import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getAdminConfigurationStatus } from "@/lib/firebase/admin";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import type { LegalCase, UserProfile } from "@/types";
import { inspectEvidenceZip } from "@/lib/evidence/package";

export const runtime = "nodejs";

function zipDiagnostic(flags: Record<string, string | boolean | number>) {
  if (process.env.NODE_ENV === "development") {
    // Stringify here because the dev log transport loses properties of server-side objects.
    logger.info(`ZIP_AUTH_REAL ${JSON.stringify({ routeVersion: "zip-auth-v3", ...flags })}`);
  }
}

function response(error: string, message: string, status: number) {
  zipDiagnostic({ httpStatus: status });
  return NextResponse.json({ error, message }, { status });
}
function authCategory(error: unknown): string {
  const code = String((error as { code?: string })?.code || "").toLowerCase();
  // Only the category is logged, never the SDK message (which may contain paths).
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (code.includes("expired")) return "TOKEN_EXPIRED";
  if (code.includes("project") || code.includes("audience") || /incorrect.*(aud|iss)|audience.*(mismatch|incorrect)|issuer.*(mismatch|incorrect)/.test(message)) return "PROJECT_MISMATCH";
  if (error instanceof AppError && error.code === "FIREBASE_NOT_CONFIGURED") return "ADMIN_NOT_CONFIGURED";
  if (code.startsWith("app/") || code === "enoent" || code === "auth/invalid-credential") return "ADMIN_CREDENTIAL_ERROR";
  if (["auth/argument-error", "auth/invalid-id-token", "auth/id-token-revoked"].includes(code)) return "TOKEN_INVALID";
  return "UNKNOWN";
}

function authCode(error: unknown): string {
  const code = String((error as { code?: string })?.code || "unknown").toLowerCase();
  return /^[a-z0-9/_-]{1,80}$/.test(code) ? code : "unknown";
}

function authFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid signature") || message.includes("signature verification failed") || message.includes("invalid token signature")) return "INVALID_SIGNATURE";
  if (message.includes("does not correspond to a known public key")) return "UNKNOWN_KEY_ID";
  if (/fetch|certificate|public key|error while making request|enotfound|getaddrinfo|econn/.test(message)) return "PUBLIC_KEY_FETCH_FAILED";
  if (message.includes('no "sub"')) return "SUBJECT_MISSING";
  if (message.includes('empty "sub"')) return "SUBJECT_EMPTY";
  if (message.includes('incorrect "aud"')) return "AUDIENCE_MISMATCH";
  if (message.includes('incorrect "iss"')) return "ISSUER_MISMATCH";
  if (message.includes("decoding firebase id token failed")) return "DECODE_FAILED";
  return "OTHER";
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const caseId = (await params).caseId;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  zipDiagnostic({
    authHeaderPresent: Boolean(authHeader), bearerPrefixValid: Boolean(token),
    googleApplicationCredentialsPresent: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    credentialFileExists: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
    adminProjectConfigured: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    configurationDeclared: getAdminConfigurationStatus() === "configured",
  });
  if (!token) return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401);
  if (token.split(".").length !== 3) return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401);
  let uid: string;
  let adminInitialized = false;
  try {
    const adminAuth = getAdminAuth();
    adminInitialized = true;
    const adminProject = adminAuth.app.options.projectId;
    const clientProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    zipDiagnostic({ adminInitialized, clientProjectMatchesExpected: clientProject === "jusfacil-b979b", adminProjectMatchesExpected: adminProject === "jusfacil-b979b", clientAdminProjectsMatch: Boolean(adminProject && adminProject === clientProject) });
    try {
      // Diagnostic comparisons only; these unverified claims never grant access.
      const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as { alg?: unknown; kid?: unknown };
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { aud?: unknown; iss?: unknown; iat?: unknown; exp?: unknown; sub?: unknown; auth_time?: unknown };
      const now = Math.floor(Date.now() / 1000);
      zipDiagnostic({
        tokenAlgorithmRs256: header.alg === "RS256",
        tokenKeyIdPresent: typeof header.kid === "string" && header.kid.length > 0,
        tokenAudienceCompatible: claims.aud === adminProject,
        tokenIssuerCompatible: claims.iss === `https://securetoken.google.com/${adminProject}`,
        tokenSubjectValid: typeof claims.sub === "string" && claims.sub.length > 0 && claims.sub.length <= 128,
        tokenAuthTimeValid: typeof claims.auth_time === "number" && claims.auth_time <= now + 300,
        tokenIssuedAtValid: typeof claims.iat === "number" && claims.iat <= now + 300,
        tokenExpirationValid: typeof claims.exp === "number" && claims.exp > now,
      });
    } catch {
      zipDiagnostic({ tokenAudienceCompatible: false, tokenIssuerCompatible: false });
    }
    uid = (await adminAuth.verifyIdToken(token)).uid;
    zipDiagnostic({ verifyIdToken: "PASS", uidPresent: Boolean(uid), caseIdPresent: Boolean(caseId) });
  }
  catch (error) {
    zipDiagnostic({ adminInitialized, verifyIdToken: "FAIL", errorCategory: authCategory(error), failureReason: authFailureReason(error), upstreamCode: authCode(error), runtimeTypeError: error instanceof TypeError, uidPresent: false, caseIdPresent: Boolean(caseId) });
    const code = (error as { code?: string })?.code || "";
    if ((error instanceof AppError && error.code === "FIREBASE_NOT_CONFIGURED") || code.startsWith("app/") || code === "ENOENT") return response("FIREBASE_NOT_CONFIGURED", "A autenticação do servidor não está configurada neste ambiente.", 503);
    return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401);
  }
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) return response("VALIDATION_ERROR", "Selecione um arquivo ZIP.", 400);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(caseId)) return response("VALIDATION_ERROR", "Identificador de caso inválido.", 400);
    const db = getAdminDb(); const [caseSnapshot, userSnapshot] = await Promise.all([db.collection("cases").doc(caseId).get(), db.collection("users").doc(uid).get()]);
    if (!caseSnapshot.exists) return response("CASE_NOT_FOUND", "Caso não encontrado.", 404);
    if (!userSnapshot.exists || !isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, caseSnapshot.data() as LegalCase)) { zipDiagnostic({ caseOwnership: "FAIL" }); return response("FORBIDDEN", "Você não possui acesso a este caso.", 403); }
    zipDiagnostic({ caseOwnership: "PASS" });
    const buffer = Buffer.from(await file.arrayBuffer());
    const manifest = inspectEvidenceZip(buffer, file.name);
    zipDiagnostic({ httpStatus: 200, manifestCount: manifest.evidenceCount });
    return NextResponse.json({ manifest, requiresConfirmation: true, originalRetained: false });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ZIP_INVALID";
    const messages: Record<string, string> = { ZIP_TOO_LARGE: "O ZIP deve ter no máximo 50 MB.", ZIP_PATH_TRAVERSAL: "O pacote contém caminhos inseguros.", ZIP_NESTED_ARCHIVE: "ZIPs e arquivos compactados dentro do pacote não são aceitos.", ZIP_TOO_MANY_ENTRIES: "O pacote contém entradas demais.", ZIP_ENTRY_TOO_LARGE: "Um arquivo interno excede 10 MB.", ZIP_UNCOMPRESSED_TOO_LARGE: "O tamanho descompactado excede o limite permitido.", ZIP_COMPRESSION_RATIO: "O pacote foi bloqueado por proporção de compressão anormal." };
    return response(code, messages[code] || "Não foi possível ler o pacote ZIP com segurança.", 400);
  }
}
