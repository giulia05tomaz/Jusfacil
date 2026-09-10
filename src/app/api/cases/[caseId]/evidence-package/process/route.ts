import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getAdminConfigurationStatus } from "@/lib/firebase/admin";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isAuthorizedForCase } from "@/lib/security/caseAuthorization";
import type { LegalCase, UserProfile } from "@/types";
import { extractEvidenceText } from "@/lib/evidence/extract";
import { extractPackageEntries, inspectEvidenceZip, type EvidencePackageManifest } from "@/lib/evidence/package";

export const runtime = "nodejs";

function response(error: string, message: string, status: number) { return NextResponse.json({ error, message }, { status }); }

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const caseId = (await params).caseId; const authHeader = request.headers.get("authorization"); const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401);
  let uid: string; try { uid = (await getAdminAuth().verifyIdToken(token)).uid; logger.info("zip_auth_debug", { authHeaderPresent: true, bearerPresent: true, adminInitialized: getAdminConfigurationStatus() === "configured", verifyIdTokenResult: "PASS", uidPresent: Boolean(uid), caseIdPresent: Boolean(caseId) }); } catch (error) { logger.warn("zip_auth_debug", { authHeaderPresent: true, bearerPresent: true, adminInitialized: getAdminConfigurationStatus() === "configured", verifyIdTokenResult: "FAIL", uidPresent: false, caseIdPresent: Boolean(caseId), errorType: error instanceof Error ? error.name : "unknown" }); const code = (error as { code?: string })?.code || ""; if ((error instanceof AppError && error.code === "FIREBASE_NOT_CONFIGURED") || code.startsWith("app/") || code === "ENOENT") return response("FIREBASE_NOT_CONFIGURED", "A autenticação do servidor não está configurada neste ambiente.", 503); return response("AUTH_REQUIRED", "Sua sessão não pôde ser validada. Entre novamente.", 401); }
  try {
    const form = await request.formData(); const file = form.get("file"); const manifestText = String(form.get("manifest") || "");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) return response("VALIDATION_ERROR", "Selecione um arquivo ZIP.", 400);
    const requested = JSON.parse(manifestText) as EvidencePackageManifest;
    const db = getAdminDb(); const [caseSnapshot, userSnapshot] = await Promise.all([db.collection("cases").doc(caseId).get(), db.collection("users").doc(uid).get()]);
    if (!caseSnapshot.exists) return response("CASE_NOT_FOUND", "Caso não encontrado.", 404);
    if (!userSnapshot.exists || !isAuthorizedForCase(uid, userSnapshot.data() as UserProfile, caseSnapshot.data() as LegalCase)) return response("FORBIDDEN", "Você não tem acesso a este caso.", 403);
    const buffer = Buffer.from(await file.arrayBuffer()); const actual = inspectEvidenceZip(buffer, file.name); const actualById = new Map(actual.items.map((item) => [item.id, item]));
    if (!requested.items?.length || requested.items.length !== actual.items.length || requested.items.some((item) => !actualById.has(item.id))) return response("MANIFEST_MISMATCH", "A prévia mudou. Leia o ZIP novamente antes de confirmar.", 409);
    const packageHash = createHash("sha256").update(buffer).digest("hex");
    const collection = caseSnapshot.ref.collection("evidences");
    const existingPackage = await collection.where("packageHash", "==", packageHash).limit(1).get();
    if (!existingPackage.empty) return response("PACKAGE_ALREADY_PROCESSED", "Este pacote já foi adicionado a este caso.", 409);
    const entries = extractPackageEntries(buffer); const results: Array<{ reference: string; status: string }> = [];
    for (const item of requested.items.sort((a, b) => a.order - b.order)) {
      const source = actualById.get(item.id)!; const canonical = source.variants.find((variant) => variant.canonical) || source.variants[0];
      const data = Object.entries(entries).find(([path]) => path.endsWith(`/${canonical.fileName}`) || path === canonical.fileName)?.[1];
      if (!data) { results.push({ reference: item.reference, status: "ERRO" }); continue; }
      const evidenceId = crypto.randomUUID();
      const evidenceRef = collection.doc(evidenceId);
      const baseRecord = { evidenceId, caseId, packageHash, originalName: canonical.fileName, alternateFileNames: source.variants.filter((variant) => variant.fileName !== canonical.fileName).map((variant) => variant.fileName), mimeType: canonical.type, size: canonical.size, sha256: canonical.sha256, order: item.order, reference: item.reference, title: item.title, originalTitle: source.originalTitle, source: "ZIP", status: "PROCESSING", processingStatus: "ANALISANDO", uploadedBy: uid, uploadedAt: new Date(), originalRetained: false };
      // Persist the logical evidence before extraction so a slow or failed analysis never hides the item from the case.
      await evidenceRef.set(baseRecord);
      try {
        const extension = canonical.fileName.slice(canonical.fileName.lastIndexOf(".")).toLowerCase(); const isImage = [".jpg", ".jpeg", ".png"].includes(extension);
        const extraction = isImage ? null : await extractEvidenceText(Buffer.from(data), canonical.type, canonical.fileName).catch(() => null);
        const completed = Boolean(extraction?.text) || isImage;
        await evidenceRef.update({ status: completed ? "PROCESSED" : "UNSUPPORTED", processingStatus: completed ? "CONCLUIDA" : "ERRO", extractedText: extraction?.text || null, extractionMethod: extraction?.method || (isImage ? "PENDING_VISION" : "UNSUPPORTED"), processedAt: new Date(), processingError: completed ? null : "Não foi possível extrair texto útil nesta sessão." });
        results.push({ reference: item.reference, status: completed ? "CONCLUIDA" : "ERRO" });
      } catch {
        await evidenceRef.update({ status: "FAILED", processingStatus: "ERRO", processingError: "Falha durante o processamento desta evidência.", processedAt: new Date() }).catch(() => undefined);
        results.push({ reference: item.reference, status: "ERRO" });
      }
    }
    return NextResponse.json({ evidenceCount: actual.items.length, completed: results.filter((item) => item.status === "CONCLUIDA").length, failed: results.filter((item) => item.status !== "CONCLUIDA").length, results, originalRetained: false });
  } catch (error) { return response("PACKAGE_PROCESSING_FAILED", error instanceof Error ? error.message : "Não foi possível processar o pacote.", 400); }
}
