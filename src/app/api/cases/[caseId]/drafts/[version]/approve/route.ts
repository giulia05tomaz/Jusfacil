import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { ArtifactError, readCompleteArtifact, type CompleteArtifact } from "@/lib/drafts/completeArtifact";
import { draftNeedsEvidenceRevision } from "@/lib/drafts/evidenceExport";
import type { DraftVersion, Evidence } from "@/types";

const VersionSchema = z.coerce.number().int().positive().max(10_000);
const allowedStatuses = new Set(["AGUARDANDO_REVISAO", "AJUSTANDO_MINUTA"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; version: string }> },
) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authorization.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { caseId, version: rawVersion } = await params;
  const parsedVersion = VersionSchema.safeParse(rawVersion);
  if (!parsedVersion.success || !/^JF-[A-Za-z0-9-]{4,76}$/.test(caseId)) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const version = parsedVersion.data;
  const db = getAdminDb();
  const caseRef = db.collection("cases").doc(caseId);
  const draftRef = caseRef.collection("drafts").doc(`v${version}`);
  const notificationRef = db.collection("notifications").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const [caseSnapshot, draftSnapshot, evidenceSnapshot, artifactSnapshot] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(draftRef),
        transaction.get(caseRef.collection("evidences")),
        transaction.get(caseRef.collection("draftArtifacts").doc(`v${version}`)),
      ]);
      if (!caseSnapshot.exists) throw new Error("CASE_NOT_FOUND");
      if (!draftSnapshot.exists) throw new Error("DRAFT_NOT_FOUND");

      const legalCase = caseSnapshot.data()!;
      if (legalCase.citizenId !== uid) throw new Error("FORBIDDEN");
      if (!allowedStatuses.has(legalCase.status)) throw new Error("INVALID_STATUS");
      const draft = draftSnapshot.data() as DraftVersion;
      if (draft.caseId !== caseId || draft.version !== version) throw new Error("FORBIDDEN");
      if (legalCase.currentDraftVersion !== version) throw new ArtifactError("DRAFT_ARTIFACT_STALE");
      const records = evidenceSnapshot.docs.map((doc) => ({ ...doc.data(), evidenceId: doc.id }) as Evidence);
      if (records.some((record) => record.caseId !== caseId)) throw new Error("FORBIDDEN");
      if (records.length) {
        if (records.some((record) => record.status !== "PROCESSED")) throw new ArtifactError("EVIDENCES_NOT_READY");
        if (draftNeedsEvidenceRevision(draft, records)) throw new ArtifactError("DRAFT_EVIDENCE_REVISION_REQUIRED");
        if (!artifactSnapshot.exists) throw new ArtifactError("DRAFT_ARTIFACT_REQUIRED");
        await readCompleteArtifact(artifactSnapshot.data() as CompleteArtifact, draft, records, "pdf");
      }

      transaction.update(draftRef, {
        approved: true,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: uid,
      });
      transaction.update(caseRef, {
        status: "MINUTA_APROVADA",
        currentDraftVersion: version,
        approvedVersion: version,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(notificationRef, {
        notificationId: notificationRef.id,
        userId: uid,
        caseId,
        type: "CASE_UPDATED",
        title: "Minuta aprovada",
        message: "A minuta foi aprovada e o caso avançou para a próxima etapa.",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ArtifactError) return NextResponse.json({ error: error.code, message: "Confira o documento completo da versão atual com todas as evidências antes de aprovar." }, { status: 409 });
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = message === "CASE_NOT_FOUND" || message === "DRAFT_NOT_FOUND"
      ? 404
      : message === "FORBIDDEN"
        ? 403
        : message === "INVALID_STATUS"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
