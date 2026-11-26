import type { TaskSubtask } from './platform';

export type TaskStatus = 
  | 'New' 
  | 'Awaiting Review' 
  | 'Accepted' 
  | 'In Progress' 
  | 'Waiting' 
  | 'Completed' 
  | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TaskKind = 'todo' | 'followup' | 'check';

export type TaskCategory = 
  | 'Lab Coordination' 
  | 'Patient Follow-up' 
  | 'Sterilization & Prep' 
  | 'Dentist Instruction' 
  | 'Inventory & Supplies' 
  | 'Record Keeping' 
  | 'Other';

export type LocaleCode = 'th' | 'en';

export interface TaskActivity {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  localized?: Partial<Record<LocaleCode, { action: string; user: string }>>;
}

export interface TaskItem {
  id: string;
  workspaceId?: string;
  taskKind?: TaskKind;
  title: string;
  description: string;
  attachedNote?: string;
  category: TaskCategory;
  customCategory?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdDate: string;
  receivedTimestamp?: string;
  dueDate: string;
  reminderAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  roomName?: string;
  templateId?: string;
  workflowId?: string;
  workflowStages?: string[];
  currentStageIndex?: number;
  subtasks?: TaskSubtask[];
  relatedLabId?: string;
  relatedPatientId?: string;
  relatedDocuments: string[]; // evidence IDs or file names
  evidenceIds: string[];
  attachmentEvidenceId?: string;
  activityHistory: TaskActivity[];
  localized?: Partial<Record<LocaleCode, { title: string; description: string }>>;
  isDemo?: boolean;
}

export type QueueStatus = 'waiting' | 'called' | 'claimed_other' | 'completed' | 'skipped';

export interface QueueItem {
  id: string;
  queueNumber: string;
  patientName: string;
  procedure: string;
  roomName?: string;
  status: QueueStatus;
  notes?: string;
  attachmentEvidenceId?: string;
  createdAt: string;
  calledAt?: string;
}

export type LabWorkType = 'Denture' | 'Crown' | 'Retainer' | 'Surgical Guide' | 'Other';

export type LabStatus = 
  | 'Ordered' 
  | 'In Fabrication' 
  | 'Shipped' 
  | 'Delivered' 
  | 'Quality Checked' 
  | 'Issue / Remake' 
  | 'Cancelled';

export interface LabHistoryItem {
  id: string;
  timestamp: string;
  status: LabStatus;
  notes: string;
  localized?: Partial<Record<LocaleCode, { notes: string }>>;
}

export interface LabOrder {
  id: string;
  orderReference: string;
  workType: LabWorkType;
  laboratoryName: string;
  dentistName: string;
  patientRefId: string;
  dateSent: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  dateReceived?: string;
  deliveryTrackingNumber?: string;
  status: LabStatus;
  supportingFiles: string[]; // file names or evidence IDs
  attachmentEvidenceId?: string;
  workHistory: LabHistoryItem[];
  localized?: Partial<Record<LocaleCode, { laboratoryName: string; dentistName: string }>>;
  isDemo?: boolean;
}

export interface PatientFollowUpItem {
  id: string;
  patientRefId: string; // e.g. "PT-8831" (anonymized reference)
  caseCategory: string; // e.g. "Post-Crown Cementation Check", "Suture Removal Check"
  followUpReason: string;
  nextAction: string;
  dueDate: string;
  status: 'Pending' | 'Contacted' | 'Scheduled' | 'Completed' | 'Cancelled';
  relatedEvidenceIds: string[];
  attachmentEvidenceId?: string;
  localized?: Partial<
    Record<LocaleCode, { caseCategory: string; followUpReason: string; nextAction: string }>
  >;
  isDemo?: boolean;
}

export interface EvidenceItem {
  id: string;
  originalFilename: string;
  fileType: 'image' | 'pdf' | 'spreadsheet' | 'document' | 'other';
  uploadDateTime: string;
  receivedTimestamp?: string;
  relatedTaskId?: string;
  relatedLabId?: string;
  relatedPatientId?: string;
  relatedInboxId?: string;
  description: string;
  fileSize?: string;
  fileUrl?: string; // object URL or mock URL
  mimeType?: string;
  hasStoredFile?: boolean;
  localized?: Partial<Record<LocaleCode, { description: string }>>;
  isDemo?: boolean;
}

