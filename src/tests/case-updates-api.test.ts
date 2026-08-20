import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
const getCase = vi.fn();
const getUser = vi.fn();
const getEvidence = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();

const updateRef = { id: "update-1" };
const notificationRef = { id: "notification-1" };

const caseRef = {
  get: getCase,
  collection: (name: string) => ({
    doc: (id?: string) => {
      if (name === "evidences") return { get: () => getEvidence(id) };
      if (name === "updates") return { ...updateRef, id: id || updateRef.id };
      throw new Error(`unexpected case subcollection ${name}`);
    },
  }),
};

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        if (name === "cases") return caseRef;
        if (name === "users") return { get: () => getUser(id) };
        if (name === "notifications") return { ...notificationRef, id: id || notificationRef.id };
        throw new Error(`unexpected collection ${name}`);
      },
    }),
    batch: () => ({ set: batchSet, update: batchUpdate, commit: batchCommit }),
  }),
}));

function snapshot(data: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

function makeRequest(token?: string, body: unknown = { message: "Atualização válida." }) {
  return new Request("http://localhost/api/cases/JF-2026-AAAAAA/updates", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ caseId: "JF-2026-AAAAAA" }) };

describe("POST /api/cases/[caseId]/updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === "invalid") throw new Error("invalid");
      return { uid: token };
    });
    getCase.mockResolvedValue(snapshot({
      caseId: "JF-2026-AAAAAA",
      citizenId: "citizen-a",
      assignedLawyerId: "lawyer-a",
    }));
    getUser.mockResolvedValue(snapshot({
      uid: "lawyer-a",
      role: "LAWYER",
      lawyerStatus: "APPROVED",
      fullName: "Advogada Teste",
    }));
    getEvidence.mockResolvedValue(snapshot({
      evidenceId: "evidence-1",
      caseId: "JF-2026-AAAAAA",
      originalName: "arquivo.pdf",
      fileUrl: "https://example.test/arquivo.pdf",
    }));
    batchCommit.mockResolvedValue(undefined);
  });

  it("retorna 401 sem token", async () => {
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    expect((await POST(makeRequest(), context)).status).toBe(401);
  });

  it("retorna 401 para token inválido", async () => {
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    expect((await POST(makeRequest("invalid"), context)).status).toBe(401);
  });

  it("retorna 400 para payload inválido", async () => {
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    expect((await POST(makeRequest("lawyer-a", { message: "   " }), context)).status).toBe(400);
  });

  it("retorna 404 para caso inexistente", async () => {
    getCase.mockResolvedValue(snapshot({}, false));
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    expect((await POST(makeRequest("lawyer-a"), context)).status).toBe(404);
  });

  it("nega cidadão e advogado pendente", async () => {
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    getUser.mockResolvedValueOnce(snapshot({ uid: "citizen-a", role: "CITIZEN" }));
    expect((await POST(makeRequest("citizen-a"), context)).status).toBe(403);

    getUser.mockResolvedValueOnce(snapshot({ uid: "lawyer-a", role: "LAWYER", lawyerStatus: "PENDING" }));
    expect((await POST(makeRequest("lawyer-a"), context)).status).toBe(403);
  });

  it("nega advogado aprovado que não está atribuído", async () => {
    getCase.mockResolvedValue(snapshot({
      caseId: "JF-2026-AAAAAA",
      citizenId: "citizen-a",
      assignedLawyerId: "lawyer-b",
    }));
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    expect((await POST(makeRequest("lawyer-a"), context)).status).toBe(403);
  });

  it("rejeita evidência que não pertence ao caso", async () => {
    getEvidence.mockResolvedValue(snapshot({
      evidenceId: "evidence-1",
      caseId: "JF-OTHER",
      originalName: "arquivo.pdf",
    }));
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    const response = await POST(makeRequest("lawyer-a", { message: "Atualização", documentEvidenceId: "evidence-1" }), context);
    expect(response.status).toBe(403);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("cria update, atualiza o caso e cria notification em um único batch", async () => {
    const { POST } = await import("@/app/api/cases/[caseId]/updates/route");
    const response = await POST(makeRequest("lawyer-a", { message: "Nova movimentação do caso.", documentEvidenceId: "evidence-1" }), context);
    expect(response.status).toBe(201);
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchCommit).toHaveBeenCalledTimes(1);

    const updatePayload = batchSet.mock.calls[0][1];
    expect(updatePayload).toMatchObject({
      caseId: "JF-2026-AAAAAA",
      createdBy: "lawyer-a",
      createdByRole: "LAWYER",
      message: "Nova movimentação do caso.",
      documentEvidenceId: "evidence-1",
      documentName: "arquivo.pdf",
      documentUrl: "https://example.test/arquivo.pdf",
      visibleToCitizen: true,
    });

    const notificationPayload = batchSet.mock.calls[1][1];
    expect(notificationPayload).toMatchObject({
      userId: "citizen-a",
      caseId: "JF-2026-AAAAAA",
      type: "CASE_UPDATED",
      read: false,
    });
  });
});
