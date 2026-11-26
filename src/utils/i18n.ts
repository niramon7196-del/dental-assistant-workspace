import {
  DENTURE_STATUSES,
  DentureStatus,
  EvidenceItem,
  InboxItem,
  InboxSourceType,
  LabStatus,
  LabWorkType,
  PatientFollowUpItem,
  TaskCategory,
  TaskPriority,
  TaskStatus
} from '../types/dental';
import { th, type TranslationDict, type TranslationKey } from '../locales/th';
import { en } from '../locales/en';

export const locales = {
  th,
  en
} as const;

export type Language = keyof typeof locales;
export const DEFAULT_LANGUAGE: Language = 'th';
export const SUPPORTED_LANGUAGES: readonly Language[] = ['th', 'en'];

export const LOCALE_CONFIG: Record<
  Language,
  {
    htmlLang: string;
    intlLocale: string;
    useBuddhistEra: boolean;
  }
> = {
  th: {
    htmlLang: 'th',
    intlLocale: 'th-TH',
    useBuddhistEra: true
  },
  en: {
    htmlLang: 'en',
    intlLocale: 'en-US',
    useBuddhistEra: false
  }
};

// Re-export unified dictionary table for backward compatibility and future language additions
export const translations: Record<Language, TranslationDict> = locales;
export type { TranslationDict, TranslationKey };

export const DENTURE_STATUS_LABELS: Record<DentureStatus, Record<Language, string>> = {
  'ยังไม่ได้โทร': { th: 'ยังไม่ได้โทร', en: 'Not Called Yet' },
  'สนใจ / นัดหมายตรวจแล้ว': { th: 'สนใจ / นัดหมายตรวจแล้ว', en: 'Interested / Appointment Scheduled' },
  'สนใจ / รอตัดสินใจ': { th: 'สนใจ / รอตัดสินใจ', en: 'Interested / Deciding' },
  'ไม่สะดวก / ปฏิเสธ': { th: 'ไม่สะดวก / ปฏิเสธ', en: 'Unavailable / Declined' },
  'ติดต่อไม่ได้ / ไม่รับสาย': { th: 'ติดต่อไม่ได้ / ไม่รับสาย', en: 'Unreachable / No Answer' },
  'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)': { th: 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)', en: 'Impression Taken (Awaiting Delivery)' },
  'ใส่ฟันปลอมเสร็จเรียบร้อย': { th: 'ใส่ฟันปลอมเสร็จเรียบร้อย', en: 'Denture Delivered / Completed' },
  'ถอนเพื่อจัดฟัน': { th: 'ถอนเพื่อจัดฟัน', en: 'Extracted for Orthodontics' },
  'เคลียร์ช่องปากทำรากเทียม': { th: 'เคลียร์ช่องปากทำรากเทียม', en: 'Mouth Prep for Implant' },
  'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน': { th: 'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน', en: 'Mouth Prep for Crown / Bridge' },
  'ถอน/ผ่าฟันคุด': { th: 'ถอน/ผ่าฟันคุด', en: 'Wisdom Tooth Extraction' },
  'ไม่ต้องติดตาม': { th: 'ไม่ต้องติดตาม', en: 'No Follow-up Needed' }
};

export function getDentureStatusDisplay(status: string, language: Language): string {
  if ((DENTURE_STATUSES as readonly string[]).includes(status)) {
    return DENTURE_STATUS_LABELS[status as DentureStatus][language] || status;
  }
  return status;
}

export const DENTURE_APPT_TYPE_EN_MAP: Record<string, string> = {
  'ตรวจฟันปลอม': 'Denture Checkup',
  'พิมพ์ปาก': 'Impression',
  'ใส่ฟันปลอม': 'Denture Delivery',
  'ปรึกษาฟันปลอม': 'Denture Consultation',
  'ติดตามอาการ': 'Follow-up Check',
  'ติดตามหลังใส่ฟัน': 'Post-Delivery Check',
  'ประเมินกระดูก': 'Bone Evaluation',
  'กรอฟันทำสะพาน': 'Bridge Tooth Prep'
};

export function getApptTypeDisplay(thaiType: string, language: Language): string {
  if (language === 'th') return thaiType;
  return DENTURE_APPT_TYPE_EN_MAP[thaiType] || thaiType;
}

