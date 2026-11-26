import { maskSensitivePii, buildAiRequestError } from './aiService';
import { Language } from '../utils/i18n';

export type ChairsideStage =
  | 'history_symptom'
  | 'medical_screening'
  | 'exam_explanation'
  | 'consent_decision'
  | 'confirmed_extraction';

export interface ChairsideLanguagePreset {
  id: string;
  labelTh: string;
  labelEn: string;
  nativeName: string;
  bcp47: string;
  flag: string;
}

export const CHAIRSIDE_LANGUAGE_PRESETS: readonly ChairsideLanguagePreset[] = [
  {
    id: 'my',
    labelTh: 'พม่า (Burmese)',
    labelEn: 'Myanmar (Burmese)',
    nativeName: 'မြန်မာဘာသာ',
    bcp47: 'my-MM',
    flag: '🇲🇲'
  },
  {
    id: 'lo',
    labelTh: 'ลาว (Lao)',
    labelEn: 'Lao',
    nativeName: 'ພາສາລາວ',
    bcp47: 'lo-LA',
    flag: '🇱🇦'
  },
  {
    id: 'km',
    labelTh: 'กัมพูชา (Khmer)',
    labelEn: 'Khmer (Cambodian)',
    nativeName: 'ភាសាខ្មែរ',
    bcp47: 'km-KH',
    flag: '🇰🇭'
  },
  {
    id: 'en',
    labelTh: 'อังกฤษ (English)',
    labelEn: 'English',
    nativeName: 'English',
    bcp47: 'en-US',
    flag: '🇬🇧'
  },
  {
    id: 'zh',
    labelTh: 'จีนกลาง (Mandarin)',
    labelEn: 'Chinese (Mandarin)',
    nativeName: '中文',
    bcp47: 'zh-CN',
    flag: '🇨🇳'
  },
  {
    id: 'ja',
    labelTh: 'ญี่ปุ่น (Japanese)',
    labelEn: 'Japanese',
    nativeName: '日本語',
    bcp47: 'ja-JP',
    flag: '🇯🇵'
  },
  {
    id: 'ko',
    labelTh: 'เกาหลี (Korean)',
    labelEn: 'Korean',
    nativeName: '한국어',
    bcp47: 'ko-KR',
    flag: '🇰🇷'
  },
  {
    id: 'vi',
    labelTh: 'เวียดนาม (Vietnamese)',
    labelEn: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    bcp47: 'vi-VN',
    flag: '🇻🇳'
  }
];

export const CHAIRSIDE_CASE_PRESETS: ReadonlyArray<{
  id: string;
  labelTh: string;
  labelEn: string;
  promptValue: string;
}> = [
  {
    id: 'extraction',
    labelTh: 'เคสถอนฟัน',
    labelEn: 'Tooth Extraction',
    promptValue: 'เคสถอนฟัน (Tooth Extraction)'
  },
  {
    id: 'wisdom',
    labelTh: 'เคสผ่าฟันคุด',
    labelEn: 'Impacted Wisdom Tooth',
    promptValue: 'เคสผ่าฟันคุด (Wisdom Tooth Surgery)'
  },
  {
    id: 'filling',
    labelTh: 'อุดฟัน / เสียวฟัน',
    labelEn: 'Filling / Sensitivity',
    promptValue: 'เคสอุดฟัน / เสียวฟัน (Dental Filling)'
  },
  {
    id: 'root_canal',
    labelTh: 'รักษารากฟัน',
    labelEn: 'Root Canal Treatment',
    promptValue: 'เคสรักษารากฟัน (Root Canal)'
  },
  {
    id: 'scaling',
    labelTh: 'ขูดหินปูน / เหงือกบวม',
    labelEn: 'Scaling / Gum Care',
    promptValue: 'เคสขูดหินปูน / เหงือกอักเสบ (Scaling)'
  }
];

export interface ChairsideQuestionOption {
  labelThai: string;
  textThai: string;
  textTargetLang: string;
  pronunciationHint: string;
  stageHint: ChairsideStage;
}

export interface ChairsidePatientHint {
  textTargetLang: string;
  thaiMeaning: string;
  agreesToExtract: boolean;
}

