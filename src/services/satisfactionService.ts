import * as XLSX from 'xlsx';
import {
  SatisfactionProcedureType,
  SatisfactionResponse,
  SatisfactionScores
} from '../types/dental';
import type { Language } from '../utils/i18n';
import { maskSensitivePii } from './aiService';

export interface ProcedureTemplateMeta {
  id: SatisfactionProcedureType;
  labelKey:
    | 'satProcExtraction'
    | 'satProcCheckupScaling'
    | 'satProcOrthoWire'
    | 'satProcFilling'
    | 'satProcDentureCrown'
    | 'satProcOther';
  careTipsTh: string;
  careTipsEn: string;
}

export const PROCEDURE_CATALOG: readonly ProcedureTemplateMeta[] = [
  {
    id: 'extraction_wisdom',
    labelKey: 'satProcExtraction',
    careTipsTh:
      '• กัดผ้าก๊อซให้แน่นต่ออีก 30–60 นาที และกลืนน้ำลายตามปกติ (งดบ้วนน้ำแรง/ดูดหลอด 24 ชม. แรก)\n• ประคบเย็นบริเวณแก้ม 15 นาที พัก 15 นาที เพื่อช่วยลดบวมใน 48 ชม. แรก\n• ทานอาหารอ่อนไม่ร้อนจัด และทานยาตามที่คุณหมอจัดให้ต่อเนื่อง',
    careTipsEn:
      '• Bite firmly on the gauze for 30–60 mins and avoid vigorous rinsing or using straws for 24 hours.\n• Apply a cold compress (15 mins on / 15 mins off) over the cheek during the first 48 hours.\n• Eat soft lukewarm food and take prescribed medications as directed.'
  },
  {
    id: 'checkup_scaling',
    labelKey: 'satProcCheckupScaling',
    careTipsTh:
      '• อาจมีอาการเสียวฟันหรือระบมเหงือกเล็กน้อยใน 1–2 วันแรก ซึ่งเป็นปกติและจะค่อยๆ ดีขึ้น\n• แปรงฟันอย่างเบามือด้วยแปรงขนนุ่ม ใช้ไหมขัดฟันวันละ 1 ครั้ง\n• งดอาหาร/เครื่องดื่มสีเข้มจัด 24 ชม. และแนะนำตรวจขูดหินปูนซ้ำทุก 6 เดือนค่ะ',
    careTipsEn:
      '• Mild tooth sensitivity or tender gums for 1–2 days is normal and will gradually subside.\n• Brush gently with a soft-bristle toothbrush and floss once daily.\n• Limit dark-staining drinks for 24 hours and schedule routine scaling every 6 months.'
  },
  {
    id: 'ortho_wire',
    labelKey: 'satProcOrthoWire',
    careTipsTh:
      '• อาจรู้สึกตึงหรือปวดฟันเบาๆ ช่วง 2–3 วันหลังปรับลวด แนะนำทานอาหารอ่อนนุ่มชั่วคราว\n• หากแบร็กเก็ตหรือปลายลวดเสียดสีกระพุ้งแก้ม สามารถปั้นขี้ผึ้งจัดฟัน (Wax) แปะทับจุดที่ระคายเคืองได้\n• แปรงฟันหลังมื้ออาหารทุกครั้งด้วยแปรงซอกฟัน/แปรงจัดฟันค่ะ',
    careTipsEn:
      '• Mild soreness for 2–3 days after wire adjustment is expected — stick to soft foods temporarily.\n• Apply orthodontic relief wax over any bracket or wire edge irritating your cheek.\n• Brush thoroughly after meals using an orthodontic brush and interdental brush.'
  },
  {
    id: 'filling',
    labelKey: 'satProcFilling',
    careTipsTh:
      '• หากมียาชา ระวังการเคี้ยวหรือกัดโดนริมฝีปาก/กระพุ้งแก้มจนกว่ายาชาจะหมดฤทธิ์ (~2–3 ชม.)\n• หลีกเลี่ยงการเคี้ยวของแข็งมากหรือเหนียวจัดบริเวณซี่ที่เพิ่งอุดในช่วง 24 ชม. แรก\n• หากรู้สึกว่าวัสดุอุดสูงหรือเคี้ยวสบฟันแล้วไม่สบาย แจ้งให้คลินิกนัดปรับแต่งได้ฟรีค่ะ',
    careTipsEn:
      '• If local anesthesia was used, avoid chewing until numbness wears off (~2–3 hours) to prevent biting your lip or cheek.\n• Avoid very hard or sticky foods on the restored tooth for the first 24 hours.\n• Let us know right away if your bite feels uneven or high so we can smoothly adjust it.'
  },
  {
    id: 'denture_crown',
    labelKey: 'satProcDentureCrown',
    careTipsTh:
      '• ช่วงสัปดาห์แรกของการใส่ฟันปลอม/ครอบฟันอาจต้องปรับตัวเล็กน้อย แนะนำฝึกเคี้ยวอาหารชิ้นเล็กทั้งสองข้างพร้อมกัน\n• ถอดล้างฟันปลอมหลังอาหารทุกมื้อ และถอดแช่น้ำสะอาดก่อนนอนทุกคืน (สำหรับฟันปลอมถอดได้)\n• หากมีจุดกดเจ็บหรือขอบเหงือกถลอก อย่าฝืนใส่ต่อ รีบแจ้งคลินิกนัดกรอปรับให้พอดีค่ะ',
    careTipsEn:
      '• An adaptation period during the first week is normal; chew small pieces evenly on both sides.\n• Clean removable dentures after meals and soak them in clean water overnight.\n• If any sore spots or pressure points develop, contact us promptly for a quick fit adjustment.'
  },
  {
    id: 'other',
    labelKey: 'satProcOther',
    careTipsTh:
      '• พักผ่อนให้เพียงพอ ดูแลความสะอาดช่องปากอย่างอ่อนโยน และสังเกตอาการตามคำแนะนำของคุณหมอ\n• หากมีอาการผิดปกติ ปวดบวมมาก หรือมีข้อสงสัยเพิ่มเติม สามารถทักแชตหรือแจ้งให้ทางคลินิกติดต่อกลับได้ทันทีค่ะ',
    careTipsEn:
      '• Rest well, keep your mouth gently clean, and follow your dentist’s tailored care advice.\n• If you experience unusual discomfort or have any questions, reach out anytime or request a clinic callback.'
  }
];

export const PROCEDURE_LABELS_TH: Record<SatisfactionProcedureType, string> = {
  extraction_wisdom: 'ถอนฟัน / ผ่าฟันคุด',
  checkup_scaling: 'ตรวจ / ขูดหินปูน',
  ortho_wire: 'จัดฟัน / ปรับลวด',
  filling: 'อุดฟัน',
  denture_crown: 'ใส่ฟันปลอม / ครอบฟัน',
  other: 'หัตถการทั่วไป / อื่นๆ'
};

export const PROCEDURE_LABELS_EN: Record<SatisfactionProcedureType, string> = {
  extraction_wisdom: 'Extraction / Wisdom Tooth',
  checkup_scaling: 'Check-up / Scaling',
  ortho_wire: 'Orthodontics / Adjustment',
  filling: 'Dental Filling',
  denture_crown: 'Denture / Crown',
  other: 'General / Other'
};

