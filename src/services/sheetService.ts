import {
  DENTURE_STATUSES,
  DentureCase,
  DentureStatus,
  SatisfactionResponse,
  SheetConfig
} from '../types/dental';
import { PROCEDURE_LABELS_TH, parseSatisfactionCsvOrTsv } from './satisfactionService';

const SHEET_CONFIG_STORAGE_KEY = 'dental_denture_sheet_config_v2';
const TEMP_CASES_STORAGE_KEY = 'clinic_real_prostho_recall_v1';
const LEGACY_TEMP_CASES_KEY = 'dental_denture_temp_cases_v2';

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
] as const;

export const THAI_MONTH_FULL_TO_INDEX: Record<string, number> = {
  'ม.ค.': 0, 'มค': 0, 'มกราคม': 0,
  'ก.พ.': 1, 'กพ': 1, 'กุมภาพันธ์': 1,
  'มี.ค.': 2, 'มีค': 2, 'มีนาคม': 2,
  'เม.ย.': 3, 'เมย': 3, 'เมษายน': 3,
  'พ.ค.': 4, 'พค': 4, 'พฤษภาคม': 4,
  'มิ.ย.': 5, 'มิย': 5, 'มิถุนายน': 5,
  'ก.ค.': 6, 'กค': 6, 'กรกฎาคม': 6,
  'ส.ค.': 7, 'สค': 7, 'สิงหาคม': 7,
  'ก.ย.': 8, 'กย': 8, 'กันยายน': 8,
  'ต.ค.': 9, 'ตค': 9, 'ตุลาคม': 9,
  'พ.ย.': 10, 'พย': 10, 'พฤศจิกายน': 10,
  'ธ.ค.': 11, 'ธค': 11, 'ธันวาคม': 11
};

// Clean baseline: no fake patient records
export const DEMO_DENTURE_CASES: DentureCase[] = [];

export function loadSheetConfig(): SheetConfig {
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        webAppUrl: parsed.webAppUrl || '',
        inventorySheetUrl: parsed.inventorySheetUrl || '',
        satisfactionSheetUrl: parsed.satisfactionSheetUrl || '',
        satisfactionFormUrl: parsed.satisfactionFormUrl || '',
        satisfactionRawTabName: parsed.satisfactionRawTabName || 'การตอบแบบฟอร์ม 1',
        token: parsed.token || '',
        operatorName: parsed.operatorName || ''
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    webAppUrl: '',
    inventorySheetUrl: '',
    satisfactionSheetUrl: '',
    satisfactionFormUrl: '',
    satisfactionRawTabName: 'การตอบแบบฟอร์ม 1',
    token: '',
    operatorName: ''
  };
}

