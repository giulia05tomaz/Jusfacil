import type {
  CaseMessage,
  CaseStatus,
  CaseUpdate,
  DraftVersion,
  Evidence,
  LegalCase,
  NotificationItem,
  SupportTicket,
  UserProfile,
} from "@/types";
import type { DevRole } from "@/lib/devMode";

const STORE_KEY = "jusfacil:ui-dev-store:v1";
const STORE_EVENT = "jusfacil:ui-dev-store-change";

interface DevStore {
  profiles: Record<string, UserProfile>;
  cases: LegalCase[];
  messages: Record<string, CaseMessage[]>;
  drafts: Record<string, DraftVersion[]>;
  evidences: Record<string, Evidence[]>;
  notifications: NotificationItem[];
  updates: Record<string, CaseUpdate[]>;
  supportTickets: SupportTicket[];
}

const isoDaysAgo = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const currentYear = new Date().getFullYear();

export const DEV_CITIZEN_UID = "dev-citizen";
export const DEV_LAWYER_UID = "dev-lawyer";

function initialStore(): DevStore {
  const citizen: UserProfile = {
    uid: DEV_CITIZEN_UID,
    fullName: "Usuário de Demonstração",
    email: "cidadao.demo@jusfacil.local",
    role: "CITIZEN",
    cpf: "123.456.789-00",
    phone: "(11) 99999-0000",
    username: "@cidadaodemo",
    createdAt: isoDaysAgo(180),
    updatedAt: isoDaysAgo(2),
  };

  const lawyer: UserProfile = {
    uid: DEV_LAWYER_UID,
    fullName: "Advogado de Demonstração",
    email: "advogado.demo@jusfacil.local",
    role: "LAWYER",
    cpf: "987.654.321-00",
    phone: "(11) 98888-0000",
    username: "@advogadodemo",
    oabNumber: "123456",
    oabState: "SP",
    lawyerStatus: "APPROVED",
    createdAt: isoDaysAgo(160),
    updatedAt: isoDaysAgo(1),
  };

  const cases: LegalCase[] = [
    {
      caseId: `JF-${currentYear}-000001`,
      citizenId: citizen.uid,
      citizenName: citizen.fullName,
      assignedLawyerId: lawyer.uid,
      assignedLawyerName: lawyer.fullName,
      title: "Compra online não entregue",
      category: "Direito do Consumidor",
      legalArea: "Direito do Consumidor",
      summary: "Produto comprado pela internet não foi entregue e a loja não realizou o estorno solicitado.",
      originalStory: "Comprei um produto pela internet, o prazo de entrega venceu e a loja não resolveu o problema nem devolveu o valor.",
      status: "MINUTA_APROVADA",
      requiresHumanReview: false,
      currentDraftVersion: 2,
      structuredData: {
        category: "Direito do Consumidor",
        summary: "Atraso de entrega com pedido de restituição do valor pago.",
        facts: ["Compra realizada online", "Prazo de entrega expirado", "Consumidor pediu estorno"],
        timeline: [
          { date: isoDaysAgo(45), event: "Compra realizada" },
          { date: isoDaysAgo(30), event: "Prazo de entrega encerrado" },
          { date: isoDaysAgo(25), event: "Solicitação de estorno" },
        ],
        involvedParties: [
          { name: "Usuário de Demonstração", role: "Consumidor" },
          { name: "Loja Exemplo", role: "Fornecedor" },
        ],
        claimValue: 450,
        userGoal: "Receber o estorno do valor pago.",
        missingInformation: [],
        evidenceNeeded: ["Comprovante da compra", "Protocolos de atendimento"],
        confidenceLevel: "HIGH",
      },
      createdAt: isoDaysAgo(45),
      updatedAt: isoDaysAgo(2),
    },
    {
      caseId: `JF-${currentYear}-000002`,
      citizenId: citizen.uid,
      citizenName: citizen.fullName,
      assignedLawyerId: lawyer.uid,
      assignedLawyerName: lawyer.fullName,
      title: "Cobrança indevida em serviço",
      category: "Cobrança indevida",
      legalArea: "Direito do Consumidor",
      summary: "Cobranças continuaram após o cancelamento de um serviço recorrente.",
      originalStory: "Cancelei o serviço, mas continuei recebendo cobranças nos meses seguintes.",
      status: "AGUARDANDO_REVISAO",
      requiresHumanReview: true,
      humanReviewReason: "Minuta encaminhada para revisão humana antes da aprovação.",
      currentDraftVersion: 1,
      structuredData: {
        category: "Direito do Consumidor",
        summary: "Cobrança posterior ao cancelamento informado pelo consumidor.",
        claimValue: 289.9,
        userGoal: "Interromper as cobranças e recuperar os valores pagos após o cancelamento.",
        missingInformation: ["Confirmação da data exata do cancelamento"],
        confidenceLevel: "MEDIUM",
        requiresHumanReview: true,
      },
      createdAt: isoDaysAgo(82),
      updatedAt: isoDaysAgo(8),
    },
    {
      caseId: `JF-${currentYear}-000003`,
      citizenId: citizen.uid,
      citizenName: citizen.fullName,
      assignedLawyerId: lawyer.uid,
      assignedLawyerName: lawyer.fullName,
      title: "Serviço contratado não finalizado",
      category: "Prestação de serviços",
      legalArea: "Direito Civil",
      summary: "Prestador recebeu parte do pagamento e não concluiu o serviço contratado.",
      originalStory: "Contratei um serviço, paguei a entrada e o prestador parou de responder antes de terminar.",
      status: "COLETANDO_EVIDENCIAS",
      requiresHumanReview: false,
      structuredData: {
        category: "Direito Civil",
        summary: "Inexecução parcial de serviço contratado.",
        evidenceNeeded: ["Contrato", "Comprovante de pagamento", "Conversas com o prestador"],
        confidenceLevel: "MEDIUM",
      },
      createdAt: isoDaysAgo(18),
      updatedAt: isoDaysAgo(4),
    },
    {
      caseId: `JF-${currentYear}-000004`,
      citizenId: citizen.uid,
      citizenName: citizen.fullName,
      assignedLawyerId: lawyer.uid,
      assignedLawyerName: lawyer.fullName,
      title: "Reembolso de ingresso cancelado",
      category: "Direito do Consumidor",
      legalArea: "Direito do Consumidor",
      summary: "Caso concluído após registro e organização dos documentos de reembolso.",
      originalStory: "O evento foi cancelado e solicitei reembolso do ingresso.",
      status: "CONCLUIDO",
      requiresHumanReview: false,
      currentDraftVersion: 1,
      createdAt: isoDaysAgo(130),
      updatedAt: isoDaysAgo(35),
    },
  ];

  const messages: Record<string, CaseMessage[]> = {
    [cases[0].caseId]: [
      { messageId: "m-1", caseId: cases[0].caseId, sender: "USER", senderName: citizen.fullName, content: cases[0].originalStory, timestamp: isoDaysAgo(45, 14) },
      { messageId: "m-2", caseId: cases[0].caseId, sender: "BOT", senderName: "JurisBot", content: "Entendi. Organizei o relato inicial e identifiquei que comprovante da compra e protocolos de atendimento são úteis para documentar o caso.", timestamp: isoDaysAgo(45, 14) },
      { messageId: "m-3", caseId: cases[0].caseId, sender: "USER", senderName: citizen.fullName, content: "Tenho o comprovante do pagamento e os e-mails da loja.", timestamp: isoDaysAgo(44, 11) },
      { messageId: "m-4", caseId: cases[0].caseId, sender: "BOT", senderName: "JurisBot", content: "Ótimo. Os documentos foram adicionados ao caso de demonstração. A minuta disponível ao lado mostra como o fluxo ficará quando a integração real estiver ativa.", timestamp: isoDaysAgo(44, 11) },
    ],
    [cases[1].caseId]: [
      { messageId: "m-5", caseId: cases[1].caseId, sender: "USER", senderName: citizen.fullName, content: cases[1].originalStory, timestamp: isoDaysAgo(82, 15) },
      { messageId: "m-6", caseId: cases[1].caseId, sender: "BOT", senderName: "JurisBot", content: "Para organizar a cobrança, preciso da data aproximada do cancelamento e de um comprovante das cobranças posteriores.", timestamp: isoDaysAgo(82, 15) },
    ],
  };

  const drafts: Record<string, DraftVersion[]> = {
    [cases[0].caseId]: [
      {
        version: 2,
        caseId: cases[0].caseId,
        title: "Minuta de Petição Inicial — Versão 2",
        content: "MINUTA DE DEMONSTRAÇÃO\n\nDOS FATOS\nO consumidor realizou compra em ambiente eletrônico e, após o término do prazo informado, não recebeu o produto. Foram realizados contatos com o fornecedor, inclusive com pedido de restituição do valor.\n\nDOS PEDIDOS\nA presente minuta é apenas um conteúdo de demonstração visual do JusFácil e não constitui orientação jurídica real.",
        approved: true,
        feedback: "Ajustar a ordem dos contatos realizados com a loja.",
        createdBy: "JurisBot DEV",
        source: "AI",
        changeSummary: "Cronologia reorganizada para demonstração.",
        createdAt: isoDaysAgo(5),
      },
      {
        version: 1,
        caseId: cases[0].caseId,
        title: "Minuta de Petição Inicial — Versão 1",
        content: "Primeira versão de demonstração da minuta do caso.",
        approved: false,
        feedback: "Ajustar a ordem dos fatos.",
        createdBy: "JurisBot DEV",
        source: "AI",
        createdAt: isoDaysAgo(12),
      },
    ],
    [cases[1].caseId]: [
      {
        version: 1,
        caseId: cases[1].caseId,
        title: "Minuta para revisão — Versão 1",
        content: "Minuta de demonstração aguardando revisão humana. Nenhum conteúdo jurídico desta tela deve ser considerado orientação real.",
        approved: false,
        createdBy: "JurisBot DEV",
        source: "AI",
        createdAt: isoDaysAgo(18),
      },
    ],
    [cases[3].caseId]: [
      {
        version: 1,
        caseId: cases[3].caseId,
        title: "Minuta final — Versão 1",
        content: "Documento de demonstração associado a um caso concluído.",
        approved: true,
        createdBy: "JurisBot DEV",
        source: "AI",
        createdAt: isoDaysAgo(40),
      },
    ],
  };

  const evidences: Record<string, Evidence[]> = {
    [cases[0].caseId]: [
      {
        evidenceId: "ev-001",
        caseId: cases[0].caseId,
        originalName: "comprovante-compra.pdf",
        mimeType: "application/pdf",
        size: 248000,
        storagePath: "dev/comprovante-compra.pdf",
        status: "PROCESSED",
        description: "Comprovante da compra",
        uploadedAt: isoDaysAgo(32),
        uploadedBy: citizen.uid,
        extractedText: "Conteúdo simulado para desenvolvimento visual.",
        extractionMethod: "DEV_MOCK",
        confidence: "HIGH",
        processedAt: isoDaysAgo(32),
      },
      {
        evidenceId: "ev-002",
        caseId: cases[0].caseId,
        originalName: "protocolos-atendimento.png",
        mimeType: "image/png",
        size: 512000,
        storagePath: "dev/protocolos-atendimento.png",
        status: "UPLOADED",
        description: "Prints dos protocolos de atendimento",
        uploadedAt: isoDaysAgo(28),
        uploadedBy: citizen.uid,
      },
    ],
    [cases[2].caseId]: [
      {
        evidenceId: "ev-003",
        caseId: cases[2].caseId,
        originalName: "contrato-servico.pdf",
        mimeType: "application/pdf",
        size: 385000,
        storagePath: "dev/contrato-servico.pdf",
        status: "PROCESSED",
        description: "Contrato do serviço",
        uploadedAt: isoDaysAgo(6),
        uploadedBy: citizen.uid,
        confidence: "MEDIUM",
        processedAt: isoDaysAgo(6),
      },
    ],
  };

  const updates: Record<string, CaseUpdate[]> = {
    [cases[0].caseId]: [
      {
        updateId: "upd-001",
        caseId: cases[0].caseId,
        createdBy: lawyer.uid,
        createdByName: lawyer.fullName,
        createdByRole: "LAWYER",
        message: "Documentos revisados. A minuta atualizada já está disponível para consulta.",
        createdAt: isoDaysAgo(4, 16),
        visibleToCitizen: true,
      },
      {
        updateId: "upd-002",
        caseId: cases[0].caseId,
        createdBy: lawyer.uid,
        createdByName: lawyer.fullName,
        createdByRole: "LAWYER",
        message: "Comprovantes recebidos e organizados no histórico do caso.",
        createdAt: isoDaysAgo(27, 13),
        visibleToCitizen: true,
      },
    ],
    [cases[1].caseId]: [
      {
        updateId: "upd-003",
        caseId: cases[1].caseId,
        createdBy: lawyer.uid,
        createdByName: lawyer.fullName,
        createdByRole: "LAWYER",
        message: "Caso recebido para revisão. Ainda falta confirmar a data do cancelamento do serviço.",
        createdAt: isoDaysAgo(8, 9),
        visibleToCitizen: true,
      },
    ],
    [cases[3].caseId]: [
      {
        updateId: "upd-004",
        caseId: cases[3].caseId,
        createdBy: lawyer.uid,
        createdByName: lawyer.fullName,
        createdByRole: "LAWYER",
        message: "Caso finalizado no ambiente de demonstração.",
        createdAt: isoDaysAgo(35, 17),
        visibleToCitizen: true,
      },
    ],
  };

  const notifications: NotificationItem[] = [
    { notificationId: "n-001", userId: citizen.uid, caseId: cases[0].caseId, title: "Minuta aprovada", message: "A versão mais recente da minuta foi marcada como aprovada.", type: "DRAFT_UPDATED", read: false, createdAt: isoDaysAgo(2) },
    { notificationId: "n-002", userId: citizen.uid, caseId: cases[0].caseId, title: "Atualização no seu caso", message: "O advogado registrou uma nova atualização no histórico.", type: "CASE_UPDATED", read: false, createdAt: isoDaysAgo(4) },
    { notificationId: "n-003", userId: citizen.uid, caseId: cases[1].caseId, title: "Revisão humana", message: "Seu caso está aguardando revisão humana.", type: "HUMAN_REVIEW_REQUIRED", read: true, createdAt: isoDaysAgo(8) },
    { notificationId: "n-004", userId: citizen.uid, caseId: cases[2].caseId, title: "Evidências solicitadas", message: "Envie os documentos indicados para continuar a organização do caso.", type: "EVIDENCE_REQUESTED", read: true, createdAt: isoDaysAgo(18) },
    { notificationId: "n-005", userId: citizen.uid, caseId: cases[0].caseId, title: "Documento processado", message: "Um documento do caso foi processado no ambiente de demonstração.", type: "CASE_UPDATED", read: true, createdAt: isoDaysAgo(34) },
    { notificationId: "n-006", userId: citizen.uid, caseId: cases[3].caseId, title: "Caso concluído", message: "O caso foi marcado como concluído.", type: "CASE_COMPLETED", read: true, createdAt: isoDaysAgo(65) },
    { notificationId: "n-007", userId: citizen.uid, caseId: cases[1].caseId, title: "Advogado atribuído", message: "Um advogado de demonstração foi associado ao caso.", type: "LAWYER_ASSIGNED", read: true, createdAt: isoDaysAgo(95) },
  ];

  const supportTickets: SupportTicket[] = [
    {
      ticketId: "ticket-001",
      userId: citizen.uid,
      category: "USO_DO_APP",
      subject: "Dúvida sobre envio de documento",
      message: "Como substituo um documento anexado por engano?",
      status: "RESOLVED",
      createdAt: isoDaysAgo(20),
      updatedAt: isoDaysAgo(18),
    },
    {
      ticketId: "ticket-002",
      userId: lawyer.uid,
      category: "PORTAL_ADVOGADO",
      subject: "Dúvida sobre atualização de caso",
      message: "Como registro uma atualização sem anexo?",
      status: "OPEN",
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(3),
    },
  ];

  return {
    profiles: { [citizen.uid]: citizen, [lawyer.uid]: lawyer },
    cases,
    messages,
    drafts,
    evidences,
    notifications,
    updates,
    supportTickets,
  };
}

