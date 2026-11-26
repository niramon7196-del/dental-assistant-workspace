import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Loader2,
  ListChecks,
  ListTodo,
  Plus
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getWorkspaceDisplayName, useWorkspace } from '../contexts/WorkspaceContext';
import { MODULE_REGISTRY, isModuleAccessible } from '../modules/moduleRegistry';
import {
  AiServiceError,
  buildManualFallbackTaskDraft,
  runWorkspaceAiAssistant
} from '../services/aiService';
import { AiAssistResponse, AiProposedTaskDraft } from '../types/platform';
import { ActiveTab, TaskCategory, TaskItem, TaskPriority } from '../types/dental';
import {
  formatDateByLanguage,
  locales,
  translateCategory,
  translateTaskPriority
} from '../utils/i18n';

interface AiAssistantCenterProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const AiAssistantCenter: React.FC<AiAssistantCenterProps> = ({ setActiveTab }) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    currentRole,
    tasks,
    setTasks,
    labOrders,
    followUps,
    templates,
    saveManualFallbackTask,
    recordAudit,
    chatState,
    updateChatState
  } = useWorkspace();

  const prompt = chatState.aiCenterPrompt || '';
  const result = chatState.aiCenterResult || null;
  const editableDraft = chatState.aiCenterDraft || null;
  const setPrompt = (nextPrompt: string) => updateChatState({ aiCenterPrompt: nextPrompt });
  const setResult = (nextResult: AiAssistResponse | null) =>
    updateChatState({ aiCenterResult: nextResult });
  const setEditableDraft = (nextDraft: AiProposedTaskDraft | null) =>
    updateChatState({ aiCenterDraft: nextDraft });

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const authorizedModules = useMemo(
    () =>
      MODULE_REGISTRY.filter((m) =>
        isModuleAccessible(m, activeWorkspace.type, activeWorkspace.enabledModules, currentRole)
      ),
    [activeWorkspace.type, activeWorkspace.enabledModules, currentRole]
  );

  const handleRun = async (mode: 'chat' | 'briefing' | 'suggest_workflow', customPrompt?: string) => {
    setErrorMsg(null);
    setSavedNotice(null);
    setIsLoading(true);

    try {
      const res = await runWorkspaceAiAssistant({
        mode,
        prompt: customPrompt ?? prompt,
        uiLanguage: language,
        workspace: activeWorkspace,
        userRole: currentRole,
        tasks,
        labOrders,
        followUps,
        templates
      });
      updateChatState({
        aiCenterResult: res,
        aiCenterDraft: res.proposedTaskDraft
      });
      recordAudit(
        'ai_assist',
        `Ran scoped AI Assistant (${mode}) in workspace ${activeWorkspace.tenantCode}`
      );
    } catch (err) {
      if (err instanceof AiServiceError && err.isUnavailable) {
        setErrorMsg(t('aiProviderUnavailableNotice'));
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('extractionFailedTitle'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWithoutAi = async (targetScope: 'active' | 'personal' = 'active') => {
    if (!prompt.trim()) return;
    setIsSavingFallback(true);
    setErrorMsg(null);
    try {
      const draft = buildManualFallbackTaskDraft({
        rawText: prompt,
        language,
        defaultCategory: 'Dentist Instruction',
        defaultKind: 'todo'
      });
      const res = await saveManualFallbackTask({
        ...draft,
        targetScope
      });
      setSavedNotice(
        t('aiSavedWithoutAiToast').replace(
          '{workspace}',
          getWorkspaceDisplayName(res.targetWorkspace, language)
        )
      );
      setPrompt('');
    } finally {
      setIsSavingFallback(false);
    }
  };

  const handleConfirmSaveDraft = () => {
    if (!editableDraft || !editableDraft.title.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const newTask: TaskItem = {
      id: `task-ai-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      title: editableDraft.title.trim(),
      description: editableDraft.description.trim(),
      category: editableDraft.category,
      priority: editableDraft.priority,
      status: 'Awaiting Review',
      createdDate: today,
      dueDate:
        editableDraft.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(editableDraft.dueDate)
          ? editableDraft.dueDate
          : new Date(Date.now() + 86_400_000 * 2).toISOString().split('T')[0],
      subtasks: editableDraft.subtasks.map((st, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: st,
        completed: false
      })),
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: t('extractedViaModel').replace('{model}', result?.model || 'gemini-4-hydrogen'),
          user: t('assistantVerified'),
          localized: {
            th: {
              action: locales.th.extractedViaModel.replace('{model}', result?.model || 'gemini-4-hydrogen'),
              user: locales.th.assistantVerified
            },
            en: {
              action: locales.en.extractedViaModel.replace('{model}', result?.model || 'gemini-4-hydrogen'),
              user: locales.en.assistantVerified
            }
          }
        }
      ]
    };

    setTasks((prev) => [newTask, ...prev]);
    recordAudit('task_create', `Saved AI-drafted task "${newTask.title}" with ${newTask.subtasks?.length || 0} subtasks`);
    setEditableDraft(null);
    setSavedNotice(t('aiProposedTaskSaved'));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Compact AI Boundary & Scoped Modules Strip */}
      <div className="crystal-tile rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{t('aiCenterBannerTitle')}</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('aiCenterBannerDesc')}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleRun('briefing')}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/25 transition-colors cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            {t('aiModeBriefingBtn')}
          </button>
        </div>

        <div className="pt-2.5 border-t border-white/15 flex items-center gap-1.5 overflow-x-auto flex-nowrap no-scrollbar text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-300 font-medium mr-1 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            {t('aiScopedModulesLabel')}
          </span>
          {authorizedModules.map((mod) => (
            <span
              key={mod.id}
              className="px-2 py-0.5 rounded-md crystal-tile text-slate-200 font-medium whitespace-nowrap shrink-0"
            >
              {t(mod.labelKey)}
            </span>
          ))}
        </div>
      </div>

      {/* Prompt Input & Quick Actions */}
      <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar pb-0.5">
          {[t('aiQuickPrompt1'), t('aiQuickPrompt2'), t('aiQuickPrompt3')].map((qp, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(qp)}
              className="px-3 py-1.5 rounded-xl glass-subcard hover:bg-white/15 text-[11px] text-violet-200 transition-colors cursor-pointer text-left whitespace-nowrap shrink-0"
            >
              {qp}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('aiPromptPlaceholder')}
            className="flex-1 glass-input rounded-xl p-3.5 text-xs text-slate-100 placeholder:text-slate-400"
          />
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              type="button"
              disabled={isLoading || !prompt.trim()}
              onClick={() => void handleRun('chat')}
              className="crystal-btn flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/25 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isLoading ? t('aiRunningBtn') : t('aiSendBtn')}</span>
            </button>
            <button
              type="button"
              disabled={isLoading || !prompt.trim()}
              onClick={() => void handleRun('suggest_workflow')}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-100 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <ListChecks className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('aiModeSuggestWorkflowBtn')}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-amber-950/35 border border-amber-500/45 text-xs text-amber-100 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
            {prompt.trim() && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingFallback}
                  onClick={() => void handleSaveWithoutAi('active')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  {isSavingFallback ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ListTodo className="w-3.5 h-3.5" />
                  )}
                  <span>{t('aiSaveDirectlyNoAiBtn')}</span>
                </button>
                {activeWorkspace.type === 'clinic' && (
                  <button
                    type="button"
                    disabled={isSavingFallback}
                    onClick={() => void handleSaveWithoutAi('personal')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl crystal-tile hover:bg-white/15 border border-violet-300/40 text-violet-100 text-xs font-medium cursor-pointer"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-violet-300" />
                    <span>{t('aiSaveToPersonalNoAiBtn')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {savedNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{savedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="text-emerald-200 underline font-medium cursor-pointer shrink-0"
            >
              {t('viewTasksLinkBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Results Area */}
      {result && (
        <div className="space-y-6">
          {/* Summary / Answer */}
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span>{t('aiAssistantHubTitle')}</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{result.model}</span>
            </div>
            <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap glass-subcard p-4 rounded-xl">
              {result.answer}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overdue Alerts */}
            <div className="neon-glass rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{t('aiOverdueAlertsTitle')}</span>
              </h4>
              {result.overdueAlerts.length === 0 ? (
                <p className="text-xs text-slate-300">{t('aiNoOverdueAlerts')}</p>
              ) : (
                <div className="space-y-2.5">
                  {result.overdueAlerts.map((al, idx) => (
                    <div
                      key={`${al.taskId}-${idx}`}
                      className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/35 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{al.title}</span>
                        <span className="text-[10px] font-mono text-rose-200 shrink-0">
                          {formatDateByLanguage(al.dueDate, language)}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-100/85">{al.urgencyNote}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Next Actions */}
            <div className="neon-glass rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-bold text-violet-300 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-violet-400" />
                <span>{t('aiRecommendedActionsTitle')}</span>
              </h4>
              <div className="space-y-2.5">
                {result.recommendedActions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl glass-subcard space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{act.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-200 border border-violet-400/35">
                        {translateTaskPriority(act.priority, language)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{act.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Reminders */}
            <div className="neon-glass rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>{t('aiSuggestedRemindersTitle')}</span>
              </h4>
              <div className="space-y-2.5">
                {result.suggestedReminders.map((rem, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl glass-subcard space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{rem.title}</span>
                      <span className="text-[10px] font-mono text-amber-300 shrink-0">
                        {formatDateByLanguage(rem.suggestedDueDate, language)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{rem.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review-Before-Save Task & Subtasks Draft */}
          {editableDraft && (
            <div className="neon-glass border-emerald-400/45 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-emerald-400" />
                  <span>{t('aiProposedTaskTitle')}</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium">{t('taskTitleLabel')}</label>
                  <input
                    type="text"
                    value={editableDraft.title}
                    onChange={(e) =>
                      setEditableDraft({ ...editableDraft, title: e.target.value })
                    }
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">{t('dueDateLabel')}</label>
                  <input
                    type="date"
                    value={editableDraft.dueDate || ''}
                    onChange={(e) =>
                      setEditableDraft({ ...editableDraft, dueDate: e.target.value })
                    }
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">{t('category')}</label>
                  <select
                    value={editableDraft.category}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        category: e.target.value as TaskCategory
                      })
                    }
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  >
                    {(
                      [
                        'Lab Coordination',
                        'Patient Follow-up',
                        'Sterilization & Prep',
                        'Dentist Instruction',
                        'Inventory & Supplies',
                        'Record Keeping',
                        'Other'
                      ] as TaskCategory[]
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {translateCategory(cat, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">{t('priorityLabel')}</label>
                  <select
                    value={editableDraft.priority}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        priority: e.target.value as TaskPriority
                      })
                    }
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  >
                    {(['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {translateTaskPriority(p, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-slate-300 font-medium">{t('taskDescription')}</label>
                  <textarea
                    rows={2}
                    value={editableDraft.description}
                    onChange={(e) =>
                      setEditableDraft({ ...editableDraft, description: e.target.value })
                    }
                    className="w-full glass-input rounded-xl p-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-200">{t('subtasksLabel')}</label>
                <div className="space-y-1.5">
                  {editableDraft.subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st}
                        onChange={(e) => {
                          const next = [...editableDraft.subtasks];
                          next[idx] = e.target.value;
                          setEditableDraft({ ...editableDraft, subtasks: next });
                        }}
                        className="flex-1 glass-input rounded-xl px-3 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setEditableDraft({
                        ...editableDraft,
                        subtasks: [...editableDraft.subtasks, '']
                      })
                    }
                    className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addSubtaskBtn')}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => setEditableDraft(null)}
                  className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 text-xs font-medium cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveDraft}
                  className="crystal-btn flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('aiConfirmSaveTaskBtn')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
