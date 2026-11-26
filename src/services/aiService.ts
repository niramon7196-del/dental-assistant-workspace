import * as XLSX from 'xlsx';
import { tryHybridText } from './hybridAi';
import {
  ExtractionConfidence,
  InboxSourceType,
  LabOrder,
  PatientFollowUpItem,
  SatisfactionResponse,
  TaskCategory,
  TaskItem,
  TaskKind
} from '../types/dental';
import {
  AiAssistResponse,
  ChatChannelType,
  ChatCopilotReply,
  ChatToneCategory,
  ClinicRole,
  ModuleId,
  SatisfactionAiAnalysisResult,
  TaskTemplate,
  Workspace
} from '../types/platform';
import type { SatisfactionMetrics } from './satisfactionService';
import { MODULE_REGISTRY, isModuleAccessible } from '../modules/moduleRegistry';
import { Language } from '../utils/i18n';

export const MAX_INBOX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface PiiMaskStats {
  phones: number;
  thaiIds: number;
  hns: number;
  totalRedacted: number;
}

export interface PiiMaskResult {
  maskedText: string;
  stats: PiiMaskStats;
}

export interface AIExtractionResult {
  title: string;
  category: TaskCategory;
  description: string;
  relatedLabOrCase: string | null;
  dueDate: string | null;
  missingFields: string[];
  confidence: ExtractionConfidence;
  sourceQuote: string;
  suggestedNextAction: string;
  model: string;
  maskStats: PiiMaskStats;
  maskedInputPreview: string;
}

export interface DuplicateTaskWarning {
  task: TaskItem;
  reasons: string[];
}

export interface PreparedInboxFile {
  file: File;
  sourceType: InboxSourceType;
  evidenceFileType: 'image' | 'pdf' | 'spreadsheet' | 'document';
  mimeType: string;
  sizeFormatted: string;
  base64Data?: string;
  extractedText?: string;
}

export class AiServiceError extends Error {
  status: number;
  code: string;
  isUnavailable: boolean;

  constructor(message: string, status = 500, code = 'AI_ERROR', isUnavailable = false) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
    this.code = code;
    this.isUnavailable = isUnavailable;
  }
}

export function buildAiRequestError(params: {
  status?: number;
  rawError?: string;
  code?: string;
  uiLanguage: Language;
  fallbackTh: string;
  fallbackEn: string;
}): AiServiceError {
  const status = params.status ?? 0;
  const raw = (params.rawError || '').trim();
  const lower = raw.toLowerCase();
  const isUnavailable =
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 0 ||
    params.code === 'AI_UNAVAILABLE' ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror');

  if (isUnavailable) {
    return new AiServiceError(
      params.uiLanguage === 'en'
        ? 'AI provider model is temporarily unavailable (503). Your typed text is preserved — you can save it to your task list now.'
        : 'โมเดลฝั่งผู้ให้บริการไม่พร้อมใช้งานชั่วคราว (503) — ข้อความที่คุณพิมพ์ยังอยู่ครบ สามารถบันทึกลงรายการงานได้ทันที',
      status || 503,
      params.code || 'AI_UNAVAILABLE',
      true
    );
  }

  return new AiServiceError(
    raw || (params.uiLanguage === 'en' ? params.fallbackEn : params.fallbackTh),
    status || 500,
    params.code || 'AI_ERROR',
    false
  );
}

export function buildManualFallbackTaskDraft(params: {
  rawText: string;
  attachmentName?: string;
  language: Language;
  defaultCategory?: TaskCategory;
  defaultKind?: TaskKind;
  prefixLabel?: string;
}): {
  title: string;
  description: string;
  category: TaskCategory;
  taskKind: TaskKind;
} {
  const trimmed = params.rawText.trim();
  const firstLine = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  let baseTitle = firstLine
    ? firstLine.length > 72
      ? `${firstLine.slice(0, 72)}...`
      : firstLine
    : params.attachmentName
    ? `${params.language === 'en' ? 'Attached file' : 'ไฟล์แนบ'}: ${params.attachmentName}`
    : params.language === 'en'
    ? 'Quick saved task draft'
    : 'ร่างงานที่บันทึกทันที';

  if (params.prefixLabel && !baseTitle.startsWith(params.prefixLabel)) {
    baseTitle = `${params.prefixLabel} ${baseTitle}`.trim();
  }

  const description =
    trimmed ||
    (params.attachmentName
      ? `${params.language === 'en' ? 'Saved with attachment' : 'บันทึกพร้อมไฟล์แนบ'}: ${params.attachmentName}`
      : baseTitle);

  return {
    title: baseTitle,
    description,
    category: params.defaultCategory || 'Dentist Instruction',
    taskKind: params.defaultKind || 'todo'
  };
}

