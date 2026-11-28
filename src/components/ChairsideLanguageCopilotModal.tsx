import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Copy,
  Check,
  Languages,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Stethoscope,
  User,
  Volume2,
  X,
  AlertTriangle,
  MessageSquarePlus
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  CHAIRSIDE_CASE_PRESETS,
  CHAIRSIDE_LANGUAGE_PRESETS,
  ChairsideMessage,
  ChairsidePatientHint,
  ChairsideQuestionOption,
  ChairsideSessionState,
  ChairsideStage,
  clearChairsideSessionStorage,
  createInitialChairsideSession,
  loadChairsideSession,
  resolveTargetLanguageMeta,
  runChairsideCopilotTurn,
  saveChairsideSession
} from '../services/chairsideCopilotService';
import { AiServiceError } from '../services/aiService';
import {
  buildJudgeDemoChairsideSession,
  loadJudgeDemoAuxState,
  saveJudgeDemoAuxState
} from '../services/judgeDemoService';

interface ChairsideLanguageCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

const STAGE_STEPS: ReadonlyArray<{ id: ChairsideStage; labelTh: string; labelEn: string }> = [
  { id: 'history_symptom', labelTh: '1. ซักประวัติ/อาการ', labelEn: '1. History' },
  { id: 'medical_screening', labelTh: '2. โรคประจำตัว/แพ้ยา', labelEn: '2. Medical' },
  { id: 'exam_explanation', labelTh: '3. อธิบายแผนรักษา', labelEn: '3. Explain' },
  { id: 'consent_decision', labelTh: '4. ขอตกลงถอนฟัน', labelEn: '4. Consent' },
  { id: 'confirmed_extraction', labelTh: '5. ตกลงถอนฟันแล้ว', labelEn: '5. Confirmed' }
];

