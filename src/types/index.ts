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
  summary?: string;
  category?: string;
  facts?: string[];
  timeline?: { date?: string; event: string }[];
  involvedParties?: { name: string; role: string }[];
  claimValue?: number;
  userGoal?: string;
  missingInformation?: string[];
  evidenceNeeded?: string[];
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  requiresHumanReview?: boolean;
  humanReviewReason?: string;
}

export interface LegalCase {
  caseId: string;
  citizenId: string;
  citizenName?: string;
  assignedLawyerId?: string;
  assignedLawyerName?: string;
  title: string;
  category: string;
  legalArea?: string;
  courtProcessNumber?: string;
  summary: string;
  originalStory: string;
  status: CaseStatus;
  structuredData?: StructuredCaseData;
  requiresHumanReview: boolean;
  humanReviewReason?: string;
  currentDraftVersion?: number;
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
  summary: string;
  documentType: string;
  dates: string[];
  amounts: string[];
  people: string[];
  companies: string[];
  protocols: string[];
  relevantFacts: string[];
  relationToCase: string[];
  uncertainties: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Evidence {
  evidenceId: string;
  caseId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
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

export interface CaseUpdate {
  updateId: string;
  caseId: string;
  createdBy: string;
  createdByName?: string;
  createdByRole: 'LAWYER' | 'ADMIN' | 'SYSTEM';
  authorName?: string;
  authorRole?: 'LAWYER' | 'ADMIN' | 'SYSTEM';
  courtProcessNumber?: string;
  message: string;
  documentEvidenceId?: string;
  documentName?: string;
  documentUrl?: string;
  createdAt: string;
  visibleToCitizen: boolean;
}