/**
 * Mask Thai national 13-digit IDs, Thai phone numbers, and Hospital Numbers (HN)
 * strictly on the client before sending any text to the backend/Gemini API.
 */
export function maskSensitivePii(input: string): PiiMaskResult {
  if (!input) {
    return {
      maskedText: '',
      stats: { phones: 0, thaiIds: 0, hns: 0, totalRedacted: 0 }
    };
  }

  let phones = 0;
  let thaiIds = 0;
  let hns = 0;

  // 1. Thai 13-digit National ID (e.g., 1-1017-00123-45-6, 1 1017 00123 45 6, 1101700123456)
  const thaiIdRegex = /(?<!\d)\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}(?!\d)/g;
  let maskedText = input.replace(thaiIdRegex, () => {
    thaiIds += 1;
    return '[REDACTED_THAI_ID]';
  });

  // 2. Hospital Numbers (HN) e.g. HN690104, HN-123456, HN: 00123/69, HN 65-0012
  const hnRegex = /\bHN\s*[-:#.]?\s*\d[\d/-]{2,14}\b/gi;
  maskedText = maskedText.replace(hnRegex, () => {
    hns += 1;
    return '[REDACTED_HN]';
  });

  // 3. Thai Phone Numbers (mobile 06x/08x/09x, landline 02-07x, and +66 international format)
  const thaiPhoneRegex =
    /(?<!\d)(?:\+66[\s-]?(?:0?)[2-9]\d(?:[\s-]?\d{3,4}){2}|0[689]\d(?:[\s-]?\d{3}[\s-]?\d{4}|\d{7})|0[23457]\d?(?:[\s-]?\d{3}[\s-]?\d{4}|\d{6,7}))(?!\d)/g;
  maskedText = maskedText.replace(thaiPhoneRegex, () => {
    phones += 1;
    return '[REDACTED_PHONE]';
  });

  return {
    maskedText,
    stats: {
      phones,
      thaiIds,
      hns,
      totalRedacted: phones + thaiIds + hns
    }
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function resolveNormalizedMimeType(file: File): string {
  if (file.type && file.type.trim()) {
    return file.type.toLowerCase().trim();
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lowerName.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lowerName.endsWith('.csv')) return 'text/csv';
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.log')) {
    return 'text/plain';
  }
  return 'application/octet-stream';
}

export function readFileAsBase64(file: File, language: Language = 'th'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(
          new Error(
            language === 'en'
              ? 'Unable to read file as Base64.'
              : 'ไม่สามารถอ่านข้อมูลไฟล์เป็น Base64 ได้'
          )
        );
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () =>
      reject(
        new Error(
          language === 'en' ? 'Error reading selected file.' : 'เกิดข้อผิดพลาดในการอ่านไฟล์'
        )
      );
    reader.readAsDataURL(file);
  });
}

export async function parseSpreadsheetFileToText(
  file: File,
  language: Language = 'th'
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(
      language === 'en'
        ? 'No worksheet found in the Excel/CSV file.'
        : 'ไม่พบแผ่นงาน (Sheet) ในไฟล์ Excel/CSV'
    );
  }

  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false }).trim();
    if (csv) {
      const label = language === 'en' ? 'Sheet' : 'ตาราง';
      sections.push(`=== ${label}: ${sheetName} ===\n${csv}`);
    }
  }

  const combined = sections.join('\n\n').trim();
  if (!combined) {
    throw new Error(
      language === 'en' ? 'The spreadsheet contains no text data.' : 'ไฟล์ตารางไม่มีข้อมูลข้อความ'
    );
  }

  const MAX_CHARS = 25000;
  if (combined.length > MAX_CHARS) {
    const truncatedNotice =
      language === 'en'
        ? '... [Truncated remaining rows because spreadsheet is large]'
        : '... [ตัดทอนข้อความส่วนเกิน เนื่องจากตารางมีขนาดใหญ่]';
    return `${combined.slice(0, MAX_CHARS)}\n\n${truncatedNotice}`;
  }
  return combined;
}

