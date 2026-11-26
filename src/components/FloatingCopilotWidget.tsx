import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  ImagePlus,
  Send,
  CheckCircle2,
  Copy,
  Check,
  ListChecks,
  Inbox,
  MessageSquareHeart,
  Loader2,
  Trash2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ListTodo
} from 'lucide-react';
import {
  ActiveTab,
  EvidenceItem,
  LabOrder,
  PatientFollowUpItem,
  QueueItem,
  TaskItem
} from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { getWorkspaceDisplayName, useWorkspace } from '../contexts/WorkspaceContext';
import {
  AiServiceError,
  buildManualFallbackTaskDraft,
  CopilotOutreachType,
  CopilotTargetZone,
  CopilotWidgetMode,
  FloatingCopilotResult,
  formatFileSize,
  PreparedInboxFile,
  prepareInboxFile,
  runFloatingCopilotAction
} from '../services/aiService';
import { saveEvidenceFile } from '../services/evidenceStorage';
import mascotWelcome from '../assets/images/mascot_welcome_1795242056750.jpg';

const COPILOT_MASCOT_URL = 'https://i.postimg.cc/cL21Z0sh/IMG-7229.png';

interface FloatingCopilotWidgetProps {
  setActiveTab: (tab: ActiveTab) => void;
  isSuppressed?: boolean;
}

interface ViewportMetrics {
  height: number;
  offsetTop: number;
  keyboardOffset: number;
}

const DODGE_RESTORE_DELAY_MS = 700;

