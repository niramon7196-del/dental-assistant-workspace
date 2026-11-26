import React, { useState } from 'react';
import {
  MessageSquareHeart,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ListTodo,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  QrCode,
  BookmarkPlus,
  History,
  Trash2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getWorkspaceDisplayName, useWorkspace } from '../contexts/WorkspaceContext';
import {
  ChatChannelType,
  ChatDraftHistoryEntry,
  ChatToneCategory
} from '../types/platform';
import { ActiveTab, TaskItem } from '../types/dental';
import {
  AiServiceError,
  buildManualFallbackTaskDraft,
  generatePatientChatReply
} from '../services/aiService';
import { locales } from '../utils/i18n';
import { PostOpSurveyModal } from './PostOpSurveyModal';

interface ChatCopilotProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const ChatCopilot: React.FC<ChatCopilotProps> = ({ setActiveTab }) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    setTasks,
    setFollowUps,
    recordAudit,
    saveManualFallbackTask,
    chatState,
    updateChatState
  } = useWorkspace();

  const channel = chatState.channel;
  const tone = chatState.tone;
  const patientMessage = chatState.patientMessage;
  const clinicHint = chatState.clinicHint;
  const replyResult = chatState.replyResult;
  const draftText = chatState.draftText;
  const savedHistory = chatState.history || [];

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [convertedNotice, setConvertedNotice] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [isPostOpModalOpen, setIsPostOpModalOpen] = useState(false);

  const isPersonal = activeWorkspace.type === 'personal';

  const toneOptions: { id: ChatToneCategory; label: string }[] = [
    { id: 'general', label: t('chatToneGeneral') },
    { id: 'pricing_promo', label: t('chatTonePricing') },
    { id: 'appointment', label: t('chatToneAppointment') },
    { id: 'post_op', label: t('chatTonePostOp') }
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientMessage.trim()) return;
    setErrorMsg(null);
    setFallbackNotice(null);
    setConvertedNotice(false);
    setIsLoading(true);

    try {
      const res = await generatePatientChatReply({
        patientMessage,
        channel,
        toneCategory: tone,
        clinicNote: clinicHint,
        uiLanguage: language
      });
      const historyItem: ChatDraftHistoryEntry = {
        id: `chat-hist-${Date.now()}`,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        channel,
        tone,
        patientMessage: patientMessage.trim(),
        clinicHint: clinicHint.trim(),
        replyDraft: res.replyDraft,
        shortReply: res.shortReply
      };
      updateChatState((prev) => ({
        ...prev,
        replyResult: res,
        draftText: res.replyDraft,
        history: [historyItem, ...(prev.history || [])].slice(0, 25)
      }));
      recordAudit('ai_assist', `Drafted ${channel} patient chat reply (${tone})`);
    } catch (err) {
      if (err instanceof AiServiceError && err.isUnavailable) {
        setErrorMsg(t('aiProviderUnavailableNotice'));
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to draft reply');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualDraftToHistory = () => {
    const cleanMsg = patientMessage.trim();
    const cleanReply = draftText.trim();
    if (!cleanMsg && !cleanReply) return;
    const entry: ChatDraftHistoryEntry = {
      id: `chat-draft-${Date.now()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      channel,
      tone,
      patientMessage: cleanMsg || '(Manual Reply Draft)',
      clinicHint: clinicHint.trim(),
      replyDraft: cleanReply || cleanMsg,
      shortReply: (cleanReply || cleanMsg).split('\n')[0]?.slice(0, 140) || ''
    };
    updateChatState((prev) => ({
      ...prev,
      history: [entry, ...(prev.history || [])].slice(0, 25)
    }));
    setDraftSavedNotice(true);
    setTimeout(() => setDraftSavedNotice(false), 2500);
    recordAudit('task_update', `Saved ${channel} chat draft locally`);
  };

  const handleLoadHistoryEntry = (entry: ChatDraftHistoryEntry) => {
    updateChatState({
      channel: entry.channel,
      tone: entry.tone,
      patientMessage: entry.patientMessage,
      clinicHint: entry.clinicHint,
      draftText: entry.replyDraft,
      replyResult: {
        replyDraft: entry.replyDraft,
        shortReply: entry.shortReply,
        suggestedTaskTitle: `[${entry.channel === 'facebook' ? 'Facebook Page' : 'LINE OA'}] ติดตามแชตคนไข้`,
        suggestedTaskKind: 'followup',
        suggestedCategory: 'Patient Follow-up',
        suggestedPriority: 'Medium',
        suggestedFollowUpNote: entry.patientMessage.slice(0, 120),
        model: 'saved-draft'
      }
    });
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    updateChatState((prev) => ({
      ...prev,
      history: (prev.history || []).filter((item) => item.id !== entryId)
    }));
  };

  const handleSaveWithoutAi = async (targetScope: 'active' | 'personal' = 'active') => {
    if (!patientMessage.trim()) return;
    setIsSavingFallback(true);
    setErrorMsg(null);
    try {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const channelLabel = channel === 'facebook' ? 'Facebook Page' : 'LINE OA';
      const draft = buildManualFallbackTaskDraft({
        rawText: patientMessage,
        language,
        defaultKind: 'followup',
        defaultCategory: 'Patient Follow-up',
        prefixLabel: `[${channelLabel}]`
      });
      const noteText = clinicHint.trim()
        ? `${channelLabel} (${tone}) • ${clinicHint.trim()}`
        : `${channelLabel} (${tone})`;
      const res = await saveManualFallbackTask({
        ...draft,
        attachedNote: noteText,
        dueDate: tomorrow,
        targetScope
      });
      setFallbackNotice(
        t('aiSavedWithoutAiToast').replace(
          '{workspace}',
          getWorkspaceDisplayName(res.targetWorkspace, language)
        )
      );
      updateChatState({ patientMessage: '', clinicHint: '' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSavingFallback(false);
    }
  };

  const handleCopy = async (text: string, isShort = false) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore if clipboard unavailable
    }
    if (isShort) {
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2000);
    } else {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    }
  };

  const handleConvertToFollowUpTask = () => {
    if (!replyResult) return;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    const channelLabel = channel === 'facebook' ? 'Facebook Page' : 'LINE OA';

    const newTask: TaskItem = {
      id: `task-chat-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      taskKind: 'followup',
      title: replyResult.suggestedTaskTitle || `[${channelLabel}] ติดตามแชตคนไข้`,
      description: `${replyResult.suggestedFollowUpNote}\n\nข้อความต้นทาง: "${patientMessage.trim().slice(0, 180)}"`,
      attachedNote: `ช่องทาง: ${channelLabel} | โทน: ${tone}`,
      category: 'Patient Follow-up',
      priority: replyResult.suggestedPriority || 'Medium',
      status: 'New',
      createdDate: today,
      dueDate: tomorrow,
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: `act-chat-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: `แปลงจากแชต ${channelLabel}`,
          user: t('assistantSelf'),
          localized: {
            th: { action: `แปลงจากแชต ${channelLabel}`, user: locales.th.assistantSelf },
            en: { action: `Converted from ${channelLabel} chat`, user: locales.en.assistantSelf }
          }
        }
      ]
    };

    setTasks((prev) => [newTask, ...prev]);

    if (!isPersonal) {
      setFollowUps((prev) => [
        {
          id: `fu-chat-${Date.now()}`,
          patientRefId: `CHAT-${String(Date.now()).slice(-4)}`,
          caseCategory: `${channelLabel} Chat Follow-up`,
          followUpReason: patientMessage.trim().slice(0, 140),
          nextAction: replyResult.suggestedFollowUpNote || replyResult.suggestedTaskTitle,
          dueDate: tomorrow,
          status: 'Pending',
          relatedEvidenceIds: []
        },
        ...prev
      ]);
    }

    setConvertedNotice(true);
    recordAudit('task_create', `Converted ${channelLabel} chat to follow-up task`);
  };

  const handleInsertPostOpToDraft = (message: string) => {
    updateChatState((prev) => ({
      ...prev,
      draftText: message,
      replyResult: prev.replyResult
        ? { ...prev.replyResult, replyDraft: message }
        : {
            replyDraft: message,
            shortReply: message.split('\n')[0] || message.slice(0, 140),
            suggestedTaskTitle: t('satPostOpShortcutShort'),
            suggestedTaskKind: 'followup',
            suggestedCategory: 'Patient Follow-up',
            suggestedPriority: 'Medium',
            suggestedFollowUpNote: t('satPostOpModalSubtitle'),
            model: 'post-op-template'
          }
    }));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-8 space-y-5 max-w-7xl mx-auto">
      {/* 1-Click Post-Op Care + Satisfaction Survey Link/QR Shortcut */}
      <div className="rounded-2xl crystal-tile border-cyan-300/35 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <QrCode className="w-4 h-4 text-cyan-300 shrink-0" />
          <span className="text-slate-200 font-medium">{t('satPostOpModalSubtitle')}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsPostOpModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md cursor-pointer shrink-0"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>{t('satPostOpShortcutBtn')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input & Tone Presets */}
        <form
          onSubmit={handleGenerate}
          className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 ${
            isPersonal ? 'neon-glass-personal' : 'neon-glass'
          }`}
        >
          {/* Channel Switcher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              {t('chatChannelLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'line_oa', label: t('chatChannelLine') },
                  { id: 'facebook', label: t('chatChannelFacebook') }
                ] as const
              ).map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => updateChatState({ channel: ch.id as ChatChannelType })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    channel === ch.id
                      ? 'bg-violet-600/30 border-violet-300/55 text-white'
                      : 'glass-subcard text-slate-300 hover:text-white'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Tone Options */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              {t('chatToneLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {toneOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateChatState({ tone: item.id })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-colors cursor-pointer ${
                    tone === item.id
                      ? 'bg-emerald-500/25 border-emerald-400/55 text-emerald-100'
                      : 'glass-subcard text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              {t('chatPatientInputLabel')}
            </label>
            <textarea
              rows={4}
              required
              value={patientMessage}
              onChange={(e) => updateChatState({ patientMessage: e.target.value })}
              placeholder={t('chatPatientInputPlaceholder')}
              className="w-full glass-input rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Clinic Hint */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              {t('chatClinicHintLabel')}
            </label>
            <input
              type="text"
              value={clinicHint}
              onChange={(e) => updateChatState({ clinicHint: e.target.value })}
              placeholder={t('chatClinicHintPlaceholder')}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/45 text-xs text-amber-100 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {patientMessage.trim() && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSavingFallback}
                    onClick={() => void handleSaveWithoutAi('active')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    {isSavingFallback ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ListTodo className="w-3.5 h-3.5" />
                    )}
                    <span>{t('aiSaveDirectlyNoAiBtn')}</span>
                  </button>
                  {!isPersonal && (
                    <button
                      type="button"
                      disabled={isSavingFallback}
                      onClick={() => void handleSaveWithoutAi('personal')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl crystal-tile hover:bg-white/15 border border-violet-300/40 text-violet-100 text-xs font-medium cursor-pointer"
                    >
                      <ListTodo className="w-3.5 h-3.5 text-violet-300" />
                      <span>{t('aiSaveToPersonalNoAiBtn')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {fallbackNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/45 border border-emerald-500/45 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{fallbackNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className="inline-flex items-center gap-1 font-semibold underline cursor-pointer shrink-0"
              >
                <span>{t('viewTasksLinkBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || !patientMessage.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/25 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isLoading ? t('chatGeneratingBtn') : t('chatGenerateBtn')}</span>
            </button>

            <button
              type="button"
              disabled={!patientMessage.trim() && !draftText.trim()}
              onClick={handleSaveManualDraftToHistory}
              className="crystal-tile flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl border border-cyan-400/35 text-cyan-100 hover:bg-white/15 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-cyan-300" />
              <span>{t('chatSaveDraftBtn')}</span>
            </button>
          </div>

          {draftSavedNotice && (
            <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('chatDraftSavedToast')}</span>
            </p>
          )}
        </form>

        {/* Right: Drafted Reply + Copy + Convert to Follow-up Task */}
        <div
          className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4 ${
            isPersonal ? 'neon-glass-personal' : 'neon-glass'
          }`}
        >
          {!replyResult ? (
            <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300">
                <MessageSquareHeart className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">{t('chatReplyResultTitle')}</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {t('chatCopilotHeaderSubtitle')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquareHeart className="w-4 h-4 text-violet-400" />
                  <span>{t('chatReplyResultTitle')}</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">{replyResult.model}</span>
              </div>

              <textarea
                rows={6}
                value={draftText}
                onChange={(e) => updateChatState({ draftText: e.target.value })}
                className="w-full glass-input border-violet-400/35 rounded-xl p-3.5 text-xs text-slate-100 leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy(draftText, false)}
                  className="crystal-btn flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  {copiedFull ? (
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedFull ? t('chatCopiedMsg') : t('chatCopyReplyBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveManualDraftToHistory}
                  className="crystal-tile flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-400/35 text-cyan-100 hover:bg-white/15 text-xs font-medium cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{t('chatSaveDraftBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConvertToFollowUpTask}
                  className="crystal-btn flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>{t('chatConvertTaskBtn')}</span>
                </button>
              </div>

              {convertedNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex items-center justify-between gap-2">
                  <span>{t('chatConvertedSuccess')}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="inline-flex items-center gap-1 font-semibold underline cursor-pointer shrink-0"
                  >
                    <span>{t('myTasks')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Short Reply Card */}
              <div className="p-3.5 rounded-xl glass-subcard space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {t('chatShortReplyTitle')}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(replyResult.shortReply, true)}
                    className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 cursor-pointer"
                  >
                    {copiedShort ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedShort ? t('chatCopiedMsg') : t('chatCopyReplyBtn')}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">{replyResult.shortReply}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Persistent Saved Chat Drafts History (LocalStorage) */}
      {savedHistory.length > 0 && (
        <div className={`rounded-2xl p-5 space-y-3 ${isPersonal ? 'neon-glass-personal' : 'neon-glass'}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-300" />
              <span>
                {t('chatSavedDraftsTitle')} ({savedHistory.length})
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedHistory.map((entry) => (
              <div
                key={entry.id}
                className="glass-subcard p-3.5 rounded-xl space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-300/35 text-violet-100 font-semibold">
                      {entry.channel === 'facebook' ? 'Facebook Page' : 'LINE OA'}
                    </span>
                    <span className="font-mono text-slate-300">{entry.createdAt}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-100 line-clamp-2">
                    {entry.patientMessage}
                  </p>
                  <p className="text-[11px] text-cyan-200/90 line-clamp-2">{entry.replyDraft}</p>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleLoadHistoryEntry(entry)}
                    className="crystal-tile px-2.5 py-1 rounded-lg text-[11px] font-medium text-violet-100 hover:text-white cursor-pointer"
                  >
                    {t('chatLoadDraftBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHistoryEntry(entry.id)}
                    className="crystal-tile p-1 rounded-lg text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                    title={t('deleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PostOpSurveyModal
        isOpen={isPostOpModalOpen}
        onClose={() => setIsPostOpModalOpen(false)}
        onInsertToChat={handleInsertPostOpToDraft}
      />
    </div>
  );
};