export function getProcedureLabel(proc: SatisfactionProcedureType, lang: Language): string {
  return lang === 'en' ? PROCEDURE_LABELS_EN[proc] : PROCEDURE_LABELS_TH[proc];
}

export function buildPostOpSurveyMessage(params: {
  procedure: SatisfactionProcedureType;
  language: Language;
  patientName?: string;
  surveyUrl?: string;
  customNote?: string;
}): string {
  const meta =
    PROCEDURE_CATALOG.find((p) => p.id === params.procedure) ||
    PROCEDURE_CATALOG[PROCEDURE_CATALOG.length - 1];
  const procName = getProcedureLabel(meta.id, params.language);
  const nameClean = (params.patientName || '').trim();
  const linkClean = (params.surveyUrl || '').trim();
  const noteClean = (params.customNote || '').trim();

  if (params.language === 'en') {
    const greeting = nameClean ? `Hello ${nameClean},` : 'Hello,';
    const linkBlock = linkClean
      ? `Quick 30-second feedback link (QR / Form):\n${linkClean}`
      : 'Quick 30-second feedback link:\n[Insert clinic survey link or let patient scan QR on iPad]';
    const extraBlock = noteClean ? `\n\nClinic Note:\n${noteClean}` : '';
    return `${greeting} thank you for visiting us today for ${procName}.\n\nPost-treatment care guide:\n${meta.careTipsEn}${extraBlock}\n\nYour comfort matters to us — if you have any soreness or would like our assistant team to call/follow up, please leave a quick rating or mark "Request Callback" in the form below:\n${linkBlock}\n\nWishing you a smooth recovery!`;
  }

  const greetingTh = nameClean ? `สวัสดีค่ะ ${nameClean}` : 'สวัสดีค่ะ';
  const linkBlockTh = linkClean
    ? `แบบประเมินสั้นๆ ใช้เวลาไม่ถึง 30 วินาที:\n${linkClean}`
    : 'แบบประเมินสั้นๆ ใช้เวลาไม่ถึง 30 วินาที:\n[วางลิงก์แบบประเมินของคลินิก หรือสแกน QR หน้าจอผู้ช่วยได้เลยค่ะ]';
  const extraBlockTh = noteClean ? `\n\nหมายเหตุเพิ่มเติมจากผู้ช่วย:\n${noteClean}` : '';

  return `${greetingTh} ขอบคุณที่ไว้วางใจเข้ามารับบริการ "${procName}" ในวันนี้นะคะ\n\nคำแนะนำดูแลตัวเองหลังทำฟัน:\n${meta.careTipsTh}${extraBlockTh}\n\nหากมีอาการเสียว ปวดบวม หรือต้องการให้ผู้ช่วย/คลินิกติดต่อกลับดูแลเพิ่มเติม สามารถกดให้คะแนนความพึงพอใจสั้นๆ พร้อมเลือก "ต้องการให้คลินิกติดต่อกลับ" ได้ที่ลิงก์ด้านล่างนี้เลยนะคะ:\n${linkBlockTh}\n\nขอให้หายไวๆ และสุขภาพช่องปากแข็งแรงค่ะ`;
}

export interface SatisfactionDimensionStat {
  key: keyof SatisfactionScores;
  labelTh: string;
  labelEn: string;
  average: number;
}

export interface SatisfactionServiceBreakdown {
  serviceType: SatisfactionProcedureType;
  labelTh: string;
  labelEn: string;
  count: number;
  percentage: number;
  avgOverall: number;
}

export interface SatisfactionTrendPoint {
  key: string; // YYYY-MM or YYYY-MM-DD
  label: string;
  count: number;
  avgScore: number;
}

export interface SatisfactionMetrics {
  thisMonthKey: string;
  prevMonthKey: string;
  thisMonthCount: number;
  prevMonthCount: number;
  monthDelta: number;
  monthGrowthPct: number | null;
  monthlyGoal: number;
  goalProgressPct: number;
  daysSinceLastScan: number | null;
  momentumStatus: 'on_track' | 'low' | 'stagnant';
  totalCount: number;
  overallAverage: number;
  dimensionAverages: SatisfactionDimensionStat[];
  serviceBreakdown: SatisfactionServiceBreakdown[];
  monthlyTrend: SatisfactionTrendPoint[];
  recentDailyTrend: SatisfactionTrendPoint[];
  callbackCases: SatisfactionResponse[];
  pendingCallbackCount: number;
  unsyncedCount: number;
}

export function getMonthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = (Number(mStr) || 1) - 1;
  const d = new Date(y, m + deltaMonths, 1);
  return getMonthKeyFromDate(d);
}

