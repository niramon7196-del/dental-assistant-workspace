import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Send,
  Loader2,
  X,
  Quote,
  Clock,
  FileCheck2,
  ListTodo,
  Inbox,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  ActiveTab,
  EvidenceItem,
  ExtractionConfidence,
  InboxItem,
  InboxSourceType,
  TaskCategory,
  TaskItem
} from '../types/dental';
import {
  AiServiceError,
  buildManualFallbackTaskDraft,
  extractTaskFromContent,
  findDuplicateTasks,
  maskSensitivePii,
  PiiMaskStats,
  PreparedInboxFile,
  prepareInboxFile
} from '../services/aiService';
import { saveEvidenceFile } from '../services/evidenceStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { getWorkspaceDisplayName, useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  locales,
  translateCategory,
  translateInboxSourceType,
  translateInboxStatus,
  translateTaskStatus
} from '../utils/i18n';
import {
  resolveLocalizedInboxItem,
  resolveLocalizedTask
} from '../data/initialData';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';
import mascotInbox from '../assets/images/mascot_inbox_1795242057276.jpg';

const INBOX_MASCOT_URL = 'https://i.postimg.cc/NjktjjyL/915124600-1800868747806524-2398384840772570514-n.webp';

interface AiInboxProps {
  inboxItems: InboxItem[];
  setInboxItems: React.Dispatch<React.SetStateAction<InboxItem[]>>;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  evidenceList: EvidenceItem[];
  setEvidenceList: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  setActiveTab?: (tab: ActiveTab) => void;
}

interface ReviewDraft {
  title: string;
  category: TaskCategory;
  description: string;
  relatedLabOrCase: string;
  dueDate: string;
  missingFields: string[];
  confidence: ExtractionConfidence;
  sourceQuote: string;
  suggestedNextAction: string;
  rawContent: string;
  maskedInputPreview: string;
  sourceType: InboxSourceType;
  receivedTimestamp: string;
  dentistName: string;
  model: string;
  maskStats: PiiMaskStats;
  attachedFile: PreparedInboxFile | null;
}

const ALL_CATEGORIES: TaskCategory[] = [
  'Lab Coordination',
  'Patient Follow-up',
  'Sterilization & Prep',
  'Dentist Instruction',
  'Inventory & Supplies',
  'Record Keeping',
  'Other'
];

function formatNowTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export const AiInbox: React.FC<AiInboxProps> = ({
  inboxItems,
  setInboxItems,
  tasks,
  setTasks,
  evidenceList,
  setEvidenceList,
  setActiveTab
}) => {
  const { language, t } = useLanguage();
  const { activeWorkspace, saveManualFallbackTask, clearWorkspaceSlice } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pastedText, setPastedText] = useState('');
  const [preparedFile, setPreparedFile] = useState<PreparedInboxFile | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [receivedTimestamp, setReceivedTimestamp] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackSavedMsg, setFallbackSavedMsg] = useState<string | null>(null);

  const [reviewItem, setReviewItem] = useState<ReviewDraft | null>(null);
  const [isUserVerified, setIsUserVerified] = useState(false);
  const [mascotSrc, setMascotSrc] = useState<string>(INBOX_MASCOT_URL);
  const [editingInbox, setEditingInbox] = useState<InboxItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearInbox, setConfirmClearInbox] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const liveMaskInfo = useMemo(() => {
    return maskSensitivePii(pastedText);
  }, [pastedText]);

  const localizedTasks = useMemo(
    () => tasks.map((task) => resolveLocalizedTask(task, language)),
    [tasks, language]
  );

  const localizedInboxItems = useMemo(
    () => inboxItems.map((item) => resolveLocalizedInboxItem(item, language)),
    [inboxItems, language]
  );

  const duplicateWarnings = useMemo(() => {
    if (!reviewItem) return [];
    return findDuplicateTasks(
      {
        title: reviewItem.title,
        relatedLabOrCase: reviewItem.relatedLabOrCase || null,
        dueDate: reviewItem.dueDate || null
      },
      localizedTasks,
      language
    );
  }, [reviewItem, localizedTasks, language]);

  const handleSelectedFile = async (file: File) => {
    setErrorMessage(null);
    try {
      const prepared = await prepareInboxFile(file, language);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (prepared.evidenceFileType === 'image') {
        setImagePreviewUrl(URL.createObjectURL(file));
      } else {
        setImagePreviewUrl(null);
      }

      setPreparedFile(prepared);
      setReceivedTimestamp(formatNowTimestamp());

      if (prepared.extractedText) {
        setPastedText(prepared.extractedText);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t('extractionFailedTitle')
      );
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleSelectedFile(file);
    }
  };

  const handleClearAttachment = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (preparedFile?.extractedText && pastedText === preparedFile.extractedText) {
      setPastedText('');
    }
    setPreparedFile(null);
    setErrorMessage(null);
  };

  const handleRunAiExtraction = async () => {
    if (!pastedText.trim() && !preparedFile) return;

    setErrorMessage(null);
    setFallbackSavedMsg(null);
    setIsExtracting(true);
    setIsUserVerified(false);

    const activeSourceType: InboxSourceType = preparedFile
      ? preparedFile.sourceType
      : 'pasted_text';
    const captureTime = receivedTimestamp || formatNowTimestamp();
    if (!receivedTimestamp) {
      setReceivedTimestamp(captureTime);
    }

    try {
      const result = await extractTaskFromContent({
        text: pastedText,
        sourceType: activeSourceType,
        preparedFile,
        uiLanguage: language
      });

      setReviewItem({
        title: result.title,
        category: result.category,
        description: result.description,
        relatedLabOrCase: result.relatedLabOrCase || '',
        dueDate: result.dueDate || '',
        missingFields: result.missingFields,
        confidence: result.confidence,
        sourceQuote: result.sourceQuote,
        suggestedNextAction: result.suggestedNextAction,
        rawContent:
          pastedText || (preparedFile ? `[${t('attachedFile')}: ${preparedFile.file.name}]` : ''),
        maskedInputPreview: result.maskedInputPreview,
        sourceType: activeSourceType,
        receivedTimestamp: captureTime,
        dentistName: t('pendingDentistVerify'),
        model: result.model,
        maskStats: result.maskStats,
        attachedFile: preparedFile
      });
    } catch (err) {
      if (err instanceof AiServiceError && err.isUnavailable) {
        setErrorMessage(t('aiProviderUnavailableNotice'));
      } else {
        setErrorMessage(err instanceof Error ? err.message : t('extractionFailedTitle'));
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveWithoutAi = async (targetScope: 'active' | 'personal' = 'active') => {
    if (!pastedText.trim() && !preparedFile) return;
    setIsSavingFallback(true);
    setErrorMessage(null);
    try {
      const draft = buildManualFallbackTaskDraft({
        rawText: pastedText,
        attachmentName: preparedFile?.file.name,
        language,
        defaultCategory: 'Dentist Instruction',
        defaultKind: 'todo'
      });
      const res = await saveManualFallbackTask({
        ...draft,
        targetScope,
        preparedFile,
        inboxSourceType: preparedFile ? preparedFile.sourceType : 'pasted_text'
      });
      setFallbackSavedMsg(
        t('aiSavedWithoutAiToast').replace(
          '{workspace}',
          getWorkspaceDisplayName(res.targetWorkspace, language)
        )
      );
      setPastedText('');
      setReceivedTimestamp('');
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(null);
      setPreparedFile(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('extractionFailedTitle'));
    } finally {
      setIsSavingFallback(false);
    }
  };

  const handleConfirmAndCreateTask = async () => {
    if (!reviewItem || !isUserVerified || !reviewItem.title.trim()) return;

    setIsSavingTask(true);
    setErrorMessage(null);

    try {
      const nowId = Date.now();
      const newTaskId = `task-${nowId}`;
      const newInboxId = `inbox-${nowId}`;
      const linkedEvidenceIds: string[] = [];
      const linkedDocNames: string[] = [];

      if (reviewItem.attachedFile) {
        const evId = `ev-${nowId}`;
        const fileObj = reviewItem.attachedFile.file;

        await saveEvidenceFile(
          evId,
          fileObj,
          fileObj.name,
          reviewItem.attachedFile.mimeType,
          reviewItem.receivedTimestamp
        );

        const newEvidence: EvidenceItem = {
          id: evId,
          originalFilename: fileObj.name,
          fileType: reviewItem.attachedFile.evidenceFileType,
          uploadDateTime: reviewItem.receivedTimestamp,
          receivedTimestamp: reviewItem.receivedTimestamp,
          relatedTaskId: newTaskId,
          relatedInboxId: newInboxId,
          relatedPatientId: reviewItem.relatedLabOrCase.trim() || undefined,
          description: `${t('aiInbox')}: ${reviewItem.title.trim()}`,
          fileSize: reviewItem.attachedFile.sizeFormatted,
          mimeType: reviewItem.attachedFile.mimeType,
          hasStoredFile: true,
          isDemo: false
        };

        setEvidenceList([newEvidence, ...evidenceList]);
        linkedEvidenceIds.push(evId);
        linkedDocNames.push(fileObj.name);
      }

      const safeDueDate =
        reviewItem.dueDate.trim() ||
        new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

      const newTask: TaskItem = {
        id: newTaskId,
        title: reviewItem.title.trim(),
        description: reviewItem.description.trim(),
        category: reviewItem.category,
        priority: 'High',
        status: 'New',
        createdDate: new Date().toISOString().split('T')[0],
        receivedTimestamp: reviewItem.receivedTimestamp,
        dueDate: safeDueDate,
        relatedPatientId: reviewItem.relatedLabOrCase.trim() || undefined,
        relatedDocuments: linkedDocNames,
        evidenceIds: linkedEvidenceIds,
        activityHistory: [
          {
            id: `act-${nowId}`,
            timestamp: reviewItem.receivedTimestamp,
            action: t('extractedViaModel').replace('{model}', reviewItem.model),
            user: t('assistantVerified'),
            localized: {
              th: {
                action: locales.th.extractedViaModel.replace('{model}', reviewItem.model),
                user: locales.th.assistantVerified
              },
              en: {
                action: locales.en.extractedViaModel.replace('{model}', reviewItem.model),
                user: locales.en.assistantVerified
              }
            }
          }
        ],
        isDemo: false
      };

      const newInboxItem: InboxItem = {
        id: newInboxId,
        title: reviewItem.title.trim(),
        sourceType: reviewItem.sourceType,
        rawContent: reviewItem.maskedInputPreview || reviewItem.rawContent,
        receivedTimestamp: reviewItem.receivedTimestamp,
        dentistName: reviewItem.dentistName,
        evidenceId: linkedEvidenceIds[0],
        extractedData: {
          title: reviewItem.title.trim(),
          category: reviewItem.category,
          description: reviewItem.description.trim(),
          relatedLabOrCase: reviewItem.relatedLabOrCase.trim() || undefined,
          importantDates: reviewItem.dueDate.trim() || '-',
          dueDate: safeDueDate,
          missingInformation:
            reviewItem.missingFields.length > 0
              ? reviewItem.missingFields.join('; ')
              : 'None',
          missingFields: reviewItem.missingFields,
          confidence: reviewItem.confidence,
          sourceQuote: reviewItem.sourceQuote,
          suggestedNextAction: reviewItem.suggestedNextAction
        },
        status: 'Converted to Task',
        isDemo: false
      };

      setTasks([newTask, ...tasks]);
      setInboxItems([newInboxItem, ...inboxItems]);

      setReviewItem(null);
      setIsUserVerified(false);
      setPastedText('');
      setReceivedTimestamp('');
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(null);
      setPreparedFile(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t('extractionFailedTitle')
      );
    } finally {
      setIsSavingTask(false);
    }
  };

  const renderConfidenceBadge = (score: number) => {
    const pct = Math.round(score * 100);
    const pctStr = formatNumberByLanguage(pct, language);
    const isLow = score < 0.7;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
          isLow
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        }`}
      >
        {isLow && <AlertTriangle className="w-2.5 h-2.5" />}
        <span>
          {isLow
            ? `${t('lowConfidenceLabel')} ${pctStr}%`
            : `${t('confidenceLabel')} ${pctStr}%`}
        </span>
      </span>
    );
  };

  const getFieldInputClass = (score: number) =>
    `glass-input w-full rounded-xl px-3 py-2 text-slate-100 focus:outline-none border transition-colors ${
      score < 0.7 ? 'border-amber-400/70 bg-amber-500/10 focus:border-amber-300' : ''
    }`;

  const handleDeleteInboxItem = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setInboxItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveEditInbox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInbox) return;
    setInboxItems((prev) =>
      prev.map((item) =>
        item.id === editingInbox.id ? { ...editingInbox, localized: undefined } : item
      )
    );
    setEditingInbox(null);
  };

  const unprocessedCount = localizedInboxItems.filter((i) => i.status === 'Unprocessed').length;
  const convertedCount = localizedInboxItems.filter((i) => i.status === 'Converted to Task').length;
  const mediaUploadCount = localizedInboxItems.filter((i) => i.sourceType !== 'pasted_text').length;
  const textInputCount = localizedInboxItems.filter((i) => i.sourceType === 'pasted_text').length;

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'inbox-total',
      label: t('aiInbox'),
      value: localizedInboxItems.length,
      subLabel: t('inboxHistory'),
      tone: 'purple',
      icon: Inbox
    },
    {
      id: 'inbox-unprocessed',
      label: translateInboxStatus('Unprocessed', language),
      value: unprocessedCount,
      subLabel: t('newIncomingInstructions'),
      tone: 'amber',
      icon: Clock
    },
    {
      id: 'inbox-converted',
      label: translateInboxStatus('Converted to Task', language),
      value: convertedCount,
      subLabel: t('activeBadge'),
      tone: 'cyan',
      icon: CheckCircle2
    },
    {
      id: 'inbox-media',
      label: translateInboxSourceType('uploaded_image', language),
      value: mediaUploadCount,
      subLabel: t('attachedFile'),
      tone: 'rose',
      icon: ImageIcon
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Row 1: Standardized 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Standardized Line + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('aiInbox')}
        trendSeriesPrimaryData={[0, 0, 0, 0, unprocessedCount, localizedInboxItems.length, localizedInboxItems.length]}
        trendSeriesSecondaryLabel={translateInboxStatus('Converted to Task', language)}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, convertedCount, convertedCount]}
        ratioSlices={[
          {
            label: translateInboxStatus('Converted to Task', language),
            count: convertedCount,
            dotClass: 'bg-emerald-400',
            colorHex: '#2dd4bf'
          },
          {
            label: translateInboxStatus('Unprocessed', language),
            count: unprocessedCount,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          },
          {
            label: translateInboxSourceType('uploaded_image', language),
            count: mediaUploadCount,
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          },
          {
            label: translateInboxSourceType('pasted_text', language),
            count: textInputCount,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          }
        ]}
        activities={localizedInboxItems.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.dentistName} · ${translateInboxStatus(item.status, language)}`,
          dotClass: item.status === 'Converted to Task' ? 'bg-emerald-400' : 'bg-amber-400'
        }))}
      />

      {/* Top Banner */}
      <div className="crystal-tile rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/25 border border-violet-400/40 flex items-center justify-center text-violet-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">{t('aiInboxTitle')}</h2>
          </div>
          <p className="text-xs text-slate-300/80 max-w-2xl">{t('aiInboxSubtitle')}</p>
        </div>
        <div className="glass-subcard flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs text-slate-200">
          <ShieldCheck className="w-4 h-4 text-violet-300 shrink-0" />
          <span>{t('userConfirmationRequired')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-300" />
                <span>{t('pasteInstructions')}</span>
              </h3>
              <div className="flex items-center gap-3 bg-violet-500/12 border border-violet-300/40 px-3.5 py-2 rounded-xl backdrop-blur-[2px]">
                <img
                  src={mascotSrc}
                  alt="Assistant Mascot"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (mascotSrc !== mascotInbox) {
                      setMascotSrc(mascotInbox);
                    }
                  }}
                  className="w-10 h-10 rounded-full object-cover border-2 border-violet-400/60 shadow-md bg-white/10"
                />
                <span className="text-xs font-medium text-violet-200">{t('assistantReady')}</span>
              </div>
            </div>

            {/* Real Drag & Drop + File Picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,.xlsx,.xls,.csv,.txt,.md,.log"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-violet-400 bg-violet-500/15 scale-[1.01]'
                  : 'glass-subcard border-white/20 hover:border-violet-400/60'
              }`}
            >
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-400/35 flex items-center justify-center text-violet-200">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-100">{t('uploadDropTitle')}</p>
                  <p className="text-[11px] text-slate-300/80">{t('uploadDropSubtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[10px] text-slate-200">
                  <span className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg">
                    <ImageIcon className="w-3 h-3 text-violet-300" />{' '}
                    {translateInboxSourceType('uploaded_image', language)}
                  </span>
                  <span className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg">
                    <FileText className="w-3 h-3 text-blue-300" />{' '}
                    {translateInboxSourceType('uploaded_pdf', language)}
                  </span>
                  <span className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg">
                    <FileSpreadsheet className="w-3 h-3 text-emerald-300" />{' '}
                    {translateInboxSourceType('uploaded_excel', language)}
                  </span>
                  <span className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg">
                    <FileText className="w-3 h-3 text-slate-200" />{' '}
                    {translateInboxSourceType('pasted_text', language)} ({t('maxSizeChip')})
                  </span>
                </div>
              </div>
            </div>

            {/* Attached File Card */}
            {preparedFile && (
              <div className="glass-subcard border-violet-400/35 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt={preparedFile.file.name}
                        className="w-12 h-12 rounded-xl object-cover border border-violet-400/50 shrink-0"
                      />
                    ) : (
                      <div className="crystal-tile w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                        {preparedFile.evidenceFileType === 'pdf' ? (
                          <FileText className="w-5 h-5 text-blue-300" />
                        ) : preparedFile.evidenceFileType === 'spreadsheet' ? (
                          <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                        ) : (
                          <FileText className="w-5 h-5 text-violet-300" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-violet-100 truncate">
                        {preparedFile.file.name}
                      </p>
                      <p className="text-[11px] text-slate-300 flex flex-wrap items-center gap-2">
                        <span>{preparedFile.sizeFormatted}</span>
                        <span>•</span>
                        <span>
                          {preparedFile.base64Data
                            ? t('multimodalReady')
                            : t('spreadsheetReady')}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAttachment}
                    className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t('clearFile')}</span>
                  </button>
                </div>

                {preparedFile.base64Data && (
                  <p className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                    <span>{t('binaryPiiReminder')}</span>
                  </p>
                )}
              </div>
            )}

            {/* Textarea Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-300">
                  {t('pasteInstructions')}
                </label>
                {receivedTimestamp && (
                  <span className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-violet-300" />
                    {t('receivedAtLabel')}: {formatDateByLanguage(receivedTimestamp, language)}
                  </span>
                )}
              </div>
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  if (!receivedTimestamp && e.target.value.trim()) {
                    setReceivedTimestamp(formatNowTimestamp());
                  }
                }}
                placeholder={t('pastePlaceholder')}
                className="glass-input w-full rounded-xl p-3.5 text-xs placeholder:text-slate-400/70 font-mono"
              />
            </div>

            {/* Live PII Redaction Notice */}
            {liveMaskInfo.stats.totalRedacted > 0 && (
              <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-3 text-xs text-emerald-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {t('piiAutoMaskTitle')} (
                    {formatNumberByLanguage(liveMaskInfo.stats.totalRedacted, language)})
                  </p>
                  <p className="text-[11px] text-emerald-300/90">
                    {t('piiSummaryCounts')
                      .replace('{phones}', formatNumberByLanguage(liveMaskInfo.stats.phones, language))
                      .replace('{thaiIds}', formatNumberByLanguage(liveMaskInfo.stats.thaiIds, language))
                      .replace('{hns}', formatNumberByLanguage(liveMaskInfo.stats.hns, language))}
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert with Direct Local Save Fallback */}
            {errorMessage && (
              <div className="rounded-xl bg-amber-950/35 border border-amber-500/45 p-4 text-xs text-amber-100 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-200">{t('extractionFailedTitle')}</p>
                    <p className="text-[11px] text-amber-100/90 mt-0.5 leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                {(pastedText.trim() || preparedFile) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
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
                        className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-400/40 text-violet-200 text-xs font-medium cursor-pointer"
                      >
                        <ListTodo className="w-3.5 h-3.5 text-violet-300" />
                        <span>{t('aiSaveToPersonalNoAiBtn')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {fallbackSavedMsg && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-3.5 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{fallbackSavedMsg}</span>
                </div>
                {setActiveTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="px-3 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-300/40 text-emerald-100 font-semibold cursor-pointer"
                  >
                    {t('viewTasksLinkBtn')}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => void handleSaveWithoutAi('active')}
                disabled={isSavingFallback || (!pastedText.trim() && !preparedFile)}
                className="crystal-tile flex items-center gap-2 hover:bg-white/15 disabled:opacity-45 disabled:cursor-not-allowed text-slate-100 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                {isSavingFallback ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                ) : (
                  <ListTodo className="w-4 h-4 text-emerald-300" />
                )}
                <span>{t('aiInboxSaveDirectBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleRunAiExtraction()}
                disabled={isExtracting || (!pastedText.trim() && !preparedFile)}
                className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('analyzingAi')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t('runAiExtraction')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Review Screen */}
          {reviewItem && (
            <div className="neon-glass border-2 border-violet-400/50 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-violet-400 animate-pulse"></span>
                  <h3 className="text-sm font-bold text-slate-100">{t('extractionReviewTitle')}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                  {reviewItem.model} ({t('jsonSchemaBadge')})
                </span>
              </div>

              {reviewItem.maskStats.totalRedacted > 0 && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/35 p-3 text-xs text-emerald-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    {t('piiMaskedDone')
                      .replace('{phones}', formatNumberByLanguage(reviewItem.maskStats.phones, language))
                      .replace('{thaiIds}', formatNumberByLanguage(reviewItem.maskStats.thaiIds, language))
                      .replace('{hns}', formatNumberByLanguage(reviewItem.maskStats.hns, language))}
                  </span>
                </div>
              )}

              {/* Duplicate Task Warning */}
              {duplicateWarnings.length > 0 && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-400/45 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                    <span>
                      {t('duplicateWarningTitle')} (
                      {formatNumberByLanguage(duplicateWarnings.length, language)})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {duplicateWarnings.map(({ task, reasons }) => (
                      <div
                        key={task.id}
                        className="glass-subcard border-rose-400/30 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <div>
                          <p className="font-semibold text-slate-100">{task.title}</p>
                          <p className="text-[11px] text-rose-200/90">
                            {t('duplicateReasonPrefix')}: {reasons.join(' • ')}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-300 font-mono shrink-0">
                          {t('dueCol')}: {formatDateByLanguage(task.dueDate, language)} (
                          {translateTaskStatus(task.status, language)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Fields Warning */}
              {reviewItem.missingFields.length > 0 && (
                <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('missingFieldsTitle')}</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-200/90 space-y-0.5">
                    {reviewItem.missingFields.map((field, idx) => (
                      <li key={idx}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 font-medium">{t('extractedTitle')}</label>
                    {renderConfidenceBadge(reviewItem.confidence.title)}
                  </div>
                  <input
                    type="text"
                    value={reviewItem.title}
                    onChange={(e) => setReviewItem({ ...reviewItem, title: e.target.value })}
                    className={getFieldInputClass(reviewItem.confidence.title)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 font-medium">{t('taskCategory')}</label>
                    {renderConfidenceBadge(reviewItem.confidence.category)}
                  </div>
                  <select
                    value={reviewItem.category}
                    onChange={(e) =>
                      setReviewItem({ ...reviewItem, category: e.target.value as TaskCategory })
                    }
                    className={getFieldInputClass(reviewItem.confidence.category)}
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {translateCategory(cat, language)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 font-medium">{t('taskDescription')}</label>
                    {renderConfidenceBadge(reviewItem.confidence.description)}
                  </div>
                  <textarea
                    rows={3}
                    value={reviewItem.description}
                    onChange={(e) => setReviewItem({ ...reviewItem, description: e.target.value })}
                    className={getFieldInputClass(reviewItem.confidence.description)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 font-medium">{t('relatedLabCase')}</label>
                    {renderConfidenceBadge(reviewItem.confidence.relatedLabOrCase)}
                  </div>
                  <input
                    type="text"
                    placeholder={t('relatedLabPlaceholder')}
                    value={reviewItem.relatedLabOrCase}
                    onChange={(e) =>
                      setReviewItem({ ...reviewItem, relatedLabOrCase: e.target.value })
                    }
                    className={getFieldInputClass(reviewItem.confidence.relatedLabOrCase)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-400 font-medium">{t('dueDateLabel')}</label>
                    {renderConfidenceBadge(reviewItem.confidence.dueDate)}
                  </div>
                  <input
                    type="date"
                    value={reviewItem.dueDate}
                    onChange={(e) => setReviewItem({ ...reviewItem, dueDate: e.target.value })}
                    className={getFieldInputClass(reviewItem.confidence.dueDate)}
                  />
                  {!reviewItem.dueDate && (
                    <p className="text-[10px] text-amber-300">{t('dueDateMissingHint')}</p>
                  )}
                </div>

                <div className="md:col-span-2 glass-subcard space-y-1.5 p-3.5 rounded-xl">
                  <p className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-violet-300" />
                    <span>{t('sourceQuoteTitle')}</span>
                  </p>
                  <p className="text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {reviewItem.sourceQuote || t('sourceQuoteEmpty')}
                  </p>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="glass-subcard p-3 rounded-xl space-y-1">
                    <p className="text-slate-300 font-medium">{t('suggestedNextAction')}</p>
                    <p className="text-slate-100">{reviewItem.suggestedNextAction || '-'}</p>
                  </div>
                  <div className="glass-subcard p-3 rounded-xl space-y-1">
                    <p className="text-slate-300 font-medium flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{t('evidenceAndTimeTitle')}</span>
                    </p>
                    <p className="text-slate-100">
                      {t('receivedTimestampPrefix')}:{' '}
                      <span className="font-mono">
                        {formatDateByLanguage(reviewItem.receivedTimestamp, language)}
                      </span>
                    </p>
                    {reviewItem.attachedFile ? (
                      <p className="text-[11px] text-emerald-300 truncate">
                        {t('willStoreIndexedDb').replace(
                          '{filename}',
                          reviewItem.attachedFile.file.name
                        )}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-300/80">{t('noAttachmentTextOnly')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-start gap-2.5 text-xs text-slate-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isUserVerified}
                    onChange={(e) => setIsUserVerified(e.target.checked)}
                    className="mt-0.5 rounded border-white/25 bg-white/10 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <span>{t('verifyCheckboxLabel')}</span>
                </label>

                <div className="flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewItem(null);
                      setIsUserVerified(false);
                    }}
                    className="crystal-tile px-4 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
                  >
                    {t('discard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmAndCreateTask()}
                    disabled={!isUserVerified || isSavingTask || !reviewItem.title.trim()}
                    className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-45 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    {isSavingTask ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('savingTask')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('confirmCreateTask')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Recent Inbox Stream with Inline Photo Attachment, Edit & Delete */}
        <div className="space-y-6">
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>
                  {t('inboxHistory')} ({formatNumberByLanguage(inboxItems.length, language)})
                </span>
                <span className="text-[10px] text-violet-200 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-400/35">
                  {t('activeBadge')}
                </span>
              </h3>
              {inboxItems.length > 0 && (
                confirmClearInbox ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void clearWorkspaceSlice('inboxItems');
                        setConfirmClearInbox(false);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t('confirmClearAllBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearInbox(false)}
                      className="crystal-tile px-2.5 py-1 rounded-lg text-[11px] text-slate-200 hover:text-white cursor-pointer"
                    >
                      {t('cancelBtn')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearInbox(true)}
                    className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-rose-200 hover:bg-rose-500/20 border-rose-400/30 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('clearAllBtn')}</span>
                  </button>
                )
              )}
            </div>

            <div className="space-y-3">
              {localizedInboxItems.length === 0 ? (
                <div className="glass-subcard p-5 rounded-xl border-dashed text-center space-y-1.5">
                  <p className="text-xs font-semibold text-slate-200">
                    {t('awaitingSheetSyncEmpty')}
                  </p>
                  <p className="text-[11px] text-slate-300/80 leading-relaxed">
                    {t('awaitingSheetSyncHint')}
                  </p>
                </div>
              ) : (
                localizedInboxItems.map((item) => {
                  const isConfirmDel = confirmDeleteId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="glass-subcard p-3.5 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span className="font-medium text-violet-300 truncate">{item.dentistName}</span>
                        <span className="text-slate-300/75 shrink-0 tabular-nums">
                          {formatDateByLanguage(item.receivedTimestamp, language)}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100">{item.title}</h4>
                      <p className="text-[11px] text-slate-300/85 line-clamp-2">{item.rawContent}</p>

                      {/* Inline Photo Attachment Preview / Upload */}
                      <AttachmentCell
                        variant="card"
                        evidenceId={item.evidenceId}
                        itemTitle={item.title}
                        contextLabel={t('aiInbox')}
                        relatedInboxId={item.id}
                        onAttached={(evId) =>
                          setInboxItems((prev) =>
                            prev.map((x) => (x.id === item.id ? { ...x, evidenceId: evId } : x))
                          )
                        }
                        onRemoved={() =>
                          setInboxItems((prev) =>
                            prev.map((x) => (x.id === item.id ? { ...x, evidenceId: undefined } : x))
                          )
                        }
                      />

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="crystal-tile text-[10px] px-2 py-0.5 rounded text-slate-200 truncate">
                            {translateInboxSourceType(item.sourceType, language)}
                          </span>
                          <span className="text-[10px] text-emerald-300 font-medium shrink-0">
                            {translateInboxStatus(item.status, language)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const raw = inboxItems.find((x) => x.id === item.id);
                              if (raw) setEditingInbox({ ...raw });
                            }}
                            className="crystal-tile p-1 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                            aria-label={t('editBtn')}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInboxItem(item.id)}
                            className={`p-1 rounded-lg border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                              isConfirmDel
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                            }`}
                            title={isConfirmDel ? t('confirmDeleteBtn') : t('deleteBtn')}
                          >
                            <Trash2 className="w-3 h-3" />
                            {isConfirmDel && <span>{t('confirmDeleteBtn')}</span>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar setActiveTab={setActiveTab} />

      {/* Edit Inbox Item Modal */}
      {editingInbox &&
        createPortal(
          <div
            onClick={() => setEditingInbox(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditInbox}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingInbox.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingInbox(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('extractedTitle')}</label>
                  <input
                    type="text"
                    required
                    value={editingInbox.title}
                    onChange={(e) => setEditingInbox({ ...editingInbox, title: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">{t('dentistLabel')}</label>
                    <input
                      type="text"
                      value={editingInbox.dentistName}
                      onChange={(e) =>
                        setEditingInbox({ ...editingInbox, dentistName: e.target.value })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">{t('status')}</label>
                    <select
                      value={editingInbox.status}
                      onChange={(e) =>
                        setEditingInbox({
                          ...editingInbox,
                          status: e.target.value as InboxItem['status']
                        })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2"
                    >
                      <option value="Unprocessed">{translateInboxStatus('Unprocessed', language)}</option>
                      <option value="Reviewed">{translateInboxStatus('Reviewed', language)}</option>
                      <option value="Converted to Task">{translateInboxStatus('Converted to Task', language)}</option>
                      <option value="Archived">{translateInboxStatus('Archived', language)}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('pasteInstructions')}</label>
                  <textarea
                    rows={4}
                    value={editingInbox.rawContent}
                    onChange={(e) =>
                      setEditingInbox({ ...editingInbox, rawContent: e.target.value })
                    }
                    className="glass-input w-full rounded-xl p-3 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingInbox(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
