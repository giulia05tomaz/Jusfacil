import {
  FieldValue,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";
import { AppError, toAppError } from "@/lib/errors";
import { assertCaseStatusTransition } from "@/lib/cases/statusMachine";
import type {
  CaseMessage,
  CaseStatus,
  DraftVersion,
  Evidence,
  LegalCase,
  LawyerStatus,
  NotificationItem,
  SupportTicket,
  UserProfile,
} from "@/types";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES: Record<string, readonly string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

function assertConfigured() {
  if (!isFirebaseConfigured) throw new AppError("FIREBASE_NOT_CONFIGURED");
}

export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (value && typeof value === "object" && !(value instanceof Timestamp) && !(value instanceof FieldValue)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)])) as T;
  }
  return value;
}

function normalizeDates<T>(value: T): T {
  if (value instanceof Timestamp) return value.toDate().toISOString() as T;
  if (Array.isArray(value)) return value.map(normalizeDates) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, normalizeDates(item)])) as T;
  }
  return value;
}

function fromSnapshot<T>(snapshot: { data: () => DocumentData }): T {
  return normalizeDates(snapshot.data()) as T;
}

function mapSnapshot<T>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((item) => fromSnapshot<T>(item));
}

export function validateEvidenceFile(file: Pick<File, "name" | "size" | "type">): void {
  if (!file.size) throw new AppError("VALIDATION_ERROR", "O arquivo está vazio.");
  if (file.size > MAX_EVIDENCE_BYTES) throw new AppError("VALIDATION_ERROR", "O arquivo deve ter no máximo 8 MB.");
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const allowedMimes = ALLOWED_EVIDENCE_TYPES[extension];
  if (!allowedMimes || !allowedMimes.includes(file.type.toLowerCase())) {
    throw new AppError("EVIDENCE_UNSUPPORTED", "Formato, extensão ou tipo MIME não permitido.");
  }
}