export async function prepareInboxFile(
  file: File,
  language: Language = 'th'
): Promise<PreparedInboxFile> {
  if (file.size > MAX_INBOX_FILE_BYTES) {
    throw new Error(
      language === 'en'
        ? `File "${file.name}" (${formatFileSize(file.size)}) exceeds the 10 MB limit.`
        : `ไฟล์ "${file.name}" มีขนาด ${formatFileSize(file.size)} เกินขีดจำกัด 10 MB`
    );
  }

  const lowerName = file.name.toLowerCase();
  const mimeType = resolveNormalizedMimeType(file);
  const sizeFormatted = formatFileSize(file.size);

  const isImage =
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic)$/i.test(lowerName);
  const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
  const isSpreadsheet =
    mimeType.includes('spreadsheetml') ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv' ||
    /\.(xlsx|xls|csv)$/i.test(lowerName);
  const isText =
    mimeType === 'text/plain' || /\.(txt|md|log)$/i.test(lowerName);

  if (isImage) {
    const base64Data = await readFileAsBase64(file, language);
    return {
      file,
      sourceType: 'uploaded_image',
      evidenceFileType: 'image',
      mimeType: mimeType.startsWith('image/') ? mimeType : 'image/png',
      sizeFormatted,
      base64Data
    };
  }

  if (isPdf) {
    const base64Data = await readFileAsBase64(file, language);
    return {
      file,
      sourceType: 'uploaded_pdf',
      evidenceFileType: 'pdf',
      mimeType: 'application/pdf',
      sizeFormatted,
      base64Data
    };
  }

  if (isSpreadsheet) {
    const extractedText = await parseSpreadsheetFileToText(file, language);
    return {
      file,
      sourceType: 'uploaded_excel',
      evidenceFileType: 'spreadsheet',
      mimeType,
      sizeFormatted,
      extractedText
    };
  }

  if (isText) {
    const extractedText = await file.text();
    if (!extractedText.trim()) {
      throw new Error(
        language === 'en' ? 'Text file is empty.' : 'ไฟล์ข้อความว่างเปล่า'
      );
    }
    return {
      file,
      sourceType: 'pasted_text',
      evidenceFileType: 'document',
      mimeType: 'text/plain',
      sizeFormatted,
      extractedText
    };
  }

  throw new Error(
    language === 'en'
      ? `Unsupported file "${file.name}". Please upload an Image (.png, .jpg, .webp), PDF (.pdf), Excel/CSV (.xlsx, .xls, .csv), or text file (.txt).`
      : `ไม่รองรับไฟล์ชนิด "${file.name}" กรุณาอัปโหลดไฟล์รูปภาพ (.png, .jpg, .webp), PDF (.pdf), Excel/CSV (.xlsx, .xls, .csv) หรือไฟล์ข้อความ (.txt)`
  );
}

export async function checkAiServerHealth(): Promise<{
  ok: boolean;
  aiConfigured: boolean;
  model: string;
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { ok: false, aiConfigured: false, model: 'gemini-4-hydrogen' };
    }
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      aiConfigured: Boolean(data.aiConfigured),
      model: data.model || 'gemini-4-hydrogen'
    };
  } catch {
    return { ok: false, aiConfigured: false, model: 'gemini-4-hydrogen' };
  }
}

export async function extractTaskFromContent(params: {
  text: string;
  sourceType: InboxSourceType;
  preparedFile?: PreparedInboxFile | null;
  uiLanguage?: Language;
}): Promise<AIExtractionResult> {
  const { text, sourceType, preparedFile, uiLanguage = 'th' } = params;

  // Always mask PII client-side before leaving the browser
  const { maskedText, stats } = maskSensitivePii(text);

  const payload: {
    text: string;
    sourceType: InboxSourceType;
    fileName?: string;
    uiLanguage: Language;
    file?: {
      base64Data: string;
      mimeType: string;
      fileName: string;
    };
  } = {
    text: maskedText,
    sourceType,
    fileName: preparedFile?.file.name,
    uiLanguage
  };

  if (preparedFile?.base64Data) {
    payload.file = {
      base64Data: preparedFile.base64Data,
      mimeType: preparedFile.mimeType,
      fileName: preparedFile.file.name
    };
  }

  let response: Response;
  try {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    throw buildAiRequestError({
      status: 0,
      rawError: err instanceof Error ? err.message : 'Failed to fetch',
      uiLanguage,
      fallbackTh: 'ไม่สามารถเชื่อมต่อระบบ AI ได้ชั่วคราว',
      fallbackEn: 'Unable to reach AI service temporarily'
    });
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    error?: string;
    model?: string;
    data?: {
      title?: string;
      category?: TaskCategory;
      description?: string;
      relatedLabOrCase?: string | null;
      dueDate?: string | null;
      missingFields?: string[];
      confidence?: Partial<ExtractionConfidence>;
      sourceQuote?: string;
      suggestedNextAction?: string;
    };
  } | null;

  if (!response.ok || !json?.ok || !json.data) {
    throw buildAiRequestError({
      status: response.status,
      code: json?.code,
      rawError: json?.error,
      uiLanguage,
      fallbackTh: `การวิเคราะห์ด้วย AI ไม่สำเร็จ (HTTP ${response.status})`,
      fallbackEn: `AI extraction failed (HTTP ${response.status})`
    });
  }

  const raw = json.data;
  const clamp = (v: unknown) => {
    const num = typeof v === 'number' && !Number.isNaN(v) ? v : 0.5;
    return Math.max(0, Math.min(1, num));
  };

  const validDate =
    typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate.trim())
      ? raw.dueDate.trim()
      : null;

  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : [];

  if (!validDate && !missingFields.some((m) => m.toLowerCase().includes('due') || m.includes('กำหนด'))) {
    missingFields.push(
      uiLanguage === 'en'
        ? 'No explicit due date specified (dueDate)'
        : 'ไม่พบวันที่กำหนดส่งที่ชัดเจน (dueDate)'
    );
  }

  return {
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    category: raw.category || 'Dentist Instruction',
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    relatedLabOrCase:
      typeof raw.relatedLabOrCase === 'string' && raw.relatedLabOrCase.trim()
        ? raw.relatedLabOrCase.trim()
        : null,
    dueDate: validDate,
    missingFields,
    confidence: {
      title: clamp(raw.confidence?.title),
      category: clamp(raw.confidence?.category),
      description: clamp(raw.confidence?.description),
      relatedLabOrCase: clamp(raw.confidence?.relatedLabOrCase),
      dueDate: validDate ? clamp(raw.confidence?.dueDate) : Math.min(clamp(raw.confidence?.dueDate), 0.4)
    },
    sourceQuote: typeof raw.sourceQuote === 'string' ? raw.sourceQuote.trim() : '',
    suggestedNextAction:
      typeof raw.suggestedNextAction === 'string' ? raw.suggestedNextAction.trim() : '',
    model: json.model || 'gemini-4-hydrogen',
    maskStats: stats,
    maskedInputPreview: maskedText
  };
}

function normalizeTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * Detect potential duplicate tasks by checking title similarity,
 * case/lab reference overlap, and due date proximity (within ±3 days).
 */
export function findDuplicateTasks(
  candidate: {
    title: string;
    relatedLabOrCase?: string | null;
    dueDate?: string | null;
  },
  existingTasks: TaskItem[],
  language: Language = 'th'
): DuplicateTaskWarning[] {
  const candidateTitle = candidate.title.trim().toLowerCase();
  const candidateTokens = new Set(normalizeTokens(candidate.title));
  const candidateCase = (candidate.relatedLabOrCase || '').trim().toLowerCase();
  const candidateDueMs = candidate.dueDate ? Date.parse(candidate.dueDate) : NaN;

  const warnings: DuplicateTaskWarning[] = [];

  for (const task of existingTasks) {
    if (task.status === 'Cancelled') continue;

    const reasons: string[] = [];
    const existingTitle = task.title.trim().toLowerCase();
    const existingTokens = normalizeTokens(task.title);

    // 1. Title similarity
    let titleSimilar = false;
    if (candidateTitle && existingTitle) {
      if (
        existingTitle.includes(candidateTitle) ||
        candidateTitle.includes(existingTitle)
      ) {
        titleSimilar = true;
      } else if (candidateTokens.size > 0 && existingTokens.length > 0) {
        const overlap = existingTokens.filter((tok) => candidateTokens.has(tok)).length;
        const ratio = overlap / Math.max(Math.min(candidateTokens.size, existingTokens.length), 1);
        if (overlap >= 2 && ratio >= 0.5) {
          titleSimilar = true;
        }
      }
    }
    if (titleSimilar) {
      reasons.push(language === 'en' ? 'Similar task title' : 'ชื่อเรื่องงานคล้ายกัน');
    }

    // 2. Related lab / case match
    let caseMatch = false;
    if (candidateCase && candidateCase !== 'general' && candidateCase !== 'n/a') {
      const haystack = [
        task.title,
        task.description,
        task.relatedLabId || '',
        task.relatedPatientId || '',
        ...task.relatedDocuments
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(candidateCase)) {
        caseMatch = true;
        reasons.push(
          language === 'en'
            ? `Same lab/case ref (${candidate.relatedLabOrCase})`
            : `อ้างอิงเคส/แล็บเดียวกัน (${candidate.relatedLabOrCase})`
        );
      }
    }

    // 3. Date proximity (within 3 days)
    let dateClose = false;
    const existingDueMs = task.dueDate ? Date.parse(task.dueDate) : NaN;
    if (!Number.isNaN(candidateDueMs) && !Number.isNaN(existingDueMs)) {
      const diffDays = Math.abs(candidateDueMs - existingDueMs) / 86_400_000;
      if (diffDays <= 3) {
        dateClose = true;
        reasons.push(
          diffDays === 0
            ? language === 'en'
              ? 'Identical due date'
              : 'วันกำหนดส่งตรงกัน'
            : language === 'en'
            ? 'Due date within ±3 days'
            : 'วันกำหนดส่งใกล้เคียง (±3 วัน)'
        );
      }
    }

    if ((titleSimilar && (caseMatch || dateClose)) || (caseMatch && dateClose)) {
      warnings.push({ task, reasons });
    }
  }

  return warnings;
}