export function formatMonthLabel(monthKey: string, lang: Language): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  if (Number.isNaN(y) || Number.isNaN(m) || m < 0 || m > 11) return monthKey;
  const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (lang === 'en') {
    return `${enMonths[m]} ${y}`;
  }
  const beShort = String((y + 543) % 100).padStart(2, '0');
  return `${thMonths[m]} ${beShort}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSatisfactionMetrics(
  responses: SatisfactionResponse[],
  monthlyGoal: number,
  now = new Date()
): SatisfactionMetrics {
  const safeGoal = Math.max(1, Number(monthlyGoal) || 30);
  const thisMonthKey = getMonthKeyFromDate(now);
  const prevMonthKey = shiftMonthKey(thisMonthKey, -1);

  const thisMonthItems = responses.filter((r) => r.monthKey === thisMonthKey);
  const prevMonthItems = responses.filter((r) => r.monthKey === prevMonthKey);
  const thisMonthCount = thisMonthItems.length;
  const prevMonthCount = prevMonthItems.length;
  const monthDelta = thisMonthCount - prevMonthCount;
  const monthGrowthPct =
    prevMonthCount > 0 ? Math.round(((thisMonthCount - prevMonthCount) / prevMonthCount) * 100) : null;
  const goalProgressPct = Math.min(100, Math.round((thisMonthCount / safeGoal) * 100));

  // Days since last scan
  let daysSinceLastScan: number | null = null;
  if (responses.length > 0) {
    const timestamps = responses
      .map((r) => {
        const isoGuess = r.submittedAt.includes('T')
          ? r.submittedAt
          : r.submittedAt.replace(' ', 'T');
        const ms = Date.parse(isoGuess);
        return Number.isNaN(ms) ? Date.parse(r.submittedAt.slice(0, 10)) : ms;
      })
      .filter((ms) => !Number.isNaN(ms));
    if (timestamps.length > 0) {
      const latest = Math.max(...timestamps);
      daysSinceLastScan = Math.max(0, Math.floor((now.getTime() - latest) / 86_400_000));
    }
  }

  // Pace heuristic relative to day of month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedByToday = Math.max(1, Math.floor((safeGoal * dayOfMonth) / daysInMonth));

  let momentumStatus: 'on_track' | 'low' | 'stagnant' = 'on_track';
  if (thisMonthCount === 0 || (daysSinceLastScan !== null && daysSinceLastScan >= 3)) {
    momentumStatus = 'stagnant';
  } else if (thisMonthCount < expectedByToday || thisMonthCount < Math.ceil(safeGoal * 0.4)) {
    momentumStatus = 'low';
  }

  const totalCount = responses.length;
  const dimMeta: Array<{
    key: keyof SatisfactionScores;
    labelTh: string;
    labelEn: string;
  }> = [
    {
      key: 'receptionCare',
      labelTh: 'การต้อนรับและความใส่ใจ',
      labelEn: 'Reception & Care'
    },
    {
      key: 'treatmentExplanation',
      labelTh: 'ความชัดเจนในการอธิบายการรักษา',
      labelEn: 'Treatment Explanation'
    },
    {
      key: 'cleanlinessProfessionalism',
      labelTh: 'ความมั่นใจในความสะอาดและความเป็นมืออาชีพ',
      labelEn: 'Cleanliness & Professionalism'
    },
    {
      key: 'waitingAndDuration',
      labelTh: 'ระยะเวลารับบริการ',
      labelEn: 'Service Duration'
    },
    {
      key: 'overallExperience',
      labelTh: 'ประสบการณ์โดยรวม',
      labelEn: 'Overall Experience'
    }
  ];

  const dimensionAverages: SatisfactionDimensionStat[] = dimMeta.map((d) => {
    if (totalCount === 0) {
      return { ...d, average: 0 };
    }
    const sum = responses.reduce((acc, item) => acc + (Number(item.scores[d.key]) || 0), 0);
    return { ...d, average: round2(sum / totalCount) };
  });

  const overallAverage =
    totalCount > 0
      ? round2(
          dimensionAverages.reduce((acc, d) => acc + d.average, 0) / dimensionAverages.length
        )
      : 0;

  // Service breakdown
  const serviceOrder: SatisfactionProcedureType[] = [
    'extraction_wisdom',
    'checkup_scaling',
    'ortho_wire',
    'filling',
    'denture_crown',
    'other'
  ];

  const serviceBreakdown: SatisfactionServiceBreakdown[] = serviceOrder
    .map((stype) => {
      const group = responses.filter((r) => r.serviceType === stype);
      const count = group.length;
      const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const avgOverall =
        count > 0
          ? round2(
              group.reduce((acc, g) => acc + (Number(g.scores.overallExperience) || 0), 0) / count
            )
          : 0;
      return {
        serviceType: stype,
        labelTh: PROCEDURE_LABELS_TH[stype],
        labelEn: PROCEDURE_LABELS_EN[stype],
        count,
        percentage,
        avgOverall
      };
    })
    .filter((s) => s.count > 0);

  // Last 6 months trend
  const monthlyTrend: SatisfactionTrendPoint[] = [];
  for (let i = -5; i <= 0; i++) {
    const mk = shiftMonthKey(thisMonthKey, i);
    const items = responses.filter((r) => r.monthKey === mk);
    const avgScore =
      items.length > 0
        ? round2(
            items.reduce(
              (acc, r) =>
                acc +
                (r.scores.receptionCare +
                  r.scores.treatmentExplanation +
                  r.scores.cleanlinessProfessionalism +
                  r.scores.waitingAndDuration +
                  r.scores.overallExperience) /
                  5,
              0
            ) / items.length
          )
        : 0;
    monthlyTrend.push({
      key: mk,
      label: formatMonthLabel(mk, 'th'),
      count: items.length,
      avgScore
    });
  }

  // Last 14 days daily trend
  const recentDailyTrend: SatisfactionTrendPoint[] = [];
  for (let d = 13; d >= 0; d--) {
    const dt = new Date(now.getTime() - d * 86_400_000);
    const dayKey = dt.toISOString().split('T')[0];
    const items = responses.filter((r) => r.submittedAt.slice(0, 10) === dayKey);
    const avgScore =
      items.length > 0
        ? round2(
            items.reduce((acc, r) => acc + r.scores.overallExperience, 0) / items.length
          )
        : 0;
    recentDailyTrend.push({
      key: dayKey,
      label: dayKey.slice(5),
      count: items.length,
      avgScore
    });
  }

  const callbackCases = responses.filter((r) => r.wantsCallback);
  const pendingCallbackCount = callbackCases.filter((r) => r.triageStatus === 'new').length;
  const unsyncedCount = responses.filter((r) => !r.syncedToSheet && !r.isDemo).length;

  return {
    thisMonthKey,
    prevMonthKey,
    thisMonthCount,
    prevMonthCount,
    monthDelta,
    monthGrowthPct,
    monthlyGoal: safeGoal,
    goalProgressPct,
    daysSinceLastScan,
    momentumStatus,
    totalCount,
    overallAverage,
    dimensionAverages,
    serviceBreakdown,
    monthlyTrend,
    recentDailyTrend,
    callbackCases,
    pendingCallbackCount,
    unsyncedCount
  };
}

function mapRawServiceType(raw: string): SatisfactionProcedureType {
  const lower = raw.trim().toLowerCase();
  if (!lower) return 'other';
  if (lower.includes('ถอน') || lower.includes('ฟันคุด') || lower.includes('extract') || lower.includes('wisdom')) {
    return 'extraction_wisdom';
  }
  if (lower.includes('ขูด') || lower.includes('ตรวจ') || lower.includes('scaling') || lower.includes('check')) {
    return 'checkup_scaling';
  }
  if (lower.includes('จัดฟัน') || lower.includes('ลวด') || lower.includes('ortho') || lower.includes('brace')) {
    return 'ortho_wire';
  }
  if (lower.includes('อุด') || lower.includes('fill')) {
    return 'filling';
  }
  if (lower.includes('ฟันปลอม') || lower.includes('ครอบ') || lower.includes('denture') || lower.includes('crown')) {
    return 'denture_crown';
  }
  return 'other';
}

function clampScore(val: unknown, fallback = 5): number {
  const raw = String(val ?? '').trim();
  if (!raw) return fallback;
  const direct = Number(raw);
  if (!Number.isNaN(direct) && direct > 0) {
    return Math.max(1, Math.min(5, Math.round(direct)));
  }
  const starCount = (raw.match(/⭐|★/g) || []).length;
  if (starCount >= 1 && starCount <= 5) {
    return starCount;
  }
  const digitMatch = raw.match(/\b([1-5])(?:\s*\/\s*5)?\b/) || raw.match(/([1-5])/);
  if (digitMatch) {
    return Math.max(1, Math.min(5, Number(digitMatch[1])));
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes('มากที่สุด') ||
    lower.includes('ดีมาก') ||
    lower.includes('excellent') ||
    lower.includes('very satisfied')
  ) {
    return 5;
  }
  if (
    lower.includes('พึงพอใจมาก') ||
    lower === 'ดี' ||
    lower === 'มาก' ||
    lower.includes('satisfied')
  ) {
    return 4;
  }
  if (lower.includes('ปานกลาง') || lower.includes('neutral') || lower.includes('fair')) {
    return 3;
  }
  if (
    lower.includes('น้อยที่สุด') ||
    lower.includes('ไม่พอใจมาก') ||
    lower.includes('very dissatisfied')
  ) {
    return 1;
  }
  if (lower.includes('น้อย') || lower.includes('ไม่พอใจ') || lower.includes('dissatisfied')) {
    return 2;
  }
  return fallback;
}

function looksLikeScoreValue(val: unknown): boolean {
  const raw = String(val ?? '').trim();
  if (!raw) return false;
  if (/^[1-5](?:\.0+)?$/.test(raw)) return true;
  if (/^[1-5]\s*[-–/:]/.test(raw)) return true;
  if (/^[1-5]\s*(?:คะแนน|ดาว)/i.test(raw)) return true;
  if (/[⭐★]/.test(raw)) return true;
  return /มากที่สุด|ดีมาก|ปานกลาง|น้อยที่สุด/.test(raw);
}

function parseCallbackFlag(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (!lower) return false;
  if (
    lower.includes('ไม่ต้องการ') ||
    lower.includes('ไม่ต้องติดต่อ') ||
    lower === 'no' ||
    lower === 'n' ||
    lower === 'false' ||
    lower === '0'
  ) {
    return false;
  }
  return (
    lower === 'yes' ||
    lower === 'y' ||
    lower === 'true' ||
    lower === '1' ||
    lower.includes('ต้องการ') ||
    lower.includes('ติดต่อกลับ') ||
    lower.includes('โทรกลับ') ||
    lower.includes('ใช่') ||
    lower.includes('callback')
  );
}

const TH_MONTH_NAME_MAP: Record<string, number> = {
  มกราคม: 1,
  'ม.ค.': 1,
  มค: 1,
  กุมภาพันธ์: 2,
  'ก.พ.': 2,
  กพ: 2,
  มีนาคม: 3,
  'มี.ค.': 3,
  มีค: 3,
  เมษายน: 4,
  'เม.ย.': 4,
  เมย: 4,
  พฤษภาคม: 5,
  'พ.ค.': 5,
  พค: 5,
  มิถุนายน: 6,
  'มิ.ย.': 6,
  มิย: 6,
  กรกฎาคม: 7,
  'ก.ค.': 7,
  กค: 7,
  สิงหาคม: 8,
  'ส.ค.': 8,
  สค: 8,
  กันยายน: 9,
  'ก.ย.': 9,
  กย: 9,
  ตุลาคม: 10,
  'ต.ค.': 10,
  ตค: 10,
  พฤศจิกายน: 11,
  'พ.ย.': 11,
  พย: 11,
  ธันวาคม: 12,
  'ธ.ค.': 12,
  ธค: 12
};

function formatTimeWithOptionalSeconds(rawTime?: string): string {
  if (!rawTime) return '12:00';
  const normalized = rawTime.replace(/\./g, ':').trim();
  const m = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap]m))?$/i);
  if (!m) return '12:00';
  let hh = parseInt(m[1], 10);
  const min = m[2];
  const sec = m[3];
  const ampm = m[4]?.toLowerCase();
  if (ampm === 'pm' && hh < 12) hh += 12;
  if (ampm === 'am' && hh === 12) hh = 0;
  const hhStr = String(Math.max(0, Math.min(23, hh))).padStart(2, '0');
  return sec ? `${hhStr}:${min}:${sec}` : `${hhStr}:${min}`;
}

function normalizeDateStamp(raw: string): { submittedAt: string; monthKey: string; parsedOk: boolean } {
  const clean = raw.trim();
  const isoMatch = clean.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s,]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?))?/i
  );
  if (isoMatch) {
    let yyyy = parseInt(isoMatch[1], 10);
    if (yyyy > 2400) yyyy -= 543;
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    const hhmm = formatTimeWithOptionalSeconds(isoMatch[4]);
    return {
      submittedAt: `${yyyy}-${mm}-${dd} ${hhmm}`,
      monthKey: `${yyyy}-${mm}`,
      parsedOk: true
    };
  }

  const slashMatch = clean.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[\s,]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?))?/i
  );
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    let yyyy = parseInt(slashMatch[3], 10);
    const hasAmPm = /\b(?:am|pm)\b/i.test(clean);
    if (yyyy > 2400) yyyy -= 543;
    let dayNum = p1;
    let monthNum = p2;
    if (p2 > 12 && p1 <= 12) {
      monthNum = p1;
      dayNum = p2;
    } else if (hasAmPm && p1 <= 12 && p2 <= 12) {
      monthNum = p1;
      dayNum = p2;
    }
    monthNum = Math.max(1, Math.min(12, monthNum));
    dayNum = Math.max(1, Math.min(31, dayNum));
    const mm = String(monthNum).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    const hhmm = formatTimeWithOptionalSeconds(slashMatch[4]);
    return {
      submittedAt: `${yyyy}-${mm}-${dd} ${hhmm}`,
      monthKey: `${yyyy}-${mm}`,
      parsedOk: true
    };
  }

  const thDateMatch = clean.match(
    /^(\d{1,2})\s+([\u0E00-\u0E7F.]+)\s+(\d{4})(?:[\s,]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?))?/
  );
  if (thDateMatch) {
    const monthNum = TH_MONTH_NAME_MAP[thDateMatch[2]];
    if (monthNum) {
      let yyyy = parseInt(thDateMatch[3], 10);
      if (yyyy > 2400) yyyy -= 543;
      const dd = String(Math.max(1, Math.min(31, parseInt(thDateMatch[1], 10)))).padStart(2, '0');
      const mm = String(monthNum).padStart(2, '0');
      const hhmm = formatTimeWithOptionalSeconds(thDateMatch[4]);
      return {
        submittedAt: `${yyyy}-${mm}-${dd} ${hhmm}`,
        monthKey: `${yyyy}-${mm}`,
        parsedOk: true
      };
    }
  }

  const now = new Date();
  return {
    submittedAt: now.toISOString().replace('T', ' ').slice(0, 16),
    monthKey: getMonthKeyFromDate(now),
    parsedOk: false
  };
}

function splitDelimitedTable(rawText: string): string[][] {
  const clean = rawText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  // Auto-detect TSV vs CSV on first line outside quotes
  const firstBreak = clean.search(/\r?\n/);
  const sampleLine = firstBreak >= 0 ? clean.slice(0, firstBreak) : clean;
  let inQ = false;
  let tabCount = 0;
  let commaCount = 0;
  for (let i = 0; i < sampleLine.length; i++) {
    const ch = sampleLine[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === '\t') tabCount++;
    else if (!inQ && ch === ',') commaCount++;
  }
  const delimiter = tabCount > 0 && tabCount >= commaCount ? '\t' : ',';

  if (delimiter === '\t') {
    return clean
      .split(/\r?\n/)
      .map((line) => line.split('\t').map((cell) => cell.trim().replace(/^"|"$/g, '')))
      .filter((row) => row.some((c) => c.length > 0));
  }

  // RFC-4180 CSV parser (supports quoted commas, escaped "", multiline quoted cells)
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (insideQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        insideQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      insideQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((c) => c.length > 0)) {
    rows.push(currentRow);
  }
  return rows;
}

interface HeaderColumnMap {
  dateIdx: number;
  serviceIdx: number;
  receptionIdx: number;
  explanationIdx: number;
  cleanlinessIdx: number;
  durationIdx: number;
  overallIdx: number;
  callbackIdx: number;
  commentIdx: number;
  patientRefIdx: number;
}

function isHeaderRow(cols: string[]): boolean {
  const joined = cols.join(' ').toLowerCase();
  return (
    joined.includes('ประทับเวลา') ||
    joined.includes('timestamp') ||
    joined.includes('วันที่') ||
    joined.includes('ประเภทบริการ') ||
    joined.includes('ความพึงพอใจ') ||
    joined.includes('ติดต่อกลับ') ||
    joined.includes('ข้อเสนอแนะ') ||
    joined.includes('service') ||
    joined.includes('overall') ||
    joined.includes('callback')
  );
}

function buildHeaderMap(headers: string[], sampleRows: string[][]): HeaderColumnMap {
  const hLower = headers.map((h) => h.toLowerCase());
  const usedIndices = new Set<number>();

  const findCol = (patterns: RegExp[]): number => {
    for (let i = 0; i < hLower.length; i++) {
      if (usedIndices.has(i)) continue;
      if (patterns.some((p) => p.test(hLower[i]))) {
        usedIndices.add(i);
        return i;
      }
    }
    return -1;
  };

  const dateIdx = findCol([/ประทับเวลา|timestamp|วันที่|date/]);
  const serviceIdx = findCol([/ประเภทบริการ|บริการที่|หัตถการ|service|procedure|treatment/]);
  const callbackIdx = findCol([/ติดต่อกลับ|โทรกลับ|callback|follow[\s_-]?up/]);
  const commentIdx = findCol([/ความคิดเห็น|ข้อเสนอแนะ|เพิ่มเติม|หมายเหตุ|comment|feedback|suggest/]);
  const patientRefIdx = findCol([/รหัส|คิว|เคส|hn|queue|ref/]);

  let receptionIdx = findCol([/ต้อนรับ|ใส่ใจ|พนักงาน|ผู้ช่วย|เจ้าหน้าที่|reception|friendly|staff/]);
  let explanationIdx = findCol([/อธิบาย|ชัดเจน|คำแนะนำ|ข้อมูล|explain|clarity/]);
  let cleanlinessIdx = findCol([/สะอาด|มืออาชีพ|มั่นใจ|เครื่องมือ|สถานที่|clean|hygiene|professional/]);
  let durationIdx = findCol([/ระยะเวลา|รอคอย|รวดเร็ว|รอตรวจ|wait|duration|speed/]);
  let overallIdx = findCol([/โดยรวม|ภาพรวม|ประทับใจ|overall|experience/]);

  // Fallback: pick remaining numeric/rating columns in left-to-right order
  const unmatchedRatingCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (usedIndices.has(i)) continue;
    const hasRatingSample = sampleRows.some((r) => looksLikeScoreValue(r[i]));
    if (hasRatingSample) {
      unmatchedRatingCols.push(i);
    }
  }

  const takeNextRating = () => {
    const next = unmatchedRatingCols.shift();
    return next !== undefined ? next : -1;
  };

  if (receptionIdx < 0) receptionIdx = takeNextRating();
  if (explanationIdx < 0) explanationIdx = takeNextRating();
  if (cleanlinessIdx < 0) cleanlinessIdx = takeNextRating();
  if (durationIdx < 0) durationIdx = takeNextRating();
  if (overallIdx < 0) overallIdx = takeNextRating();

  return {
    dateIdx: dateIdx >= 0 ? dateIdx : 0,
    serviceIdx: serviceIdx >= 0 ? serviceIdx : 1,
    receptionIdx: receptionIdx >= 0 ? receptionIdx : 2,
    explanationIdx: explanationIdx >= 0 ? explanationIdx : 3,
    cleanlinessIdx: cleanlinessIdx >= 0 ? cleanlinessIdx : 4,
    durationIdx: durationIdx >= 0 ? durationIdx : 5,
    overallIdx: overallIdx >= 0 ? overallIdx : 6,
    callbackIdx: callbackIdx >= 0 ? callbackIdx : 7,
    commentIdx: commentIdx >= 0 ? commentIdx : 8,
    patientRefIdx
  };
}

function buildIntegerScoreSeries(count: number, targetAvg: number): number[] {
  if (count <= 0) return [];
  const clampedAvg = Math.max(1, Math.min(5, targetAvg || 5));
  const base = Math.max(1, Math.min(4, Math.floor(clampedAvg)));
  const ceil = Math.min(5, base + 1);
  const totalPoints = Math.round(count * clampedAvg);
  const highCount =
    ceil === base
      ? count
      : Math.max(0, Math.min(count, totalPoints - base * count));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i < highCount ? ceil : base);
  }
  return out;
}

function tryParseClinicSummaryDashboardCsv(
  table: string[][],
  source: 'sheet_sync' | 'manual_entry'
): SatisfactionResponse[] {
  // Detect Thai clinic monthly summary rows such as "สิงหาคม 2569,10,4.73,..."
  let monthHeaderCol = 1;
  let countOffset = 1;
  let overallColOffset = 2;
  let cleanIdx = 4;
  let recIdx = 5;
  let expIdx = 6;
  let ovrIdx = 7;
  let durIdx = 8;

  for (const row of table) {
    const joined = row.join(' ');
    if (joined.includes('เดือน') && joined.includes('จำนวนผู้ตอบ')) {
      const mCol = row.findIndex((cell) => cell.trim() === 'เดือน');
      if (mCol >= 0) {
        monthHeaderCol = mCol;
      }
      row.forEach((cell, idx) => {
        const c = cell.trim();
        if (c.includes('จำนวนผู้ตอบ')) countOffset = Math.max(1, idx - monthHeaderCol);
        else if (c.includes('คะแนนเฉลี่ยรวม')) overallColOffset = Math.max(1, idx - monthHeaderCol);
        else if (c.includes('สะอาด')) cleanIdx = idx;
        else if (c.includes('ต้อนรับ')) recIdx = idx;
        else if (c.includes('อธิบาย')) expIdx = idx;
        else if (c.includes('ประสบการณ์')) ovrIdx = idx;
        else if (c.includes('ระยะเวลา')) durIdx = idx;
      });
      break;
    }
  }

  interface MonthBucket {
    monthKey: string;
    count: number;
    cleanAvg: number;
    recAvg: number;
    expAvg: number;
    ovrAvg: number;
    durAvg: number;
  }

  const monthBuckets: MonthBucket[] = [];
  const serviceTotals = new Map<SatisfactionProcedureType, number>();

  for (const row of table) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      if (!cell) continue;

      const mMatch = cell.match(/^([\u0E00-\u0E7F.]+)\s+(25\d{2}|20\d{2})$/);
      if (mMatch && !cell.includes('รวม')) {
        const monthNum = TH_MONTH_NAME_MAP[mMatch[1]];
        if (monthNum) {
          let year = parseInt(mMatch[2], 10);
          if (year > 2400) year -= 543;
          const count = parseInt((row[c + countOffset] || '').replace(/[^\d]/g, ''), 10) || 0;
          if (count > 0) {
            const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
            const numOr = (idx: number, def: number) => {
              const offset = idx - monthHeaderCol;
              const v = parseFloat((row[c + offset] || '').replace(/[^0-9.]/g, ''));
              return !Number.isNaN(v) && v >= 1 && v <= 5 ? v : def;
            };
            const overallRowAvg =
              parseFloat((row[c + overallColOffset] || '').replace(/[^0-9.]/g, '')) || 4.75;
            monthBuckets.push({
              monthKey,
              count,
              cleanAvg: numOr(cleanIdx, overallRowAvg),
              recAvg: numOr(recIdx, overallRowAvg),
              expAvg: numOr(expIdx, overallRowAvg),
              ovrAvg: numOr(ovrIdx, overallRowAvg),
              durAvg: numOr(durIdx, overallRowAvg)
            });
          }
          break;
        }
      }

      // Check service breakdown rows (e.g., "ถอนฟัน / ผ่าฟันคุด, 37, 30.1%")
      if (
        c <= 2 &&
        /(ถอน|ฟันคุด|ขูด|ตรวจสุขภาพ|จัดฟัน|อุดฟัน|ฟันปลอม|ครอบฟัน|ตัดไหม|รักษาราก)/.test(cell) &&
        !cell.includes('ประเภทบริการ')
      ) {
        const svcCount = parseInt((row[c + 1] || '').replace(/[^\d]/g, ''), 10) || 0;
        if (svcCount > 0) {
          const stype = mapRawServiceType(cell);
          serviceTotals.set(stype, (serviceTotals.get(stype) || 0) + svcCount);
        }
      }
    }
  }

  const totalRespondents = monthBuckets.reduce((acc, b) => acc + b.count, 0);
  if (totalRespondents === 0) return [];

  // Allocate service slots exactly summing to totalRespondents (handles multi-select > totalRespondents cleanly)
  const servicePool: SatisfactionProcedureType[] = [];
  const rawSvcSum = Array.from(serviceTotals.values()).reduce((a, b) => a + b, 0);
  if (rawSvcSum > 0) {
    const entries = Array.from(serviceTotals.entries()).map(([stype, cnt]) => {
      const exact = (cnt / rawSvcSum) * totalRespondents;
      return { stype, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let allocated = entries.reduce((acc, e) => acc + e.floor, 0);
    entries.sort((a, b) => b.frac - a.frac);
    for (let i = 0; allocated < totalRespondents && i < entries.length; i++) {
      entries[i].floor += 1;
      allocated += 1;
    }
    for (const e of entries) {
      for (let i = 0; i < e.floor; i++) {
        servicePool.push(e.stype);
      }
    }
  }
  while (servicePool.length < totalRespondents) {
    servicePool.push('checkup_scaling');
  }

  // Spread service types evenly across respondents so every month shows representative service mix
  const interleavedServices: SatisfactionProcedureType[] = new Array(totalRespondents);
  const stride = Math.max(1, Math.floor(totalRespondents / 7));
  let cursor = 0;
  for (let i = 0; i < totalRespondents; i++) {
    while (interleavedServices[cursor] !== undefined) {
      cursor = (cursor + 1) % totalRespondents;
    }
    interleavedServices[cursor] = servicePool[i];
    cursor = (cursor + stride) % totalRespondents;
  }

  const rows: SatisfactionResponse[] = [];
  let globalIdx = 0;
  for (const bucket of monthBuckets) {
    const cleanSeries = buildIntegerScoreSeries(bucket.count, bucket.cleanAvg);
    const recSeries = buildIntegerScoreSeries(bucket.count, bucket.recAvg);
    const expSeries = buildIntegerScoreSeries(bucket.count, bucket.expAvg);
    const ovrSeries = buildIntegerScoreSeries(bucket.count, bucket.ovrAvg);
    const durSeries = buildIntegerScoreSeries(bucket.count, bucket.durAvg);

    for (let i = 0; i < bucket.count; i++) {
      const dayNum = Math.min(28, 1 + Math.floor((i * 27) / Math.max(1, bucket.count)));
      const hour = 9 + (i % 10);
      const min = (i * 7) % 60;
      const submittedAt = `${bucket.monthKey}-${String(dayNum).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const numLabel = String(globalIdx + 1).padStart(3, '0');
      rows.push({
        id: `sat-sum-${bucket.monthKey}-${numLabel}`,
        submittedAt,
        monthKey: bucket.monthKey,
        serviceType: interleavedServices[globalIdx] || 'checkup_scaling',
        scores: {
          receptionCare: recSeries[i] ?? 5,
          treatmentExplanation: expSeries[i] ?? 5,
          cleanlinessProfessionalism: cleanSeries[i] ?? 5,
          waitingAndDuration: durSeries[i] ?? 5,
          overallExperience: ovrSeries[i] ?? 5
        },
        wantsCallback: false,
        patientRef: `สรุปชีต #${numLabel}`,
        comment: 'นำเข้าจากรายงานสรุปผลชีตคลินิก (Read-Only)',
        source,
        triageStatus: 'new',
        syncedToSheet: true
      });
      globalIdx++;
    }
  }

  return rows.reverse();
}

