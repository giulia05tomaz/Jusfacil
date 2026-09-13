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
import { retainOriginal } from "@/lib/evidence/originals";

export const runtime = "nodejs";

function response(error: string, message: string, status: number) { return NextResponse.json({ error, message }, { status }); }

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const caseId = (await params).caseId; const authHeader = request.headers.get("authorization"); const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(caseId)) return response("VALIDATION_ERROR", "Caso inválido.", 400);
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
    if (!requested.items?.length || requested.items.length !== actual.items.length || new Set(requested.items.map((item) => item.id)).size !== actual.items.length
      || new Set(requested.items.map((item) => item.order)).size !== actual.items.length
      || new Set(requested.items.map((item) => item.reference)).size !== actual.items.length
      || requested.items.some((item) => !actualById.has(item.id) || !Number.isInteger(item.order) || item.order < 1 || item.order > 9999
        || typeof item.reference !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(item.reference)
        || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500 || /[\u0000-\u001f\u007f]/.test(item.title))) return response("MANIFEST_MISMATCH", "A prévia mudou. Leia o ZIP novamente antes de confirmar.", 409);
    const packageHash = createHash("sha256").update(buffer).digest("hex");
    const collection = caseSnapshot.ref.collection("evidences");
    let existingPackage: Pick<FirebaseFirestore.QuerySnapshot, "docs" | "size" | "empty"> = await collection.where("packageHash", "==", packageHash).get();
    const allRecords = await collection.get();
    if (existingPackage.empty) {
      // Repackaging an identical set changes ZIP hash, not the originals. Recover
      // only a complete, unambiguous match of persisted ZIP evidence bytes/labels.
      const matches = requested.items.map((item) => {
        const source = actualById.get(item.id)!;
        return allRecords.docs.filter((doc) => doc.data().caseId === caseId && doc.data().source === "ZIP"
          && doc.data().reference === item.reference && Number(doc.data().order) === item.order
          && source.variants.some((variant) => variant.sha256 === doc.data().sha256));
      });
      if (matches.every((items) => items.length === 1) && new Set(matches.map((items) => items[0].id)).size === requested.items.length) {
        existingPackage = { docs: matches.map((items) => items[0]), size: matches.length, empty: false };
      }
    }
    const entries = extractPackageEntries(buffer); const results: Array<{ reference: string; status: string }> = [];
    const bytesFor = (fileName: string, sha256: string) => {
      const matches = Object.entries(entries).filter(([entryPath, bytes]) => (entryPath.endsWith(`/${fileName}`) || entryPath === fileName)
        && createHash("sha256").update(bytes).digest("hex") === sha256);
      if (matches.length !== 1) throw new Error("ZIP_ENTRY_MISMATCH");
      return Buffer.from(matches[0][1]);
    };
    // Validate every source before restoring or writing any Firestore item.
    for (const source of actual.items) for (const variant of source.variants) bytesFor(variant.fileName, variant.sha256);
    if (!existingPackage.empty && existingPackage.size !== actual.items.length) return response("PACKAGE_INCOMPLETE", "O pacote anterior está incompleto. Não foram duplicadas evidências.", 409);
    if (!existingPackage.empty && requested.items.some((item) => {
      const source = actualById.get(item.id)!;
      return !existingPackage.docs.some((doc) => doc.data().caseId === caseId && doc.data().reference === item.reference
        && Number(doc.data().order) === item.order && source.variants.some((variant) => variant.sha256 === doc.data().sha256));
    })) return response("ZIP_CASE_MISMATCH", "A ordem e as referências devem corresponder ao pacote já adicionado ao caso.", 409);
    if (existingPackage.empty && (allRecords.size + actual.items.length > 150
      || allRecords.docs.reduce((total, doc) => total + Number(doc.data().size || 0), 0) + actual.items.reduce((total, item) => total + (item.variants.find((variant) => variant.canonical) || item.variants[0]).size, 0) > 200 * 1024 * 1024)) return response("EVIDENCE_LIMIT", "Limite de 150 evidências e 200 MB por caso atingido.", 400);
    if (existingPackage.empty && requested.items.some((item) => allRecords.docs.some((doc) => doc.data().reference === item.reference || Number(doc.data().order) === item.order))) return response("EVIDENCE_ORDER_CONFLICT", "A ordem/referência já existe no caso. Ajuste a prévia do pacote para continuar a numeração.", 409);
    for (const item of requested.items.sort((a, b) => a.order - b.order)) {
      const source = actualById.get(item.id)!;
      const previous = existingPackage.docs.find((doc) => doc.data().reference === item.reference && Number(doc.data().order) === item.order && source.variants.some((variant) => variant.sha256 === doc.data().sha256));
      const canonical = source.variants.find((variant) => variant.sha256 === previous?.data().sha256) || source.variants.find((variant) => variant.canonical) || source.variants[0];
      const data = bytesFor(canonical.fileName, canonical.sha256);
      if (!existingPackage.empty && !previous) throw new Error("ZIP_CASE_MISMATCH");
      const evidenceId = previous?.id || createHash("sha256").update(`${caseId}:${packageHash}:${item.id}`).digest("hex");
      const evidenceRef = collection.doc(evidenceId);
      const original = await retainOriginal(caseId, evidenceId, data, canonical.type, canonical.fileName);
      const visual = source.variants.find((variant) => ["image/png", "image/jpeg"].includes(variant.type)) || canonical;
      const annexOriginal = visual === canonical ? original : await retainOriginal(caseId, evidenceId, bytesFor(visual.fileName, visual.sha256), visual.type, visual.fileName);
      if (previous) {
        // Recover legacy files without duplicating records, changing their chronology or invoking AI.
        await evidenceRef.update({ original, annexOriginal, originalRetained: true });
        results.push({ reference: item.reference, status: previous.data().status === "PROCESSED" ? "CONCLUIDA" : "ERRO" });
        continue;
      }
      const baseRecord = { evidenceId, caseId, packageHash, originalName: canonical.fileName, alternateFileNames: source.variants.filter((variant) => variant.fileName !== canonical.fileName).map((variant) => variant.fileName), mimeType: canonical.type, size: canonical.size, sha256: canonical.sha256, order: item.order, reference: item.reference, title: item.title, originalTitle: source.originalTitle, source: "ZIP", status: "PROCESSING", processingStatus: "ANALISANDO", uploadedBy: uid, uploadedAt: new Date(), original, annexOriginal, originalRetained: true };
      // Persist the logical evidence before extraction so a slow or failed analysis never hides the item from the case.
      const reserved = await db.runTransaction(async (transaction) => {
        const [current, all] = await Promise.all([transaction.get(evidenceRef), transaction.get(collection)]);
        if (current.exists) return false;
        if (all.size >= 150 || all.docs.reduce((total, doc) => total + Number(doc.data().size || 0), 0) + canonical.size > 200 * 1024 * 1024) throw new Error("EVIDENCE_LIMIT");
        if (all.docs.some((doc) => doc.data().reference === item.reference || Number(doc.data().order) === item.order)) throw new Error("EVIDENCE_ORDER_CONFLICT");
        transaction.set(evidenceRef, baseRecord);
        return true;
      });
      if (!reserved) { results.push({ reference: item.reference, status: (await evidenceRef.get()).data()?.status === "PROCESSED" ? "CONCLUIDA" : "AGUARDANDO" }); continue; }
      try {
        const extension = canonical.fileName.slice(canonical.fileName.lastIndexOf(".")).toLowerCase(); const isImage = [".jpg", ".jpeg", ".png"].includes(extension);
        const extraction = isImage ? null : await extractEvidenceText(Buffer.from(data), canonical.type, canonical.fileName).catch(() => null);
        const completed = Boolean(extraction?.text) || isImage || canonical.type === "application/pdf";
        await evidenceRef.update({ status: completed ? "PROCESSED" : "UNSUPPORTED", processingStatus: completed ? "CONCLUIDA" : "ERRO", extractedText: extraction?.text || null, extractionMethod: extraction?.method || (isImage ? "PENDING_VISION" : canonical.type === "application/pdf" ? "SCANNED_PDF_NO_OCR" : "UNSUPPORTED"), processedAt: new Date(), processingError: completed ? null : "Não foi possível extrair texto útil nesta sessão." });
        results.push({ reference: item.reference, status: completed ? "CONCLUIDA" : "ERRO" });
      } catch {
        await evidenceRef.update({ status: "FAILED", processingStatus: "ERRO", processingError: "Falha durante o processamento desta evidência.", processedAt: new Date() }).catch(() => undefined);
        results.push({ reference: item.reference, status: "ERRO" });
      }
    }
    return NextResponse.json({ evidenceCount: actual.items.length, completed: results.filter((item) => item.status === "CONCLUIDA").length, failed: results.filter((item) => item.status === "ERRO").length, pending: results.filter((item) => item.status === "AGUARDANDO").length, results, originalRetained: true, recovered: !existingPackage.empty });
  } catch (error) { return response("PACKAGE_PROCESSING_FAILED", error instanceof Error ? error.message : "Não foi possível processar o pacote.", 400); }
}
