import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

const ReviewRequestSchema = z.object({ reason: z.string().trim().min(5).max(2_000) });

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(header.slice(7))).uid; }
  catch { return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }); }
  const body = ReviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const { caseId } = await params;
  const db = getAdminDb();
  const caseRef = db.collection("cases").doc(caseId);
  const snapshot = await caseRef.get();
  if (!snapshot.exists) return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
  const legalCase = snapshot.data()!;
  if (legalCase.citizenId !== uid) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const notificationRef = db.collection("notifications").doc();
  const batch = db.batch();
  batch.update(caseRef, { requiresHumanReview: true, humanReviewReason: body.data.reason, status: "REVISAO_HUMANA", updatedAt: new Date() });
  batch.set(notificationRef, { notificationId: notificationRef.id, userId: uid, caseId, type: "HUMAN_REVIEW_REQUIRED", title: "Revisão humana solicitada", message: "Seu caso aguarda atribuição explícita a um profissional autorizado.", read: false, createdAt: new Date() });
  await batch.commit();
  return NextResponse.json({ ok: true });
}