export const FloatingCopilotWidget: React.FC<FloatingCopilotWidgetProps> = ({
  setActiveTab,
  isSuppressed = false
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    tasks,
    setTasks,
    queueItems,
    setQueueItems,
    labOrders,
    setLabOrders,
    followUps,
    setFollowUps,
    setEvidenceList,
    recordAudit,
    saveManualFallbackTask,
    chatState,
    updateChatState
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mascotSrc, setMascotSrc] = useState(COPILOT_MASCOT_URL);
  const mode: CopilotWidgetMode = chatState.floatingMode || 'prioritize';
  const outreachType: CopilotOutreachType = chatState.floatingOutreachType || 'chat_reply';
  const inputText = chatState.floatingInputText || '';
  const setMode = (nextMode: CopilotWidgetMode) => updateChatState({ floatingMode: nextMode });
  const setOutreachType = (nextType: CopilotOutreachType) =>
    updateChatState({ floatingOutreachType: nextType });
  const setInputText = (nextText: string) => updateChatState({ floatingInputText: nextText });
  const [preparedFile, setPreparedFile] = useState<PreparedInboxFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<FloatingCopilotResult | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [viewport, setViewport] = useState<ViewportMetrics | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const buttonWrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isClinic = activeWorkspace.type === 'clinic';

  const isOverlayHidden = isSuppressed;

  // Track visualViewport only while popover is open so iPad on-screen keyboard never covers input
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      setViewport(null);
      return;
    }

    const updateViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewport({ height: window.innerHeight, offsetTop: 0, keyboardOffset: 0 });
        return;
      }
      const keyboardOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setViewport({
        height: vv.height,
        offsetTop: vv.offsetTop,
        keyboardOffset
      });
    };

    updateViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateViewport, { passive: true });
    vv?.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport, { passive: true });

    return () => {
      vv?.removeEventListener('resize', updateViewport);
      vv?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openPopover = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsVisible(false);
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  };

  const closePopover = () => {
    setIsVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 150);
  };

  const togglePopover = () => {
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  };

  const workspaceSummary = useMemo(
    () => ({
      workspaceType: activeWorkspace.type,
      workspaceName: activeWorkspace.name,
      waitingQueues: queueItems
        .filter((q) => q.status === 'waiting' || q.status === 'called')
        .slice(0, 6)
        .map((q) => ({ q: q.queueNumber, patient: q.patientName, proc: q.procedure, status: q.status })),
      urgentTasks: tasks
        .filter((tk) => tk.status !== 'Completed' && tk.status !== 'Cancelled')
        .slice(0, 8)
        .map((tk) => ({ title: tk.title, kind: tk.taskKind, priority: tk.priority, due: tk.dueDate })),
      activeLabs: labOrders
        .filter((l) => l.status !== 'Delivered' && l.status !== 'Quality Checked')
        .slice(0, 5)
        .map((l) => ({ ref: l.orderReference, workType: l.workType, expected: l.expectedReturnDate })),
      pendingFollowUps: followUps
        .filter((f) => f.status !== 'Completed')
        .slice(0, 5)
        .map((f) => ({ patient: f.patientRefId, category: f.caseCategory, due: f.dueDate }))
    }),
    [activeWorkspace.name, activeWorkspace.type, queueItems, tasks, labOrders, followUps]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    try {
      const prepared = await prepareInboxFile(file, language);
      setPreparedFile(prepared);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('extractionFailedTitle'));
    }
  };

  const handleRunCopilot = async () => {
    setErrorMsg(null);
    setSavedToast(null);
    setIsLoading(true);
    try {
      const res = await runFloatingCopilotAction({
        mode,
        text: inputText,
        outreachType,
        preparedFile,
        uiLanguage: language,
        workspaceContext: workspaceSummary
      });
      setResult(res);
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
    if (!inputText.trim() && !preparedFile) return;
    setIsSavingFallback(true);
    setErrorMsg(null);
    try {
      const draft = buildManualFallbackTaskDraft({
        rawText: inputText,
        attachmentName: preparedFile?.file.name,
        language,
        defaultKind: mode === 'outreach' ? 'followup' : 'todo',
        defaultCategory: mode === 'outreach' ? 'Patient Follow-up' : 'Dentist Instruction'
      });
      const res = await saveManualFallbackTask({
        ...draft,
        targetScope,
        preparedFile,
        inboxSourceType: preparedFile
          ? preparedFile.sourceType
          : mode === 'intake'
          ? 'pasted_text'
          : undefined
      });
      setSavedToast(
        t('aiSavedWithoutAiToast').replace(
          '{workspace}',
          getWorkspaceDisplayName(res.targetWorkspace, language)
        )
      );
      setInputText('');
      setPreparedFile(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('extractionFailedTitle'));
    } finally {
      setIsSavingFallback(false);
    }
  };

  const getZoneLabel = (zone: CopilotTargetZone): string => {
    if (zone === 'queue') return t('zoneTabQueue');
    if (zone === 'lab') return t('zoneTabLab');
    if (zone === 'followup') return t('zoneTabFollowup');
    if (zone === 'evidence') return t('zoneTabEvidence');
    return t('myTasks');
  };

  const handleConfirmSaveIntake = async () => {
    if (!result?.intakeDraft) return;
    const draft = result.intakeDraft;
    const todayIso = new Date().toISOString().split('T')[0];
    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);

    let linkedEvId: string | undefined;
    if (preparedFile) {
      linkedEvId = `ev-cop-${Date.now()}`;
      await saveEvidenceFile(
        linkedEvId,
        preparedFile.file,
        preparedFile.file.name,
        preparedFile.mimeType,
        nowTs
      );
      const newEv: EvidenceItem = {
        id: linkedEvId,
        originalFilename: preparedFile.file.name,
        fileType: preparedFile.evidenceFileType,
        uploadDateTime: nowTs.slice(0, 16),
        receivedTimestamp: nowTs,
        description: `${draft.title} — ${draft.description}`,
        fileSize: preparedFile.sizeFormatted,
        mimeType: preparedFile.mimeType,
        hasStoredFile: true,
        isDemo: false
      };
      setEvidenceList((prev) => [newEv, ...prev]);
    }

    const effectiveZone: CopilotTargetZone =
      !isClinic && (draft.targetZone === 'lab' || draft.targetZone === 'followup')
        ? 'task'
        : draft.targetZone;

    if (effectiveZone === 'queue') {
      const newQ: QueueItem = {
        id: `q-cop-${Date.now()}`,
        queueNumber: `Q${String(queueItems.length + 1).padStart(2, '0')}`,
        patientName: draft.patientOrRef || draft.title,
        procedure: draft.description,
        status: 'waiting',
        attachmentEvidenceId: linkedEvId,
        createdAt: nowTs
      };
      setQueueItems((prev) => [newQ, ...prev]);
    } else if (effectiveZone === 'lab') {
      const newLab: LabOrder = {
        id: `lab-cop-${Date.now()}`,
        orderReference: draft.patientOrRef || `LAB-${Date.now().toString().slice(-4)}`,
        workType: 'Crown',
        laboratoryName: draft.title,
        dentistName: t('assistantSelf'),
        patientRefId: draft.patientOrRef || 'PT-NEW',
        dateSent: todayIso,
        expectedReturnDate: draft.dueDate || todayIso,
        status: 'Ordered',
        supportingFiles: linkedEvId ? [linkedEvId] : [],
        attachmentEvidenceId: linkedEvId,
        workHistory: [
          {
            id: `lh-${Date.now()}`,
            timestamp: nowTs.slice(0, 16),
            status: 'Ordered',
            notes: draft.description
          }
        ],
        isDemo: false
      };
      setLabOrders((prev) => [newLab, ...prev]);
    } else if (effectiveZone === 'followup') {
      const newFu: PatientFollowUpItem = {
        id: `fu-cop-${Date.now()}`,
        patientRefId: draft.patientOrRef || 'PT-FOLLOW',
        caseCategory: draft.title,
        followUpReason: draft.description,
        nextAction: draft.description,
        dueDate: draft.dueDate || todayIso,
        status: 'Pending',
        relatedEvidenceIds: linkedEvId ? [linkedEvId] : [],
        attachmentEvidenceId: linkedEvId,
        isDemo: false
      };
      setFollowUps((prev) => [newFu, ...prev]);
    } else {
      const newTask: TaskItem = {
        id: `task-cop-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        taskKind: effectiveZone === 'evidence' ? 'check' : draft.taskKind || 'todo',
        title: draft.title,
        description: draft.description,
        category: draft.category || 'Dentist Instruction',
        priority: draft.priority || 'Medium',
        status: 'New',
        createdDate: todayIso,
        receivedTimestamp: nowTs,
        dueDate: draft.dueDate || todayIso,
        relatedPatientId: draft.patientOrRef || undefined,
        relatedDocuments: preparedFile ? [preparedFile.file.name] : [],
        evidenceIds: linkedEvId ? [linkedEvId] : [],
        attachmentEvidenceId: linkedEvId,
        activityHistory: [
          {
            id: `act-${Date.now()}`,
            timestamp: nowTs.slice(0, 16),
            action: t('taskCreatedManually'),
            user: t('assistantSelf')
          }
        ],
        isDemo: false
      };
      setTasks((prev) => [newTask, ...prev]);
    }

    const zoneName = getZoneLabel(effectiveZone);
    recordAudit('ai_assist', `${draft.title} -> ${zoneName}`);
    setSavedToast(t('copilotIntakeSavedMsg').replace('{zone}', zoneName));
    setInputText('');
    setPreparedFile(null);
    setResult(null);
  };

  const handleCopyDraft = async () => {
    if (!result?.draftMessage) return;
    await navigator.clipboard.writeText(result.draftMessage);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const isKeyboardOpen = (viewport?.keyboardOffset ?? 0) > 40;

  // Compact mode positioning & keyboard avoidance (never blocks iPad sidebar or gets hidden by keyboard)
  const compactStyle: React.CSSProperties | undefined = !isExpanded && viewport
    ? {
        bottom: isKeyboardOpen ? `${viewport.keyboardOffset + 12}px` : undefined,
        maxHeight: isKeyboardOpen
          ? `${Math.max(240, viewport.height - 24)}px`
          : `${Math.max(280, viewport.height - 104)}px`
      }
    : undefined;

  // Expanded mode viewport-safe wrapper style
  const expandedContainerStyle: React.CSSProperties | undefined = isExpanded && viewport
    ? {
        top: `${viewport.offsetTop}px`,
        height: `${viewport.height}px`
      }
    : undefined;

  const panelContent = (
    <div
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      style={compactStyle}
      className={`${
        isExpanded
          ? 'w-full max-w-3xl h-[84dvh] max-h-[820px]'
          : `fixed right-4 sm:right-6 ${
              isKeyboardOpen ? 'bottom-3' : 'bottom-24'
            } z-50 w-[calc(100vw-2rem)] sm:w-[380px] lg:w-[440px] max-h-[60dvh] lg:max-h-[70dvh]`
      } flex flex-col neon-glass rounded-2xl shadow-2xl overflow-hidden origin-bottom-right transition-[opacity,transform] duration-150 ease-out ${
        isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
      }`}
    >
      {/* Header with Expand/Compact & Close */}
      <div className="px-4 py-3 border-b border-white/15 bg-gradient-to-r from-violet-600/25 to-cyan-500/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={mascotSrc}
            alt={t('copilotWidgetTitle')}
            referrerPolicy="no-referrer"
            onError={() => {
              if (mascotSrc !== mascotWelcome) setMascotSrc(mascotWelcome);
            }}
            className="w-8 h-8 rounded-full object-cover object-top border border-violet-300/40 bg-violet-950/35 shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white text-depth truncate">{t('copilotWidgetTitle')}</h4>
            <p className="text-[10px] text-violet-100/85 truncate">{t('copilotWidgetSubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? t('copilotCompactBtn') : t('copilotExpandBtn')}
            aria-label={isExpanded ? t('copilotCompactBtn') : t('copilotExpandBtn')}
            className="p-1.5 rounded-lg crystal-tile hover:bg-white/15 text-violet-200 hover:text-white border border-white/15 transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={closePopover}
            title={t('close')}
            aria-label={t('close')}
            className="p-1.5 rounded-lg crystal-tile hover:bg-white/15 text-slate-200 hover:text-white border border-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Mode Segmented Tabs */}
      <div className="p-2 border-b border-white/15 grid grid-cols-3 gap-1 bg-white/5 text-[11px] shrink-0">
        <button
          type="button"
          onClick={() => {
            setMode('prioritize');
            setResult(null);
            setErrorMsg(null);
          }}
          className={`px-2 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${
            mode === 'prioritize' ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('copilotModePrioritize')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('intake');
            setResult(null);
            setErrorMsg(null);
          }}
          className={`px-2 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${
            mode === 'intake' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Inbox className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('copilotModeIntake')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('outreach');
            setResult(null);
            setErrorMsg(null);
          }}
          className={`px-2 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${
            mode === 'outreach' ? 'bg-fuchsia-600 text-white' : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <MessageSquareHeart className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('copilotModeOutreach')}</span>
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-4 space-y-3 text-xs">
        {savedToast && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-2.5 text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
              <span className="leading-snug">{savedToast}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('tasks');
                closePopover();
              }}
              className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-100 text-[10px] font-semibold cursor-pointer shrink-0"
            >
              {t('viewTasksLinkBtn')}
            </button>
          </div>
        )}

        {mode === 'prioritize' && (
          <p className="text-[11px] text-slate-300 leading-relaxed">{t('copilotPrioritizeHint')}</p>
        )}

        {mode === 'outreach' && (
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'chat_reply', label: t('copilotOutreachTypeReply') },
                { id: 'call_script', label: t('copilotOutreachTypeCallScript') },
                { id: 'team_handoff', label: t('copilotOutreachTypeTeamHandoff') }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOutreachType(opt.id)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border cursor-pointer truncate transition-colors ${
                  outreachType === opt.id
                    ? 'bg-fuchsia-500/25 border-fuchsia-400/50 text-fuchsia-100'
                    : 'glass-subcard border-white/15 text-slate-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {mode !== 'prioritize' && (
          <textarea
            rows={isExpanded ? 5 : 3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={(e) => {
              const target = e.currentTarget;
              window.setTimeout(() => {
                target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }, 120);
            }}
            placeholder={
              mode === 'intake' ? t('copilotIntakePlaceholder') : t('copilotOutreachPlaceholder')
            }
            className="w-full glass-input rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-400"
          />
        )}

        {mode === 'intake' && (
          <div className="flex items-center justify-between gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl crystal-tile hover:bg-white/15 border border-violet-300/35 text-violet-100 text-[11px] font-medium cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>{t('copilotAttachImageBtn')}</span>
            </button>
            {preparedFile && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 truncate">
                <span className="truncate">
                  {preparedFile.file.name} ({formatFileSize(preparedFile.file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => setPreparedFile(null)}
                  className="text-slate-400 hover:text-rose-400 cursor-pointer"
                  aria-label={t('close')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={isLoading}
          onClick={() => void handleRunCopilot()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-lg shadow-violet-600/25 transition-opacity"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>
            {mode === 'prioritize'
              ? t('copilotPrioritizeBtn')
              : mode === 'intake'
              ? t('copilotIntakeBtn')
              : t('copilotOutreachBtn')}
          </span>
        </button>

        {errorMsg && (
          <div className="rounded-xl bg-amber-950/40 border border-amber-500/45 p-3 text-[11px] text-amber-100 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
            {(inputText.trim() || preparedFile) ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={isSavingFallback}
                  onClick={() => void handleSaveWithoutAi('active')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                >
                  {isSavingFallback ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ListTodo className="w-3.5 h-3.5" />
                  )}
                  <span>{t('aiSaveDirectlyNoAiBtn')}</span>
                </button>
                {isClinic && (
                  <button
                    type="button"
                    disabled={isSavingFallback}
                    onClick={() => void handleSaveWithoutAi('personal')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg crystal-tile hover:bg-white/15 border border-violet-300/40 text-violet-100 text-[11px] font-medium cursor-pointer"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-violet-300" />
                    <span>{t('aiSaveToPersonalNoAiBtn')}</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tasks');
                  closePopover();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg crystal-tile hover:bg-white/15 border border-white/20 text-slate-100 text-[11px] font-medium cursor-pointer"
              >
                <ListTodo className="w-3.5 h-3.5 text-cyan-300" />
                <span>{t('viewTasksLinkBtn')}</span>
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t border-white/15">
            <p className="text-slate-100 leading-relaxed whitespace-pre-line">
              {result.summaryReply}
            </p>

            {result.actionSteps.length > 0 && (
              <ul className="space-y-1.5 glass-subcard border border-white/15 rounded-xl p-3">
                {result.actionSteps.map((step, idx) => (
                  <li key={idx} className="text-[11px] text-slate-100 flex items-start gap-2">
                    <span className="font-mono text-cyan-300 shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            )}

            {result.draftMessage && (
              <div className="space-y-2 glass-subcard border border-fuchsia-400/35 rounded-xl p-3">
                <p className="text-xs text-slate-100 whitespace-pre-line leading-relaxed">
                  {result.draftMessage}
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopyDraft()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600/25 hover:bg-fuchsia-600/35 border border-fuchsia-400/40 text-fuchsia-200 text-[11px] font-medium cursor-pointer"
                >
                  {copiedDraft ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDraft ? t('chatCopiedMsg') : t('copilotCopyMessageBtn')}</span>
                </button>
              </div>
            )}

            {result.intakeDraft && (
              <div className="space-y-2.5 glass-subcard border border-cyan-400/35 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-cyan-300">
                    {getZoneLabel(result.intakeDraft.targetZone)}
                  </span>
                  <span className="font-mono text-slate-300">{result.intakeDraft.dueDate}</span>
                </div>
                <p className="font-semibold text-slate-100">{result.intakeDraft.title}</p>
                <p className="text-[11px] text-slate-200">{result.intakeDraft.description}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmSaveIntake()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('copilotConfirmCreateBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inbox')}
                    className="px-2.5 py-2 rounded-lg crystal-tile hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-[11px] cursor-pointer"
                  >
                    {t('aiInbox')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Compact Circular Mascot Button (Auto-hides on TV Display Mode & full-screen modals) */}
      {!(isOpen && (isExpanded || isKeyboardOpen)) && !isOverlayHidden && (
        <div
          ref={buttonWrapperRef}
          className="fixed bottom-4 right-3.5 sm:bottom-5 sm:right-5 z-40 transition-transform duration-150 ease-out"
        >
          <div>
            <button
              type="button"
              onClick={togglePopover}
              title={t('copilotOpenTooltip')}
              aria-label={t('copilotOpenTooltip')}
              aria-expanded={isOpen}
              className="w-14 h-14 sm:w-[62px] sm:h-[62px] rounded-full p-1 bg-gradient-to-br from-violet-500/45 via-fuchsia-500/35 to-cyan-400/40 border border-violet-300/60 shadow-[0_0_22px_rgba(168,85,247,0.45)] hover:scale-105 active:scale-95 transition-transform duration-150 touch-manipulation cursor-pointer flex items-center justify-center"
            >
              <img
                src={mascotSrc}
                alt={t('copilotWidgetTitle')}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (mascotSrc !== mascotWelcome) setMascotSrc(mascotWelcome);
                }}
                className="w-full h-full rounded-full object-cover object-top bg-violet-950/40"
              />
            </button>
          </div>
        </div>
      )}

      {/* Responsive Admin AI Popover (Compact Floating vs Expanded Modal) */}
      {isOpen &&
        !isOverlayHidden &&
        (isExpanded ? (
          <div
            onClick={closePopover}
            style={expandedContainerStyle}
            className={`fixed inset-x-0 top-0 bottom-0 z-50 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 transition-opacity duration-150 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {panelContent}
          </div>
        ) : (
          panelContent
        ))}
    </>
  );
};