export interface ParsedSatisfactionBatch {
  rows: SatisfactionResponse[];
  skippedRows: number;
  detectedHeaders: boolean;
  importedFormat?: 'raw_rows' | 'summary_dashboard';
}

export function parseSatisfactionCsvOrTsvDetailed(
  rawText: string,
  options?: { source?: 'sheet_sync' | 'manual_entry' }
): ParsedSatisfactionBatch {
  const table = splitDelimitedTable(rawText);
  if (table.length === 0) {
    return { rows: [], skippedRows: 0, detectedHeaders: false };
  }

  const source = options?.source || 'sheet_sync';
  const topSampleText = table
    .slice(0, 15)
    .map((r) => r.join(' ').toLowerCase())
    .join('\n');
  const hasTimestampHeader = /ประทับเวลา|timestamp/i.test(table[0].join(' '));
  const looksLikeSummaryDashboard =
    !hasTimestampHeader &&
    (topSampleText.includes('จำนวนผู้ตอบ') ||
      topSampleText.includes('แดชบอร์ดภาพรวมความพึงพอใจ') ||
      (topSampleText.includes('เดือน') && topSampleText.includes('คะแนนเฉลี่ยรวม')));

  if (looksLikeSummaryDashboard) {
    const summaryFirstRows = tryParseClinicSummaryDashboardCsv(table, source);
    if (summaryFirstRows.length > 0) {
      return {
        rows: summaryFirstRows,
        skippedRows: 0,
        detectedHeaders: true,
        importedFormat: 'summary_dashboard'
      };
    }
  }

  const hasHeader = isHeaderRow(table[0]);
  const dataRows = hasHeader ? table.slice(1) : table;
  const colMap: HeaderColumnMap = hasHeader
    ? buildHeaderMap(table[0], dataRows.slice(0, 8))
    : {
        dateIdx: 0,
        serviceIdx: 1,
        receptionIdx: 2,
        explanationIdx: 3,
        cleanlinessIdx: 4,
        durationIdx: 5,
        overallIdx: 6,
        callbackIdx: 7,
        commentIdx: 8,
        patientRefIdx: -1
      };

  const results: SatisfactionResponse[] = [];
  let skippedRows = 0;
  const nowMs = Date.now();

  dataRows.forEach((cols, idx) => {
    if (cols.length < 2 || cols.every((c) => !c.trim())) {
      skippedRows++;
      return;
    }

    const rawDate = cols[colMap.dateIdx] || '';
    const rawService = cols[colMap.serviceIdx] || '';
    const dateParsed = normalizeDateStamp(rawDate);

    // Check if row has at least a date or any valid score/service content
    const hasAnyScore =
      looksLikeScoreValue(cols[colMap.receptionIdx]) ||
      looksLikeScoreValue(cols[colMap.overallIdx]) ||
      looksLikeScoreValue(cols[colMap.explanationIdx]);

    if (!dateParsed.parsedOk && !hasAnyScore && !rawService.trim()) {
      skippedRows++;
      return;
    }

    const serviceType = mapRawServiceType(rawService);
    const receptionScore = clampScore(cols[colMap.receptionIdx], 5);
    const scores: SatisfactionScores = {
      receptionCare: receptionScore,
      treatmentExplanation: clampScore(cols[colMap.explanationIdx], receptionScore),
      cleanlinessProfessionalism: clampScore(cols[colMap.cleanlinessIdx], receptionScore),
      waitingAndDuration: clampScore(cols[colMap.durationIdx], receptionScore),
      overallExperience: clampScore(cols[colMap.overallIdx], receptionScore)
    };

    const rawCallback = colMap.callbackIdx >= 0 ? cols[colMap.callbackIdx] || '' : '';
    const wantsCallback = parseCallbackFlag(rawCallback);

    const rawComment = colMap.commentIdx >= 0 ? (cols[colMap.commentIdx] || '').trim() : '';
    const maskedComment = rawComment ? maskSensitivePii(rawComment).maskedText : undefined;
    const rawRef = colMap.patientRefIdx >= 0 ? (cols[colMap.patientRefIdx] || '').trim() : '';
    const maskedRef = rawRef ? maskSensitivePii(rawRef).maskedText : undefined;

    results.push({
      id: `sat-imp-${nowMs}-${idx}`,
      submittedAt: dateParsed.submittedAt,
      monthKey: dateParsed.monthKey,
      serviceType,
      scores,
      wantsCallback,
      callbackTopic: wantsCallback
        ? maskedComment || PROCEDURE_LABELS_TH[serviceType]
        : undefined,
      patientRef: maskedRef,
      comment: maskedComment,
      source,
      triageStatus: 'new',
      syncedToSheet: true
    });
  });

  if (results.length === 0) {
    const summaryRows = tryParseClinicSummaryDashboardCsv(table, source);
    if (summaryRows.length > 0) {
      return {
        rows: summaryRows,
        skippedRows: 0,
        detectedHeaders: true,
        importedFormat: 'summary_dashboard'
      };
    }
  }

  return {
    rows: results,
    skippedRows,
    detectedHeaders: hasHeader,
    importedFormat: 'raw_rows'
  };
}