export interface ChairsideMessage {
  id: string;
  role: 'assistant' | 'patient';
  timestamp: string;
  stage: ChairsideStage;
  /** For assistant: original Thai question/instruction. For patient: ALWAYS kept Thai translation! */
  textThai: string;
  /** For assistant: translated patient language script. For patient: original patient reply. */
  textTargetLang: string;
  pronunciationHint?: string;
}

export interface ChairsideCopilotApiResponse {
  patientReplyThaiTranslation: string;
  clinicalSummaryThai: string;
  nextStage: ChairsideStage;
  assistantThai: string;
  assistantTargetLang: string;
  pronunciationHint: string;
  nextQuestionOptions: ChairsideQuestionOption[];
  patientQuickAnswerHints: ChairsidePatientHint[];
  patientAgreedToExtract: boolean;
  model: string;
}

export interface ChairsideSessionState {
  selectedPresetId: string;
  customLanguageName: string;
  casePresetId: string;
  customCaseText: string;
  caseStarted: boolean;
  currentStage: ChairsideStage;
  confirmedExtraction: boolean;
  confirmedAt?: string;
  clinicalSummaryThai: string;
  messages: ChairsideMessage[];
  nextQuestionOptions: ChairsideQuestionOption[];
  patientQuickAnswerHints: ChairsidePatientHint[];
  recommendedReply: {
    textThai: string;
    textTargetLang: string;
    pronunciationHint?: string;
  } | null;
}

const STORAGE_PREFIX = 'dental_chairside_copilot_v1::';

export function createInitialChairsideSession(): ChairsideSessionState {
  return {
    selectedPresetId: 'my',
    customLanguageName: '',
    casePresetId: 'extraction',
    customCaseText: '',
    caseStarted: false,
    currentStage: 'history_symptom',
    confirmedExtraction: false,
    confirmedAt: undefined,
    clinicalSummaryThai: '',
    messages: [],
    nextQuestionOptions: [],
    patientQuickAnswerHints: [],
    recommendedReply: null
  };
}

export function loadChairsideSession(workspaceId: string): ChairsideSessionState {
  const fallback = createInitialChairsideSession();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${workspaceId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ChairsideSessionState>;
    return {
      ...fallback,
      ...parsed,
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-60) : [],
      nextQuestionOptions: Array.isArray(parsed.nextQuestionOptions)
        ? parsed.nextQuestionOptions
        : [],
      patientQuickAnswerHints: Array.isArray(parsed.patientQuickAnswerHints)
        ? parsed.patientQuickAnswerHints
        : []
    };
  } catch {
    return fallback;
  }
}

export function saveChairsideSession(workspaceId: string, state: ChairsideSessionState): void {
  try {
    const trimmed: ChairsideSessionState = {
      ...state,
      messages: state.messages.slice(-60)
    };
    localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, JSON.stringify(trimmed));
  } catch {
    // Ignore quota failure silently to keep chairside UI responsive on iPad
  }
}