let memoryStore: DevStore | null = null;

function readStore(): DevStore {
  if (typeof window === "undefined") {
    if (!memoryStore) memoryStore = initialStore();
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      const created = initialStore();
      window.localStorage.setItem(STORE_KEY, JSON.stringify(created));
      return created;
    }
    return JSON.parse(raw) as DevStore;
  } catch {
    if (!memoryStore) memoryStore = initialStore();
    return memoryStore;
  }
}

function writeStore(store: DevStore): void {
  memoryStore = store;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // A UI de demonstração continua funcional em memória se o storage estiver cheio.
    }
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

export function resetDevStore(): void {
  const fresh = initialStore();
  writeStore(fresh);
}

export function getDevProfile(role: DevRole): UserProfile {
  const store = readStore();
  return role === "LAWYER" ? store.profiles[DEV_LAWYER_UID] : store.profiles[DEV_CITIZEN_UID];
}

export function devGetUserProfile(uid: string): UserProfile | null {
  return readStore().profiles[uid] ?? null;
}

export async function devUpdateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const store = readStore();
  const profile = store.profiles[uid];
  if (!profile) return;
  store.profiles[uid] = { ...profile, ...updates, uid: profile.uid, role: profile.role, updatedAt: new Date().toISOString() };
  writeStore(store);
}