/**
 * Parse pasted TSV (Google Sheets copy-paste) or CSV lines into SatisfactionResponse records.
 * Supports Google Form header rows ("ประทับเวลา", "ประเภทบริการ", ...), raw positional rows,
 * and clinic dashboard summary CSV exports.
 */
export function parseSatisfactionCsvOrTsv(rawText: string): SatisfactionResponse[] {
  return parseSatisfactionCsvOrTsvDetailed(rawText).rows;
}

export function buildDeterministicExecutiveReport(params: {
  metrics: SatisfactionMetrics;
  responses: SatisfactionResponse[];
  language: Language;
  strengths?: string[];
  improvements?: string[];
}): string {
  const { metrics, responses, language, strengths, improvements } = params;

  const autoStrengths =
    strengths && strengths.length > 0
      ? strengths
      : [...metrics.dimensionAverages]
          .sort((a, b) => b.average - a.average)
          .slice(0, 2)
          .map((d) =>
            language === 'en'
              ? `${d.labelEn} scored ${d.average.toFixed(2)}/5.00`
              : `${d.labelTh} ได้คะแนนโดดเด่น (${d.average.toFixed(2)}/5.00)`
          );

  const lowDims = [...metrics.dimensionAverages].filter((d) => d.average > 0 && d.average < 4.5);
  const autoImprovements =
    improvements && improvements.length > 0
      ? improvements
      : lowDims.length > 0
      ? lowDims.slice(0, 2).map((d) =>
          language === 'en'
            ? `Monitor ${d.labelEn} (${d.average.toFixed(2)}/5.00)`
            : `ควรติดตามพัฒนาด้าน${d.labelTh} (เฉลี่ย ${d.average.toFixed(2)}/5.00)`
        )
      : [
          language === 'en'
            ? metrics.momentumStatus !== 'on_track'
              ? 'Increase post-op QR/link outreach after procedures to boost monthly scan volume.'
              : 'Maintain steady scan collection and timely callback follow-up.'
            : metrics.momentumStatus !== 'on_track'
            ? 'เร่งส่งข้อความดูแลหลังทำฟัน + ลิงก์/QR ประเมินหลังหัตถการ เพื่อเพิ่มยอดสแกนเดือนนี้ให้ถึงเป้า'
            : 'รักษามาตรฐานการดึงยอดสแกนและการติดต่อกลับเคสที่ขอคำแนะนำให้ต่อเนื่อง'
        ];

  const createdCb = responses.filter((r) => r.wantsCallback && r.triageStatus !== 'new').length;
  const pendingCb = metrics.pendingCallbackCount;

  if (language === 'en') {
    const dimLines = metrics.dimensionAverages
      .map((d) => `- ${d.labelEn}: ${d.average.toFixed(2)} / 5.00`)
      .join('\n');
    const svcLines =
      metrics.serviceBreakdown.length > 0
        ? metrics.serviceBreakdown
            .map((s) => `- ${s.labelEn}: ${s.count} (${s.percentage}%)`)
            .join('\n')
        : '- No service records yet';

    return [
      `EXECUTIVE PATIENT SATISFACTION BRIEF (${formatMonthLabel(metrics.thisMonthKey, 'en')})`,
      `==================================================`,
      `1. Monthly QR Scan Volume:`,
      `- Scans this month: ${metrics.thisMonthCount} / Goal ${metrics.monthlyGoal} (${metrics.goalProgressPct}%)`,
      `- Previous month: ${metrics.prevMonthCount} (Delta: ${metrics.monthDelta >= 0 ? '+' : ''}${metrics.monthDelta})`,
      `- Total respondents recorded: ${metrics.totalCount}`,
      `- Overall average score: ${metrics.overallAverage.toFixed(2)} / 5.00`,
      ``,
      `2. Five-Aspect Average Scores:`,
      dimLines,
      ``,
      `3. Service Breakdown:`,
      svcLines,
      ``,
      `4. Key Strengths:`,
      ...autoStrengths.map((s) => `- ${s}`),
      ``,
      `5. Areas for Improvement:`,
      ...autoImprovements.map((im) => `- ${im}`),
      ``,
      `6. Clinic Callback Triage Status:`,
      `- Total requesting callback: ${metrics.callbackCases.length}`,
      `- Follow-up tasks created/handled: ${createdCb}`,
      `- Pending triage: ${pendingCb}`
    ].join('\n');
  }

  const dimLinesTh = metrics.dimensionAverages
    .map((d) => `- ${d.labelTh}: ${d.average.toFixed(2)} / 5.00`)
    .join('\n');
  const svcLinesTh =
    metrics.serviceBreakdown.length > 0
      ? metrics.serviceBreakdown
          .map((s) => `- ${s.labelTh}: ${s.count} ราย (${s.percentage}%)`)
          .join('\n')
      : '- ยังไม่มีข้อมูลประเภทบริการ';

  return [
    `รายงานสรุปผลความพึงพอใจคนไข้สำหรับผู้บริหาร (${formatMonthLabel(metrics.thisMonthKey, 'th')})`,
    `==================================================`,
    `1. สรุปยอดสแกน QR ประเมินรายเดือน:`,
    `- ยอดสแกนเดือนนี้: ${metrics.thisMonthCount} ราย / เป้าหมาย ${metrics.monthlyGoal} ราย (${metrics.goalProgressPct}%)`,
    `- เทียบเดือนก่อน (${formatMonthLabel(metrics.prevMonthKey, 'th')}): ${metrics.prevMonthCount} ราย (${metrics.monthDelta >= 0 ? '+' : ''}${metrics.monthDelta} ราย)`,
    `- ผู้ตอบแบบประเมินสะสมทั้งหมด: ${metrics.totalCount} ราย`,
    `- คะแนนเฉลี่ยรวม 5 ด้าน: ${metrics.overallAverage.toFixed(2)} / 5.00`,
    ``,
    `2. คะแนนเฉลี่ยแยกตาม 5 ด้านหลัก:`,
    dimLinesTh,
    ``,
    `3. สัดส่วนประเภทบริการที่เข้าประเมิน:`,
    svcLinesTh,
    ``,
    `4. สิ่งที่ทำได้ดี (Strengths):`,
    ...autoStrengths.map((s) => `- ${s}`),
    ``,
    `5. สิ่งที่ควรปรับปรุงและติดตามต่อ (Improvements):`,
    ...autoImprovements.map((im) => `- ${im}`),
    ``,
    `6. สถานะเคสที่ระบุ "ต้องการให้คลินิกติดต่อกลับ":`,
    `- เคสขอติดต่อกลับทั้งหมด: ${metrics.callbackCases.length} เคส`,
    `- สร้างงานติดตามแล้ว: ${createdCb} เคส | รอสร้างงานติดตาม: ${pendingCb} เคส`
  ].join('\n');
}