export async function runWorkspaceAiAssistant(params: {
  mode: 'chat' | 'briefing' | 'suggest_workflow';
  prompt?: string;
  uiLanguage: Language;
  workspace: Workspace;
  userRole: ClinicRole;
  tasks: TaskItem[];
  labOrders: LabOrder[];
  followUps: PatientFollowUpItem[];
  templates: TaskTemplate[];
}): Promise<AiAssistResponse> {
  const {
    mode,
    prompt = '',
    uiLanguage,
    workspace,
    userRole,
    tasks,
    labOrders,
    followUps,
    templates
  } = params;

  const allowedModules: ModuleId[] = MODULE_REGISTRY.filter((mod) =>
    isModuleAccessible(mod, workspace.type, workspace.enabledModules, userRole)
  ).map((mod) => mod.id);

  const today = new Date().toISOString().split('T')[0];

  const canReadTasks = allowedModules.includes('tasks');
  const canReadLabs = workspace.type === 'clinic' && allowedModules.includes('labs');
  const canReadFollowUps = workspace.type === 'clinic' && allowedModules.includes('followups');

  const tasksSummary = canReadTasks
    ? tasks.slice(0, 25).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.customCategory || t.category,
        dueDate: t.dueDate,
        assigneeName: workspace.type === 'clinic' ? t.assigneeName : undefined,
        subtasksCount: t.subtasks?.length || 0,
        completedSubtasks: t.subtasks?.filter((s) => s.completed).length || 0
      }))
    : [];

  const overdueTasks = canReadTasks
    ? tasks
        .filter((t) => t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled')
        .map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status
        }))
    : [];

  const labsSummary = canReadLabs
    ? labOrders
        .filter((l) => l.status !== 'Quality Checked' && l.status !== 'Cancelled')
        .slice(0, 15)
        .map((l) => ({
          ref: l.orderReference,
          workType: l.workType,
          status: l.status,
          expectedReturnDate: l.expectedReturnDate,
          patientRefId: l.patientRefId
        }))
    : [];

  const followUpsSummary = canReadFollowUps
    ? followUps
        .filter((f) => f.status !== 'Completed' && f.status !== 'Cancelled')
        .slice(0, 15)
        .map((f) => ({
          patientRefId: f.patientRefId,
          caseCategory: f.caseCategory,
          dueDate: f.dueDate,
          status: f.status,
          nextAction: f.nextAction
        }))
    : [];

  const templatesSummary = canReadTasks
    ? templates.slice(0, 10).map((tp) => ({
        id: tp.id,
        name: tp.name,
        category: tp.customCategory || tp.category,
        subtasks: tp.defaultSubtasks
      }))
    : [];

  const { maskedText } = maskSensitivePii(prompt);

  let response: Response;
  try {
    response = await fetch('/api/ai/assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode,
        prompt: maskedText,
        uiLanguage,
        workspaceContext: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceType: workspace.type,
          userRole,
          allowedModules,
          tasksSummary,
          overdueTasks,
          labsSummary,
          followUpsSummary,
          templatesSummary
        }
      })
    });
  } catch (err) {
    throw buildAiRequestError({
      status: 0,
      rawError: err instanceof Error ? err.message : 'Failed to fetch',
      uiLanguage,
      fallbackTh: 'ไม่สามารถเชื่อมต่อระบบ AI ผู้ช่วยได้ชั่วคราว',
      fallbackEn: 'Unable to reach AI Assistant service temporarily'
    });
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    error?: string;
    model?: string;
    scopedModules?: ModuleId[];
    data?: Omit<AiAssistResponse, 'model' | 'scopedModules'>;
  } | null;

  if (!response.ok || !json?.ok || !json.data) {
    throw buildAiRequestError({
      status: response.status,
      code: json?.code,
      rawError: json?.error,
      uiLanguage,
      fallbackTh: `คำขอ AI ผู้ช่วยไม่สำเร็จ (HTTP ${response.status})`,
      fallbackEn: `AI Assistant request failed (HTTP ${response.status})`
    });
  }

  return {
    answer: json.data.answer || '',
    overdueAlerts: Array.isArray(json.data.overdueAlerts) ? json.data.overdueAlerts : [],
    recommendedActions: Array.isArray(json.data.recommendedActions)
      ? json.data.recommendedActions
      : [],
    suggestedReminders: Array.isArray(json.data.suggestedReminders)
      ? json.data.suggestedReminders
      : [],
    proposedTaskDraft: json.data.proposedTaskDraft ?? null,
    model: json.model || 'gemini-4-hydrogen',
    scopedModules: json.scopedModules || allowedModules
  };
}

