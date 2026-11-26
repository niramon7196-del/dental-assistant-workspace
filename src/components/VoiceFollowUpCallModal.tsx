import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOutgoing,
  Settings,
  Trash2,
  Volume2,
  X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  FOLLOW_UP_CALL_SCRIPTS,
  FollowUpCallLog,
  FollowUpCallOutcome,
  FollowUpCallScriptType,
  FollowUpSipConfig,
  loadFollowUpCallLogs,
  loadFollowUpSipConfig,
  saveFollowUpCallLogs,
  saveFollowUpSipConfig
} from '../services/followUpCallService';
import {
  buildJudgeDemoFollowUpCalls,
  loadJudgeDemoAuxState,
  saveJudgeDemoAuxState
} from '../services/judgeDemoService';

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

export interface VoiceFollowUpPreset {
  patientRefId?: string;
  caseCategory?: string;
  scriptType?: FollowUpCallScriptType;
  openSipDrawer?: boolean;
}

interface VoiceFollowUpCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset?: VoiceFollowUpPreset | null;
  onOutcomeLogged?: (log: FollowUpCallLog) => void;
}

const OUTCOME_OPTIONS: ReadonlyArray<{
  id: FollowUpCallOutcome;
  labelTh: string;
  labelEn: string;
  badgeCls: string;
}> = [
  {
    id: 'normal_recovery',
    labelTh: 'อาการปกติ / ดูแลต่อที่บ้าน',
    labelEn: 'Normal Recovery',
    badgeCls: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40'
  },
  {
    id: 'needs_recheck',
    labelTh: 'มีอาการปวด/บวม — นัดตรวจซ้ำ',
    labelEn: 'Pain/Swelling — Needs Recheck',
    badgeCls: 'bg-rose-500/20 text-rose-100 border-rose-300/40'
  },
  {
    id: 'appointment_booked',
    labelTh: 'ตกลงนัดเข้าคลินิกแล้ว',
    labelEn: 'Follow-up Booked',
    badgeCls: 'bg-cyan-500/20 text-cyan-100 border-cyan-300/40'
  },
  {
    id: 'no_answer',
    labelTh: 'ติดต่อไม่ได้ / รอโทรซ้ำ',
    labelEn: 'No Answer / Retry',
    badgeCls: 'bg-amber-500/20 text-amber-100 border-amber-300/40'
  }
];