export async function devGetUserCases(userId: string, role: string): Promise<LegalCase[]> {
  const cases = readStore().cases.filter((item) => role === "LAWYER" ? item.assignedLawyerId === userId : item.citizenId === userId);
  return [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function devGetCaseById(caseId: string): Promise<LegalCase | null> {
  return readStore().cases.find((item) => item.caseId === caseId) ?? null;
}

export async function devCreateLegalCase(caseData: LegalCase): Promise<string> {
  const store = readStore();
  store.cases.unshift(caseData);
  store.messages[caseData.caseId] = [];
  store.drafts[caseData.caseId] = [];
  store.evidences[caseData.caseId] = [];
  store.updates[caseData.caseId] = [];
  writeStore(store);
  return caseData.caseId;
}

export async function devUpdateCaseStatus(caseId: string, status: CaseStatus, extraUpdates: Partial<LegalCase> = {}): Promise<void> {
  const store = readStore();
  const index = store.cases.findIndex((item) => item.caseId === caseId);
  if (index < 0) return;
  store.cases[index] = { ...store.cases[index], ...extraUpdates, status, updatedAt: new Date().toISOString() };
  writeStore(store);
}

export async function devGetCaseMessages(caseId: string): Promise<CaseMessage[]> {
  return [...(readStore().messages[caseId] ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function devAddCaseMessage(message: CaseMessage): Promise<void> {
  const store = readStore();
  store.messages[message.caseId] = [...(store.messages[message.caseId] ?? []), message];
  writeStore(store);
}

export async function devGetCaseDrafts(caseId: string): Promise<DraftVersion[]> {
  return [...(readStore().drafts[caseId] ?? [])].sort((a, b) => b.version - a.version);
}

export async function devSaveDraftVersion(draft: DraftVersion): Promise<void> {
  const store = readStore();
  const list = store.drafts[draft.caseId] ?? [];
  store.drafts[draft.caseId] = [draft, ...list.filter((item) => item.version !== draft.version)];
  const caseIndex = store.cases.findIndex((item) => item.caseId === draft.caseId);
  if (caseIndex >= 0) {
    store.cases[caseIndex] = { ...store.cases[caseIndex], currentDraftVersion: draft.version, status: "AGUARDANDO_REVISAO", updatedAt: new Date().toISOString() };
  }
  writeStore(store);
}

export async function devApproveDraft(caseId: string, version: number): Promise<void> {
  const store = readStore();
  store.drafts[caseId] = (store.drafts[caseId] ?? []).map((draft) => draft.version === version ? { ...draft, approved: true } : draft);
  const caseIndex = store.cases.findIndex((item) => item.caseId === caseId);
  if (caseIndex >= 0) store.cases[caseIndex] = { ...store.cases[caseIndex], status: "MINUTA_APROVADA", updatedAt: new Date().toISOString() };
  writeStore(store);
}

export async function devCreateDraftRevision(caseId: string, feedback: string): Promise<void> {
  const store = readStore();
  const current = [...(store.drafts[caseId] ?? [])].sort((a, b) => b.version - a.version)[0];
  const nextVersion = (current?.version ?? 0) + 1;
  const draft: DraftVersion = {
    version: nextVersion,
    caseId,
    title: `Minuta de demonstração — Versão ${nextVersion}`,
    content: `${current?.content ?? "Minuta de demonstração."}\n\nAJUSTE SOLICITADO (DEV): ${feedback}\n\nEsta versão existe apenas para testes visuais e não constitui orientação jurídica.`,
    approved: false,
    feedback,
    createdBy: "JurisBot DEV",
    source: "AI",
    changeSummary: "Nova versão simulada a partir do feedback informado.",
    createdAt: new Date().toISOString(),
  };
  store.drafts[caseId] = [draft, ...(store.drafts[caseId] ?? [])];
  const caseIndex = store.cases.findIndex((item) => item.caseId === caseId);
  if (caseIndex >= 0) store.cases[caseIndex] = { ...store.cases[caseIndex], currentDraftVersion: nextVersion, status: "AJUSTANDO_MINUTA", updatedAt: new Date().toISOString() };
  writeStore(store);
}

export async function devRequestHumanReview(caseId: string, reason: string): Promise<void> {
  const store = readStore();
  const caseIndex = store.cases.findIndex((item) => item.caseId === caseId);
  if (caseIndex >= 0) {
    store.cases[caseIndex] = {
      ...store.cases[caseIndex],
      requiresHumanReview: true,
      humanReviewReason: reason,
      status: "REVISAO_HUMANA",
      updatedAt: new Date().toISOString(),
    };
  }
  writeStore(store);
}

export async function devGetCaseEvidences(caseId: string): Promise<Evidence[]> {
  return [...(readStore().evidences[caseId] ?? [])].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function devAddEvidence(evidence: Evidence): Promise<void> {
  const store = readStore();
  store.evidences[evidence.caseId] = [evidence, ...(store.evidences[evidence.caseId] ?? [])];
  writeStore(store);
}

export async function devUploadEvidenceFile(file: File, caseId: string, userId: string, description?: string, onProgress?: (progress: number) => void): Promise<Evidence> {
  onProgress?.(20);
  await new Promise((resolve) => setTimeout(resolve, 120));
  onProgress?.(65);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const evidence: Evidence = {
    evidenceId: crypto.randomUUID(),
    caseId,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    storagePath: `dev/${caseId}/${file.name}`,
    status: "PROCESSED",
    description: description?.trim() || undefined,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
    extractionMethod: "DEV_MOCK",
    confidence: "MEDIUM",
    processedAt: new Date().toISOString(),
  };
  await devAddEvidence(evidence);
  onProgress?.(100);
  return evidence;
}

export async function devRemoveEvidence(evidence: Evidence): Promise<void> {
  const store = readStore();
  store.evidences[evidence.caseId] = (store.evidences[evidence.caseId] ?? []).filter((item) => item.evidenceId !== evidence.evidenceId);
  writeStore(store);
}

export function devSubscribeToNotifications(userId: string, onData: (items: NotificationItem[]) => void): () => void {
  const emit = () => onData(readStore().notifications.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  emit();
  if (typeof window === "undefined") return () => undefined;
  const listener = () => emit();
  window.addEventListener(STORE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(STORE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function devGetUserNotifications(userId: string): Promise<NotificationItem[]> {
  return readStore().notifications.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function devMarkNotificationAsRead(notificationId: string): Promise<void> {
  const store = readStore();
  store.notifications = store.notifications.map((item) => item.notificationId === notificationId ? { ...item, read: true } : item);
  writeStore(store);
}

export async function devMarkAllNotificationsAsRead(items: NotificationItem[]): Promise<void> {
  const ids = new Set(items.map((item) => item.notificationId));
  const store = readStore();
  store.notifications = store.notifications.map((item) => ids.has(item.notificationId) ? { ...item, read: true } : item);
  writeStore(store);
}

export async function devDeleteNotification(notificationId: string): Promise<void> {
  const store = readStore();
  store.notifications = store.notifications.filter((item) => item.notificationId !== notificationId);
  writeStore(store);
}

export async function devGetCaseUpdates(caseId: string): Promise<CaseUpdate[]> {
  return [...(readStore().updates[caseId] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function devAddCaseUpdate(caseId: string, lawyerId: string, message: string, documentEvidenceId?: string): Promise<CaseUpdate> {
  const store = readStore();
  const lawyer = store.profiles[lawyerId];
  const legalCase = store.cases.find((item) => item.caseId === caseId);
  const evidence = documentEvidenceId ? (store.evidences[caseId] ?? []).find((item) => item.evidenceId === documentEvidenceId) : undefined;
  const update: CaseUpdate = {
    updateId: crypto.randomUUID(),
    caseId,
    createdBy: lawyerId,
    createdByName: lawyer?.fullName ?? "Advogado DEV",
    createdByRole: "LAWYER",
    message,
    documentEvidenceId,
    documentName: evidence?.originalName,
    documentUrl: evidence?.fileUrl,
    createdAt: new Date().toISOString(),
    visibleToCitizen: true,
  };
  store.updates[caseId] = [update, ...(store.updates[caseId] ?? [])];
  const caseIndex = store.cases.findIndex((item) => item.caseId === caseId);
  if (caseIndex >= 0) store.cases[caseIndex] = { ...store.cases[caseIndex], updatedAt: update.createdAt };
  if (legalCase) {
    store.notifications.unshift({
      notificationId: crypto.randomUUID(),
      userId: legalCase.citizenId,
      caseId,
      title: "Atualização no seu caso",
      message: message.length > 120 ? `${message.slice(0, 120)}…` : message,
      type: "CASE_UPDATED",
      read: false,
      createdAt: update.createdAt,
    });
  }
  writeStore(store);
  return update;
}

export async function devUploadUserAvatar(uid: string, file: File): Promise<string> {
  const url = await new Promise<string>((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve("/img/Logo.png");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "/img/Logo.png");
    reader.onerror = () => resolve("/img/Logo.png");
    reader.readAsDataURL(file);
  });
  await devUpdateUserProfile(uid, { avatarUrl: url });
  return url;
}

export async function devGetUserSupportTickets(userId: string): Promise<SupportTicket[]> {
  return readStore().supportTickets.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function devCreateSupportTicket(ticket: Omit<SupportTicket, "ticketId" | "status" | "createdAt" | "updatedAt">): Promise<string> {
  const store = readStore();
  const ticketId = crypto.randomUUID();
  const now = new Date().toISOString();
  store.supportTickets.unshift({ ...ticket, ticketId, status: "OPEN", createdAt: now, updatedAt: now });
  writeStore(store);
  return ticketId;
}

export function devGenerateBotReply(userText: string): string {
  const normalized = userText.trim().toLowerCase();
  if (normalized.includes("evid") || normalized.includes("document") || normalized.includes("comprov")) {
    return "Perfeito. No modo de desenvolvimento, você pode usar a aba de evidências para testar upload, progresso e estados visuais sem enviar arquivos ao Firebase ou à IA.";
  }
  if (normalized.includes("minuta") || normalized.includes("petição") || normalized.includes("peticao")) {
    return "A minuta exibida neste ambiente é simulada apenas para validar a interface, versionamento, download e estados de aprovação. Nenhum conteúdo jurídico real está sendo gerado.";
  }
  return "Recebi sua mensagem no ambiente de desenvolvimento. O fluxo visual está ativo com dados simulados; Firebase e OpenAI não foram acionados. Você pode continuar a conversa, enviar evidências e navegar pelas demais etapas.";
}