export type InboxSourceType = 'pasted_text' | 'uploaded_image' | 'uploaded_pdf' | 'uploaded_excel';

export interface ExtractionConfidence {
  title: number;
  category: number;
  description: number;
  relatedLabOrCase: number;
  dueDate: number;
}

export interface InboxItem {
  id: string;
  title: string;
  sourceType: InboxSourceType;
  rawContent: string; // text or file name
  receivedTimestamp: string;
  dentistName: string;
  evidenceId?: string;
  extractedData: {
    title: string;
    category: TaskCategory;
    description: string;
    relatedLabOrCase?: string;
    importantDates: string;
    dueDate: string;
    missingInformation?: string;
    missingFields?: string[];
    confidence?: ExtractionConfidence;
    sourceQuote?: string;
    suggestedNextAction: string;
  };
  localized?: Partial<
    Record<LocaleCode, { title: string; rawContent: string; dentistName: string }>
  >;
  status: 'Unprocessed' | 'Reviewed' | 'Converted to Task' | 'Archived';
  isDemo?: boolean;
}

export const DENTURE_STATUSES = [
  'ยังไม่ได้โทร',
  'สนใจ / นัดหมายตรวจแล้ว',
  'สนใจ / รอตัดสินใจ',
  'ไม่สะดวก / ปฏิเสธ',
  'ติดต่อไม่ได้ / ไม่รับสาย',
  'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)',
  'ใส่ฟันปลอมเสร็จเรียบร้อย',
  'ถอนเพื่อจัดฟัน',
  'เคลียร์ช่องปากทำรากเทียม',
  'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน',
  'ถอน/ผ่าฟันคุด',
  'ไม่ต้องติดตาม'
] as const;

export type DentureStatus = (typeof DENTURE_STATUSES)[number];

export interface DentureCase {
  sheet: string;
  row: number;
  no: string | number;
  name: string;
  age: string | number;
  phone: string;
  history: string;
  group: string;
  extractDate: string;
  hn: string;
  dentist: string;
  status: string;
  appt: string;
  note: string;
  attachmentEvidenceId?: string;
}

export interface SheetConfig {
  webAppUrl: string;
  inventorySheetUrl?: string;
  satisfactionSheetUrl?: string;
  satisfactionFormUrl?: string;
  satisfactionRawTabName?: string;
  token: string;
  operatorName: string;
}

export type SatisfactionProcedureType =
  | 'extraction_wisdom'
  | 'checkup_scaling'
  | 'ortho_wire'
  | 'filling'
  | 'denture_crown'
  | 'other';

export interface SatisfactionScores {
  receptionCare: number; // 1. การต้อนรับและความใส่ใจ
  treatmentExplanation: number; // 2. ความชัดเจนในการอธิบายการรักษา
  cleanlinessProfessionalism: number; // 3. ความมั่นใจในความสะอาดและความเป็นมืออาชีพ
  waitingAndDuration: number; // 4. ระยะเวลารับบริการ
  overallExperience: number; // 5. ประสบการณ์โดยรวม
}

export interface SatisfactionResponse {
  id: string;
  submittedAt: string; // YYYY-MM-DD HH:mm
  monthKey: string; // YYYY-MM
  serviceType: SatisfactionProcedureType;
  scores: SatisfactionScores;
  wantsCallback: boolean;
  callbackTopic?: string;
  patientRef?: string;
  comment?: string;
  source: 'qr_scan' | 'post_op_link' | 'manual_entry' | 'sheet_sync';
  triageStatus: 'new' | 'followup_created' | 'resolved';
  linkedTaskId?: string;
  syncedToSheet?: boolean;
  attachmentEvidenceId?: string;
  isDemo?: boolean;
}

export interface SatisfactionSettings {
  monthlyGoal: number;
  surveyUrl: string;
  rawSheetTabName: string;
}

export type ActiveTab = 
  | 'overview' 
  | 'ai_assistant'
  | 'chat_copilot'
  | 'inbox' 
  | 'tasks' 
  | 'live_workspaces'
  | 'queue'
  | 'labs' 
  | 'followups' 
  | 'denture'
  | 'satisfaction'
  | 'evidence' 
  | 'team'
  | 'modules_hub'
  | 'settings';