export const VoiceFollowUpCallModal: React.FC<VoiceFollowUpCallModalProps> = ({
  isOpen,
  onClose,
  preset,
  onOutcomeLogged
}) => {
  const { language } = useLanguage();
  const { activeWorkspace, recordAudit, isJudgeDemoActive } = useWorkspace();
  const isEn = language === 'en';

  const [logs, setLogs] = useState<FollowUpCallLog[]>(() =>
    isJudgeDemoActive
      ? loadJudgeDemoAuxState(`fcall::${activeWorkspace.id}`, buildJudgeDemoFollowUpCalls())
      : loadFollowUpCallLogs(activeWorkspace.id)
  );
  const [sipConfig, setSipConfig] = useState<FollowUpSipConfig>(() =>
    loadFollowUpSipConfig(activeWorkspace.id)
  );

  const [patientRefId, setPatientRefId] = useState(preset?.patientRefId || '');
  const [caseCategory, setCaseCategory] = useState(preset?.caseCategory || 'หลังถอนฟัน');
  const [scriptType, setScriptType] = useState<FollowUpCallScriptType>(
    preset?.scriptType || 'extraction'
  );
  const [customScriptText, setCustomScriptText] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [outcome, setOutcome] = useState<FollowUpCallOutcome>('normal_recovery');

  const [isListening, setIsListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showSipDrawer, setShowSipDrawer] = useState(Boolean(preset?.openSipDrawer));
  const [sipSavedToast, setSipSavedToast] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  useEffect(() => {
    if (isJudgeDemoActive) {
      setLogs(loadJudgeDemoAuxState(`fcall::${activeWorkspace.id}`, buildJudgeDemoFollowUpCalls()));
    } else {
      setLogs(loadFollowUpCallLogs(activeWorkspace.id));
    }
    setSipConfig(loadFollowUpSipConfig(activeWorkspace.id));
  }, [activeWorkspace.id, isJudgeDemoActive]);

  useEffect(() => {
    if (!isOpen) return;
    if (preset?.patientRefId !== undefined) setPatientRefId(preset.patientRefId);
    if (preset?.caseCategory !== undefined) setCaseCategory(preset.caseCategory);
    if (preset?.scriptType !== undefined) setScriptType(preset.scriptType);
    if (preset?.openSipDrawer !== undefined) setShowSipDrawer(Boolean(preset.openSipDrawer));
  }, [isOpen, preset]);

  useEffect(() => {
    if (isJudgeDemoActive) {
      saveJudgeDemoAuxState(`fcall::${activeWorkspace.id}`, logs);
      return;
    }
    saveFollowUpCallLogs(activeWorkspace.id, logs);
  }, [activeWorkspace.id, logs, isJudgeDemoActive]);

  // Stop voice recognition & synthesis immediately on close/unmount
  useEffect(() => {
    const cleanupSpeech = () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
      setIsSpeaking(false);
    };

    if (!isOpen) {
      cleanupSpeech();
    }
    return cleanupSpeech;
  }, [isOpen]);

  const activeTemplate = useMemo(
    () =>
      FOLLOW_UP_CALL_SCRIPTS.find((s) => s.id === scriptType) || FOLLOW_UP_CALL_SCRIPTS[0],
    [scriptType]
  );

  const fullScriptString = useMemo(() => {
    if (scriptType === 'custom' && customScriptText.trim()) {
      return customScriptText.trim();
    }
    return [
      activeTemplate.openingTh,
      ...activeTemplate.questionsTh,
      activeTemplate.closingTh
    ].join('\n');
  }, [activeTemplate, scriptType, customScriptText]);

  const hasMicSupport = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const hasTtsSupport = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    []
  );

  if (!isOpen) return null;

  const handleSpeakScript = () => {
    if (!hasTtsSupport) return;
    const synth = window.speechSynthesis;
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(fullScriptString);
    utter.lang = 'th-TH';
    utter.rate = 0.96;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synth.speak(utter);
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(fullScriptString);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1800);
    } catch {
      // ignore
    }
  };

  const toggleVoiceNoteMic = () => {
    setSpeechNotice(null);
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechNotice(
        isEn
          ? 'Microphone dictation is not supported on this browser — please type patient notes below.'
          : 'อุปกรณ์นี้ไม่รองรับการถอดเสียงไมค์อัตโนมัติ สามารถพิมพ์บันทึกอาการคนไข้ด้านล่างได้ทันที'
      );
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = 'th-TH';
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i += 1) {
          const item = ev.results[i];
          if (item && item[0]?.transcript) {
            parts.push(item[0].transcript.trim());
          }
        }
        const captured = parts.join(' ').trim();
        if (captured) {
          setPatientNotes((prev) => (prev.trim() ? `${prev.trim()} ${captured}` : captured));
        }
      };
      rec.onerror = () => {
        setSpeechNotice(
          isEn
            ? 'Could not capture mic input — you can type notes directly.'
            : 'ไม่สามารถรับเสียงจากไมค์ได้ในขณะนี้ สามารถพิมพ์บันทึกอาการแทนได้ทันที'
        );
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setSpeechNotice(
        isEn ? 'Microphone could not be started.' : 'ไม่สามารถเปิดไมโครโฟนได้'
      );
      setIsListening(false);
    }
  };

  const handleSaveCallLog = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog: FollowUpCallLog = {
      id: `fcall-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      patientRefId: patientRefId.trim() || 'PT-UNSPECIFIED',
      caseCategory: caseCategory.trim() || activeTemplate.labelTh,
      scriptType,
      outcome,
      patientNotes: patientNotes.trim(),
      usedExternalSip: sipConfig.enabled && Boolean(sipConfig.sipExtension.trim())
    };
    setLogs((prev) => [newLog, ...prev]);
    onOutcomeLogged?.(newLog);
    recordAudit(
      'task_update',
      `Voice Follow-up logged (${newLog.patientRefId}: ${newLog.outcome})`
    );
    setPatientNotes('');
    setSavedNotice(
      isEn
        ? 'Follow-up call outcome saved locally.'
        : 'บันทึกผลการโทรติดตามอาการลงเครื่องเรียบร้อย'
    );
    setTimeout(() => setSavedNotice(null), 2600);
  };

  const handleSaveSipConfig = () => {
    saveFollowUpSipConfig(activeWorkspace.id, sipConfig);
    setSipSavedToast(true);
    setTimeout(() => setSipSavedToast(false), 2000);
  };

  const handleTriggerExternalSip = async () => {
    if (!sipConfig.enabled) return;
    if (sipConfig.outboundWebhookUrl.trim()) {
      try {
        await fetch(sipConfig.outboundWebhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientRefId: patientRefId.trim() || 'PT-UNSPECIFIED',
            extension: sipConfig.sipExtension.trim(),
            caseCategory
          })
        });
        setSavedNotice(
          isEn ? 'Outbound SIP webhook triggered.' : 'ส่งสัญญาณโทรออกไปยังระบบ SIP Webhook แล้ว'
        );
      } catch {
        setSpeechNotice(
          isEn
            ? 'Could not reach SIP webhook — built-in script mode remains ready.'
            : 'เชื่อมต่อ Webhook ไม่สำเร็จ (ยังใช้งานสคริปต์และบันทึกผลในตัวได้ตามปกติ)'
        );
      }
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[102] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/15 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-300/35 flex items-center justify-center text-emerald-200 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {isEn
                  ? 'Built-in Voice Follow-up Copilot'
                  : 'โมดูลโทรติดตามอาการในตัว (Voice Follow-up)'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                {isEn
                  ? 'Ready right inside your browser with guided scripts, voice notes & quick status logging (Optional SIP supported).'
                  : 'ใช้งานได้ทันทีบนเว็บโดยไม่ต้องต่อระบบโทรภายนอก พร้อมสคริปต์ บันทึกเสียงเป็นข้อความ และอัปเดตสถานะเคส'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSipDrawer((v) => !v)}
              className={`crystal-tile px-3 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                sipConfig.enabled ? 'text-cyan-200 border-cyan-300/40' : 'text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{isEn ? 'SIP Settings (Optional)' : 'ตั้งค่า SIP (ทางเลือก)'}</span>
              {showSipDrawer ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="crystal-tile p-2 rounded-xl text-slate-200 hover:text-white cursor-pointer"
              aria-label={isEn ? 'Close' : 'ปิด'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Collapsible SIP Drawer (never blocks built-in workflow) */}
        {showSipDrawer && (
          <div className="px-5 py-3 bg-slate-950/50 border-b border-white/15 space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="sip-optional-toggle"
                  type="checkbox"
                  checked={sipConfig.enabled}
                  onChange={(e) =>
                    setSipConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="rounded border-white/30 bg-white/10"
                />
                <label
                  htmlFor="sip-optional-toggle"
                  className="text-xs font-semibold text-cyan-100 cursor-pointer"
                >
                  {isEn
                    ? 'Enable Optional External SIP / Outbound Call Trigger'
                    : 'เปิดใช้งานการเชื่อมต่อสายโทรศัพท์ SIP / ระบบโทรออกภายนอก (Optional)'}
                </label>
              </div>
              <div className="flex items-center gap-2">
                {sipSavedToast && (
                  <span className="text-[11px] text-emerald-300">
                    {isEn ? 'Saved' : 'บันทึกแล้ว'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveSipConfig}
                  className="crystal-tile px-3 py-1 rounded-lg text-[11px] font-semibold text-white cursor-pointer"
                >
                  {isEn ? 'Save SIP Config' : 'บันทึกการตั้งค่า SIP'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={sipConfig.sipServerWss}
                onChange={(e) =>
                  setSipConfig((prev) => ({ ...prev, sipServerWss: e.target.value }))
                }
                placeholder="WSS Server (e.g. wss://pbx.clinic.local:8089/ws)"
                className="glass-input px-3 py-1.5 rounded-lg text-xs"
              />
              <input
                type="text"
                value={sipConfig.sipExtension}
                onChange={(e) =>
                  setSipConfig((prev) => ({ ...prev, sipExtension: e.target.value }))
                }
                placeholder={isEn ? 'Extension (e.g. 102)' : 'เบอร์ภายใน (Extension เช่น 102)'}
                className="glass-input px-3 py-1.5 rounded-lg text-xs"
              />
              <input
                type="url"
                value={sipConfig.outboundWebhookUrl}
                onChange={(e) =>
                  setSipConfig((prev) => ({ ...prev, outboundWebhookUrl: e.target.value }))
                }
                placeholder={
                  isEn ? 'Outbound Dial Webhook URL (optional)' : 'Webhook โทรออก (ถ้ามี)'
                }
                className="glass-input px-3 py-1.5 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Script & Built-in Call Runner */}
          <div className="lg:col-span-7 space-y-3">
            <div className="glass-subcard rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                    {isEn ? 'Patient Ref ID / Case' : 'รหัสอ้างอิงคนไข้ (ไม่ระบุชื่อจริง)'}
                  </label>
                  <input
                    type="text"
                    value={patientRefId}
                    onChange={(e) => setPatientRefId(e.target.value)}
                    placeholder="เช่น PT-2045"
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                    {isEn ? 'Case Category' : 'หมวดเคสติดตาม'}
                  </label>
                  <input
                    type="text"
                    value={caseCategory}
                    onChange={(e) => setCaseCategory(e.target.value)}
                    placeholder="เช่น หลังผ่าฟันคุด"
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Script Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-200 mb-1.5">
                  {isEn ? 'Guided Follow-up Script' : 'เลือกสคริปต์โทรติดตามอาการ'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FOLLOW_UP_CALL_SCRIPTS.map((tpl) => {
                    const active = tpl.id === scriptType;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setScriptType(tpl.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-500/25 border-emerald-300/60 text-white'
                            : 'crystal-tile text-slate-300 hover:text-white'
                        }`}
                      >
                        {isEn ? tpl.labelEn : tpl.labelTh}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script Card */}
              <div className="rounded-xl bg-slate-950/50 border border-emerald-300/25 p-3.5 space-y-2.5">
                {scriptType === 'custom' ? (
                  <textarea
                    rows={5}
                    value={customScriptText}
                    onChange={(e) => setCustomScriptText(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Type your custom follow-up script here...'
                        : 'พิมพ์สคริปต์ติดตามอาการที่ต้องการใช้พูดคุยกับคนไข้...'
                    }
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs resize-none"
                  />
                ) : (
                  <div className="space-y-1.5 text-xs text-slate-100 leading-relaxed">
                    <p className="font-semibold text-emerald-200">{activeTemplate.openingTh}</p>
                    <ul className="space-y-1 pl-1 text-slate-200">
                      {activeTemplate.questionsTh.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                    <p className="text-cyan-200 pt-1">{activeTemplate.closingTh}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {hasTtsSupport && (
                    <button
                      type="button"
                      onClick={handleSpeakScript}
                      className={`crystal-tile px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        isSpeaking ? 'text-emerald-200 border-emerald-300/50' : 'text-white'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>
                        {isSpeaking
                          ? isEn
                            ? 'Stop Speaking'
                            : 'หยุดเสียงอ่าน'
                          : isEn
                            ? 'Speak Questions'
                            : 'ฟังเสียงคำถาม'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopyScript()}
                    className="crystal-tile px-3 py-1.5 rounded-lg text-[11px] font-semibold text-cyan-100 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedScript ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedScript
                        ? isEn
                          ? 'Copied'
                          : 'คัดลอกแล้ว'
                        : isEn
                          ? 'Copy Script'
                          : 'คัดลอกสคริปต์'}
                    </span>
                  </button>
                  {sipConfig.enabled && sipConfig.outboundWebhookUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => void handleTriggerExternalSip()}
                      className="crystal-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <PhoneOutgoing className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Dial via SIP' : 'สั่งโทรผ่าน SIP'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Outcome & Voice-to-Text Note Form */}
            <form
              onSubmit={handleSaveCallLog}
              className="glass-subcard rounded-2xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-white">
                  {isEn ? 'Patient Response Notes' : 'บันทึกคำตอบ / อาการจากสายติดตาม'}
                </label>
                <button
                  type="button"
                  onClick={toggleVoiceNoteMic}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                    isListening
                      ? 'bg-rose-500/30 border-rose-300/60 text-white'
                      : hasMicSupport
                        ? 'crystal-tile text-cyan-100 hover:text-white'
                        : 'crystal-tile text-slate-300'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isListening
                      ? isEn
                        ? 'Stop Mic'
                        : 'หยุดบันทึกเสียง'
                      : isEn
                        ? 'Voice-to-Text Mic'
                        : 'พูดบันทึกอาการ (ไมค์)'}
                  </span>
                </button>
              </div>

              {speechNotice && <p className="text-[11px] text-amber-200">{speechNotice}</p>}

              <textarea
                rows={3}
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                placeholder={
                  isEn
                    ? 'Speak or type symptom notes (bleeding stopped, mild soreness, confirmed appointment)...'
                    : 'พิมพ์หรือกดไมค์เพื่อบันทึกอาการ (เช่น เลือดหยุดแล้ว กินยาครบ ปวดเล็กน้อย)...'
                }
                className="glass-input w-full px-3 py-2 rounded-xl text-xs resize-none"
              />

              <div>
                <label className="block text-[11px] font-semibold text-slate-200 mb-1.5">
                  {isEn ? 'Quick Call Outcome' : 'สรุปผลการโทรติดตาม'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {OUTCOME_OPTIONS.map((opt) => {
                    const active = outcome === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOutcome(opt.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-colors cursor-pointer ${
                          active ? opt.badgeCls : 'crystal-tile text-slate-300 hover:text-white'
                        }`}
                      >
                        {isEn ? opt.labelEn : opt.labelTh}
                      </button>
                    );
                  })}
                </div>
              </div>

              {savedNotice && (
                <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savedNotice}</span>
                </p>
              )}

              <button
                type="submit"
                className="crystal-btn w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEn ? 'Save Follow-up Outcome' : 'บันทึกผลการโทรติดตามอาการ'}</span>
              </button>
            </form>
          </div>

          {/* Right: Local Call Logs */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="glass-subcard rounded-2xl p-4 flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {isEn
                    ? `Call History (${logs.length})`
                    : `ประวัติการโทรติดตาม (${logs.length})`}
                </h4>
              </div>

              {logs.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <p className="text-xs font-semibold text-slate-300">
                    {isEn ? 'No follow-up calls logged yet' : 'ยังไม่มีประวัติการโทรติดตามในเครื่อง'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {isEn
                      ? 'Logged calls stay in local workspace storage and export with JSON backup.'
                      : 'บันทึกสายทุกครั้งจะเก็บไว้ในเบราว์เซอร์และรวมในไฟล์สำรอง JSON'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
                  {logs.map((entry) => {
                    const outMeta =
                      OUTCOME_OPTIONS.find((o) => o.id === entry.outcome) ||
                      OUTCOME_OPTIONS[0];
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl bg-white/5 border border-white/15 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-cyan-100 truncate">
                              {entry.patientRefId}
                            </span>
                            <span className="text-[10px] text-slate-300 truncate">
                              • {entry.caseCategory}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setLogs((prev) => prev.filter((x) => x.id !== entry.id))
                            }
                            className="text-slate-400 hover:text-rose-300 p-1 cursor-pointer"
                            title={isEn ? 'Delete log' : 'ลบบันทึก'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${outMeta.badgeCls}`}
                          >
                            {isEn ? outMeta.labelEn : outMeta.labelTh}
                          </span>
                          {entry.usedExternalSip && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-cyan-500/20 text-cyan-200 border border-cyan-300/30">
                              SIP
                            </span>
                          )}
                        </div>

                        {entry.patientNotes && (
                          <p className="text-xs text-slate-200 whitespace-pre-line">
                            {entry.patientNotes}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400">
                          {new Date(entry.createdAt).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