export function clearChairsideSessionStorage(workspaceId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${workspaceId}`);
  } catch {
    // ignore
  }
}

/**
 * Resolve human-readable target language string and best-effort BCP-47 speech code
 * for Web Speech API (Voice-to-Text & TTS) from either preset or custom text input.
 */
export function resolveTargetLanguageMeta(
  selectedPresetId: string,
  customLanguageName: string
): { displayName: string; bcp47: string } {
  const custom = customLanguageName.trim();
  if (custom) {
    const lower = custom.toLowerCase();
    const keywordMap: Array<[RegExp, string]> = [
      [/พม่า|burmese|myanmar|မြန်မာ/, 'my-MM'],
      [/ลาว|lao|ລາວ/, 'lo-LA'],
      [/กัมพูชา|เขมร|khmer|cambodia|ខ្មែរ/, 'km-KH'],
      [/อังกฤษ|english/, 'en-US'],
      [/จีน|chinese|mandarin|中文/, 'zh-CN'],
      [/ไต้หวัน|taiwan/, 'zh-TW'],
      [/ญี่ปุ่น|japanese|日本語/, 'ja-JP'],
      [/เกาหลี|korean|한국/, 'ko-KR'],
      [/เวียดนาม|vietnam/, 'vi-VN'],
      [/อาหรับ|arabic|العربية/, 'ar-SA'],
      [/ฟิลิปปิน|ตากาล็อก|tagalog|filipino/, 'fil-PH'],
      [/อินโดนีเซีย|indonesi/, 'id-ID'],
      [/มาเลย์|malay|bahasa/, 'ms-MY'],
      [/ฮินดี|อินเดีย|hindi/, 'hi-IN'],
      [/ฝรั่งเศส|french/, 'fr-FR'],
      [/เยอรมัน|german/, 'de-DE'],
      [/สเปน|spanish/, 'es-ES'],
      [/รัสเซีย|russian/, 'ru-RU'],
      [/ไทย|thai/, 'th-TH']
    ];
    for (const [regex, code] of keywordMap) {
      if (regex.test(lower)) {
        return { displayName: custom, bcp47: code };
      }
    }
    if (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(custom)) {
      return { displayName: custom, bcp47: custom };
    }
    return { displayName: custom, bcp47: '' };
  }

  const preset =
    CHAIRSIDE_LANGUAGE_PRESETS.find((p) => p.id === selectedPresetId) ||
    CHAIRSIDE_LANGUAGE_PRESETS[0];
  return {
    displayName: preset.labelTh,
    bcp47: preset.bcp47
  };
}

export async function runChairsideCopilotTurn(params: {
  action: 'start_case' | 'patient_turn' | 'assistant_translate';
  caseType: string;
  targetLanguage: string;
  currentStage: ChairsideStage;
  patientReplyText?: string;
  assistantThaiText?: string;
  conversationHistory: ChairsideMessage[];
  uiLanguage: Language;
}): Promise<ChairsideCopilotApiResponse> {
  const { maskedText: maskedPatient } = maskSensitivePii(params.patientReplyText || '');
  const { maskedText: maskedAssistant } = maskSensitivePii(params.assistantThaiText || '');

  let response: Response;
  try {
    response = await fetch('/api/ai/chairside-copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: params.action,
        caseType: params.caseType,
        targetLanguage: params.targetLanguage,
        currentStage: params.currentStage,
        patientReplyText: maskedPatient,
        assistantThaiText: maskedAssistant,
        conversationHistory: params.conversationHistory.slice(-16).map((m) => ({
          role: m.role,
          textThai: m.textThai,
          textTargetLang: m.textTargetLang,
          stage: m.stage
        })),
        uiLanguage: params.uiLanguage
      })
    });
  } catch (err) {
    throw buildAiRequestError({
      status: 0,
      rawError: err instanceof Error ? err.message : 'Failed to fetch',
      uiLanguage: params.uiLanguage,
      fallbackTh: 'ไม่สามารถเชื่อมต่อผู้ช่วยสื่อสารหลายภาษาได้ชั่วคราว',
      fallbackEn: 'Unable to reach Chairside Language Copilot temporarily'
    });
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    error?: string;
    model?: string;
    data?: Omit<ChairsideCopilotApiResponse, 'model'>;
  } | null;

  if (!response.ok || !json?.ok || !json.data) {
    throw buildAiRequestError({
      status: response.status,
      code: json?.code,
      rawError: json?.error,
      uiLanguage: params.uiLanguage,
      fallbackTh: `เรียกใช้งานผู้ช่วยสื่อสารไม่สำเร็จ (HTTP ${response.status})`,
      fallbackEn: `Chairside copilot failed (HTTP ${response.status})`
    });
  }

  return {
    patientReplyThaiTranslation: json.data.patientReplyThaiTranslation || '',
    clinicalSummaryThai: json.data.clinicalSummaryThai || '',
    nextStage: json.data.nextStage || params.currentStage,
    assistantThai: json.data.assistantThai || '',
    assistantTargetLang: json.data.assistantTargetLang || '',
    pronunciationHint: json.data.pronunciationHint || '',
    nextQuestionOptions: Array.isArray(json.data.nextQuestionOptions)
      ? json.data.nextQuestionOptions
      : [],
    patientQuickAnswerHints: Array.isArray(json.data.patientQuickAnswerHints)
      ? json.data.patientQuickAnswerHints
      : [],
    patientAgreedToExtract: Boolean(json.data.patientAgreedToExtract),
    model: json.model || 'gemini-4-hydrogen'
  };
}