export function exportSatisfactionExcelWorkbook(params: {
  responses: SatisfactionResponse[];
  metrics: SatisfactionMetrics;
  rawTabName: string;
  reportText: string;
  filename?: string;
}): void {
  const safeTab =
    params.rawTabName
      .trim()
      .replace(/[\\/?*[\]:]/g, '_')
      .slice(0, 31) || 'Raw_Responses';

  const rawRows = params.responses.map((r, idx) => ({
    No: idx + 1,
    Submitted_At: r.submittedAt,
    Month_Key: r.monthKey,
    Service_Type: PROCEDURE_LABELS_TH[r.serviceType],
    Reception_Care: r.scores.receptionCare,
    Treatment_Explanation: r.scores.treatmentExplanation,
    Cleanliness_Professionalism: r.scores.cleanlinessProfessionalism,
    Service_Duration: r.scores.waitingAndDuration,
    Overall_Experience: r.scores.overallExperience,
    Wants_Callback: r.wantsCallback ? 'Yes' : 'No',
    Callback_Topic: r.callbackTopic || '',
    Comment: r.comment || '',
    Source: r.source,
    Triage_Status: r.triageStatus
  }));

  const wb = XLSX.utils.book_new();
  const wsRaw = XLSX.utils.json_to_sheet(
    rawRows.length > 0
      ? rawRows
      : [
          {
            No: 0,
            Submitted_At: '',
            Month_Key: '',
            Service_Type: '',
            Reception_Care: '',
            Treatment_Explanation: '',
            Cleanliness_Professionalism: '',
            Service_Duration: '',
            Overall_Experience: '',
            Wants_Callback: '',
            Callback_Topic: '',
            Comment: '',
            Source: '',
            Triage_Status: ''
          }
        ]
  );
  XLSX.utils.book_append_sheet(wb, wsRaw, safeTab);

  const reportLines = params.reportText.split('\n').map((line) => ({ Executive_Brief: line }));
  const wsExec = XLSX.utils.json_to_sheet(reportLines);
  XLSX.utils.book_append_sheet(wb, wsExec, 'Executive_Brief');

  const outName =
    params.filename ||
    `satisfaction-raw-and-brief-${params.metrics.thisMonthKey}.xlsx`;
  XLSX.writeFile(wb, outName);
}