export function formatDentureApptDisplay(apptStr: string, language: Language): string {
  if (!apptStr || !apptStr.trim()) return '';
  if (language === 'th') return apptStr;

  const match = apptStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s*\(([^)]+)\))?/);
  if (!match) return apptStr;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const yearNum = parseInt(match[3], 10);
  const adYear = yearNum > 2400 ? yearNum - 543 : yearNum;
  const rawType = match[4] ? match[4].trim() : '';
  const enType = rawType ? getApptTypeDisplay(rawType, 'en') : '';

  return enType ? `${day}-${month}-${adYear} (${enType})` : `${day}-${month}-${adYear}`;
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, Record<Language, string>> = {
  'Lab Coordination': { th: 'ประสานงานแล็บ', en: 'Lab Coordination' },
  'Patient Follow-up': { th: 'ติดตามผู้ป่วย', en: 'Patient Follow-up' },
  'Sterilization & Prep': { th: 'ฆ่าเชื้อและเตรียมอุปกรณ์', en: 'Sterilization & Prep' },
  'Dentist Instruction': { th: 'คำสั่งทันตแพทย์', en: 'Dentist Instruction' },
  'Inventory & Supplies': { th: 'วัสดุและคลังอุปกรณ์', en: 'Inventory & Supplies' },
  'Record Keeping': { th: 'บันทึกเอกสาร', en: 'Record Keeping' },
  'Other': { th: 'อื่นๆ', en: 'Other' }
};

