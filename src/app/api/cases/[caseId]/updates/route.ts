import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { Evidence, LegalCase, UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const CaseUpdateRequestSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  documentEvidenceId: z.string().trim().min(1).max(200).optional(),
}).strict();

function respond(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return respond("AUTH_REQUIRED", "Faça login para continuar.", 401);
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return respond("AUTH_REQUIRED", "Sessão inválida ou expirada. Faça login novamente.", 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return respond("VALIDATION_ERROR", "O corpo da requisição deve ser JSON válido.", 400);
  }

  const parsed = CaseUpdateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return respond("VALIDATION_ERROR", "Revise a mensagem e o documento informado.", 400);
  }

  const { caseId } = await context.params;
  if (!caseId?.trim()) return respond("VALIDATION_ERROR", "Caso inválido.", 400);

  try {
    const adminDb = getAdminDb();
    const caseRef = adminDb.collection("cases").doc(caseId);
    const userRef = adminDb.collection("users").doc(uid);
    const [caseSnapshot, userSnapshot] = await Promise.all([caseRef.get(), userRef.get()]);

    if (!caseSnapshot.exists) return respond("CASE_NOT_FOUND", "O caso solicitado não foi encontrado.", 404);
    if (!userSnapshot.exists) return respond("FORBIDDEN", "Perfil profissional não encontrado.", 403);

    const legalCase = caseSnapshot.data() as LegalCase;
    const profile = userSnapshot.data() as UserProfile;
    if (profile.role !== "LAWYER" || profile.lawyerStatus !== "APPROVED") {
      return respond("FORBIDDEN", "Somente advogados aprovados podem enviar atualizações.", 403);
    }
    if (legalCase.assignedLawyerId !== uid) {
      return respond("FORBIDDEN", "Você não é o advogado responsável por este caso.", 403);
    }

    let evidence: Evidence | undefined;
    if (parsed.data.documentEvidenceId) {
      const evidenceSnapshot = await caseRef
        .collection("evidences")
        .doc(parsed.data.documentEvidenceId)
        .get();
      if (!evidenceSnapshot.exists) {
        return respond("VALIDATION_ERROR", "O documento anexado não foi encontrado neste caso.", 400);
      }
      evidence = evidenceSnapshot.data() as Evidence;
      if (evidence.caseId !== caseId) {
        return respond("FORBIDDEN", "O documento não pertence a este caso.", 403);
      }
    }

    const updateRef = caseRef.collection("updates").doc();
    const notificationRef = adminDb.collection("notifications").doc();
    const now = new Date();

    const updatePayload = {
      updateId: updateRef.id,
      caseId,
      createdBy: uid,
      createdByName: profile.fullName || "Advogado responsável",
      createdByRole: "LAWYER" as const,
      message: parsed.data.message,
      ...(evidence ? {
        documentEvidenceId: evidence.evidenceId,
        documentName: evidence.originalName,
        ...(evidence.fileUrl ? { documentUrl: evidence.fileUrl } : {}),
      } : {}),
      createdAt: now,
      visibleToCitizen: true,
    };

    const notificationPayload = {
      notificationId: notificationRef.id,
      userId: legalCase.citizenId,
      caseId,
      title: "Atualização no seu caso",
      message: parsed.data.message.slice(0, 180),
      type: "CASE_UPDATED" as const,
      read: false,
      createdAt: now,
    };

    const batch = adminDb.batch();
    batch.set(updateRef, updatePayload);
    batch.update(caseRef, { updatedAt: now });
    batch.set(notificationRef, notificationPayload);
    await batch.commit();

    return NextResponse.json({
      updateId: updateRef.id,
      notificationId: notificationRef.id,
      status: "CREATED",
    }, { status: 201 });
  } catch (error) {
    console.error("case_update_failed", error);
    return respond("FIREBASE_UNAVAILABLE", "Não foi possível registrar a atualização. Tente novamente.", 503);
  }
}