export function sanitizeFileName(name: string): string {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-120);
  return safe || "anexo";
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  assertConfigured();
  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? fromSnapshot<UserProfile>(snapshot) : null;
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  assertConfigured();
  if (profile.role === "ADMIN" || (profile.role === "LAWYER" && profile.lawyerStatus !== "PENDING")) {
    throw new AppError("FORBIDDEN", "Perfil administrativo ou advogado aprovado não pode ser criado pelo cliente.");
  }
  const payload = withoutUndefined({
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await setDoc(doc(db, "users", profile.uid), payload);
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  assertConfigured();
  const allowed = ["fullName", "phone", "cpf", "username", "avatarUrl"] as const;
  const safeUpdates = Object.fromEntries(allowed.filter((key) => updates[key] !== undefined).map((key) => [key, updates[key]]));
  try {
    await updateDoc(doc(db, "users", uid), withoutUndefined({ ...safeUpdates, updatedAt: serverTimestamp() }));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function getUserCases(userId: string, role: string): Promise<LegalCase[]> {
  assertConfigured();
  if (!userId) throw new AppError("AUTH_REQUIRED");
  try {
    const field = role === "LAWYER" ? "assignedLawyerId" : "citizenId";
    return mapSnapshot<LegalCase>(await getDocs(query(collection(db, "cases"), where(field, "==", userId), orderBy("updatedAt", "desc"))));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function getCaseById(caseId: string): Promise<LegalCase | null> {
  assertConfigured();
  try {
    const snapshot = await getDoc(doc(db, "cases", caseId));
    return snapshot.exists() ? fromSnapshot<LegalCase>(snapshot) : null;
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function createLegalCase(caseData: LegalCase): Promise<string> {
  assertConfigured();
  if (!caseData.caseId.startsWith("JF-")) throw new AppError("VALIDATION_ERROR", "Use um protocolo interno JusFácil válido.");
  try {
    await setDoc(doc(db, "cases", caseData.caseId), withoutUndefined({ ...caseData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return caseData.caseId;
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function updateCaseStatus(caseId: string, status: CaseStatus, extraUpdates: Partial<LegalCase> = {}): Promise<void> {
  assertConfigured();
  try {
    const caseRef = doc(db, "cases", caseId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(caseRef);
      if (!snapshot.exists()) throw new AppError("CASE_NOT_FOUND");
      const current = fromSnapshot<LegalCase>(snapshot);
      assertCaseStatusTransition(current.status, status);
      transaction.update(caseRef, withoutUndefined({ ...extraUpdates, status, updatedAt: serverTimestamp() }));
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function getCaseMessages(caseId: string): Promise<CaseMessage[]> {
  assertConfigured();
  try {
    return mapSnapshot<CaseMessage>(await getDocs(query(collection(db, "cases", caseId, "messages"), orderBy("timestamp", "asc"), limit(100))))
      .filter((message) => Boolean(message.content?.trim()));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function addCaseMessage(message: CaseMessage): Promise<void> {
  assertConfigured();
  try {
    await setDoc(doc(db, "cases", message.caseId, "messages", message.messageId), withoutUndefined({ ...message, timestamp: serverTimestamp() }));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function getCaseDrafts(caseId: string): Promise<DraftVersion[]> {
  assertConfigured();
  try {
    return mapSnapshot<DraftVersion>(await getDocs(query(collection(db, "cases", caseId, "drafts"), orderBy("version", "desc"), limit(50))));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function saveDraftVersion(draft: DraftVersion): Promise<void> {
  assertConfigured();
  try {
    await setDoc(doc(db, "cases", draft.caseId, "drafts", `v${draft.version}`), withoutUndefined({ ...draft, approved: false, createdAt: serverTimestamp() }));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function getCaseEvidences(caseId: string): Promise<Evidence[]> {
  assertConfigured();
  try {
    return mapSnapshot<Evidence>(await getDocs(query(collection(db, "cases", caseId, "evidences"), orderBy("uploadedAt", "desc"))));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function addEvidence(evidence: Evidence): Promise<void> {
  assertConfigured();
  try {
    await setDoc(doc(db, "cases", evidence.caseId, "evidences", evidence.evidenceId), withoutUndefined({ ...evidence, uploadedAt: serverTimestamp() }));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function removeEvidence(evidence: Evidence): Promise<void> {
  assertConfigured();
  try {
    await deleteDoc(doc(db, "cases", evidence.caseId, "evidences", evidence.evidenceId));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export function subscribeToNotifications(userId: string, onData: (items: NotificationItem[]) => void, onError?: (error: AppError) => void) {
  assertConfigured();
  const notificationsQuery = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(notificationsQuery, (snapshot) => onData(mapSnapshot<NotificationItem>(snapshot)), (error) => onError?.(toAppError(error, "FIREBASE_UNAVAILABLE")));
}

export async function getUserNotifications(userId: string): Promise<NotificationItem[]> {
  assertConfigured();
  try {
    return mapSnapshot<NotificationItem>(await getDocs(query(collection(db, "notifications"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100))));
  } catch (error) {
    throw toAppError(error, "FIREBASE_UNAVAILABLE");
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  assertConfigured();
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsAsRead(items: NotificationItem[]): Promise<void> {
  assertConfigured();
  const batch = writeBatch(db);
  items.filter((item) => !item.read).forEach((item) => batch.update(doc(db, "notifications", item.notificationId), { read: true }));
  await batch.commit();
}

export async function createSupportTicket(ticket: Omit<SupportTicket, "ticketId" | "status" | "createdAt" | "updatedAt">): Promise<string> {
  assertConfigured();
  const ticketId = crypto.randomUUID();
  await setDoc(doc(db, "supportTickets", ticketId), withoutUndefined({
    ...ticket,
    ticketId,
    status: "OPEN",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return ticketId;
}

export async function getPendingLawyers(): Promise<UserProfile[]> {
  assertConfigured();
  return mapSnapshot<UserProfile>(await getDocs(query(collection(db, "users"), where("role", "==", "LAWYER"), where("lawyerStatus", "==", "PENDING"))));
}

export async function getApprovedLawyers(): Promise<UserProfile[]> {
  assertConfigured();
  return mapSnapshot<UserProfile>(await getDocs(query(collection(db, "users"), where("role", "==", "LAWYER"), where("lawyerStatus", "==", "APPROVED"))));
}

export async function getSupportTicketsForAdmin(): Promise<SupportTicket[]> {
  assertConfigured();
  return mapSnapshot<SupportTicket>(await getDocs(query(collection(db, "supportTickets"), orderBy("createdAt", "desc"), limit(100))));
}

export async function getAdminStats(): Promise<{ users: number; cases: number; pendingLawyers: number; reviewCases: number }> {
  assertConfigured();
  const [users, cases, pendingLawyers, reviewCases] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "cases")),
    getDocs(query(collection(db, "users"), where("role", "==", "LAWYER"), where("lawyerStatus", "==", "PENDING"))),
    getDocs(query(collection(db, "cases"), where("requiresHumanReview", "==", true))),
  ]);
  return { users: users.size, cases: cases.size, pendingLawyers: pendingLawyers.size, reviewCases: reviewCases.size };
}

export async function getCasesAwaitingAssignment(): Promise<LegalCase[]> {
  assertConfigured();
  return mapSnapshot<LegalCase>(await getDocs(query(collection(db, "cases"), where("requiresHumanReview", "==", true))));
}

export async function reviewLawyer(uid: string, status: Exclude<LawyerStatus, "PENDING">, adminUid: string, reason?: string): Promise<void> {
  assertConfigured();
  await updateDoc(doc(db, "users", uid), withoutUndefined({ lawyerStatus: status, lawyerReviewedBy: adminUid, lawyerReviewedAt: serverTimestamp(), lawyerReviewReason: reason?.trim(), updatedAt: serverTimestamp() }));
}

export async function assignLawyer(caseId: string, lawyer: UserProfile): Promise<void> {
  assertConfigured();
  if (lawyer.role !== "LAWYER" || lawyer.lawyerStatus !== "APPROVED") throw new AppError("VALIDATION_ERROR", "Selecione um advogado aprovado.");
  await updateDoc(doc(db, "cases", caseId), { assignedLawyerId: lawyer.uid, assignedLawyerName: lawyer.fullName, status: "ENCAMINHADO_ADVOGADO", updatedAt: serverTimestamp() });
}