export const GOOGLE_APPS_SCRIPT_APPEND_ONLY_SNIPPET = `/**
 * Google Apps Script (Strict Append-Only Raw Tab Guardrail)
 * วางใน Extensions > Apps Script ของไฟล์ประเมินความพึงพอใจ
 * ระบบจะต่อท้ายแถวใหม่ในแท็บ "Raw_Responses" เท่านั้น และบล็อกการเขียนทับแท็บ Dashboard/สรุปยอด
 */
var ALLOWED_RAW_TAB = 'Raw_Responses';
var API_TOKEN = ''; // ใส่รหัส Token เดียวกับหน้าตั้งค่า (ถ้ามี)

function isProtectedSummaryTab(name) {
  return /dashboard|summary|overview|report|chart|ภาพรวม|สรุป|แดชบอร์ด|กราฟ/i.test(String(name || ''));
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tab = (e && e.parameter && e.parameter.rawTab) || ALLOWED_RAW_TAB;
  if (isProtectedSummaryTab(tab)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Protected summary tab cannot be targeted.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var sheet = ss.getSheetByName(tab) || ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({ ok: true, tab: sheet.getName(), rows: values }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents || '{}');
  if (API_TOKEN && payload.token !== API_TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (payload.writeMode !== 'append_only' || payload.preventOverwrite !== true) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Only append_only mode is permitted' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var targetTab = payload.rawTabName || ALLOWED_RAW_TAB;
  if (isProtectedSummaryTab(targetTab)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Blocked overwrite of Dashboard/Summary tab!' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(targetTab);
  if (!sheet) {
    sheet = ss.insertSheet(targetTab);
    sheet.appendRow(['ประทับเวลา', 'ประเภทบริการ', 'การต้อนรับและความใส่ใจ', 'ความชัดเจนในการอธิบายการรักษา', 'ความสะอาดและความเป็นมืออาชีพ', 'ระยะเวลารับบริการ', 'ประสบการณ์โดยรวม', 'ต้องการให้คลินิกติดต่อกลับ', 'ความคิดเห็นเพิ่มเติม', 'แหล่งที่มา']);
  }
  var rows = payload.rows || [];
  rows.forEach(function(r) {
    sheet.appendRow([r.submittedAt, r.serviceLabel, r.receptionCare, r.treatmentExplanation, r.cleanlinessProfessionalism, r.waitingAndDuration, r.overallExperience, r.wantsCallbackText, r.comment, r.source]);
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, appendedCount: rows.length, tab: targetTab }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
