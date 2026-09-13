export type UserRole = 'CITIZEN' | 'LAWYER' | 'ADMIN';

export type LawyerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  cpf?: string;
  phone?: string;
  username?: string;
  oabNumber?: string;
  oabState?: string;
  lawyerStatus?: LawyerStatus;
  lawyerReviewedBy?: string;
  lawyerReviewedAt?: string;
  lawyerReviewReason?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type CaseStatus =
  | 'TRIAGEM'
  | 'COLETANDO_INFORMACOES'
  | 'AGUARDANDO_INFORMACOES'
  | 'COLETANDO_EVIDENCIAS'
  | 'ANALISANDO'
  | 'NECESSITA_ESCLARECIMENTO'
  | 'PREPARANDO_MINUTA'
  | 'AGUARDANDO_REVISAO'
  | 'AJUSTANDO_MINUTA'
  | 'MINUTA_APROVADA'
  | 'REVISAO_HUMANA'
  | 'ENCAMINHADO_ADVOGADO'
  | 'PRONTO_PARA_PROTOCOLO'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDO';

export interface StructuredCaseData {
  caseSummary: string;
  category: string | null;
  parties: { role: string; name: string | null; document: string | null; address: string | null; details: string | null }[];
  facts: { description: string; date: string | null; source: string | null }[];
  timeline: { date: string | null; event: string }[];
  values: { description: string; amount: number | null; currency: string | null }[];
  claimValue?: number | null;
  evidence: { evidenceId: string | null; name: string; type: string; summary: string; relevantFacts: string[]; uncertainties: string[] }[];
  legalIssues: string[];
  requestedRelief: string[];
  missingInformation: string[];
  contradictions: string[];
  riskFlags: string[];
  draftReady: boolean;
  nextQuestions: string[];
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  requiresHumanReview: boolean;
  humanReviewReason: string | null;
}

export interface LegalCase {
  caseId: string;
  citizenId: string;
  citizenName?: string;
  assignedLawyerId?: string;
  assignedLawyerName?: string;
  title: string;
  category: string;
  summary: string;
  originalStory: string;
  status: CaseStatus;
  structuredData?: StructuredCaseData;
  requiresHumanReview: boolean;
  humanReviewReason?: string;
  currentDraftVersion?: number;
  approvedVersion?: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseMessage {
  messageId: string;
  caseId: string;
  sender: 'USER' | 'BOT' | 'LAWYER' | 'SYSTEM';
  senderName?: string;
  content: string;
  timestamp: string;
  createdBy?: string;
  revisionReview?: import("@/lib/drafts/revisionShared").RevisionProposal;
}

export interface DraftVersion {
  version: number;
  caseId: string;
  title: string;
  content: string;
  approved: boolean;
  feedback?: string;
  createdBy: string;
  source: 'AI' | 'CITIZEN' | 'LAWYER' | 'ADMIN';
  changeSummary?: string;
  revisionAdvice?: string;
  createdAt: string;
}

export type EvidenceStatus =
  | 'QUEUED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'UNSUPPORTED'
  | 'FAILED';

export interface EvidenceAnalysis {
  fileName: string;
  fileType: string;
  summary: string;
  relevantFacts: string[];
  dates: string[];
  values: string[];
  peopleOrOrganizations: string[];
  protocols: string[];
  contradictions: string[];
  uncertainties: string[];
  relevance: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EvidenceOriginal {
  id: string;
  caseId: string;
  evidenceId: string;
  sha256: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface Evidence {
  evidenceId: string;
  caseId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  status: EvidenceStatus;
  fileUrl?: string;
  description?: string;
  uploadedAt: string;
  uploadedBy: string;
  extractedText?: string;
  extractionMethod?: string;
  analysis?: EvidenceAnalysis;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  processedAt?: string;
  processingError?: string;
  originalRetained?: boolean;
  original?: EvidenceOriginal;
  annexOriginal?: EvidenceOriginal;
  order?: number;
  reference?: string;
  title?: string;
  originalTitle?: string;
  alternateFileNames?: string[];
  sha256?: string;
  source?: 'INDIVIDUAL' | 'ZIP';
  processingStatus?: 'AGUARDANDO' | 'ANALISANDO' | 'CONCLUIDA' | 'ERRO';
}

export type NotificationType =
  | 'CASE_UPDATED'
  | 'DRAFT_READY'
  | 'DRAFT_UPDATED'
  | 'EVIDENCE_REQUESTED'
  | 'LAWYER_ASSIGNED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'CASE_COMPLETED';

export interface NotificationItem {
  notificationId: string;
  userId: string;
  caseId?: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface SupportTicket {
  ticketId: string;
  userId: string;
  category: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface CaseEligibilityResult {
  path: 'SELF_SERVICE' | 'HUMAN_REVIEW';
  reasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