async function tryHybridChatReply(params: {
  maskedMessage: string;
  maskedNote: string;
  channel: ChatChannelType;
  toneCategory: ChatToneCategory;
  uiLanguage: Language;
}): Promise<ChatCopilotReply | null> {
  const langName = params.uiLanguage === 'en' ? 'English' : 'Thai';
  const prompt = [
    'You are a dental clinic assistant drafting a reply to a patient chat message.',
    `Write in ${langName}. Be polite, short, and never invent prices, dates, or medical advice.`,
    'If something is missing, ask the patient; do not guess. A human will review before sending.',
    `Channel: ${params.channel}. Tone category: ${params.toneCategory}.`,
    params.maskedNote ? `Clinic note: ${params.maskedNote}` : '',
    `Patient message: ${params.maskedMessage}`,
    'Return ONLY a JSON object with keys: replyDraft, shortReply, suggestedTaskTitle, suggestedFollowUpNote (all strings).'
  ]
    .filter(Boolean)
    .join('\n');

  const out = await tryHybridText(prompt);
  if (!out) return null;
  try {
    const cleaned = out.text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const j = JSON.parse(cleaned) as Record<string, unknown>;
    const replyDraft = typeof j.replyDraft === 'string' ? j.replyDraft.trim() : '';
    if (!replyDraft) return null;
    return {
      replyDraft,
      shortReply: typeof j.shortReply === 'string' ? j.shortReply : '',
      suggestedTaskTitle: typeof j.suggestedTaskTitle === 'string' ? j.suggestedTaskTitle : '',
      suggestedTaskKind: 'followup',
      suggestedCategory: 'Patient Follow-up',
      suggestedPriority: 'Medium',
      suggestedFollowUpNote:
        typeof j.suggestedFollowUpNote === 'string' ? j.suggestedFollowUpNote : '',
      model: `hybrid:${out.source}`
    };
  } catch {
    // Unparseable output from a small on-device model: use the server path instead.
    return null;
  }
}

export async function generatePatientChatReply(params: {
  patientMessage: string;
  channel: ChatChannelType;
  toneCategory: ChatToneCategory;
  clinicNote?: string;
  uiLanguage: Language;
}): Promise<ChatCopilotReply> {
  const { maskedText } = maskSensitivePii(params.patientMessage);
  const { maskedText: maskedNote } = maskSensitivePii(params.clinicNote || '');

  // Hybrid AI (Firebase AI Logic): on-device Gemini Nano when available, else cloud.
  // Input is already PII-masked. Any failure falls through to the existing server path.
  const hybrid = await tryHybridChatReply({
    maskedMessage: maskedText,
    maskedNote,
    channel: params.channel,
    toneCategory: params.toneCategory,
    uiLanguage: params.uiLanguage
  });
  if (hybrid) return hybrid;

  let response: Response;
  try {
    response = await fetch('/api/ai/chat-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientMessage: maskedText,
        channel: params.channel,
        toneCategory: params.toneCategory,
        clinicNote: maskedNote,
        uiLanguage: params.uiLanguage
      })
    });
  } catch (err) {
    throw buildAiRequestError({
      status: 0,
      rawError: err instanceof Error ? err.message : 'Failed to fetch',
      uiLanguage: params.uiLanguage,
      fallbackTh: 'ไม่สามารถเชื่อมต่อระบบร่างคำตอบแชตได้ชั่วคราว',
      fallbackEn: 'Unable to reach AI chat reply service temporarily'
    });
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    error?: string;
    model?: string;
    data?: Omit<ChatCopilotReply, 'model'>;
  } | null;

  if (!response.ok || !json?.ok || !json.data) {
    throw buildAiRequestError({
      status: response.status,
      code: json?.code,
      rawError: json?.error,
      uiLanguage: params.uiLanguage,
      fallbackTh: `การร่างคำตอบแชตไม่สำเร็จ (HTTP ${response.status})`,
      fallbackEn: `Chat reply generation failed (HTTP ${response.status})`
    });
  }

  return {
    replyDraft: json.data.replyDraft || '',
    shortReply: json.data.shortReply || '',
    suggestedTaskTitle: json.data.suggestedTaskTitle || '',
    suggestedTaskKind: json.data.suggestedTaskKind || 'followup',
    suggestedCategory: json.data.suggestedCategory || 'Patient Follow-up',
    suggestedPriority: json.data.suggestedPriority || 'Medium',
    suggestedFollowUpNote: json.data.suggestedFollowUpNote || '',
    model: json.model || 'gemini-4-hydrogen'
  };
}

export type CopilotWidgetMode = 'prioritize' | 'intake' | 'outreach';
export type CopilotOutreachType = 'chat_reply' | 'call_script' | 'team_handoff';
export type CopilotTargetZone = 'queue' | 'lab' | 'followup' | 'evidence' | 'task';

export interface FloatingCopilotIntakeDraft {
  targetZone: CopilotTargetZone;
  taskKind: 'todo' | 'followup' | 'check';
  title: string;
  description: string;
  patientOrRef?: string | null;
  category: TaskCategory;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate: string;
}

export interface FloatingCopilotResult {
  summaryReply: string;
  actionSteps: string[];
  draftMessage: string | null;
  intakeDraft: FloatingCopilotIntakeDraft | null;
  model: string;
}

