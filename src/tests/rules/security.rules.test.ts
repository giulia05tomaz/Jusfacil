import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { readFileSync } from "node:fs";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "jusfacil-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users/citizen-a"), { uid: "citizen-a", role: "CITIZEN", fullName: "A" }),
      setDoc(doc(db, "users/citizen-b"), { uid: "citizen-b", role: "CITIZEN", fullName: "B" }),
      setDoc(doc(db, "users/lawyer-pending"), { uid: "lawyer-pending", role: "LAWYER", lawyerStatus: "PENDING" }),
      setDoc(doc(db, "users/lawyer-a"), { uid: "lawyer-a", role: "LAWYER", lawyerStatus: "APPROVED" }),
      setDoc(doc(db, "users/lawyer-b"), { uid: "lawyer-b", role: "LAWYER", lawyerStatus: "APPROVED" }),
      setDoc(doc(db, "users/admin"), { uid: "admin", role: "ADMIN" }),
      setDoc(doc(db, "cases/JF-2026-AAAAAA"), { caseId: "JF-2026-AAAAAA", citizenId: "citizen-a", assignedLawyerId: "lawyer-a", status: "COLETANDO_EVIDENCIAS", requiresHumanReview: true }),
      setDoc(doc(db, "cases/JF-2026-AAAAAA/updates/update-1"), { updateId: "update-1", caseId: "JF-2026-AAAAAA", createdBy: "lawyer-a", createdByRole: "LAWYER", message: "Atualização de teste", visibleToCitizen: true }),
    ]);
  });
});

afterAll(async () => environment.cleanup());

describe("Firestore isolation", () => {
  it("allows own profile and denies another profile", async () => {
    const db = environment.authenticatedContext("citizen-a").firestore();
    await assertSucceeds(getDoc(doc(db, "users/citizen-a")));
    await assertFails(getDoc(doc(db, "users/citizen-b")));
  });

  it("prevents citizen role escalation and lawyer self-approval", async () => {
    const citizenDb = environment.authenticatedContext("citizen-a").firestore();
    const lawyerDb = environment.authenticatedContext("lawyer-pending").firestore();
    await assertFails(updateDoc(doc(citizenDb, "users/citizen-a"), { role: "ADMIN" }));
    await assertFails(updateDoc(doc(lawyerDb, "users/lawyer-pending"), { lawyerStatus: "APPROVED" }));
  });

  it("isolates cases and requires approved assignment", async () => {
    const path = "cases/JF-2026-AAAAAA";
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("citizen-a").firestore(), path)));
    await assertFails(getDoc(doc(environment.authenticatedContext("citizen-b").firestore(), path)));
    await assertFails(getDoc(doc(environment.authenticatedContext("lawyer-pending").firestore(), path)));
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("lawyer-a").firestore(), path)));
    await assertFails(getDoc(doc(environment.authenticatedContext("lawyer-b").firestore(), path)));
  });
});


describe("Case updates isolation", () => {
  const path = "cases/JF-2026-AAAAAA/updates/update-1";

  it("allows the case owner and assigned approved lawyer to read updates", async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("citizen-a").firestore(), path)));
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("lawyer-a").firestore(), path)));
  });

  it("denies unrelated citizens, pending lawyers and non-assigned lawyers", async () => {
    await assertFails(getDoc(doc(environment.authenticatedContext("citizen-b").firestore(), path)));
    await assertFails(getDoc(doc(environment.authenticatedContext("lawyer-pending").firestore(), path)));
    await assertFails(getDoc(doc(environment.authenticatedContext("lawyer-b").firestore(), path)));
  });

  it("denies client-side creation even for the assigned lawyer and case owner", async () => {
    const payload = {
      updateId: "client-update",
      caseId: "JF-2026-AAAAAA",
      createdBy: "lawyer-a",
      createdByRole: "LAWYER",
      message: "Tentativa pelo cliente",
      visibleToCitizen: true,
    };
    await assertFails(setDoc(doc(environment.authenticatedContext("lawyer-a").firestore(), "cases/JF-2026-AAAAAA/updates/client-lawyer"), payload));
    await assertFails(setDoc(doc(environment.authenticatedContext("citizen-a").firestore(), "cases/JF-2026-AAAAAA/updates/client-citizen"), { ...payload, createdBy: "citizen-a" }));
  });

  it("denies direct notification creation by a lawyer", async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext("lawyer-a").firestore(), "notifications/notif-lawyer"), {
      notificationId: "notif-lawyer",
      userId: "citizen-a",
      caseId: "JF-2026-AAAAAA",
      title: "Tentativa",
      message: "Não deve ser permitida",
      type: "CASE_UPDATED",
      read: false,
    }));
  });
});

describe("Storage isolation", () => {
  const path = "cases/JF-2026-AAAAAA/evidences/evidence-1/teste.txt";
  const data = new Blob(["conteúdo fictício"], { type: "text/plain" });
  const metadata = (uid: string) => ({ contentType: "text/plain", customMetadata: { uploadedBy: uid, evidenceId: "evidence-1" } });

  it("allows owner and assigned approved lawyer", async () => {
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext("citizen-a").storage(), path), data, metadata("citizen-a")));
    await assertSucceeds(uploadBytes(ref(environment.authenticatedContext("lawyer-a").storage(), path.replace("teste", "advogado")), data, metadata("lawyer-a")));
  });

  it("denies unauthenticated, pending and non-assigned users", async () => {
    await assertFails(uploadBytes(ref(environment.unauthenticatedContext().storage(), path), data, metadata("citizen-a")));
    await assertFails(uploadBytes(ref(environment.authenticatedContext("citizen-b").storage(), path), data, metadata("citizen-b")));
    await assertFails(uploadBytes(ref(environment.authenticatedContext("lawyer-pending").storage(), path), data, metadata("lawyer-pending")));
    await assertFails(uploadBytes(ref(environment.authenticatedContext("lawyer-b").storage(), path), data, metadata("lawyer-b")));
  });
});


describe("Profile avatar storage", () => {
  const validImage = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });

  it("allows a user to upload their own supported avatar", async () => {
    const storage = environment.authenticatedContext("citizen-a").storage();
    await assertSucceeds(uploadBytes(ref(storage, "profiles/citizen-a/avatar.png"), validImage, { contentType: "image/png" }));
  });

  it("denies uploading an avatar into another user's profile path", async () => {
    const storage = environment.authenticatedContext("citizen-a").storage();
    await assertFails(uploadBytes(ref(storage, "profiles/citizen-b/avatar.png"), validImage, { contentType: "image/png" }));
  });

  it("denies unsupported avatar content types", async () => {
    const storage = environment.authenticatedContext("lawyer-a").storage();
    const pdf = new Blob(["fake"], { type: "application/pdf" });
    await assertFails(uploadBytes(ref(storage, "profiles/lawyer-a/avatar.pdf"), pdf, { contentType: "application/pdf" }));
  });
});

it("loads the rules test environment", () => expect(environment).toBeDefined());
