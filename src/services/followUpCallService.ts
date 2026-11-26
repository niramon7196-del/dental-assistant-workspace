export type FollowUpCallScriptType =
  | 'extraction'
  | 'general_dental'
  | 'denture'
  | 'custom';

export type FollowUpCallOutcome =
  | 'normal_recovery'
  | 'needs_recheck'
  | 'appointment_booked'
  | 'no_answer';

export interface FollowUpCallScriptTemplate {
  id: FollowUpCallScriptType;
  labelTh: string;
  labelEn: string;
  openingTh: string;
  questionsTh: string[];
  closingTh: string;
}

export const FOLLOW_UP_CALL_SCRIPTS: readonly FollowUpCallScriptTemplate[] = [
  {
    id: 'extraction',
    labelTh: 'หลังถอนฟัน / ผ่าฟันคุด',
    labelEn: 'Post-Extraction / Wisdom Tooth',
    openingTh:
      'สวัสดีค่ะ โทรติดตามอาการจากคลินิกทันตกรรมนะคะ สอบถามอาการหลังถอนฟัน/ผ่าฟันคุดวันนี้เป็นอย่างไรบ้างคะ',
    questionsTh: [
      '1. หลังกัดผ้าก๊อซ เลือดหยุดไหลเรียบร้อยดีไหมคะ',
      '2. มีอาการปวดตึง หรือแก้มบวมเพิ่มขึ้นมากไหมคะ',
      '3. รับประทานยาแก้ปวด/ยาฆ่าเชื้อตามที่คุณหมอสั่งได้ครบไหมคะ',
      '4. หากมีเลือดซึมไม่หยุด มีไข้ หรือปวดมากผิดปกติ แนะนำรีบติดต่อคลินิกเพื่อนัดตรวจซ้ำทันทีค่ะ'
    ],
    closingTh:
      'ขอให้หายไวๆ นะคะ หลีกเลี่ยงอาหารร้อนจัด เผ็ด และงดดูดหลอด 24 ชั่วโมงค่ะ'
  },
  {
    id: 'general_dental',
    labelTh: 'หลังทำฟันทั่วไป (อุด/ขูด/ราก)',
    labelEn: 'Post-Filling / Scaling / Root Canal',
    openingTh:
      'สวัสดีค่ะ โทรติดตามอาการหลังทำฟันจากคลินิกนะคะ ไม่ทราบว่าหลังทำฟันไปแล้วรู้สึกสบายดีไหมคะ',
    questionsTh: [
      '1. เวลากัดหรือเคี้ยวอาหาร มีอาการเสียวฟัน ปวด หรือรู้สึกสูงค้ำสบฟันไหมคะ',
      '2. บริเวณเหงือกมีอาการระบมหรือเลือดออกผิดปกติไหมคะ',
      '3. วัสดุอุดหรือยาอุดชั่วคราวยังอยู่ปกติดีใช่ไหมคะ'
    ],
    closingTh:
      'หากรู้สึกค้ำเวลาเคี้ยวหรือปวดมากขึ้น สามารถแจ้งทางคลินิกเพื่อเข้าปรับแก้ได้ตลอดนะคะ'
  },
  {
    id: 'denture',
    labelTh: 'ติดตามเคสใส่ฟันปลอม',
    labelEn: 'Denture Recall & Post-Delivery',
    openingTh:
      'สวัสดีค่ะ โทรติดตามอาการหลังรับฟันปลอมนะคะ ลองใส่ใช้งานแล้วเป็นอย่างไรบ้างคะ',
    questionsTh: [
      '1. เวลาใส่หรือเคี้ยวอาหาร มีจุดไหนกดเจ็บ เสียดสีเหงือก หรือหลวมขยับไหมคะ',
      '2. การออกเสียงพูดและการถอดล้างทำความสะอาดสะดวกดีไหมคะ',
      '3. สะดวกนัดเข้ามาตรวจเช็กและปรับฐานฟันปลอมให้ใส่สบายขึ้นวันไหนดีคะ'
    ],
    closingTh:
      'อย่าลืมถอดแช่น้ำสะอาดตอนกลางคืน และหากมีจุดกดเจ็บให้รีบมาปรับฐานฟันปลอมที่คลินิกนะคะ'
  },
  {
    id: 'custom',
    labelTh: 'สคริปต์กำหนดเอง',
    labelEn: 'Custom Call Script',
    openingTh: 'สวัสดีค่ะ โทรติดต่อติดตามอาการจากคลินิกทันตกรรมค่ะ',
    questionsTh: ['1. สอบถามอาการทั่วไปหลังรับบริการวันนี้เป็นอย่างไรบ้างคะ'],
    closingTh: 'ขอบพระคุณค่ะ หากมีข้อสงสัยติดต่อคลินิกได้ตลอดนะคะ'
  }
];

export interface FollowUpCallLog {
  id: string;
  createdAt: string;
  patientRefId: string;
  caseCategory: string;
  scriptType: FollowUpCallScriptType;
  outcome: FollowUpCallOutcome;
  patientNotes: string;
  usedExternalSip: boolean;
}

export interface FollowUpSipConfig {
  enabled: boolean;
  sipServerWss: string;
  sipExtension: string;
  outboundWebhookUrl: string;
}

export const FOLLOWUP_CALL_LOGS_PREFIX = 'dental_followup_calls_v1::';
export const FOLLOWUP_SIP_CONFIG_PREFIX = 'dental_followup_sip_config_v1::';

export function createDefaultSipConfig(): FollowUpSipConfig {
  return {
    enabled: false,
    sipServerWss: '',
    sipExtension: '',
    outboundWebhookUrl: ''
  };
}

export function loadFollowUpCallLogs(workspaceId: string): FollowUpCallLog[] {
  try {
    const raw = localStorage.getItem(`${FOLLOWUP_CALL_LOGS_PREFIX}${workspaceId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FollowUpCallLog[]) : [];
  } catch {
    return [];
  }
}

export function saveFollowUpCallLogs(workspaceId: string, logs: FollowUpCallLog[]): void {
  try {
    localStorage.setItem(
      `${FOLLOWUP_CALL_LOGS_PREFIX}${workspaceId}`,
      JSON.stringify(logs.slice(0, 120))
    );
  } catch {
    // ignore quota errors gracefully
  }
}

export function loadFollowUpSipConfig(workspaceId: string): FollowUpSipConfig {
  const fallback = createDefaultSipConfig();
  try {
    const raw = localStorage.getItem(`${FOLLOWUP_SIP_CONFIG_PREFIX}${workspaceId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<FollowUpSipConfig>;
    return {
      ...fallback,
      ...parsed,
      enabled: Boolean(parsed.enabled)
    };
  } catch {
    return fallback;
  }
}

export function saveFollowUpSipConfig(workspaceId: string, config: FollowUpSipConfig): void {
  try {
    localStorage.setItem(`${FOLLOWUP_SIP_CONFIG_PREFIX}${workspaceId}`, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function clearFollowUpCallStorage(workspaceId: string): void {
  try {
    localStorage.removeItem(`${FOLLOWUP_CALL_LOGS_PREFIX}${workspaceId}`);
    localStorage.removeItem(`${FOLLOWUP_SIP_CONFIG_PREFIX}${workspaceId}`);
  } catch {
    // ignore
  }
}