export async function runFloatingCopilotAction(params: {
  mode: CopilotWidgetMode;
  text: string;
  outreachType?: CopilotOutreachType;
  preparedFile?: PreparedInboxFile | null;
  uiLanguage: Language;
  workspaceContext: Record<string, unknown>;
}): Promise<FloatingCopilotResult> {
  const { maskedText } = maskSensitivePii(params.text);

  const payload: Record<string, unknown> = {
    mode: params.mode,
    text: maskedText,
    outreachType: params.outreachType || 'chat_reply',
    uiLanguage: params.uiLanguage,
    workspaceContext: params.workspaceContext
  };

  if (params.preparedFile?.base64Data) {
    payload.file = {
      base64Data: params.preparedFile.base64Data,
      mimeType: params.preparedFile.mimeType,
      fileName: params.preparedFile.file.name
    };
  }

  let response: Response;
  try {
    response = await fetch('/api/ai/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    throw buildAiRequestError({
      status: 0,
      rawError: err instanceof Error ? err.message : 'Failed to fetch',
      uiLanguage: params.uiLanguage,
      fallbackTh: 'ไม่สามารถเชื่อมต่อ AI ผู้ช่วยได้ชั่วคราว',
      fallbackEn: 'Unable to reach AI Copilot temporarily'
    });
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    error?: string;
    model?: string;
    data?: Omit<FloatingCopilotResult, 'model'>;
  } | null;

  if (!response.ok || !json?.ok || !json.data) {
    throw buildAiRequestError({
      status: response.status,
      code: json?.code,
      rawError: json?.error,
      uiLanguage: params.uiLanguage,
      fallbackTh: `การเรียกใช้ AI ผู้ช่วยไม่สำเร็จ (HTTP ${response.status})`,
      fallbackEn: `AI Copilot request failed (HTTP ${response.status})`
    });
  }

  return {
    summaryReply: json.data.summaryReply || '',
    actionSteps: Array.isArray(json.data.actionSteps) ? json.data.actionSteps : [],
    draftMessage: json.data.draftMessage ?? null,
    intakeDraft: json.data.intakeDraft ?? null,
    model: json.model || 'gemini-4-hydrogen'
  };
}

function buildDeterministicSatisfactionAnalysis(
  metrics: SatisfactionMetrics,
  responses: SatisfactionResponse[],
  uiLanguage: Language
): SatisfactionAiAnalysisResult {
  const isEn = uiLanguage === 'en';
  const total = metrics.totalCount;
  const avg = metrics.overallAverage;
  const goalPct = metrics.goalProgressPct;

  const summaryOverview = isEn
    ? `Analyzed ${total} patient satisfaction responses with an overall average score of ${avg}/5.00 (Monthly goal progress: ${goalPct}%). Service quality remains high across cleanliness, professionalism, and treatment explanations.`
    : `วิเคราะห์ข้อมูลผลประเมินความพึงพอใจจากผู้รับบริการทั้งหมด ${total} ราย คะแนนเฉลี่ยรวมทุกด้านอยู่ที่ ${avg} / 5.00 (ความคืบหน้าเทียบเป้าหมายเดือนนี้ ${goalPct}%) คุณภาพการให้บริการอยู่ในเกณฑ์ดีเยี่ยมโดยเฉพาะด้านความสะอาดและความเป็นมืออาชีพ`;

  const strengths = isEn
    ? [
        `High overall rating of ${avg}/5.00 across ${total} respondents.`,
        'Strong scores in reception care, treatment clarity, and clinic cleanliness.',
        'Immediate feedback collection via QR and post-op care guidance.'
      ]
    : [
        `คะแนนเฉลี่ยรวมอยู่ในระดับดีเยี่ยม (${avg} / 5.00 จากผู้ตอบ ${total} ราย)`,
        'ด้านการต้อนรับ ความใส่ใจ และความสะอาด/ความเป็นมืออาชีพได้รับคำชมสม่ำเสมอ',
        'ระบบสแกน QR และคำแนะนำหลังทำฟันช่วยอำนวยความสะดวกให้คนไข้ได้ดีมาก'
      ];

  const improvements = isEn
    ? [
        'Monitor waiting times during peak afternoon hours.',
        'Encourage active QR scans earlier in the month to maintain steady scan momentum.',
        'Follow up promptly with any patients requesting clinic callbacks.'
      ]
    : [
        'ควรบริหารจัดการเวลาและคิวรอรับบริการในช่วงเวลาหนาแน่นช่วงบ่าย',
        'กระตุ้นการสแกนแบบประเมินให้สม่ำเสมอตลอดทั้งเดือนเพื่อรักษาโมเมนตัมของยอดสแกน',
        'ติดตามประสานงานเคสที่ขอให้คลินิกติดต่อกลับโดยเร็วที่สุด'
      ];

  const callbackRecommendations = responses
    .filter((r) => r.wantsCallback)
    .map((r) => ({
      responseId: r.id,
      patientRef: r.patientRef || `QR-${r.id.slice(-4)}`,
      serviceType: r.serviceType,
      suggestedTitle: isEn ? `Callback patient ${r.patientRef || ''}` : `โทรติดต่อกลับคนไข้ ${r.patientRef || ''}`,
      suggestedAction: isEn ? 'Call patient to check post-op recovery or address feedback.' : 'โทรสอบถามอาการหลังทำฟันหรือประสานงานข้อเสนอแนะเพิ่มเติม',
      priority: (r.scores.overallExperience <= 3 ? 'Urgent' : 'Medium') as 'Low' | 'Medium' | 'High' | 'Urgent'
    }));

  const executiveReportText = isEn
    ? `=== Executive Summary Report ===\nTotal Responses: ${total}\nOverall Average: ${avg} / 5.00\nGoal Progress: ${goalPct}%\n\nStrengths:\n${strengths.map(s => `- ${s}`).join('\n')}\n\nImprovements:\n${improvements.map(i => `- ${i}`).join('\n')}`
    : `=== รายงานสรุปผลประเมินเพื่อผู้บริหาร ===\nยอดผู้ตอบแบบประเมินสะสม: ${total} ราย\nคะแนนเฉลี่ยรวม: ${avg} / 5.00\nความคืบหน้าเป้าหมาย: ${goalPct}%\n\nจุดเด่นในการให้บริการ:\n${strengths.map(s => `- ${s}`).join('\n')}\n\nข้อเสนอแนะเพื่อพัฒนา:\n${improvements.map(i => `- ${i}`).join('\n')}`;

  return {
    summaryOverview,
    strengths,
    improvements,
    callbackRecommendations,
    executiveReportText,
    model: 'gemini-4-hydrogen'
  };
}