export const ChairsideLanguageCopilotModal: React.FC<ChairsideLanguageCopilotModalProps> = ({
  isOpen,
  onClose
}) => {
  const { language } = useLanguage();
  const { activeWorkspace, recordAudit, isJudgeDemoActive } = useWorkspace();
  const isEn = language === 'en';

  const [session, setSession] = useState<ChairsideSessionState>(() =>
    isJudgeDemoActive
      ? loadJudgeDemoAuxState(`chairside::${activeWorkspace.id}`, buildJudgeDemoChairsideSession())
      : loadChairsideSession(activeWorkspace.id)
  );
  const [patientInput, setPatientInput] = useState('');
  const [assistantInput, setAssistantInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [activeMicRole, setActiveMicRole] = useState<'patient' | 'assistant' | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [bigCardMessage, setBigCardMessage] = useState<{
    thai: string;
    target: string;
    hint?: string;
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [confirmResetPending, setConfirmResetPending] = useState(false);
  const [langOther, setLangOther] = useState(false);
  const [caseOther, setCaseOther] = useState(false);
  const [showPatientQuick, setShowPatientQuick] = useState(false);
  // Lock the page behind the modal so swiping inside scrolls the chat, not the background app.
  useEffect(() => {
    const els: HTMLElement[] = [document.body];
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) els.push(main);
    const prev = els.map((el) => el.style.overflow);
    els.forEach((el) => {
      el.style.overflow = 'hidden';
    });
    return () => {
      els.forEach((el, i) => {
        el.style.overflow = prev[i];
      });
    };
  }, []);
  /** read = patient reads the screen (works for every language); voice = speak/listen (languages with device voices). */
  const [mode, setMode] = useState<'read' | 'voice'>('read');

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Sync session when workspace or Judge Demo Mode changes
  useEffect(() => {
    if (isJudgeDemoActive) {
      setSession(
        loadJudgeDemoAuxState(`chairside::${activeWorkspace.id}`, buildJudgeDemoChairsideSession())
      );
      return;
    }
    setSession(loadChairsideSession(activeWorkspace.id));
  }, [activeWorkspace.id, isJudgeDemoActive]);

  // Persist lightweight session locally on browser (real storage untouched in Judge Demo Mode)
  useEffect(() => {
    if (isJudgeDemoActive) {
      saveJudgeDemoAuxState(`chairside::${activeWorkspace.id}`, session);
      return;
    }
    saveChairsideSession(activeWorkspace.id, session);
  }, [activeWorkspace.id, session, isJudgeDemoActive]);

  // Auto-scroll conversation log to bottom when new messages arrive
  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [session.messages.length, isLoading]);

  // Load device TTS voices ONLY while modal is open and clean up speech resources on unmount
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    const loadVoices = () => {
      if (!synth) return;
      try {
        setAvailableVoices(synth.getVoices());
      } catch {
        setAvailableVoices([]);
      }
    };

    loadVoices();
    if (synth && 'onvoiceschanged' in synth) {
      synth.addEventListener('voiceschanged', loadVoices);
    }

    return () => {
      if (synth) {
        if ('onvoiceschanged' in synth) {
          synth.removeEventListener('voiceschanged', loadVoices);
        }
        try {
          synth.cancel();
        } catch {
          // ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [isOpen]);

  const resolvedLang = useMemo(
    () => resolveTargetLanguageMeta(session.selectedPresetId, session.customLanguageName),
    [session.selectedPresetId, session.customLanguageName]
  );

  const resolvedCaseLabel = useMemo(() => {
    if (session.customCaseText.trim()) return session.customCaseText.trim();
    const found = CHAIRSIDE_CASE_PRESETS.find((c) => c.id === session.casePresetId);
    return found ? found.promptValue : CHAIRSIDE_CASE_PRESETS[0].promptValue;
  }, [session.casePresetId, session.customCaseText]);

  const hasSpeechRecognition = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const hasSpeechSynthesis = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    []
  );

  const matchingTargetVoice = useMemo(() => {
    if (!resolvedLang.bcp47 || availableVoices.length === 0) return null;
    const exact = resolvedLang.bcp47.toLowerCase();
    const base = exact.split('-')[0];
    return (
      availableVoices.find((v) => v.lang.toLowerCase() === exact) ||
      availableVoices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`)) ||
      availableVoices.find((v) => v.lang.toLowerCase() === base) ||
      null
    );
  }, [availableVoices, resolvedLang.bcp47]);

  const matchingThaiVoice = useMemo(() => {
    if (availableVoices.length === 0) return null;
    return (
      availableVoices.find((v) => v.lang.toLowerCase().startsWith('th')) || null
    );
  }, [availableVoices]);

  const stopAllSpeech = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setActiveMicRole(null);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setSpeakingMessageId(null);
  };

  const handleSpeakText = (
    messageId: string,
    text: string,
    mode: 'target' | 'thai'
  ) => {
    if (!text.trim()) return;
    if (!hasSpeechSynthesis) {
      setSpeechNotice(
        isEn
          ? 'This browser does not support Speech Synthesis. You can show the enlarged text card to the patient.'
          : 'อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง สามารถกดขยายการ์ดตัวใหญ่ให้คนไข้อ่านได้ทันที'
      );
      return;
    }

    const synth = window.speechSynthesis;
    if (speakingMessageId === messageId) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }

    try {
      synth.cancel();
      const targetLangCode = mode === 'thai' ? 'th-TH' : resolvedLang.bcp47;
      const chosenVoice = mode === 'thai' ? matchingThaiVoice : matchingTargetVoice;

      if (mode === 'target' && !chosenVoice && !targetLangCode) {
        setSpeechNotice(
          isEn
            ? `Device TTS does not have a voice code for "${resolvedLang.displayName}". Use "Show Large" for the patient.`
            : `อุปกรณ์นี้ยังไม่รองรับเสียงอ่านภาษา "${resolvedLang.displayName}" — สามารถกดขยายข้อความตัวใหญ่ให้คนไข้อ่านแทนได้`
        );
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (targetLangCode) utterance.lang = targetLangCode;
      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => {
        setSpeakingMessageId(null);
        setSpeechNotice(
          isEn
            ? `Unable to play audio for ${resolvedLang.displayName} on this device. Use "Show Large" instead.`
            : `อุปกรณ์นี้ไม่สามารถเล่นเสียงภาษา${resolvedLang.displayName}ได้ สามารถกดปุ่ม "ขยายให้คนไข้อ่าน" แทนได้ทันที`
        );
      };

      setSpeechNotice(null);
      setSpeakingMessageId(messageId);
      synth.speak(utterance);

      if (mode === 'target' && availableVoices.length > 0 && !chosenVoice) {
        setSpeechNotice(
          isEn
            ? `Note: No dedicated ${resolvedLang.displayName} voice installed on this device; audio may vary. "Show Large" is always crisp.`
            : `หมายเหตุ: อุปกรณ์นี้ไม่ได้ติดตั้งเสียงอ่านภาษา${resolvedLang.displayName}โดยตรง เสียงอาจไม่ชัดเท่าข้อความตัวใหญ่`
        );
      }
    } catch {
      setSpeakingMessageId(null);
    }
  };

  const handleToggleMic = (role: 'patient' | 'assistant') => {
    setSpeechNotice(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechNotice(
        isEn
          ? 'Microphone Voice-to-Text is not supported in this browser. You can type or tap quick patient answers below.'
          : 'เบราว์เซอร์นี้ไม่รองรับ Voice-to-Text สามารถพิมพ์หรือแตะตัวเลือกคำตอบด้านล่างได้ทันที'
      );
      return;
    }

    if (activeMicRole === role && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setActiveMicRole(null);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const micLang = role === 'assistant' ? 'th-TH' : resolvedLang.bcp47;
    if (role === 'patient' && !micLang) {
      setSpeechNotice(
        isEn
          ? `Voice-to-Text speech code is unavailable for "${resolvedLang.displayName}". Patient can type or tap quick answers.`
          : `ไมโครโฟนยังไม่มีรหัสเสียงพูดสำหรับภาษา "${resolvedLang.displayName}" — สามารถพิมพ์หรือแตะตัวเลือกคำตอบแทนได้`
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = micLang;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          if (item && item[0]?.transcript) {
            combined += item[0].transcript;
          }
        }
        if (combined.trim()) {
          if (role === 'patient') {
            setPatientInput(combined.trim());
          } else {
            setAssistantInput(combined.trim());
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errCode = event?.error || '';
        setActiveMicRole(null);
        recognitionRef.current = null;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setSpeechNotice(
            isEn
              ? 'Microphone permission denied. Please allow mic access or type/tap options.'
              : 'ไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณาอนุญาตไมค์ในเบราว์เซอร์ หรือพิมพ์/แตะตัวเลือกแทน'
          );
        } else if (errCode === 'language-not-supported') {
          setSpeechNotice(
            isEn
              ? `Speech recognition does not support "${resolvedLang.displayName}" on this device.`
              : `อุปกรณ์นี้ไม่รองรับการรับเสียงพูดภาษา${resolvedLang.displayName} สามารถพิมพ์หรือแตะตัวเลือกคำตอบได้`
          );
        } else if (errCode !== 'aborted') {
          setSpeechNotice(
            isEn
              ? 'Could not capture voice clearly. Please tap mic again or type.'
              : 'ไม่ได้ยินเสียงพูดชัดเจน กรุณากดไมค์อีกครั้งหรือพิมพ์ข้อความ'
          );
        }
      };

      recognition.onend = () => {
        setActiveMicRole(null);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setActiveMicRole(role);
      recognition.start();
    } catch {
      setActiveMicRole(null);
      setSpeechNotice(
        isEn
          ? 'Could not start microphone on this device.'
          : 'ไม่สามารถเปิดไมโครโฟนบนอุปกรณ์นี้ได้'
      );
    }
  };

  const makeTimeLabel = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleStartCase = async () => {
    stopAllSpeech();
    setErrorMsg(null);
    setSpeechNotice(null);
    setIsLoading(true);
    setConfirmResetPending(false);

    try {
      const res = await runChairsideCopilotTurn({
        action: 'start_case',
        caseType: resolvedCaseLabel,
        targetLanguage: resolvedLang.displayName,
        currentStage: 'history_symptom',
        conversationHistory: [],
        uiLanguage: language
      });

      const openingMsg: ChairsideMessage = {
        id: `cs-msg-${Date.now()}`,
        role: 'assistant',
        timestamp: makeTimeLabel(),
        stage: res.nextStage,
        textThai: res.assistantThai,
        textTargetLang: res.assistantTargetLang,
        pronunciationHint: res.pronunciationHint
      };

      setSession((prev) => ({
        ...prev,
        caseStarted: true,
        currentStage: res.nextStage,
        confirmedExtraction: false,
        confirmedAt: undefined,
        clinicalSummaryThai: res.clinicalSummaryThai,
        messages: [openingMsg],
        nextQuestionOptions: res.nextQuestionOptions,
        patientQuickAnswerHints: res.patientQuickAnswerHints,
        recommendedReply: {
          textThai: res.assistantThai,
          textTargetLang: res.assistantTargetLang,
          pronunciationHint: res.pronunciationHint
        }
      }));
      recordAudit('ai_assist', `Started Chairside Copilot (${resolvedCaseLabel} / ${resolvedLang.displayName})`);
    } catch (err) {
      setErrorMsg(
        err instanceof AiServiceError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unable to start case'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPatientReply = async (replyTextOverride?: string) => {
    const rawReply = (replyTextOverride !== undefined ? replyTextOverride : patientInput).trim();
    if (!rawReply || isLoading) return;

    stopAllSpeech();
    setErrorMsg(null);
    setIsLoading(true);
    if (replyTextOverride === undefined) {
      setPatientInput('');
    }

    try {
      const res = await runChairsideCopilotTurn({
        action: 'patient_turn',
        caseType: resolvedCaseLabel,
        targetLanguage: resolvedLang.displayName,
        currentStage: session.currentStage,
        patientReplyText: rawReply,
        conversationHistory: session.messages,
        uiLanguage: language
      });

      const patientMsg: ChairsideMessage = {
        id: `cs-pt-${Date.now()}`,
        role: 'patient',
        timestamp: makeTimeLabel(),
        stage: res.nextStage,
        // Keep Thai translation permanently on the patient turn!
        textThai: res.patientReplyThaiTranslation || rawReply,
        textTargetLang: rawReply
      };

      setSession((prev) => {
        const nextConfirmed = prev.confirmedExtraction || res.patientAgreedToExtract;
        const nextStageVal: ChairsideStage = nextConfirmed
          ? 'confirmed_extraction'
          : res.nextStage;
        return {
          ...prev,
          caseStarted: true,
          currentStage: nextStageVal,
          confirmedExtraction: nextConfirmed,
          confirmedAt: nextConfirmed && !prev.confirmedAt ? makeTimeLabel() : prev.confirmedAt,
          clinicalSummaryThai: res.clinicalSummaryThai || prev.clinicalSummaryThai,
          messages: [...prev.messages, patientMsg].slice(-60),
          nextQuestionOptions: res.nextQuestionOptions,
          patientQuickAnswerHints: res.patientQuickAnswerHints,
          recommendedReply: {
            textThai: res.assistantThai,
            textTargetLang: res.assistantTargetLang,
            pronunciationHint: res.pronunciationHint
          }
        };
      });
    } catch (err) {
      if (replyTextOverride === undefined) {
        setPatientInput(rawReply);
      }
      setErrorMsg(
        err instanceof AiServiceError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Translation failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAssistantOption = (option: ChairsideQuestionOption) => {
    stopAllSpeech();
    const newMsg: ChairsideMessage = {
      id: `cs-as-${Date.now()}`,
      role: 'assistant',
      timestamp: makeTimeLabel(),
      stage: option.stageHint || session.currentStage,
      textThai: option.textThai,
      textTargetLang: option.textTargetLang,
      pronunciationHint: option.pronunciationHint
    };
    setSession((prev) => ({
      ...prev,
      caseStarted: true,
      currentStage: prev.confirmedExtraction
        ? 'confirmed_extraction'
        : option.stageHint || prev.currentStage,
      messages: [...prev.messages, newMsg].slice(-60)
    }));
  };

  const handleUseRecommendedReply = () => {
    if (!session.recommendedReply) return;
    stopAllSpeech();
    const rec = session.recommendedReply;
    const newMsg: ChairsideMessage = {
      id: `cs-as-${Date.now()}`,
      role: 'assistant',
      timestamp: makeTimeLabel(),
      stage: session.currentStage,
      textThai: rec.textThai,
      textTargetLang: rec.textTargetLang,
      pronunciationHint: rec.pronunciationHint
    };
    setSession((prev) => ({
      ...prev,
      caseStarted: true,
      messages: [...prev.messages, newMsg].slice(-60),
      recommendedReply: null
    }));
  };

  const handleTranslateAssistantText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawThai = assistantInput.trim();
    if (!rawThai || isLoading) return;

    stopAllSpeech();
    setErrorMsg(null);
    setIsLoading(true);
    setAssistantInput('');

    try {
      const res = await runChairsideCopilotTurn({
        action: 'assistant_translate',
        caseType: resolvedCaseLabel,
        targetLanguage: resolvedLang.displayName,
        currentStage: session.currentStage,
        assistantThaiText: rawThai,
        conversationHistory: session.messages,
        uiLanguage: language
      });

      const assistantMsg: ChairsideMessage = {
        id: `cs-as-${Date.now()}`,
        role: 'assistant',
        timestamp: makeTimeLabel(),
        stage: session.confirmedExtraction ? 'confirmed_extraction' : res.nextStage,
        textThai: res.assistantThai || rawThai,
        textTargetLang: res.assistantTargetLang,
        pronunciationHint: res.pronunciationHint
      };

      setSession((prev) => ({
        ...prev,
        caseStarted: true,
        currentStage: prev.confirmedExtraction ? 'confirmed_extraction' : res.nextStage,
        clinicalSummaryThai: res.clinicalSummaryThai || prev.clinicalSummaryThai,
        messages: [...prev.messages, assistantMsg].slice(-60),
        nextQuestionOptions:
          res.nextQuestionOptions.length > 0 ? res.nextQuestionOptions : prev.nextQuestionOptions,
        patientQuickAnswerHints:
          res.patientQuickAnswerHints.length > 0
            ? res.patientQuickAnswerHints
            : prev.patientQuickAnswerHints
      }));
    } catch (err) {
      setAssistantInput(rawThai);
      setErrorMsg(
        err instanceof AiServiceError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Translation failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmExtractionStatus = () => {
    setSession((prev) => {
      const nextVal = !prev.confirmedExtraction;
      return {
        ...prev,
        confirmedExtraction: nextVal,
        confirmedAt: nextVal ? makeTimeLabel() : undefined,
        currentStage: nextVal ? 'confirmed_extraction' : 'consent_decision'
      };
    });
    recordAudit('task_update', `Chairside case extraction consent toggled (${resolvedCaseLabel})`);
  };

  const handleStartNewCase = () => {
    if (session.messages.length > 0 && !confirmResetPending) {
      setConfirmResetPending(true);
      return;
    }
    stopAllSpeech();
    setConfirmResetPending(false);
    setErrorMsg(null);
    setSpeechNotice(null);
    setPatientInput('');
    setAssistantInput('');
    setBigCardMessage(null);
    if (!isJudgeDemoActive) {
      clearChairsideSessionStorage(activeWorkspace.id);
    }
    setSession((prev) => ({
      ...createInitialChairsideSession(),
      selectedPresetId: prev.selectedPresetId,
      customLanguageName: prev.customLanguageName,
      casePresetId: prev.casePresetId,
      customCaseText: prev.customCaseText
    }));
  };

  const handleCopySummary = async () => {
    const summaryText = [
      `เคส: ${resolvedCaseLabel}`,
      `ภาษาคนไข้: ${resolvedLang.displayName}`,
      `สถานะ: ${session.confirmedExtraction ? `ตกลงถอนฟันแล้ว (${session.confirmedAt || ''})` : 'กำลังซักประวัติ/ปรึกษา'}`,
      session.clinicalSummaryThai ? `สรุปอาการ (ไทย): ${session.clinicalSummaryThai}` : '',
      '--- บทสนทนา ---',
      ...session.messages.map((m) =>
        m.role === 'assistant'
          ? `[ผู้ช่วย ${m.timestamp}] ${m.textThai} (${m.textTargetLang})`
          : `[คนไข้ ${m.timestamp}] คำแปลไทย: ${m.textThai} | ต้นฉบับ: ${m.textTargetLang}`
      )
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-label="Chairside Language Copilot"
    >
      <div className="glass-modal w-full max-w-5xl h-[94dvh] max-h-[94dvh] rounded-2xl flex flex-col overflow-hidden overscroll-contain text-slate-100">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/20 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/35 to-violet-500/35 border border-cyan-300/45 flex items-center justify-center text-cyan-200 shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {isEn
                    ? 'Chairside Language Copilot'
                    : 'ผู้ช่วยสื่อสารและโต้ตอบหลายภาษา (Chairside Language Copilot)'}
                </h2>
                {session.confirmedExtraction && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/25 border border-emerald-400/50 text-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      ตกลงถอนฟันแล้ว{session.confirmedAt ? ` · ${session.confirmedAt}` : ''}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {resolvedLang.displayName} · {resolvedCaseLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmExtractionStatus}
              className={`crystal-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                session.confirmedExtraction
                  ? 'bg-emerald-600/80 border border-emerald-300/60 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{session.confirmedExtraction ? 'ยืนยัน: ตกลงถอนฟันแล้ว ✓' : 'ตกลงถอนฟันแล้ว'}</span>
            </button>

            {!confirmResetPending ? (
              <button
                type="button"
                onClick={handleStartNewCase}
                className="crystal-tile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300/40 text-amber-100 hover:bg-amber-500/20 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                <span>เริ่มเคสใหม่</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStartNewCase}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  ยืนยันเริ่มเคสใหม่
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetPending(false)}
                  className="crystal-tile px-2.5 py-1.5 rounded-xl text-xs text-slate-200 cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                stopAllSpeech();
                onClose();
              }}
              aria-label="Close"
              className="crystal-tile p-1.5 rounded-xl text-slate-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Setup Bar (simplified): 2 dropdowns + 1 start button + 1 status line */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/15 space-y-2 shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-xs font-semibold text-cyan-200">ภาษาคนไข้</span>
              <select
                value={
                  langOther || session.customLanguageName.trim()
                    ? '__other'
                    : session.selectedPresetId
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other') {
                    setLangOther(true);
                  } else {
                    setLangOther(false);
                    setSession((prev) => ({
                      ...prev,
                      selectedPresetId: v as typeof prev.selectedPresetId,
                      customLanguageName: ''
                    }));
                  }
                }}
                className="glass-input min-h-[44px] px-3 rounded-xl text-sm font-medium"
              >
                {CHAIRSIDE_LANGUAGE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.flag} {preset.labelTh.split(' ')[0]}
                  </option>
                ))}
                <option value="__other">🌐 ภาษาอื่น (พิมพ์เอง)</option>
              </select>
            </label>
            {(langOther || session.customLanguageName.trim()) && (
              <input
                type="text"
                value={session.customLanguageName}
                onChange={(e) =>
                  setSession((prev) => ({ ...prev, customLanguageName: e.target.value }))
                }
                placeholder="เช่น อาหรับ, ไทใหญ่, Tagalog"
                className="glass-input min-h-[44px] w-48 px-3 rounded-xl text-sm"
              />
            )}

            <label className="flex flex-col gap-1 min-w-[170px]">
              <span className="text-xs font-semibold text-violet-200">ประเภทเคส</span>
              <select
                value={
                  caseOther || session.customCaseText.trim() ? '__other' : session.casePresetId
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other') {
                    setCaseOther(true);
                  } else {
                    setCaseOther(false);
                    setSession((prev) => ({
                      ...prev,
                      casePresetId: v as typeof prev.casePresetId,
                      customCaseText: ''
                    }));
                  }
                }}
                className="glass-input min-h-[44px] px-3 rounded-xl text-sm font-medium"
              >
                {CHAIRSIDE_CASE_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelTh}
                  </option>
                ))}
                <option value="__other">✏️ เคสอื่น (พิมพ์เอง)</option>
              </select>
            </label>
            {(caseOther || session.customCaseText.trim()) && (
              <input
                type="text"
                value={session.customCaseText}
                onChange={(e) =>
                  setSession((prev) => ({ ...prev, customCaseText: e.target.value }))
                }
                placeholder="พิมพ์อาการ/เคส"
                className="glass-input min-h-[44px] w-48 px-3 rounded-xl text-sm"
              />
            )}

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleStartCase()}
              className="crystal-btn inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50 shrink-0 ml-auto"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{session.messages.length === 0 ? 'เริ่มซักประวัติ' : 'เริ่มซักประวัติใหม่'}</span>
            </button>
          </div>

          {/* One status line: current step + only real warnings */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="font-semibold text-cyan-100">
              {(() => {
                const idx = STAGE_STEPS.findIndex((st) => st.id === session.currentStage);
                const cur = STAGE_STEPS[idx >= 0 ? idx : 0];
                return `ขั้นตอน ${(idx >= 0 ? idx : 0) + 1}/${STAGE_STEPS.length} · ${cur.labelTh}`;
              })()}
            </span>
            <span className="text-amber-200/90">
              {!hasSpeechSynthesis || !matchingTargetVoice
                ? `ไม่มีเสียงอ่าน${resolvedLang.displayName.split(' ')[0]}ในเครื่องนี้ ใช้ปุ่ม "ขยายให้คนไข้อ่าน" แทน`
                : ''}
              {!hasSpeechRecognition ? ' · ไมค์ไม่รองรับ ใช้การพิมพ์แทน' : ''}
            </span>
          </div>

          {/* Mode switch: reading vs voice dialogue */}
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="โหมดสื่อสาร">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'read'}
              onClick={() => {
                stopAllSpeech();
                setMode('read');
              }}
              className={`min-h-[44px] rounded-xl border text-xs font-bold cursor-pointer ${
                mode === 'read'
                  ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white border-cyan-300/60'
                  : 'crystal-tile text-slate-200 border-white/20'
              }`}
            >
              📖 โหมดอ่าน — ให้คนไข้อ่านจอ (ได้ทุกภาษา)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'voice'}
              onClick={() => setMode('voice')}
              className={`min-h-[44px] rounded-xl border text-xs font-bold cursor-pointer ${
                mode === 'voice'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-violet-300/60'
                  : 'crystal-tile text-slate-200 border-white/20'
              }`}
            >
              🎙️ โหมดเสียงโต้ตอบ — พูด/ฟัง
            </button>
          </div>
          {mode === 'voice' && (!hasSpeechSynthesis || !matchingTargetVoice) && (
            <p className="text-[11px] text-amber-200">
              ภาษานี้ไม่มีเสียงอ่านในเครื่อง โหมดเสียงจะอ่านออกเสียงไม่ได้ แนะนำสลับไปโหมดอ่าน
            </p>
          )}
        </div>

        {/* Clinical Summary Strip (Thai) when gathered */}
        {mode === 'voice' && session.clinicalSummaryThai && (
          <div className="px-4 sm:px-5 py-2 border-b border-white/15 bg-emerald-500/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-start gap-2 min-w-0">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-100 leading-snug line-clamp-2">
                <strong className="text-emerald-200">สรุปข้อมูลเคส (ไทย): </strong>
                {session.clinicalSummaryThai}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-emerald-100 shrink-0 cursor-pointer"
            >
              {copiedSummary ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSummary ? 'คัดลอกแล้ว' : 'คัดลอกสรุปเคส'}</span>
            </button>
          </div>
        )}

        {/* Warnings / Speech Notices */}
        {(errorMsg || speechNotice) && (
          <div className="px-4 sm:px-5 pt-2 shrink-0 space-y-1.5">
            {errorMsg && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-400/45 px-3 py-2 text-xs text-rose-100 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                  <span>{errorMsg}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-[10px] underline cursor-pointer shrink-0"
                >
                  ปิด
                </button>
              </div>
            )}
            {speechNotice && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-3 py-1.5 text-[11px] text-amber-100 flex items-center justify-between gap-2">
                <span>{speechNotice}</span>
                <button
                  type="button"
                  onClick={() => setSpeechNotice(null)}
                  className="text-[10px] underline cursor-pointer shrink-0"
                >
                  ปิด
                </button>
              </div>
            )}
          </div>
        )}

        {/* Persistent Conversation Scroll Area */}
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-[22vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] px-4 sm:px-5 py-3 space-y-3"
        >
          {session.messages.length === 0 ? (
            <div className="crystal-tile rounded-2xl border border-dashed border-cyan-300/35 p-6 text-center space-y-3 my-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-300/40 flex items-center justify-center text-cyan-200 mx-auto">
                <Languages className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  พร้อมช่วยสื่อสารข้างเก้าอี้ทำฟัน ({resolvedLang.displayName})
                </h3>
                <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                  เลือกภาษาคนไข้และประเภทเคสด้านบน แล้วกด{' '}
                  <strong className="text-cyan-200">“เริ่มเคส • ให้ AI เปิดคำถามซักประวัติ”</strong>{' '}
                  AI จะเปิดคำถามซักอาการหลัก ฟันบน/ล่าง และลักษณะปวดเป็นภาษาของคนไข้ทันที
                  และจะเก็บคำแปลภาษาไทยค้างไว้ในบทสนทนาตลอดจนตกลงถอนฟัน
                </p>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleStartCase()}
                className="crystal-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-bold cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>เริ่มเคส {resolvedCaseLabel} เลย</span>
              </button>
            </div>
          ) : (
            session.messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const isSpeaking = speakingMessageId === msg.id;

              if (isAssistant) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="crystal-tile max-w-[92%] sm:max-w-[82%] rounded-2xl p-3.5 border border-cyan-400/35 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 font-bold text-cyan-200">
                          <Stethoscope className="w-3 h-3" />
                          <span>ผู้ช่วย / AI · {msg.timestamp}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleSpeakText(msg.id, msg.textTargetLang, 'target')
                            }
                            className={`${mode === 'voice' ? 'inline-flex' : 'hidden'} items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                              isSpeaking
                                ? 'bg-rose-500/25 border-rose-300/55 text-rose-100'
                                : 'bg-cyan-500/20 border-cyan-300/40 text-cyan-100 hover:bg-cyan-500/30'
                            }`}
                          >
                            {isSpeaking ? (
                              <Square className="w-2.5 h-2.5" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                            <span>{isSpeaking ? 'หยุดเสียง' : 'ฟังเสียง'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setBigCardMessage({
                                thai: msg.textThai,
                                target: msg.textTargetLang,
                                hint: msg.pronunciationHint
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-[10px] font-medium text-slate-100 cursor-pointer"
                          >
                            <Maximize2 className="w-2.5 h-2.5" />
                            <span>ขยายให้คนไข้อ่าน</span>
                          </button>
                        </div>
                      </div>

                      {/* Target language message (Large, crisp for patient) */}
                      <p className={`${mode === 'read' ? 'text-xl sm:text-3xl leading-snug' : 'text-sm sm:text-base leading-relaxed'} font-semibold text-white`}>
                        {msg.textTargetLang}
                      </p>

                      {msg.pronunciationHint && (
                        <p className={`${mode === 'read' ? 'text-sm sm:text-lg' : 'text-[11px]'} text-cyan-200/90 italic`}>
                          คำอ่านช่วยออกเสียง: {msg.pronunciationHint}
                        </p>
                      )}

                      {/* Assistant Thai reference always visible */}
                      <div className="pt-1.5 border-t border-white/15 text-xs text-slate-200">
                        <span className="text-[10px] font-semibold text-violet-200 mr-1.5">
                          [ไทย]:
                        </span>
                        <span>{msg.textThai}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Patient reply bubble — ALWAYS preserves Thai translation inside!
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="glass-subcard max-w-[92%] sm:max-w-[82%] rounded-2xl p-3.5 border border-violet-300/45 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="inline-flex items-center gap-1 font-bold text-violet-200">
                        <User className="w-3 h-3" />
                        <span>คนไข้ตอบ · {msg.timestamp}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSpeakText(msg.id, msg.textThai, 'thai')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/20 border border-violet-300/40 text-violet-100 text-[10px] cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>อ่านคำแปลไทย</span>
                      </button>
                    </div>

                    {/* Pinned Thai Translation (Never vanishes across turns) */}
                    <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-3 py-2">
                      <span className="block text-[10px] font-bold text-emerald-200 mb-0.5">
                        คำแปลภาษาไทย (ค้างไว้ในบทสนทนา):
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                        {msg.textThai}
                      </p>
                    </div>

                    {/* Original Patient Language */}
                    <p className="text-xs text-slate-200/95">
                      <span className="text-[10px] text-slate-400 mr-1">[ต้นฉบับ]:</span>
                      {msg.textTargetLang}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-cyan-200 px-2 py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI กำลังแปลภาษาและเตรียมตัวเลือกโต้ตอบถัดไป...</span>
            </div>
          )}
        </div>

        {/* AI Recommended Next Reply + Sequential Options + Patient Quick Chips */}
        {session.caseStarted && (
          <div className={`px-4 sm:px-5 py-2.5 border-t border-white/15 space-y-2 ${mode === 'read' ? 'max-h-[22vh]' : 'max-h-[30vh]'} overflow-y-auto overscroll-contain touch-pan-y shrink-0`}>
            {/* Recommended AI next turn (when patient just replied) */}
            {session.recommendedReply &&
              session.messages[session.messages.length - 1]?.role === 'patient' && (
                <div className="rounded-xl bg-cyan-500/15 border border-cyan-300/45 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[10px] font-bold text-cyan-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>AI แนะนำคำถาม/คำตอบถัดไป:</span>
                    </div>
                    <p className="text-xs font-semibold text-white">
                      {session.recommendedReply.textThai}
                    </p>
                    <p className="text-[11px] text-cyan-100">
                      {session.recommendedReply.textTargetLang}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleSpeakText(
                          'rec-preview',
                          session.recommendedReply?.textTargetLang || '',
                          'target'
                        )
                      }
                      className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-cyan-100 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>ฟังเสียง</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUseRecommendedReply}
                      className="crystal-btn px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>ส่งคำถามนี้ให้คนไข้</span>
                    </button>
                  </div>
                </div>
              )}

            {/* Sequential Assistant Follow-up Options (up to ตกลงถอนฟัน) */}
            {session.nextQuestionOptions.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-violet-200">
                  ขั้นถัดไป — แตะ 1 ปุ่มเพื่อส่งให้คนไข้
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {session.nextQuestionOptions.map((opt, idx) => (
                    <button
                      key={`${opt.labelThai}-${idx}`}
                      type="button"
                      onClick={() => handleSendAssistantOption(opt)}
                      className="crystal-tile px-2.5 py-1.5 rounded-xl border border-violet-300/35 hover:border-cyan-300/60 text-left text-[11px] cursor-pointer transition-colors max-w-full"
                    >
                      <span className="font-bold text-cyan-200 block truncate">
                        {idx + 1}. {opt.labelThai}
                      </span>
                      <span className="text-[10px] text-slate-200 line-clamp-1">
                        {opt.textThai}
                      </span>
                      <span className="text-[11px] text-white line-clamp-2 mt-0.5">
                        {opt.textTargetLang}
                      </span>
                      {opt.pronunciationHint && (
                        <span className="text-[10px] text-cyan-200/90 italic line-clamp-1">
                          อ่านว่า: {opt.pronunciationHint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Tap Patient Answers (helps patient reply easily on iPad) */}
            {session.patientQuickAnswerHints.length > 0 && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setShowPatientQuick((v) => !v)}
                  aria-expanded={showPatientQuick}
                  className="crystal-tile min-h-[44px] px-3 rounded-xl border border-emerald-300/40 text-[11px] font-semibold text-emerald-100 cursor-pointer"
                >
                  {showPatientQuick ? 'ซ่อนคำตอบด่วนให้คนไข้แตะ ▲' : 'ยื่น iPad ให้คนไข้แตะตอบ ▼'}
                </button>
                <div className={`${showPatientQuick ? 'flex' : 'hidden'} flex-wrap gap-1.5`}>
                  {session.patientQuickAnswerHints.map((hint: ChairsidePatientHint, idx) => (
                    <button
                      key={`${hint.thaiMeaning}-${idx}`}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleSendPatientReply(hint.textTargetLang)}
                      className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] cursor-pointer transition-colors disabled:opacity-50 ${
                        hint.agreesToExtract
                          ? 'bg-emerald-500/25 border-emerald-300/60 text-emerald-100 font-semibold'
                          : 'crystal-tile border-white/25 text-slate-100 hover:border-emerald-300/50'
                      }`}
                    >
                      <span className="block font-semibold">{hint.textTargetLang}</span>
                      <span className="block text-[10px] text-slate-300">({hint.thaiMeaning})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dual Input Footer: Patient Reply (Translate -> Thai) & Assistant Thai Reply (Translate -> Patient) */}
        <div className="px-4 sm:px-5 py-3 border-t border-white/20 grid grid-cols-1 lg:grid-cols-2 gap-2.5 shrink-0">
          {/* Patient Reply Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendPatientReply();
            }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => handleToggleMic('patient')}
              title={`ไมค์คนไข้ (${resolvedLang.displayName})`}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold ${mode === 'voice' ? 'inline-flex' : 'hidden'} items-center gap-1 cursor-pointer shrink-0 ${
                activeMicRole === 'patient'
                  ? 'bg-rose-600 border-rose-300 text-white'
                  : 'crystal-tile border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/20'
              }`}
            >
              {activeMicRole === 'patient' ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {activeMicRole === 'patient' ? 'หยุด' : 'ไมค์คนไข้'}
              </span>
            </button>
            <input
              type="text"
              value={patientInput}
              onChange={(e) => setPatientInput(e.target.value)}
              placeholder={`คำตอบคนไข้ (${resolvedLang.displayName.split(' ')[0]})...`}
              className="glass-input flex-1 min-w-0 px-3 py-2 rounded-xl text-xs"
            />
            <button
              type="submit"
              disabled={isLoading || !patientInput.trim()}
              className="crystal-btn px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>แปลเป็นไทย</span>
            </button>
          </form>

          {/* Assistant Thai Reply Box */}
          <form onSubmit={(e) => void handleTranslateAssistantText(e)} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleToggleMic('assistant')}
              title="ไมค์ผู้ช่วย (ภาษาไทย)"
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold ${mode === 'voice' ? 'inline-flex' : 'hidden'} items-center gap-1 cursor-pointer shrink-0 ${
                activeMicRole === 'assistant'
                  ? 'bg-rose-600 border-rose-300 text-white'
                  : 'crystal-tile border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20'
              }`}
            >
              {activeMicRole === 'assistant' ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {activeMicRole === 'assistant' ? 'หยุด' : 'ไมค์ไทย'}
              </span>
            </button>
            <input
              type="text"
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              placeholder="ผู้ช่วยพิมพ์/พูดภาษาไทย เพื่อแปลให้คนไข้..."
              className="glass-input flex-1 min-w-0 px-3 py-2 rounded-xl text-xs"
            />
            <button
              type="submit"
              disabled={isLoading || !assistantInput.trim()}
              className="crystal-btn px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 shrink-0"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>แปลส่งคนไข้</span>
            </button>
          </form>
        </div>
      </div>

      {/* Patient Big-Text Reading Card Overlay */}
      {bigCardMessage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/80"
          onClick={() => setBigCardMessage(null)}
        >
          <div
            className="glass-modal w-full max-w-2xl rounded-2xl p-6 sm:p-8 space-y-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs text-cyan-200">
              <span className="font-bold">{resolvedLang.displayName}</span>
              <button
                type="button"
                onClick={() => setBigCardMessage(null)}
                className="crystal-tile px-3 py-1 rounded-lg text-slate-100 cursor-pointer"
              >
                ปิด
              </button>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white leading-relaxed">
              {bigCardMessage.target}
            </p>
            {bigCardMessage.hint && (
              <p className="text-sm text-cyan-200 italic">{bigCardMessage.hint}</p>
            )}
            <div className="pt-3 border-t border-white/20 text-sm text-slate-200">
              {bigCardMessage.thai}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() =>
                  handleSpeakText('big-card-speak', bigCardMessage.target, 'target')
                }
                className="crystal-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-sm font-bold cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>ฟังเสียง</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