export function translateCategory(category: TaskCategory, language: Language): string {
  return TASK_CATEGORY_LABELS[category]?.[language] || category;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, Record<Language, string>> = {
  'New': { th: 'งานใหม่', en: 'New' },
  'Awaiting Review': { th: 'รอตรวจสอบ', en: 'Awaiting review' },
  'Accepted': { th: 'ผู้ช่วยยืนยันรับงานแล้ว', en: 'Accepted by assistant' },
  'In Progress': { th: 'กำลังดำเนินการ', en: 'In progress' },
  'Waiting': { th: 'รอข้อมูลหรือรอหมอตัดสินใจ', en: 'Waiting for info or dentist' },
  'Completed': { th: 'เสร็จแล้ว', en: 'Completed' },
  'Cancelled': { th: 'ยกเลิก', en: 'Cancelled' }
};

export function translateTaskStatus(status: TaskStatus, language: Language): string {
  return TASK_STATUS_LABELS[status]?.[language] || status;
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, Record<Language, string>> = {
  'Low': { th: 'ต่ำ', en: 'Low' },
  'Medium': { th: 'ปานกลาง', en: 'Medium' },
  'High': { th: 'สูง', en: 'High' },
  'Urgent': { th: 'เร่งด่วน', en: 'Urgent' }
};

export function translateTaskPriority(priority: TaskPriority, language: Language): string {
  return TASK_PRIORITY_LABELS[priority]?.[language] || priority;
}

export const LAB_WORK_TYPE_LABELS: Record<LabWorkType, Record<Language, string>> = {
  'Denture': { th: 'ฟันปลอม', en: 'Denture' },
  'Crown': { th: 'ครอบฟัน', en: 'Crown' },
  'Retainer': { th: 'รีเทนเนอร์', en: 'Retainer' },
  'Surgical Guide': { th: 'ไกด์ผ่าตัด', en: 'Surgical Guide' },
  'Other': { th: 'อื่นๆ', en: 'Other' }
};

export function translateLabWorkType(workType: LabWorkType, language: Language): string {
  return LAB_WORK_TYPE_LABELS[workType]?.[language] || workType;
}

export const LAB_STATUS_LABELS: Record<LabStatus, Record<Language, string>> = {
  'Ordered': { th: 'สั่งทำแล้ว', en: 'Ordered' },
  'In Fabrication': { th: 'กำลังผลิต', en: 'In Fabrication' },
  'Shipped': { th: 'กำลังจัดส่ง', en: 'Shipped' },
  'Delivered': { th: 'รับชิ้นงานแล้ว', en: 'Delivered' },
  'Quality Checked': { th: 'ตรวจคุณภาพแล้ว', en: 'Quality Checked' },
  'Issue / Remake': { th: 'มีปัญหา / ส่งแก้ไข', en: 'Issue / Remake' },
  'Cancelled': { th: 'ยกเลิก', en: 'Cancelled' }
};

export function translateLabStatus(status: LabStatus, language: Language): string {
  return LAB_STATUS_LABELS[status]?.[language] || status;
}

export const FOLLOWUP_STATUS_LABELS: Record<
  PatientFollowUpItem['status'],
  Record<Language, string>
> = {
  'Pending': { th: 'รอดำเนินการ', en: 'Pending' },
  'Contacted': { th: 'ติดต่อแล้ว', en: 'Contacted' },
  'Scheduled': { th: 'นัดหมายแล้ว', en: 'Scheduled' },
  'Completed': { th: 'เสร็จแล้ว', en: 'Completed' },
  'Cancelled': { th: 'ยกเลิก', en: 'Cancelled' }
};

export function translateFollowUpStatus(
  status: PatientFollowUpItem['status'],
  language: Language
): string {
  return FOLLOWUP_STATUS_LABELS[status]?.[language] || status;
}

export const INBOX_SOURCE_TYPE_LABELS: Record<InboxSourceType, Record<Language, string>> = {
  'pasted_text': { th: 'ข้อความ', en: 'Text Note' },
  'uploaded_image': { th: 'รูปภาพ', en: 'Image' },
  'uploaded_pdf': { th: 'ไฟล์ PDF', en: 'PDF Document' },
  'uploaded_excel': { th: 'ไฟล์ Excel / CSV', en: 'Excel / CSV' }
};

export function translateInboxSourceType(
  sourceType: InboxSourceType,
  language: Language
): string {
  return INBOX_SOURCE_TYPE_LABELS[sourceType]?.[language] || sourceType;
}

export const INBOX_STATUS_LABELS: Record<InboxItem['status'], Record<Language, string>> = {
  'Unprocessed': { th: 'ยังไม่ประมวลผล', en: 'Unprocessed' },
  'Reviewed': { th: 'ตรวจสอบแล้ว', en: 'Reviewed' },
  'Converted to Task': { th: 'สร้างเป็นงานแล้ว', en: 'Converted to Task' },
  'Archived': { th: 'เก็บถาวร', en: 'Archived' }
};

export function translateInboxStatus(status: InboxItem['status'], language: Language): string {
  return INBOX_STATUS_LABELS[status]?.[language] || status;
}

export const EVIDENCE_FILE_TYPE_LABELS: Record<
  EvidenceItem['fileType'],
  Record<Language, string>
> = {
  'image': { th: 'รูปภาพ', en: 'Image' },
  'pdf': { th: 'เอกสาร PDF', en: 'PDF' },
  'spreadsheet': { th: 'ตารางคำนวณ', en: 'Spreadsheet' },
  'document': { th: 'เอกสาร', en: 'Document' },
  'other': { th: 'ไฟล์อื่นๆ', en: 'Other' }
};

export function translateEvidenceFileType(
  fileType: EvidenceItem['fileType'],
  language: Language
): string {
  return EVIDENCE_FILE_TYPE_LABELS[fileType]?.[language] || fileType;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.'
];

const EN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

export function formatNumberByLanguage(value: number, language: Language): string {
  if (!Number.isFinite(value)) return String(value);
  return new Intl.NumberFormat(LOCALE_CONFIG[language].intlLocale).format(value);
}

/**
 * Formats ISO dates (`YYYY-MM-DD`, `YYYY-MM-DD HH:mm[:ss]`), `Date`, or `dd-mm-YYYY`
 * strings according to the active UI language (`th` -> Buddhist Era พ.ศ., `en` -> CE ค.ศ.).
 */
export function formatDateByLanguage(
  input: string | Date | undefined | null,
  language: Language
): string {
  if (!input) return '';

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    const day = input.getDate();
    const month = input.getMonth();
    const year = input.getFullYear();
    return language === 'th'
      ? `${day} ${THAI_MONTHS_SHORT[month]} ${year + 543}`
      : `${day} ${EN_MONTHS_SHORT[month]} ${year}`;
  }

  const trimmed = input.trim();
  if (!trimmed) return '';

  // ISO date or datetime: YYYY-MM-DD or YYYY-MM-DD HH:mm[:ss]
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?$/);
  if (isoMatch) {
    const rawYear = parseInt(isoMatch[1], 10);
    const adYear = rawYear > 2400 ? rawYear - 543 : rawYear;
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const timePart = isoMatch[4] ? ` ${isoMatch[4].slice(0, 5)}` : '';
    if (monthIdx >= 0 && monthIdx < 12) {
      return language === 'th'
        ? `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${adYear + 543}${timePart}`
        : `${day} ${EN_MONTHS_SHORT[monthIdx]} ${adYear}${timePart}`;
    }
  }

  // dd-mm-YYYY or dd/mm/YYYY (possibly BE year)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const rawYear = parseInt(dmyMatch[3], 10);
    const adYear = rawYear > 2400 ? rawYear - 543 : rawYear;
    if (monthIdx >= 0 && monthIdx < 12) {
      return language === 'th'
        ? `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${adYear + 543}`
        : `${day} ${EN_MONTHS_SHORT[monthIdx]} ${adYear}`;
    }
  }

  return trimmed;
}
