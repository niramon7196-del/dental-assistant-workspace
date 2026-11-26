import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Download,
  X,
  Send,
  CalendarPlus,
  Link2,
  CheckCircle2
} from 'lucide-react';
import { SatisfactionProcedureType, TaskItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  PROCEDURE_CATALOG,
  buildPostOpSurveyMessage,
  getProcedureLabel
} from '../services/satisfactionService';
import { locales } from '../utils/i18n';

interface PostOpSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProcedure?: SatisfactionProcedureType;
  initialPatientName?: string;
  onInsertToChat?: (message: string) => void;
}

export const PostOpSurveyModal: React.FC<PostOpSurveyModalProps> = ({
  isOpen,
  onClose,
  initialProcedure = 'extraction_wisdom',
  initialPatientName = '',
  onInsertToChat
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    satisfactionSettings,
    updateSatisfactionSettings,
    setTasks,
    setFollowUps,
    recordAudit
  } = useWorkspace();

  const [procedure, setProcedure] = useState<SatisfactionProcedureType>(initialProcedure);
  const [patientName, setPatientName] = useState(initialPatientName);
  const [surveyUrl, setSurveyUrl] = useState(satisfactionSettings.surveyUrl || '');
  const [customNote, setCustomNote] = useState('');
  const [messageText, setMessageText] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [loggedToast, setLoggedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSurveyUrl(satisfactionSettings.surveyUrl || '');
      setLoggedToast(false);
    }
  }, [isOpen, satisfactionSettings.surveyUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setMessageText(
      buildPostOpSurveyMessage({
        procedure,
        language,
        patientName,
        surveyUrl,
        customNote
      })
    );
  }, [isOpen, procedure, language, patientName, surveyUrl, customNote]);

  useEffect(() => {
    if (!isOpen) return;
    const targetUrl = surveyUrl.trim();
    if (!targetUrl) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    QRCode.toDataURL(targetUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, surveyUrl]);

  if (!isOpen) return null;

  const handleSaveSurveyUrl = (val: string) => {
    setSurveyUrl(val);
    updateSatisfactionSettings({ surveyUrl: val.trim() });
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
    } catch {
      // ignore if clipboard blocked
    }
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2200);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `clinic-satisfaction-qr-${procedure}.png`;
    a.click();
  };

  const handleLogOutreachAndFollowup = () => {
    const nowMs = Date.now();
    const today = new Date(nowMs).toISOString().split('T')[0];
    const tomorrow = new Date(nowMs + 86_400_000).toISOString().split('T')[0];
    const nowStamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 16);
    const procLabel = getProcedureLabel(procedure, language);
    const refLabel = patientName.trim() || `POSTOP-${String(nowMs).slice(-4)}`;

    const newTask: TaskItem = {
      id: `task-postop-${nowMs}`,
      workspaceId: activeWorkspace.id,
      taskKind: 'followup',
      title:
        language === 'en'
          ? `[Post-Op + QR] ${procLabel} (${refLabel})`
          : `[ส่งดูแลหลังทำฟัน + QR] ${procLabel} (${refLabel})`,
      description: messageText,
      attachedNote:
        language === 'en'
          ? 'Sent post-op care guide + satisfaction QR/link'
          : 'ส่งคำแนะนำดูแลหลังทำฟัน + ลิงก์/QR ประเมินแล้ว',
      category: 'Patient Follow-up',
      priority: 'Medium',
      status: 'Waiting',
      createdDate: today,
      dueDate: tomorrow,
      relatedPatientId: refLabel,
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: `act-postop-${nowMs}`,
          timestamp: nowStamp,
          action:
            language === 'en'
              ? 'Logged post-op care + survey link outreach'
              : 'บันทึกการส่งข้อความดูแลหลังทำฟัน + ลิงก์ประเมิน',
          user: t('assistantSelf'),
          localized: {
            th: {
              action: 'บันทึกการส่งข้อความดูแลหลังทำฟัน + ลิงก์ประเมิน',
              user: locales.th.assistantSelf
            },
            en: {
              action: 'Logged post-op care + survey link outreach',
              user: locales.en.assistantSelf
            }
          }
        }
      ]
    };

    setTasks((prev) => [newTask, ...prev]);

    if (activeWorkspace.type === 'clinic') {
      setFollowUps((prev) => [
        {
          id: `fu-postop-${nowMs}`,
          patientRefId: refLabel,
          caseCategory: `${procLabel} (Post-Op + QR)`,
          followUpReason:
            language === 'en'
              ? 'Post-op care instructions & satisfaction link sent'
              : 'ส่งข้อความดูแลหลังทำฟันพร้อมลิงก์ประเมินแล้ว',
          nextAction:
            language === 'en'
              ? 'Check patient recovery & survey callback flag'
              : 'ติดตามอาการหลังทำฟันและเช็กผลตอบกลับประเมิน',
          dueDate: tomorrow,
          status: 'Contacted',
          relatedEvidenceIds: []
        },
        ...prev
      ]);
    }

    recordAudit('task_create', `Logged post-op QR outreach (${procLabel})`);
    setLoggedToast(true);
    setTimeout(() => setLoggedToast(false), 3000);
  };

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal border border-violet-300/35 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden my-auto"
      >
        {/* Modal Header with ↩️ Back Button */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/15 flex items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-violet-600/20 via-white/5 to-cyan-500/15 shrink-0">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              title={language === 'en' ? 'Back' : 'ย้อนกลับ'}
              aria-label={language === 'en' ? 'Back' : 'ย้อนกลับ'}
              className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[36px] py-1.5 rounded-xl border border-violet-300/35 hover:border-cyan-400/50 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
            >
              <span aria-hidden="true" className="text-sm leading-none">
                ↩️
              </span>
              <span className="hidden sm:inline">
                {language === 'en' ? 'Back' : 'ย้อนกลับ'}
              </span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-300/40 flex items-center justify-center text-violet-200 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 text-depth break-words leading-snug">
                {t('satPostOpModalTitle')}
              </h3>
              <p className="text-[11px] text-slate-200/85 break-words leading-snug mt-0.5">
                {t('satPostOpModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-5 text-xs">
          {/* Step 1: Select Procedure */}
          <div className="space-y-2 min-w-0">
            <label className="font-semibold text-slate-200 block break-words">
              {t('satSelectProcedureLabel')}
            </label>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
              {PROCEDURE_CATALOG.map((proc) => {
                const active = procedure === proc.id;
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setProcedure(proc.id)}
                    className={`px-3 py-2.5 min-h-[42px] rounded-xl border text-left font-medium break-words leading-snug transition-all cursor-pointer ${
                      active
                        ? 'crystal-btn bg-gradient-to-r from-violet-600/40 to-cyan-600/25 border-violet-400 text-white'
                        : 'crystal-tile border-white/10 text-slate-200 hover:border-violet-400/35'
                    }`}
                  >
                    {t(proc.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Inputs & Message Preview */}
            <div className="lg:col-span-7 space-y-3.5 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-300 font-medium block break-words">
                    {t('satPatientNameOptionalLabel')}
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={t('satPatientNameOptionalPlaceholder')}
                    className="w-full min-w-0 glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-300 font-medium flex items-center gap-1 break-words">
                    <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="break-words">{t('satSurveyUrlLabel')}</span>
                  </label>
                  <input
                    type="url"
                    value={surveyUrl}
                    onChange={(e) => handleSaveSurveyUrl(e.target.value)}
                    placeholder={t('satSurveyUrlPlaceholder')}
                    className="w-full min-w-0 glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-slate-300 font-medium block break-words">
                  {t('satGeneratedMsgLabel')}
                </label>
                <textarea
                  rows={10}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full min-w-0 glass-input border-violet-400/35 rounded-xl p-3.5 text-xs text-slate-100 leading-relaxed break-words [overflow-wrap:anywhere]"
                />
              </div>
            </div>

            {/* Right: Live QR Card + Custom Extra Note */}
            <div className="lg:col-span-5 space-y-3.5 min-w-0">
              <div className="crystal-tile p-4 rounded-2xl border border-cyan-400/35 flex flex-col items-center text-center space-y-3 min-w-0">
                <p className="text-xs font-bold text-cyan-200 break-words">{t('satQrPreviewTitle')}</p>
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-lg">
                    <img
                      src={qrDataUrl}
                      alt={t('satQrPreviewTitle')}
                      referrerPolicy="no-referrer"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 rounded-2xl border border-dashed border-white/25 glass-subcard flex flex-col items-center justify-center p-4 text-slate-300 space-y-2">
                    <QrCode className="w-10 h-10 text-slate-400" />
                    <span className="text-[11px] leading-snug">
                      {t('satSurveyUrlPlaceholder')}
                    </span>
                  </div>
                )}
                <p className="text-[11px] text-slate-300 leading-relaxed">{t('satQrHint')}</p>
                {qrDataUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/35 border border-cyan-400/40 text-cyan-200 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('satDownloadQrBtn')}</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  {t('attachedNoteLabel')} ({t('optionalLabel')})
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder={
                    language === 'en'
                      ? 'e.g., Suture removal next Tue 10:00 AM'
                      : 'เช่น นัดตัดไหมวันอังคารหน้า 10:00 น.'
                  }
                  className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {loggedToast && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{t('satOutreachLoggedToast')}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-white/15 bg-white/5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleLogOutreachAndFollowup}
            className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3.5 min-h-[40px] py-2 rounded-xl border border-white/25 text-slate-100 text-xs font-medium cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="break-words">{t('satLogOutreachBtn')}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onInsertToChat && (
              <button
                type="button"
                onClick={() => {
                  onInsertToChat(messageText);
                  onClose();
                }}
                className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>{t('satInsertToChatBtn')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleCopyMessage()}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              {copiedMsg ? (
                <Check className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{copiedMsg ? t('satCopiedMsgToast') : t('satCopyMsgBtn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