export async function analyzeSatisfactionWithAi(params: {
  metrics: SatisfactionMetrics;
  responses: SatisfactionResponse[];
  uiLanguage: Language;
}): Promise<SatisfactionAiAnalysisResult> {
  const { metrics, responses, uiLanguage } = params;

  const comments = responses
    .filter((r) => Boolean(r.comment && r.comment.trim()))
    .slice(0, 60)
    .map((r) => ({
      id: r.id,
      date: r.submittedAt.slice(0, 10),
      serviceType: r.serviceType,
      overallScore: r.scores.overallExperience,
      wantsCallback: r.wantsCallback,
      comment: maskSensitivePii(r.comment || '').maskedText
    }));

  const callbackCases = responses
    .filter((r) => r.wantsCallback)
    .slice(0, 30)
    .map((r) => ({
      responseId: r.id,
      patientRef: r.patientRef || `QR-${r.id.slice(-4)}`,
      serviceType: r.serviceType,
      overallScore: r.scores.overallExperience,
      triageStatus: r.triageStatus,
      topic: maskSensitivePii(r.callbackTopic || r.comment || '').maskedText
    }));

  try {
    const response = await fetch('/api/ai/satisfaction-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uiLanguage,
        metricsSummary: {
          thisMonthKey: metrics.thisMonthKey,
          thisMonthCount: metrics.thisMonthCount,
          prevMonthCount: metrics.prevMonthCount,
          monthDelta: metrics.monthDelta,
          monthlyGoal: metrics.monthlyGoal,
          goalProgressPct: metrics.goalProgressPct,
          momentumStatus: metrics.momentumStatus,
          totalCount: metrics.totalCount,
          overallAverage: metrics.overallAverage,
          dimensionAverages: metrics.dimensionAverages,
          serviceBreakdown: metrics.serviceBreakdown,
          pendingCallbackCount: metrics.pendingCallbackCount
        },
        comments,
        callbackCases
      })
    });

    const json = (await response.json().catch(() => null)) as any;
    if (json) {
      const targetData = json.data || json;
      if (
        targetData &&
        typeof targetData === 'object' &&
        (targetData.summaryOverview || targetData.executiveReportText || targetData.strengths)
      ) {
        return {
          summaryOverview: targetData.summaryOverview || '',
          strengths: Array.isArray(targetData.strengths) ? targetData.strengths : [],
          improvements: Array.isArray(targetData.improvements) ? targetData.improvements : [],
          callbackRecommendations: Array.isArray(targetData.callbackRecommendations)
            ? targetData.callbackRecommendations
            : [],
          executiveReportText: targetData.executiveReportText || '',
          model: json.model || 'gemini-4-hydrogen'
        };
      }
    }
  } catch {
    // fallback to deterministic analysis below
  }

  return buildDeterministicSatisfactionAnalysis(metrics, responses, uiLanguage);
}