export function saveSheetConfig(config: SheetConfig): void {
  try {
    localStorage.setItem(
      SHEET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        webAppUrl: config.webAppUrl || '',
        inventorySheetUrl: config.inventorySheetUrl || '',
        satisfactionSheetUrl: config.satisfactionSheetUrl || '',
        satisfactionFormUrl: config.satisfactionFormUrl || '',
        satisfactionRawTabName: config.satisfactionRawTabName || 'การตอบแบบฟอร์ม 1',
        token: config.token || '',
        operatorName: config.operatorName || ''
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function isDemoSheetMode(config?: SheetConfig): boolean {
  const cfg = config || loadSheetConfig();
  return !cfg.webAppUrl.trim();
}

export function loadDemoDentureCases(): DentureCase[] {
  try {
    const raw = localStorage.getItem(TEMP_CASES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    const legacy = localStorage.getItem(LEGACY_TEMP_CASES_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy)) {
        localStorage.setItem(TEMP_CASES_STORAGE_KEY, JSON.stringify(parsedLegacy));
        return parsedLegacy;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveDemoDentureCases(cases: DentureCase[]): void {
  try {
    localStorage.setItem(TEMP_CASES_STORAGE_KEY, JSON.stringify(cases));
  } catch {
    // ignore storage quota errors
  }
}

export function resetDemoDentureCases(): DentureCase[] {
  try {
    localStorage.removeItem(TEMP_CASES_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TEMP_CASES_KEY);
  } catch {
    // ignore storage errors
  }
  return [];
}

export interface FetchDentureResult {
  ok: boolean;
  isDemo: boolean;
  statuses: string[];
  rows: DentureCase[];
  error?: string;
}

export async function fetchDentureCases(config?: SheetConfig): Promise<FetchDentureResult> {
  const cfg = config || loadSheetConfig();
  // Standby mode: do not fire external sync unless URL is configured
  if (!cfg.webAppUrl.trim()) {
    return {
      ok: true,
      isDemo: false,
      statuses: [...DENTURE_STATUSES],
      rows: loadDemoDentureCases()
    };
  }

  try {
    const separator = cfg.webAppUrl.includes('?') ? '&' : '?';
    const url = `${cfg.webAppUrl.trim()}${separator}action=list&token=${encodeURIComponent(cfg.token.trim())}`;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      return {
        ok: false,
        isDemo: false,
        statuses: [...DENTURE_STATUSES],
        rows: [],
        error: `เซิร์ฟเวอร์ตอบกลับสถานะ ${response.status}`
      };
    }

    const data = await response.json();
    if (!data || !data.ok || !Array.isArray(data.rows)) {
      return {
        ok: false,
        isDemo: false,
        statuses: [...DENTURE_STATUSES],
        rows: [],
        error: data?.error || 'รูปแบบข้อมูลจาก Google Sheet ไม่ถูกต้อง'
      };
    }

    return {
      ok: true,
      isDemo: false,
      statuses: Array.isArray(data.statuses) && data.statuses.length > 0 ? data.statuses : [...DENTURE_STATUSES],
      rows: data.rows
    };
  } catch (err) {
    return {
      ok: false,
      isDemo: false,
      statuses: [...DENTURE_STATUSES],
      rows: [],
      error: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ Google Sheet ได้'
    };
  }
}

export async function testSheetConnection(config: SheetConfig): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!config.webAppUrl.trim()) {
    return { ok: false, error: 'กรุณาระบุ Web app URL ก่อนทดสอบการเชื่อมต่อ' };
  }
  const res = await fetchDentureCases(config);
  if (!res.ok) {
    return { ok: false, error: res.error || 'เชื่อมต่อไม่สำเร็จ' };
  }
  return { ok: true, count: res.rows.length };
}

export interface DentureUpdateInput {
  sheet: string;
  row: number;
  key: {
    name: string;
    hn: string;
    extractDate: string;
  };
  status?: string;
  appt?: string;
  noteAppend?: string;
  by: string;
}

export interface DentureUpdateResponse {
  ok: boolean;
  row?: number;
  status?: string;
  appt?: string;
  note?: string;
  error?: string;
}

export function formatThaiNotePrefix(date = new Date()): string {
  const day = date.getDate();
  const month = THAI_MONTHS_SHORT[date.getMonth()];
  const beShortYear = String((date.getFullYear() + 543) % 100).padStart(2, '0');
  return `[${day} ${month} ${beShortYear}]`;
}

export function appendThaiNote(existingNote: string, newText: string, date = new Date()): string {
  const trimmed = newText.trim();
  if (!trimmed) return existingNote;
  const formattedLine = `${formatThaiNotePrefix(date)} ${trimmed}`;
  if (!existingNote || !existingNote.trim()) {
    return formattedLine;
  }
  return `${existingNote.trimEnd()}\n${formattedLine}`;
}

export function formatThaiApptString(isoDate: string, apptType: string): string {
  if (!isoDate.trim()) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const yearNum = parseInt(parts[0], 10);
  const month = parts[1].padStart(2, '0');
  const day = parts[2].padStart(2, '0');
  if (Number.isNaN(yearNum)) return isoDate;
  const beYear = yearNum < 2400 ? yearNum + 543 : yearNum;
  const cleanType = apptType.trim();
  return cleanType ? `${day}-${month}-${beYear} (${cleanType})` : `${day}-${month}-${beYear}`;
}

export function parseThaiApptString(apptStr: string): { isoDate: string; apptType: string } {
  if (!apptStr || !apptStr.trim()) {
    return { isoDate: '', apptType: 'ตรวจฟันปลอม' };
  }
  const match = apptStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s*\(([^)]+)\))?/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const yearNum = parseInt(match[3], 10);
    const adYear = yearNum > 2400 ? yearNum - 543 : yearNum;
    const apptType = match[4] ? match[4].trim() : 'ตรวจฟันปลอม';
    return {
      isoDate: `${adYear}-${month}-${day}`,
      apptType
    };
  }
  return { isoDate: '', apptType: 'ตรวจฟันปลอม' };
}

export function maskPhoneNumber(phone: string): string {
  if (!phone || !phone.trim()) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 9) {
    const prefix = digits.slice(0, 3);
    const suffix = digits.slice(-4);
    return `${prefix}-xxx-${suffix}`;
  }
  if (phone.length > 4) {
    return `${phone.slice(0, 3)}-xxx-${phone.slice(-2)}`;
  }
  return 'xxx-xxxx';
}

export function getUrgencyRank(group: string): number {
  if (group.includes('เร่งด่วนมาก')) return 0;
  if (group.includes('ศักยภาพสูง')) return 1;
  if (group.includes('ศักยภาพปานกลาง')) return 2;
  return 3;
}

export function isReadyToCallCase(c: DentureCase): boolean {
  if (c.status !== 'ยังไม่ได้โทร') return false;
  return (
    c.group.includes('เร่งด่วนมาก') ||
    c.group.includes('ศักยภาพสูง') ||
    c.group.includes('ศักยภาพปานกลาง')
  );
}

export function extractMonthLabel(caseItem: DentureCase): string {
  if (caseItem.sheet && caseItem.sheet.trim()) {
    return caseItem.sheet.trim();
  }
  const match = caseItem.extractDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const mIdx = parseInt(match[2], 10) - 1;
    const yr = match[3].slice(-2);
    if (mIdx >= 0 && mIdx < 12) {
      return `${THAI_MONTHS_SHORT[mIdx]} ${yr}`;
    }
  }
  return 'ไม่ระบุเดือน';
}

export async function updateDentureCase(
  payload: DentureUpdateInput,
  config?: SheetConfig,
  options?: { simulateError?: boolean }
): Promise<DentureUpdateResponse> {
  const cfg = config || loadSheetConfig();

  // Validate status against the exact 12 allowed strings if status is provided
  if (payload.status !== undefined && !(DENTURE_STATUSES as readonly string[]).includes(payload.status)) {
    return {
      ok: false,
      error: `สถานะ "${payload.status}" ไม่อยู่ในรายการ 12 สถานะที่ระบบรองรับ`
    };
  }

  // Browser-local standby persistence (when external sheet URL is not connected)
  if (!cfg.webAppUrl.trim()) {
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'จำลองข้อผิดพลาด: ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง'
      };
    }

    // Per-workspace storage in WorkspaceContext owns standby denture cases; confirm payload cleanly
    return {
      ok: true,
      row: payload.row,
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.appt !== undefined ? { appt: payload.appt } : {})
    };
  }

  // Live Google Apps Script POST call
  // Strict API Contract: header Content-Type: text/plain;charset=utf-8 ONLY (no other headers), redirect: 'follow'
  try {
    const body = {
      token: cfg.token.trim(),
      sheet: payload.sheet,
      row: payload.row,
      key: payload.key,
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.appt !== undefined ? { appt: payload.appt } : {}),
      ...(payload.noteAppend ? { noteAppend: payload.noteAppend } : {}),
      by: payload.by || cfg.operatorName || 'ผู้ช่วยทันตแพทย์'
    };

    const response = await fetch(cfg.webAppUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      redirect: 'follow',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Google Sheet ตอบกลับผิดพลาด (HTTP ${response.status})`
      };
    }

    const data = (await response.json()) as DentureUpdateResponse;
    if (!data || !data.ok) {
      return {
        ok: false,
        error: data?.error || 'Google Sheet ปฏิเสธการบันทึกข้อมูล'
      };
    }

    return data;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet'
    };
  }
}

export interface ParsedCommandResult {
  ok: boolean;
  query: string;
  matchedCases: DentureCase[];
  targetCase: DentureCase | null;
  status?: DentureStatus;
  appt?: string;
  noteAppend?: string;
  error?: string;
}

const EN_MONTH_TO_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const THAI_ROMAN_CHAR_MAP: Record<string, string> = {
  ก: 'k', ข: 'k', ฃ: 'k', ค: 'k', ฅ: 'k', ฆ: 'k',
  ง: 'ng',
  จ: 'ch', ฉ: 'ch', ช: 'ch', ฌ: 'ch',
  ซ: 's', ศ: 's', ษ: 's', ส: 's',
  ญ: 'y', ย: 'y',
  ฎ: 'd', ด: 'd',
  ฏ: 't', ต: 't', ถ: 't', ท: 't', ธ: 't', ฐ: 't', ฑ: 't', ฒ: 't',
  ณ: 'n', น: 'n',
  บ: 'b',
  ป: 'p', ผ: 'p', ฝ: 'f', พ: 'p', ฟ: 'f', ภ: 'p',
  ม: 'm',
  ร: 'r', ล: 'l', ฬ: 'l',
  ว: 'w',
  ห: 'h', ฮ: 'h',
  อ: '',
  'ะ': 'a', 'ั': 'a', 'า': 'a', 'ำ': 'am',
  'ิ': 'i', 'ี': 'i', 'ึ': 'ue', 'ื': 'ue',
  'ุ': 'u', 'ู': 'u',
  'เ': 'e', 'แ': 'ae', 'โ': 'o', 'ใ': 'ai', 'ไ': 'ai'
};

function romanizeThaiSkeleton(input: string): string {
  // Reorder leading vowels เ แ โ ใ ไ only lightly by stripping vowels for consonant+core matching
  let out = '';
  for (const ch of input.toLowerCase()) {
    if (ch in THAI_ROMAN_CHAR_MAP) {
      out += THAI_ROMAN_CHAR_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

function normalizeLatinForSkeleton(input: string): string {
  return input
    .toLowerCase()
    .replace(/ph/g, 'p')
    .replace(/th/g, 't')
    .replace(/kh/g, 'k')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/y$/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

function stripVowels(str: string): string {
  return str.replace(/[aeiou]/g, '');
}

export function matchesPatientQuery(c: DentureCase, query: string): boolean {
  const qLower = query.trim().toLowerCase();
  if (!qLower) return false;

  if (
    c.name.toLowerCase().includes(qLower) ||
    c.hn.toLowerCase() === qLower ||
    c.hn.toLowerCase().includes(qLower)
  ) {
    return true;
  }

  // Bilingual fallback: allow English query (e.g., "Somchai", "Wilai") to match Thai names
  if (/^[a-z0-9\s-]+$/i.test(qLower) && qLower.length >= 3) {
    const qLatin = normalizeLatinForSkeleton(qLower);
    const qConsonants = stripVowels(qLatin);
    const nameParts = c.name.split(/\s+/);
    for (const part of nameParts) {
      const partRoman = romanizeThaiSkeleton(part);
      const partConsonants = stripVowels(partRoman);
      if (partRoman.includes(qLatin) || (qConsonants.length >= 3 && partConsonants.includes(qConsonants))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Pure rule-based Thai & English quick command parser.
 * Never calls Gemini or external AI; never sends patient name, phone, or HN externally.
 * Always produces canonical Thai status strings and Thai BE appointment format for Google Sheet writes.
 */
export function parseThaiQuickCommand(
  commandText: string,
  cases: DentureCase[],
  language: 'th' | 'en' = 'th'
): ParsedCommandResult {
  const raw = commandText.trim();
  if (!raw) {
    return {
      ok: false,
      query: '',
      matchedCases: [],
      targetCase: null,
      error: language === 'en' ? 'Please enter a command.' : 'กรุณาพิมพ์คำสั่งภาษาไทยหรืออังกฤษ'
    };
  }

  let working = raw;
  let noteAppend: string | undefined;

  // 1. Extract verbatim note after บันทึก: / โน้ต: / หมายเหตุ: / note: / memo: (never auto-translate!)
  const noteMatch = working.match(/(?:บันทึก|โน้ต|หมายเหตุ|note|memo)\s*[:：]\s*(.+)$/i);
  if (noteMatch) {
    noteAppend = noteMatch[1].trim();
    working = working.slice(0, noteMatch.index).trim();
  }

  // 2. Extract canonical Thai status (supports Thai AND English commands)
  let detectedStatus: DentureStatus | undefined;

  // Exact Thai status names first
  for (const s of DENTURE_STATUSES) {
    if (working.includes(s)) {
      detectedStatus = s;
      working = working.replace(s, ' ').trim();
      break;
    }
  }

  const statusKeywords: Array<{ pattern: RegExp; status: DentureStatus }> = [
    // Thai shorthand
    { pattern: /สถานะ\s*[:：]\s*ยังไม่ได้โทร/i, status: 'ยังไม่ได้โทร' },
    { pattern: /ติดต่อไม่ได้|ไม่รับสาย/i, status: 'ติดต่อไม่ได้ / ไม่รับสาย' },
    { pattern: /รอตัดสินใจ|ขอคิดดูก่อน/i, status: 'สนใจ / รอตัดสินใจ' },
    { pattern: /ไม่สะดวก|ปฏิเสธ/i, status: 'ไม่สะดวก / ปฏิเสธ' },
    { pattern: /พิมพ์ปากแล้ว|รอใส่ชิ้นงาน/i, status: 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)' },
    { pattern: /ใส่ฟันปลอมเสร็จ|ใส่เสร็จเรียบร้อย|ใส่ฟันเสร็จ/i, status: 'ใส่ฟันปลอมเสร็จเรียบร้อย' },
    { pattern: /ถอนเพื่อจัดฟัน|จัดฟัน/i, status: 'ถอนเพื่อจัดฟัน' },
    { pattern: /รากเทียม/i, status: 'เคลียร์ช่องปากทำรากเทียม' },
    { pattern: /ครอบฟัน|สะพานฟัน/i, status: 'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน' },
    { pattern: /ฟันคุด/i, status: 'ถอน/ผ่าฟันคุด' },
    { pattern: /ไม่ต้องติดตาม/i, status: 'ไม่ต้องติดตาม' },

    // English shorthand -> mapped strictly to canonical Thai statuses
    { pattern: /\b(?:not called|pending call)\b/i, status: 'ยังไม่ได้โทร' },
    { pattern: /\b(?:no answer|unreachable|did not answer|no reply|voicemail)\b/i, status: 'ติดต่อไม่ได้ / ไม่รับสาย' },
    { pattern: /\b(?:deciding|thinking about it|wait to decide|considering)\b/i, status: 'สนใจ / รอตัดสินใจ' },
    { pattern: /\b(?:declined|not interested|unavailable|refused)\b/i, status: 'ไม่สะดวก / ปฏิเสธ' },
    { pattern: /\b(?:impression taken|awaiting delivery)\b/i, status: 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)' },
    { pattern: /\b(?:denture delivered|completed|finished denture|delivered)\b/i, status: 'ใส่ฟันปลอมเสร็จเรียบร้อย' },
    { pattern: /\b(?:orthodontic|ortho|braces)\b/i, status: 'ถอนเพื่อจัดฟัน' },
    { pattern: /\b(?:implant)\b/i, status: 'เคลียร์ช่องปากทำรากเทียม' },
    { pattern: /\b(?:crown|bridge)\b/i, status: 'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน' },
    { pattern: /\b(?:wisdom tooth|wisdom|impaction)\b/i, status: 'ถอน/ผ่าฟันคุด' },
    { pattern: /\b(?:no follow[- ]?up|do not follow)\b/i, status: 'ไม่ต้องติดตาม' }
  ];

  if (!detectedStatus) {
    for (const rule of statusKeywords) {
      const m = working.match(rule.pattern);
      if (m) {
        detectedStatus = rule.status;
        working = working.replace(rule.pattern, ' ').trim();
        break;
      }
    }
  }

  // 3. Extract appointment in Thai OR English -> always saved in Thai BE format "dd-mm-YYYY (ประเภทนัดไทย)"
  let detectedAppt: string | undefined;
  const thMonthPattern =
    'ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม';
  const enMonthPattern =
    'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec';

  const apptActionPattern =
    '(?:นัด(?:ตรวจฟันปลอม|ตรวจ|พิมพ์ปาก|ใส่ฟันปลอม|ใส่ฟัน|ใส่|ปรึกษา|ติดตาม)?|(?:?:book|schedule|appt|appointment)\\s+(?:for\\s+)?(?:denture\\s+check(?:up)?|check(?:up)?|impression|denture\\s+delivery|delivery|consult(?:ation)?|follow[- ]?up)|(?:denture\\s+check(?:up)?|impression|denture\\s+delivery|consult(?:ation)?|follow[- ]?up|book|schedule|appt))';

  const apptRegex = new RegExp(
    `(${apptActionPattern})\\s+(?:on\\s+)?(\\d{1,2})\\s*(?:[-/]\\s*(\\d{1,2})(?:\\s*[-/]\\s*(\\d{2,4}))?|(${thMonthPattern}|${enMonthPattern})(?:\\s+(\\d{2,4}))?)`,
    'i'
  );

  const apptMatch = working.match(apptRegex);
  if (apptMatch) {
    const apptKeyword = apptMatch[1].toLowerCase();
    const dayNum = parseInt(apptMatch[2], 10);
    let monthIdx = -1;
    let yearBe = new Date().getFullYear() + 543;

    if (apptMatch[3]) {
      monthIdx = parseInt(apptMatch[3], 10) - 1;
      if (apptMatch[4]) {
        const yRaw = parseInt(apptMatch[4], 10);
        yearBe = yRaw < 100 ? (yRaw >= 60 ? 2500 + yRaw : 2000 + yRaw + 543) : yRaw < 2400 ? yRaw + 543 : yRaw;
      }
    } else if (apptMatch[5]) {
      const mText = apptMatch[5].replace(/\s+/g, '').toLowerCase();
      if (mText in EN_MONTH_TO_INDEX) {
        monthIdx = EN_MONTH_TO_INDEX[mText];
      } else {
        const normalizedMonth = Object.keys(THAI_MONTH_FULL_TO_INDEX).find(
          (k) => k === mText || k.replace(/\./g, '') === mText.replace(/\./g, '')
        );
        if (normalizedMonth) {
          monthIdx = THAI_MONTH_FULL_TO_INDEX[normalizedMonth];
        }
      }
      if (apptMatch[6]) {
        const yRaw = parseInt(apptMatch[6], 10);
        yearBe = yRaw < 100 ? (yRaw >= 60 ? 2500 + yRaw : 2000 + yRaw + 543) : yRaw < 2400 ? yRaw + 543 : yRaw;
      }
    }

    if (dayNum >= 1 && dayNum <= 31 && monthIdx >= 0 && monthIdx <= 11) {
      const dd = String(dayNum).padStart(2, '0');
      const mm = String(monthIdx + 1).padStart(2, '0');
      let apptType = 'ตรวจฟันปลอม';
      if (apptKeyword.includes('พิมพ์ปาก') || apptKeyword.includes('impression')) {
        apptType = 'พิมพ์ปาก';
      } else if (apptKeyword.includes('ใส่') || apptKeyword.includes('delivery')) {
        apptType = 'ใส่ฟันปลอม';
      } else if (apptKeyword.includes('ปรึกษา') || apptKeyword.includes('consult')) {
        apptType = 'ปรึกษาฟันปลอม';
      } else if (apptKeyword.includes('ติดตาม') || apptKeyword.includes('follow')) {
        apptType = 'ติดตามอาการ';
      }

      detectedAppt = `${dd}-${mm}-${yearBe} (${apptType})`;
      if (!detectedStatus) {
        detectedStatus = 'สนใจ / นัดหมายตรวจแล้ว';
      }
      working = working.replace(apptMatch[0], ' ').trim();
    }
  }

  // Clean leftover connectors
  const patientQuery = working.replace(/(?:สถานะ|status)\s*[:：]?/gi, '').trim();
  if (!patientQuery) {
    return {
      ok: false,
      query: '',
      matchedCases: [],
      targetCase: null,
      status: detectedStatus,
      appt: detectedAppt,
      noteAppend,
      error:
        language === 'en'
          ? 'No patient name or HN found. Start the command with the patient name or HN.'
          : 'ไม่พบชื่อคนไข้หรือ HN ในคำสั่ง กรุณาระบุชื่อหรือ HN นำหน้าคำสั่ง'
    };
  }

  const matched = cases.filter((c) => matchesPatientQuery(c, patientQuery));

  if (matched.length === 0) {
    return {
      ok: false,
      query: patientQuery,
      matchedCases: [],
      targetCase: null,
      status: detectedStatus,
      appt: detectedAppt,
      noteAppend,
      error:
        language === 'en'
          ? `No case found matching "${patientQuery}".`
          : `ไม่พบเคสที่ตรงกับ "${patientQuery}"`
    };
  }

  if (matched.length > 1) {
    return {
      ok: false,
      query: patientQuery,
      matchedCases: matched,
      targetCase: null,
      status: detectedStatus,
      appt: detectedAppt,
      noteAppend,
      error:
        language === 'en'
          ? `Found ${matched.length} matching cases for "${patientQuery}" (${matched.map((m) => `${m.name} ${m.hn}`).join(', ')}). Specify full name or HN.`
          : `พบ ${matched.length} เคสที่ตรงกับ "${patientQuery}" (${matched.map((m) => `${m.name} ${m.hn}`).join(', ')}) กรุณาระบุชื่อเต็มหรือ HN ให้ชัดเจน`
    };
  }

  if (!detectedStatus && !detectedAppt && !noteAppend) {
    return {
      ok: false,
      query: patientQuery,
      matchedCases: matched,
      targetCase: matched[0],
      error:
        language === 'en'
          ? 'No status, appointment, or note found (e.g., "[Patient Name] book denture check 25 Dec" or "[HN] no answer").'
          : 'ไม่พบคำสั่งสถานะ วันนัด หรือบันทึก (เช่น "[ชื่อคนไข้] นัดตรวจ 25 ธ.ค. บันทึก: แจ้งราคาแล้ว")'
    };
  }

  return {
    ok: true,
    query: patientQuery,
    matchedCases: matched,
    targetCase: matched[0],
    status: detectedStatus,
    appt: detectedAppt,
    noteAppend
  };
}

export const parseQuickCommand = parseThaiQuickCommand;

const PROTECTED_SUMMARY_TAB_PATTERN =
  /dashboard|summary|overview|report|chart|ภาพรวม|สรุป|แดชบอร์ด|กราฟ/i;

export function validateRawSatisfactionTabName(tabName: string): { ok: boolean; error?: string } {
  const clean = (tabName || '').trim();
  if (!clean) {
    return { ok: false, error: 'กรุณาระบุชื่อแท็บข้อมูลแบบประเมิน (เช่น การตอบแบบฟอร์ม 1)' };
  }
  if (PROTECTED_SUMMARY_TAB_PATTERN.test(clean)) {
    return {
      ok: false,
      error: `ไม่อนุญาตให้เข้าถึงหรือแก้ไขแท็บ "${clean}" เนื่องจากอาจมีสูตร/กราฟ Dashboard อยู่ — ระบบอ่านเฉพาะแท็บคำตอบดิบ (เช่น การตอบแบบฟอร์ม 1) แบบ Read-Only เท่านั้น`
    };
  }
  return { ok: true };
}

/**
 * Strict Read-Only Protection:
 * Satisfaction sheet integration operates in Read-Only mode so the original project submission
 * Google Sheet (tabs, formulas, charts) is NEVER modified or overwritten.
 */
export async function appendSatisfactionRowsToRawSheet(
  _rows: SatisfactionResponse[],
  _config?: SheetConfig,
  rawTabName = 'การตอบแบบฟอร์ม 1'
): Promise<{
  ok: boolean;
  standby: boolean;
  appendedCount: number;
  tabName: string;
  error?: string;
}> {
  return {
    ok: false,
    standby: true,
    appendedCount: 0,
    tabName: rawTabName.trim() || 'การตอบแบบฟอร์ม 1',
    error:
      'โหมดอ่านอย่างเดียว (Read-Only): ระบบล็อกการเขียน/แก้ไขไฟล์ชีตต้นฉบับโดยอัตโนมัติ เพื่อปกป้องข้อมูล สูตร และกราฟในไฟล์ส่งงานของคุณ'
  };
}

export async function fetchSatisfactionFromSheet(
  config?: SheetConfig,
  rawTabName = 'การตอบแบบฟอร์ม 1',
  uiLanguage: 'th' | 'en' = 'th'
): Promise<{
  ok: boolean;
  standby: boolean;
  accessDenied?: boolean;
  tabNotFound?: boolean;
  rows: SatisfactionResponse[];
  tabName: string;
  error?: string;
}> {
  const targetTab = (rawTabName || '').trim() || 'การตอบแบบฟอร์ม 1';
  const tabCheck = validateRawSatisfactionTabName(targetTab);
  if (!tabCheck.ok) {
    return {
      ok: false,
      standby: true,
      rows: [],
      tabName: targetTab,
      error: tabCheck.error
    };
  }

  const cfg = config || loadSheetConfig();
  const sheetUrl = (cfg.satisfactionSheetUrl || '').trim();
  if (!sheetUrl) {
    return {
      ok: true,
      standby: true,
      rows: [],
      tabName: targetTab
    };
  }

  try {
    const response = await fetch('/api/sheets/satisfaction-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetUrl,
        tabName: targetTab,
        token: (cfg.token || '').trim(),
        uiLanguage
      })
    });

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      format?: 'csv' | 'rows';
      tabName?: string;
      csvText?: string;
      rows?: unknown[];
      error?: string;
    } | null;

    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        standby: false,
        accessDenied: response.status === 403 || data?.code === 'SHEET_ACCESS_DENIED',
        tabNotFound: response.status === 404 || data?.code === 'SHEET_TAB_NOT_FOUND',
        rows: [],
        tabName: targetTab,
        error:
          data?.error ||
          (uiLanguage === 'en'
            ? `Failed to read sheet (HTTP ${response.status}).`
            : `ไม่สามารถอ่านข้อมูลจากชีตได้ (HTTP ${response.status})`)
      };
    }

    if (data.format === 'csv' && typeof data.csvText === 'string') {
      const parsed = parseSatisfactionCsvOrTsv(data.csvText);
      return {
        ok: true,
        standby: false,
        rows: parsed,
        tabName: data.tabName || targetTab
      };
    }

    if (Array.isArray(data.rows)) {
      const tsv = data.rows
        .map((r) =>
          Array.isArray(r)
            ? r.map((cell) => String(cell ?? '').replace(/\t|\r?\n/g, ' ')).join('\t')
            : ''
        )
        .filter(Boolean)
        .join('\n');
      const parsed = parseSatisfactionCsvOrTsv(tsv);
      return {
        ok: true,
        standby: false,
        rows: parsed,
        tabName: data.tabName || targetTab
      };
    }

    return {
      ok: true,
      standby: false,
      rows: [],
      tabName: targetTab
    };
  } catch (err) {
    return {
      ok: false,
      standby: false,
      rows: [],
      tabName: targetTab,
      error:
        err instanceof Error
          ? err.message
          : uiLanguage === 'en'
          ? 'Could not reach the read-only sheet proxy.'
          : 'ไม่สามารถเชื่อมต่อระบบอ่านข้อมูลชีตได้'
    };
  }
}
