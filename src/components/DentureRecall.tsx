import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MessageSquarePlus,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  RotateCcw,
  X,
  FileText,
  ChevronRight,
  Loader2,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Users,
  PhoneCall,
  CheckSquare
} from 'lucide-react';
import { ActiveTab, DENTURE_STATUSES, DentureCase, DentureStatus, SheetConfig } from '../types/dental';
import {
  appendThaiNote,
  extractMonthLabel,
  formatThaiApptString,
  formatThaiNotePrefix,
  getUrgencyRank,
  isReadyToCallCase,
  maskPhoneNumber,
  matchesPatientQuery,
  parseThaiApptString,
  parseThaiQuickCommand,
  ParsedCommandResult,
  updateDentureCase,
  DentureUpdateInput
} from '../services/sheetService';
import { ToastContainer, ToastMessage } from './ToastContainer';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatDentureApptDisplay,
  formatNumberByLanguage,
  getApptTypeDisplay,
  getDentureStatusDisplay
} from '../utils/i18n';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';

interface DentureRecallProps {
  cases: DentureCase[];
  setCases: React.Dispatch<React.SetStateAction<DentureCase[]>>;
  sheetConfig: SheetConfig;
  isLoading: boolean;
  loadError: string | null;
  onRefreshCases: () => Promise<void>;
  onOpenSettings: () => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onOpenNewTaskModal?: () => void;
}

type ViewTab = 'all' | 'ready' | 'appt' | 'done';

const APPT_TYPES = [
  'ตรวจฟันปลอม',
  'พิมพ์ปาก',
  'ใส่ฟันปลอม',
  'ปรึกษาฟันปลอม',
  'ติดตามอาการ'
];

function getCaseKey(c: Pick<DentureCase, 'sheet' | 'row' | 'hn'>): string {
  return `${c.sheet}::${c.row}::${c.hn}`;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ยังไม่ได้โทร':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/35';
    case 'สนใจ / นัดหมายตรวจแล้ว':
      return 'bg-sky-500/15 text-sky-200 border-sky-500/35';
    case 'สนใจ / รอตัดสินใจ':
      return 'bg-violet-500/15 text-violet-200 border-violet-500/35';
    case 'ไม่สะดวก / ปฏิเสธ':
      return 'bg-rose-500/15 text-rose-200 border-rose-500/35';
    case 'ติดต่อไม่ได้ / ไม่รับสาย':
      return 'bg-orange-500/15 text-orange-200 border-orange-500/35';
    case 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)':
      return 'bg-cyan-500/15 text-cyan-200 border-cyan-500/35';
    case 'ใส่ฟันปลอมเสร็จเรียบร้อย':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35';
    case 'ถอนเพื่อจัดฟัน':
    case 'เคลียร์ช่องปากทำรากเทียม':
    case 'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน':
    case 'ถอน/ผ่าฟันคุด':
      return 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30';
    case 'ไม่ต้องติดตาม':
      return 'bg-white/10 text-slate-300 border-white/20';
    default:
      return 'bg-white/10 text-slate-200 border-white/20';
  }
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case 'ยังไม่ได้โทร':
      return 'bg-amber-400';
    case 'สนใจ / นัดหมายตรวจแล้ว':
      return 'bg-sky-400';
    case 'สนใจ / รอตัดสินใจ':
      return 'bg-violet-400';
    case 'ไม่สะดวก / ปฏิเสธ':
      return 'bg-rose-400';
    case 'ติดต่อไม่ได้ / ไม่รับสาย':
      return 'bg-orange-400';
    case 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)':
      return 'bg-cyan-400';
    case 'ใส่ฟันปลอมเสร็จเรียบร้อย':
      return 'bg-emerald-400';
    case 'ถอนเพื่อจัดฟัน':
    case 'เคลียร์ช่องปากทำรากเทียม':
    case 'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน':
    case 'ถอน/ผ่าฟันคุด':
      return 'bg-indigo-400';
    default:
      return 'bg-slate-400';
  }
}

function getGroupBadgeClass(group: string): string {
  if (group.includes('เร่งด่วนมาก')) {
    return 'bg-rose-500/15 text-rose-200 border-rose-400/35';
  }
  if (group.includes('ศักยภาพสูง')) {
    return 'bg-violet-500/15 text-violet-200 border-violet-400/35';
  }
  if (group.includes('ศักยภาพปานกลาง')) {
    return 'bg-amber-500/15 text-amber-200 border-amber-400/35';
  }
  return 'bg-white/10 text-slate-300 border-white/20';
}

export const DentureRecall: React.FC<DentureRecallProps> = ({
  cases,
  setCases,
  sheetConfig,
  isLoading,
  loadError,
  onRefreshCases,
  onOpenSettings,
  setActiveTab,
  onOpenNewTaskModal
}) => {
  const { language, t } = useLanguage();
  const { clearWorkspaceSlice } = useWorkspace();
  const isLocalStandby = !sheetConfig.webAppUrl.trim();
  const [confirmClearDenture, setConfirmClearDenture] = useState(false);

  // View & filter states
  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [dentistFilter, setDentistFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');

  // Revealed phone keys (hidden by default)
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  // Selected case & detail editor states
  const [selectedCaseKey, setSelectedCaseKey] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>('ยังไม่ได้โทร');
  const [draftApptDate, setDraftApptDate] = useState<string>('');
  const [draftApptType, setDraftApptType] = useState<string>('ตรวจฟันปลอม');
  const [draftClearAppt, setDraftClearAppt] = useState<boolean>(false);
  const [draftNoteAppend, setDraftNoteAppend] = useState<string>('');

  // Temporary browser-local case & import modals (when Sheet is on standby)
  const [isAddTempOpen, setIsAddTempOpen] = useState<boolean>(false);
  const [editingCase, setEditingCase] = useState<DentureCase | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [tempHn, setTempHn] = useState<string>('');
  const [tempPhone, setTempPhone] = useState<string>('');
  const [tempAge, setTempAge] = useState<string>('60');
  const [tempDentist, setTempDentist] = useState<string>('');
  const [tempHistory, setTempHistory] = useState<string>('');
  const [tempGroup, setTempGroup] = useState<string>('เร่งด่วนมาก (ฟันปลอมทั้งปาก)');

  const [isImportTempOpen, setIsImportTempOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');

  // Quick command bar states (supports TH + EN)
  const [commandText, setCommandText] = useState<string>('');
  const [commandPreview, setCommandPreview] = useState<ParsedCommandResult | null>(null);

  // Optimistic update tracking & retry state
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [failedUpdates, setFailedUpdates] = useState<
    Record<string, { error: string; retry: () => void }>
  >({});

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>, autoDismissMs?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (autoDismissMs && autoDismissMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, autoDismissMs);
      }
      return id;
    },
    [dismissToast]
  );

  const selectedCase = useMemo(() => {
    if (!selectedCaseKey) return null;
    return cases.find((c) => getCaseKey(c) === selectedCaseKey) || null;
  }, [cases, selectedCaseKey]);

  // Sync draft editor whenever a different row is selected
  useEffect(() => {
    if (!selectedCase) return;
    setDraftStatus(selectedCase.status || 'ยังไม่ได้โทร');
    const parsedAppt = parseThaiApptString(selectedCase.appt);
    setDraftApptDate(parsedAppt.isoDate);
    setDraftApptType(parsedAppt.apptType || 'ตรวจฟันปลอม');
    setDraftClearAppt(false);
    setDraftNoteAppend('');
  }, [selectedCaseKey]);

  const togglePhoneReveal = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRevealedPhones((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAttachPhoto = (keyStr: string, evidenceId: string) => {
    setCases((prev) =>
      prev.map((item) =>
        getCaseKey(item) === keyStr ? { ...item, attachmentEvidenceId: evidenceId } : item
      )
    );
  };

  const handleRemovePhoto = (keyStr: string) => {
    setCases((prev) =>
      prev.map((item) =>
        getCaseKey(item) === keyStr ? { ...item, attachmentEvidenceId: undefined } : item
      )
    );
  };

  const handleDeleteLocalCase = (keyStr: string) => {
    if (confirmDeleteKey !== keyStr) {
      setConfirmDeleteKey(keyStr);
      return;
    }
    setConfirmDeleteKey(null);
    setCases((prev) => prev.filter((item) => getCaseKey(item) !== keyStr));
    if (selectedCaseKey === keyStr) setSelectedCaseKey(null);
  };

  const handleSaveEditCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    const origKey = getCaseKey(editingCase);
    setCases((prev) =>
      prev.map((item) => (getCaseKey(item) === origKey ? { ...editingCase } : item))
    );
    setEditingCase(null);
  };

  // Dynamic filter options
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => set.add(extractMonthLabel(c)));
    return Array.from(set);
  }, [cases]);

  const dentistOptions = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      if (c.dentist && c.dentist.trim()) set.add(c.dentist.trim());
    });
    return Array.from(set);
  }, [cases]);

  // Summary card metrics
  const summaryStats = useMemo(() => {
    const total = cases.length;
    const dentureTargets = cases.filter(
      (c) =>
        ![
          'ถอนเพื่อจัดฟัน',
          'เคลียร์ช่องปากทำรากเทียม',
          'เคลียร์ช่องปากทำครอบฟัน/สะพานฟัน',
          'ถอน/ผ่าฟันคุด',
          'ไม่ต้องติดตาม'
        ].includes(c.status)
    ).length;
    const pendingCall = cases.filter((c) => c.status === 'ยังไม่ได้โทร').length;
    const hasAppt = cases.filter(
      (c) => Boolean(c.appt && c.appt.trim()) || c.status === 'สนใจ / นัดหมายตรวจแล้ว'
    ).length;
    const completedOrImpression = cases.filter(
      (c) =>
        c.status === 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)' ||
        c.status === 'ใส่ฟันปลอมเสร็จเรียบร้อย'
    ).length;

    return {
      total,
      dentureTargets,
      pendingCall,
      hasAppt,
      completedOrImpression
    };
  }, [cases]);

  const readyCount = useMemo(() => cases.filter(isReadyToCallCase).length, [cases]);

  const filteredCases = useMemo(() => {
    const q = localSearch.trim().toLowerCase();

    let list = cases.filter((c) => {
      if (viewTab === 'ready' && !isReadyToCallCase(c)) return false;
      if (
        viewTab === 'appt' &&
        !(Boolean(c.appt && c.appt.trim()) || c.status === 'สนใจ / นัดหมายตรวจแล้ว')
      ) {
        return false;
      }
      if (
        viewTab === 'done' &&
        !(
          c.status === 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)' ||
          c.status === 'ใส่ฟันปลอมเสร็จเรียบร้อย'
        )
      ) {
        return false;
      }

      if (monthFilter !== 'ALL' && extractMonthLabel(c) !== monthFilter) {
        return false;
      }
      if (dentistFilter !== 'ALL' && c.dentist.trim() !== dentistFilter) {
        return false;
      }

      if (q) {
        const matchPatient = matchesPatientQuery(c, q);
        const qDigits = q.replace(/\D/g, '');
        const matchPhone =
          qDigits.length > 0 && c.phone.replace(/\D/g, '').includes(qDigits);
        const matchHistory = c.history.toLowerCase().includes(q);
        if (!matchPatient && !matchPhone && !matchHistory) return false;
      }

      return true;
    });

    if (viewTab === 'ready') {
      list = [...list].sort((a, b) => getUrgencyRank(a.group) - getUrgencyRank(b.group));
    }

    return list;
  }, [cases, viewTab, monthFilter, dentistFilter, localSearch]);

  /**
   * Optimistic Update + Snapshot Rollback + Retry + Toast.
   * Always sends canonical Thai status and Thai BE appointment format to Google Sheet.
   */
  const executeOptimisticUpdate = useCallback(
    async (
      targetCase: DentureCase,
      changes: {
        status?: string;
        appt?: string;
        noteAppend?: string;
      }
    ) => {
      const keyStr = getCaseKey(targetCase);
      const previousSnapshot: DentureCase = { ...targetCase };

      const optimisticStatus =
        changes.status !== undefined ? changes.status : previousSnapshot.status;
      const optimisticAppt =
        changes.appt !== undefined ? changes.appt : previousSnapshot.appt;
      const optimisticNote = changes.noteAppend
        ? appendThaiNote(previousSnapshot.note, changes.noteAppend)
        : previousSnapshot.note;

      const optimisticRow: DentureCase = {
        ...previousSnapshot,
        status: optimisticStatus,
        appt: optimisticAppt,
        note: optimisticNote
      };

      setCases((prev) =>
        prev.map((item) => (getCaseKey(item) === keyStr ? optimisticRow : item))
      );
      setSavingKeys((prev) => ({ ...prev, [keyStr]: true }));
      setFailedUpdates((prev) => {
        const next = { ...prev };
        delete next[keyStr];
        return next;
      });

      const payload: DentureUpdateInput = {
        sheet: previousSnapshot.sheet,
        row: previousSnapshot.row,
        key: {
          name: previousSnapshot.name,
          hn: previousSnapshot.hn,
          extractDate: previousSnapshot.extractDate
        },
        ...(changes.status !== undefined ? { status: changes.status } : {}),
        ...(changes.appt !== undefined ? { appt: changes.appt } : {}),
        ...(changes.noteAppend ? { noteAppend: changes.noteAppend } : {}),
        by: sheetConfig.operatorName || t('dentureDetailDefaultOperator')
      };

      const res = await updateDentureCase(payload, sheetConfig);

      setSavingKeys((prev) => {
        const next = { ...prev };
        delete next[keyStr];
        return next;
      });

      if (res.ok) {
        const confirmedRow: DentureCase = {
          ...optimisticRow,
          status: res.status !== undefined ? res.status : optimisticRow.status,
          appt: res.appt !== undefined ? res.appt : optimisticRow.appt,
          note: res.note !== undefined ? res.note : optimisticRow.note
        };

        setCases((prev) =>
          prev.map((item) => (getCaseKey(item) === keyStr ? confirmedRow : item))
        );

        if (selectedCaseKey === keyStr) {
          setDraftStatus(confirmedRow.status || 'ยังไม่ได้โทร');
          const parsedAppt = parseThaiApptString(confirmedRow.appt);
          setDraftApptDate(parsedAppt.isoDate);
          setDraftApptType(parsedAppt.apptType || 'ตรวจฟันปลอม');
          setDraftClearAppt(false);
          setDraftNoteAppend('');
        }

        const displayStatus = getDentureStatusDisplay(confirmedRow.status, language);
        const displayAppt = confirmedRow.appt
          ? formatDentureApptDisplay(confirmedRow.appt, language)
          : '';

        addToast(
          {
            type: 'success',
            title: t('dentureSaveSuccessTitle').replace('{name}', previousSnapshot.name),
            description: `${t('dentureSaveSuccessStatusPrefix')}: ${displayStatus}${
              displayAppt ? ` • ${t('dentureSaveSuccessApptPrefix')}: ${displayAppt}` : ''
            }`
          },
          4500
        );
      } else {
        setCases((prev) =>
          prev.map((item) => (getCaseKey(item) === keyStr ? previousSnapshot : item))
        );

        const retryFn = () => {
          void executeOptimisticUpdate(previousSnapshot, changes);
        };

        const errorMsg = res.error || t('dentureSheetWriteErrorDefault');
        setFailedUpdates((prev) => ({
          ...prev,
          [keyStr]: { error: errorMsg, retry: retryFn }
        }));

        addToast({
          type: 'error',
          title: t('dentureSaveFailTitle').replace('{name}', previousSnapshot.name),
          description: errorMsg,
          retryLabel: t('dentureRetryBtn'),
          onRetry: retryFn
        });
      }
    },
    [sheetConfig, setCases, addToast, selectedCaseKey, language, t]
  );

  const handleAddTempCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim() || !tempHn.trim()) return;
    const todayIso = new Date().toISOString().split('T')[0];
    const nowMonthLabel = extractMonthLabel({
      sheet: 'Local',
      extractDate: todayIso
    } as DentureCase);
    const nextRow: DentureCase = {
      sheet: nowMonthLabel || 'Local',
      row: cases.length + 2,
      no: cases.length + 1,
      extractDate: todayIso,
      dentist: tempDentist.trim() || '-',
      hn: tempHn.trim().toUpperCase(),
      name: tempName.trim(),
      phone: tempPhone.trim() || '-',
      age: parseInt(tempAge, 10) || 60,
      history: tempHistory.trim() || '-',
      group: tempGroup,
      status: 'ยังไม่ได้โทร',
      appt: '',
      note: ''
    };
    const updated = [nextRow, ...cases];
    setCases(updated);
    setSelectedCaseKey(getCaseKey(nextRow));
    setTempName('');
    setTempHn('');
    setTempPhone('');
    setTempAge('60');
    setTempDentist('');
    setTempHistory('');
    setIsAddTempOpen(false);
    addToast(
      {
        type: 'success',
        title: nextRow.name,
        description: t('dentureTempAddedSuccess')
      },
      3500
    );
  };

  const handleImportTempBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const todayIso = new Date().toISOString().split('T')[0];
    const imported: DentureCase[] = [];
    lines.forEach((line, idx) => {
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());
      if (!parts[0]) return;
      imported.push({
        sheet: 'Local',
        row: cases.length + idx + 2,
        no: cases.length + idx + 1,
        extractDate: parts[3] || todayIso,
        dentist: parts[4] || '-',
        hn: (parts[1] || `HN-${cases.length + idx + 1}`).toUpperCase(),
        name: parts[0],
        phone: parts[2] || '-',
        age: 60,
        history: parts[5] || '-',
        group: 'ศักยภาพสูง (รอใส่ฟันปลอม)',
        status: 'ยังไม่ได้โทร',
        appt: '',
        note: ''
      });
    });

    if (imported.length === 0) return;
    const updated = [...imported, ...cases];
    setCases(updated);
    setImportText('');
    setIsImportTempOpen(false);
    addToast(
      {
        type: 'success',
        title: t('dentureTempImportTitle'),
        description: `${t('dentureTempAddedSuccess')} (${formatNumberByLanguage(imported.length, language)})`
      },
      3500
    );
  };

  const handleSaveDetailPanel = async () => {
    if (!selectedCase) return;

    // Always format canonical Thai BE appointment for Google Sheet
    const computedAppt = draftClearAppt
      ? ''
      : draftApptDate
      ? formatThaiApptString(draftApptDate, draftApptType)
      : selectedCase.appt;

    const changes: { status?: string; appt?: string; noteAppend?: string } = {};

    if (draftStatus !== selectedCase.status) {
      changes.status = draftStatus;
    }
    if (computedAppt !== selectedCase.appt) {
      changes.appt = computedAppt;
    }
    if (draftNoteAppend.trim()) {
      // Save verbatim as typed by user without auto-translation
      changes.noteAppend = draftNoteAppend.trim();
    }

    if (
      changes.status === undefined &&
      changes.appt === undefined &&
      changes.noteAppend === undefined
    ) {
      addToast(
        {
          type: 'info',
          title: t('dentureNoChangesTitle'),
          description: t('dentureNoChangesDesc')
        },
        3000
      );
      return;
    }

    await executeOptimisticUpdate(selectedCase, changes);
  };

  const handleParseCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseThaiQuickCommand(commandText, cases, language);
    setCommandPreview(parsed);
  };

  const handleConfirmCommand = async () => {
    if (!commandPreview || !commandPreview.ok || !commandPreview.targetCase) return;

    const target = commandPreview.targetCase;
    const changes = {
      ...(commandPreview.status ? { status: commandPreview.status } : {}),
      ...(commandPreview.appt ? { appt: commandPreview.appt } : {}),
      ...(commandPreview.noteAppend ? { noteAppend: commandPreview.noteAppend } : {})
    };

    setCommandPreview(null);
    setCommandText('');
    setSelectedCaseKey(getCaseKey(target));
    await executeOptimisticUpdate(target, changes);
  };

  const computedPreviewSheetAppt = useMemo(() => {
    if (draftClearAppt) return t('dentureClearedLabel');
    if (!draftApptDate) return selectedCase?.appt || '-';
    return formatThaiApptString(draftApptDate, draftApptType);
  }, [draftClearAppt, draftApptDate, draftApptType, selectedCase, t]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedCase) return false;
    const nextAppt = draftClearAppt
      ? ''
      : draftApptDate
      ? formatThaiApptString(draftApptDate, draftApptType)
      : selectedCase.appt;
    return (
      draftStatus !== selectedCase.status ||
      nextAppt !== selectedCase.appt ||
      draftNoteAppend.trim().length > 0
    );
  }, [selectedCase, draftStatus, draftApptDate, draftApptType, draftClearAppt, draftNoteAppend]);

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'denture-targets',
      label: t('dentureCardTargets'),
      value: summaryStats.dentureTargets,
      subLabel: `${t('dentureCardTotal')}: ${formatNumberByLanguage(summaryStats.total, language)}`,
      tone: 'purple',
      icon: Users,
      active: viewTab === 'all',
      onClick: () => setViewTab('all')
    },
    {
      id: 'denture-pending',
      label: t('dentureCardPendingCall'),
      value: summaryStats.pendingCall,
      subLabel: t('dentureCardPendingCallSub'),
      tone: 'amber',
      icon: PhoneCall,
      active: viewTab === 'ready',
      onClick: () => setViewTab(viewTab === 'ready' ? 'all' : 'ready')
    },
    {
      id: 'denture-appt',
      label: t('dentureCardHasAppt'),
      value: summaryStats.hasAppt,
      subLabel: t('dentureCardHasApptSub'),
      tone: 'cyan',
      icon: Calendar,
      active: viewTab === 'appt',
      onClick: () => setViewTab(viewTab === 'appt' ? 'all' : 'appt')
    },
    {
      id: 'denture-done',
      label: t('dentureCardDone'),
      value: summaryStats.completedOrImpression,
      subLabel: t('dentureCardDoneSub'),
      tone: 'rose',
      icon: CheckSquare,
      active: viewTab === 'done',
      onClick: () => setViewTab(viewTab === 'done' ? 'all' : 'done')
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1440px] mx-auto pb-24 lg:pb-8">
      {/* Compact Connection & Action Strip */}
      <div className="crystal-tile rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {isLocalStandby ? (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-violet-500/15 text-violet-200 border border-violet-500/35 shrink-0">
              {t('dentureBadgeLocal')}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shrink-0">
              {t('dentureBadgeConnected')}
            </span>
          )}
          <span className="text-xs text-slate-300 truncate">{t('dentureSubtitle')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddTempOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-violet-600/25 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('dentureAddTempBtn').replace(/^\+\s*/, '')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportTempOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl crystal-tile text-slate-100 text-xs font-medium transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('dentureImportTempBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => void onRefreshCases()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl crystal-tile text-slate-100 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
            <span>{isLoading ? t('dentureLoadingBtn') : t('dentureRefreshBtn')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>{t('dentureSettingsBtn')}</span>
          </button>

          {cases.length > 0 && (
            confirmClearDenture ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void clearWorkspaceSlice('dentureCases');
                    setConfirmClearDenture(false);
                    setSelectedCaseKey(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('confirmClearAllBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearDenture(false)}
                  className="crystal-tile px-3 py-1.5 rounded-xl text-slate-200 hover:text-white text-xs cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearDenture(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl crystal-tile text-rose-200 hover:bg-rose-500/20 border-rose-400/30 text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('clearAllBtn')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-500/12 backdrop-blur-[2px] border border-rose-400/45 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-rose-100">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {t('dentureLoadFailedPrefix')}: {loadError}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onRefreshCases()}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shrink-0 cursor-pointer"
          >
            {t('dentureRetryBtn')}
          </button>
        </div>
      )}

      {/* Row 1: 4 Standardized Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Standardized Trend Line + Doughnut + Recent Cases */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('dentureCardTargets')}
        trendSeriesPrimaryData={[
          0,
          0,
          0,
          Math.floor(summaryStats.dentureTargets / 3),
          Math.floor(summaryStats.dentureTargets / 2),
          summaryStats.dentureTargets,
          summaryStats.total
        ]}
        trendSeriesSecondaryLabel={t('dentureCardHasAppt')}
        trendSeriesSecondaryData={[0, 0, 0, 0, summaryStats.hasAppt, summaryStats.hasAppt + summaryStats.completedOrImpression, summaryStats.completedOrImpression]}
        ratioSlices={[
          {
            label: t('dentureCardPendingCall'),
            count: summaryStats.pendingCall,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          },
          {
            label: t('dentureCardHasAppt'),
            count: summaryStats.hasAppt,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          },
          {
            label: t('dentureCardDone'),
            count: summaryStats.completedOrImpression,
            dotClass: 'bg-emerald-400',
            colorHex: '#2dd4bf'
          },
          {
            label: t('dentureCardTargets'),
            count: Math.max(
              0,
              summaryStats.dentureTargets -
                summaryStats.pendingCall -
                summaryStats.hasAppt -
                summaryStats.completedOrImpression
            ),
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          }
        ]}
        activities={cases.slice(0, 5).map((c) => ({
          id: getCaseKey(c),
          title: `${c.name} (${c.hn})`,
          meta: `${c.group} · ${getDentureStatusDisplay(c.status, language)}`,
          dotClass: getStatusDotClass(c.status)
        }))}
      />

      {/* Bilingual Rule-Based Quick Command Bar */}
      <div className="neon-glass rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <form onSubmit={handleParseCommand} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-300" />
            <input
              type="text"
              value={commandText}
              onChange={(e) => {
                setCommandText(e.target.value);
                if (!e.target.value.trim()) setCommandPreview(null);
              }}
              placeholder={t('dentureCmdPlaceholder')}
              className="glass-input w-full rounded-xl pl-10 pr-4 py-2.5 text-xs placeholder:text-slate-400/75"
            />
          </div>
          <button
            type="submit"
            disabled={!commandText.trim()}
            className="crystal-btn px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
          >
            {t('dentureCmdCheckBtn')}
          </button>
        </form>

        {commandPreview && (
          <div
            className={`glass-subcard rounded-xl border p-4 text-xs space-y-3 ${
              commandPreview.ok ? 'border-violet-400/40' : 'border-rose-400/40'
            }`}
          >
            {!commandPreview.ok ? (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-rose-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
                  <div>
                    <p className="font-semibold">{t('dentureCmdCannotProceed')}</p>
                    <p className="text-rose-100/90 mt-0.5">{commandPreview.error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCommandPreview(null)}
                  className="crystal-tile text-slate-200 hover:text-white px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-violet-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-violet-300" />
                    {t('dentureCmdPreviewTitle')}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {commandPreview.targetCase?.name} • {commandPreview.targetCase?.hn}
                  </span>
                </div>

                <div className="glass-subcard grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {t('dentureCmdNewStatus')}
                    </span>
                    <span className="font-semibold text-slate-100 block">
                      {commandPreview.status
                        ? getDentureStatusDisplay(commandPreview.status, language)
                        : t('dentureCmdUnchanged')}
                    </span>
                    {commandPreview.status && (
                      <span className="text-[10px] text-violet-300 font-mono">
                        {t('dentureCmdSheetPrefix')}: {commandPreview.status}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {t('dentureCmdApptWrite')}
                    </span>
                    <span className="font-semibold text-blue-200 block">
                      {commandPreview.appt
                        ? formatDentureApptDisplay(commandPreview.appt, language)
                        : t('dentureCmdUnchanged')}
                    </span>
                    {commandPreview.appt && (
                      <span className="text-[10px] text-blue-300/80 font-mono">
                        {t('dentureCmdSheetPrefix')}: {commandPreview.appt}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {t('dentureCmdNoteAppend')}
                    </span>
                    <span className="font-semibold text-emerald-300">
                      {commandPreview.noteAppend
                        ? `${formatThaiNotePrefix()} ${commandPreview.noteAppend}`
                        : t('dentureCmdNoNote')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCommandPreview(null)}
                    className="crystal-tile px-3.5 py-1.5 rounded-xl text-slate-200 hover:text-white font-medium cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmCommand()}
                    className="crystal-btn flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('dentureCmdConfirmBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={`${selectedCase ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          {/* View Tabs + Filters */}
          <div className="crystal-tile rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="glass-subcard flex flex-wrap gap-1.5 p-1 rounded-xl">
                {(
                  [
                    {
                      id: 'all',
                      label: `${t('dentureTabAll')} (${formatNumberByLanguage(cases.length, language)})`
                    },
                    {
                      id: 'ready',
                      label: `${t('dentureTabReady')} (${formatNumberByLanguage(readyCount, language)})`
                    },
                    {
                      id: 'appt',
                      label: `${t('dentureTabAppt')} (${formatNumberByLanguage(summaryStats.hasAppt, language)})`
                    },
                    {
                      id: 'done',
                      label: `${t('dentureTabDone')} (${formatNumberByLanguage(summaryStats.completedOrImpression, language)})`
                    }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      viewTab === tab.id
                        ? 'bg-violet-600/90 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {viewTab === 'ready' && (
                <span className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-lg">
                  {t('dentureUrgencyOrderNote')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {t('dentureFilterMonth')}
                </label>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="glass-input w-full text-xs rounded-xl px-3 py-2"
                >
                  <option value="ALL">{t('dentureFilterAllOption')}</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {t('dentureFilterDentist')}
                </label>
                <select
                  value={dentistFilter}
                  onChange={(e) => setDentistFilter(e.target.value)}
                  className="glass-input w-full text-xs rounded-xl px-3 py-2"
                >
                  <option value="ALL">{t('dentureFilterAllOption')}</option>
                  {dentistOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {t('dentureSearchLabel')}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    type="text"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder={t('dentureSearchPlaceholder')}
                    className="glass-input w-full text-xs rounded-xl pl-8 pr-3 py-2 placeholder:text-slate-400/70"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cases Table with Photo Attachment, Edit & Delete */}
          <div className="neon-glass rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-3">{t('zoneColPhoto')}</th>
                    <th className="py-3.5 px-4">{t('dentureColPatient')}</th>
                    <th className="py-3.5 px-3">{t('dentureColPhone')}</th>
                    <th className="py-3.5 px-3">{t('dentureColGroupDate')}</th>
                    <th className="py-3.5 px-3">{t('dentureColStatus')}</th>
                    <th className="py-3.5 px-3 hidden sm:table-cell">{t('dentureColAppt')}</th>
                    <th className="py-3.5 px-4 text-right">{t('dentureColActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 px-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-100">
                          {t('dentureNoCasesFound')}
                        </p>
                        <p className="text-[11px] text-slate-300/80 max-w-md mx-auto">
                          {t('awaitingSheetSyncHint')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddTempOpen(true)}
                            className="crystal-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('dentureAddTempBtn').replace(/^\+\s*/, '')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsImportTempOpen(true)}
                            className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-100 text-xs font-medium cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-cyan-300" />
                            <span>{t('dentureImportTempBtn')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={onOpenSettings}
                            className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-violet-200 text-xs font-medium cursor-pointer"
                          >
                            <SettingsIcon className="w-3.5 h-3.5" />
                            <span>{t('dentureSettingsBtn')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((item) => {
                      const keyStr = getCaseKey(item);
                      const isSelected = selectedCaseKey === keyStr;
                      const isPhoneRevealed = Boolean(revealedPhones[keyStr]);
                      const isSaving = Boolean(savingKeys[keyStr]);
                      const failedInfo = failedUpdates[keyStr];
                      const isConfirmDel = confirmDeleteKey === keyStr;

                      return (
                        <tr
                          key={keyStr}
                          onClick={() => setSelectedCaseKey(keyStr)}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? 'bg-violet-500/20' : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          <td className="py-3 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
                            <AttachmentCell
                              evidenceId={item.attachmentEvidenceId}
                              itemTitle={`${item.name} (${item.hn})`}
                              contextLabel={t('dentureTitle')}
                              relatedPatientId={item.hn}
                              onAttached={(evId) => handleAttachPhoto(keyStr, evId)}
                              onRemoved={() => handleRemovePhoto(keyStr)}
                            />
                          </td>
                          {/* Patient + HN + Dentist */}
                          <td className="py-4 px-4 align-middle">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-semibold text-slate-100 text-xs sm:text-[13px]">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-slate-300 shrink-0">
                                ({item.age} {t('dentureAgeUnit')})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-300/80">
                              <span className="crystal-tile font-mono text-violet-200 px-1.5 py-0.5 rounded text-[10px]">
                                {item.hn}
                              </span>
                              <span>•</span>
                              <span className="truncate max-w-[140px]">{item.dentist}</span>
                            </div>
                          </td>

                          {/* Phone with clean inline icon toggle */}
                          <td
                            className="py-4 px-3 whitespace-nowrap align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="glass-subcard inline-flex items-center gap-1.5 rounded-lg px-2 py-1">
                              <span className="font-mono text-[11px] text-slate-100">
                                {isPhoneRevealed ? item.phone : maskPhoneNumber(item.phone)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => togglePhoneReveal(keyStr, e)}
                                title={isPhoneRevealed ? t('dentureHidePhone') : t('dentureShowPhone')}
                                className="p-0.5 rounded text-violet-300 hover:text-white cursor-pointer"
                              >
                                {isPhoneRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Urgency Group + Short Extract Date */}
                          <td className="py-4 px-3 align-middle">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium border ${getGroupBadgeClass(
                                item.group
                              )}`}
                            >
                              {item.group}
                            </span>
                            <p className="text-[11px] text-slate-300/80 mt-1 whitespace-nowrap">
                              {formatDateByLanguage(item.extractDate, language)}
                            </p>
                          </td>

                          {/* Color-Coded Status Pill with Leading Dot */}
                          <td className="py-4 px-3 align-middle">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusBadgeClass(
                                  item.status
                                )}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(
                                    item.status
                                  )}`}
                                />
                                <span>{getDentureStatusDisplay(item.status, language)}</span>
                              </span>
                              {isSaving && (
                                <div className="flex items-center gap-1 text-[10px] text-violet-300">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>{t('dentureSavingRow')}</span>
                                </div>
                              )}
                              {failedInfo && (
                                <div
                                  className="flex items-center gap-1.5 pt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[10px] text-rose-300">
                                    {t('dentureSaveFailedShort')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={failedInfo.retry}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    <span>{t('dentureRetryBtn')}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Appointment */}
                          <td className="py-4 px-3 align-middle hidden sm:table-cell">
                            {item.appt ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-400/35 text-[11px] text-sky-200 whitespace-nowrap">
                                <Calendar className="w-3 h-3 text-sky-300 shrink-0" />
                                <span>{formatDentureApptDisplay(item.appt, language)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Edit, Delete & Manage Action Buttons */}
                          <td className="py-4 px-4 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingCase({ ...item })}
                                className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                                title={t('editBtn')}
                                aria-label={t('editBtn')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLocalCase(keyStr)}
                                className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                  isConfirmDel
                                    ? 'bg-rose-600 text-white border-rose-400'
                                    : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                                }`}
                                title={isConfirmDel ? t('confirmDeleteBtn') : t('deleteBtn')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {isConfirmDel && <span>{t('confirmDeleteBtn')}</span>}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCaseKey(keyStr)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'crystal-tile text-violet-200'
                                }`}
                              >
                                <span>{t('dentureManageRowBtn')}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Detail Panel (Desktop) / Bottom Sheet (iPad & Mobile) */}
        {selectedCase && (
          <>
            <div
              onClick={() => setSelectedCaseKey(null)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-40 lg:hidden"
            />

            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl glass-modal border-t border-x border-violet-400/40 shadow-2xl p-5 space-y-5 lg:static lg:col-span-5 lg:rounded-2xl lg:max-h-[calc(100vh-10rem)] lg:sticky lg:top-4">
              <div className="w-12 h-1.5 rounded-full bg-white/30 mx-auto lg:hidden" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/15">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">{selectedCase.name}</h3>
                    <span className="crystal-tile px-2 py-0.5 rounded text-violet-200 font-mono text-[11px]">
                      {selectedCase.hn}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300/80 mt-1">
                    {t('dentureDetailSheetPrefix')} {selectedCase.sheet} •{' '}
                    {t('dentureDetailRowPrefix')} {selectedCase.row} •{' '}
                    {t('dentureDetailAgePrefix')} {selectedCase.age} {t('dentureAgeUnit')} •{' '}
                    {selectedCase.dentist}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaseKey(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                  aria-label={t('close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Failed Write Banner with Retry */}
              {failedUpdates[getCaseKey(selectedCase)] && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-400/45 p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 text-rose-100">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{t('dentureDetailFailedBannerTitle')}</p>
                      <p className="text-[11px] text-rose-200/90">
                        {failedUpdates[getCaseKey(selectedCase)].error}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={failedUpdates[getCaseKey(selectedCase)].retry}
                    className="crystal-btn flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('dentureRetryBtn')}</span>
                  </button>
                </div>
              )}

              {/* Photo Attachment Banner */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">{t('zoneColPhoto')}</label>
                <AttachmentCell
                  variant="banner"
                  evidenceId={selectedCase.attachmentEvidenceId}
                  itemTitle={`${selectedCase.name} (${selectedCase.hn})`}
                  contextLabel={t('dentureTitle')}
                  relatedPatientId={selectedCase.hn}
                  onAttached={(evId) => handleAttachPhoto(getCaseKey(selectedCase), evId)}
                  onRemoved={() => handleRemovePhoto(getCaseKey(selectedCase))}
                />
              </div>

              {/* Patient Info & Masked Phone */}
              <div className="glass-subcard rounded-xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Phone className="w-3.5 h-3.5 text-violet-300" />
                    <span className="font-mono font-semibold">
                      {revealedPhones[getCaseKey(selectedCase)]
                        ? selectedCase.phone
                        : maskPhoneNumber(selectedCase.phone)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePhoneReveal(getCaseKey(selectedCase))}
                    className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-violet-200 cursor-pointer"
                  >
                    {revealedPhones[getCaseKey(selectedCase)] ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>{t('dentureHidePhone')}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>{t('dentureShowPhone')}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300/80">
                      {t('dentureDetailExtractDateLabel')}:{' '}
                      {formatDateByLanguage(selectedCase.extractDate, language)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] ${getGroupBadgeClass(
                        selectedCase.group
                      )}`}
                    >
                      {selectedCase.group}
                    </span>
                  </div>
                  <p className="text-slate-100 leading-relaxed pt-1">
                    <span className="text-slate-300/80">{t('dentureDetailHistoryLabel')}: </span>
                    {selectedCase.history}
                  </p>
                </div>
              </div>

              {/* 12 Status Buttons Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-100">
                    {t('dentureDetailStatusHeading')}
                  </label>
                  {draftStatus !== selectedCase.status && (
                    <span className="text-[10px] text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/35 shrink-0">
                      {t('dentureDetailStatusChangedBadge')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {DENTURE_STATUSES.map((statusOption: DentureStatus) => {
                    const isDraftActive = draftStatus === statusOption;
                    const isCurrentSaved = selectedCase.status === statusOption;
                    return (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => setDraftStatus(statusOption)}
                        className={`text-left px-3 py-2 rounded-xl text-[11px] font-medium border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isDraftActive
                            ? 'bg-violet-500/30 border-violet-400 text-violet-100 shadow-sm'
                            : 'glass-subcard text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="truncate">
                          {getDentureStatusDisplay(statusOption, language)}
                        </span>
                        {isCurrentSaved && (
                          <span className="crystal-tile text-[9px] px-1.5 py-0.5 rounded text-slate-300 shrink-0">
                            {t('dentureDetailCurrentBadge')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Appointment Date + Type */}
              <div className="glass-subcard space-y-2 rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{t('dentureDetailApptHeading')}</span>
                  </label>
                  {(draftApptDate || selectedCase.appt) && !draftClearAppt && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftApptDate('');
                        setDraftClearAppt(true);
                      }}
                      className="text-[10px] text-rose-300 hover:text-rose-200 cursor-pointer"
                    >
                      {t('dentureDetailClearAppt')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">
                      {t('dentureDetailApptDateLabel')}
                    </label>
                    <input
                      type="date"
                      value={draftApptDate}
                      onChange={(e) => {
                        setDraftApptDate(e.target.value);
                        setDraftClearAppt(false);
                      }}
                      className="glass-input w-full rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">
                      {t('dentureDetailApptTypeLabel')}
                    </label>
                    <select
                      value={APPT_TYPES.includes(draftApptType) ? draftApptType : 'CUSTOM'}
                      onChange={(e) => {
                        setDraftApptType(e.target.value === 'CUSTOM' ? '' : e.target.value);
                        setDraftClearAppt(false);
                      }}
                      className="glass-input w-full rounded-xl px-3 py-2 text-xs"
                    >
                      {APPT_TYPES.map((tp) => (
                        <option key={tp} value={tp}>
                          {getApptTypeDisplay(tp, language)}
                        </option>
                      ))}
                      <option value="CUSTOM">{t('dentureDetailApptCustomOption')}</option>
                    </select>
                  </div>
                </div>

                {!APPT_TYPES.includes(draftApptType) && (
                  <input
                    type="text"
                    value={draftApptType}
                    onChange={(e) => {
                      setDraftApptType(e.target.value);
                      setDraftClearAppt(false);
                    }}
                    placeholder={t('dentureDetailApptCustomPlaceholder')}
                    className="glass-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                )}

                <p className="text-[11px] text-cyan-200/90">
                  {t('dentureDetailSheetFormatLabel')}:{' '}
                  <span className="font-mono font-semibold">{computedPreviewSheetAppt}</span>
                </p>
              </div>

              {/* Append Note + Existing Note History */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{t('dentureDetailNoteHeading')}</span>
                </label>

                <textarea
                  rows={2}
                  value={draftNoteAppend}
                  onChange={(e) => setDraftNoteAppend(e.target.value)}
                  placeholder={t('dentureDetailNotePlaceholder').replace(
                    '{prefix}',
                    formatThaiNotePrefix()
                  )}
                  className="glass-input w-full rounded-xl p-3 text-xs placeholder:text-slate-400/70"
                />

                {draftNoteAppend.trim() && (
                  <p className="text-[11px] text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 px-3 py-1.5 rounded-lg">
                    {t('dentureDetailNotePreviewPrefix')} {formatThaiNotePrefix()}{' '}
                    {draftNoteAppend.trim()}
                  </p>
                )}

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-300 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {t('dentureDetailExistingNoteLabel')}
                  </span>
                  <div className="glass-subcard rounded-xl p-3 text-[11px] text-slate-200 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
                    {selectedCase.note && selectedCase.note.trim()
                      ? selectedCase.note
                      : t('dentureDetailNoPrevNote')}
                  </div>
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">
                  {t('dentureDetailOperatorLabel')}:{' '}
                  <strong className="text-slate-100">
                    {sheetConfig.operatorName || t('dentureDetailDefaultOperator')}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => void handleSaveDetailPanel()}
                  disabled={Boolean(savingKeys[getCaseKey(selectedCase)]) || !hasUnsavedChanges}
                  className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-45 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {savingKeys[getCaseKey(selectedCase)] ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('dentureDetailSavingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{t('dentureDetailSaveBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={onOpenNewTaskModal ? t('quickBarNewTask') : t('dentureAddTempBtn')}
        onPrimaryAction={onOpenNewTaskModal || (() => setIsAddTempOpen(true))}
      />

      {/* Add Temporary Browser Case Modal */}
      {isAddTempOpen &&
        createPortal(
          <div
            onClick={() => setIsAddTempOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[70] flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAddTempCase}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <h3 className="text-sm font-bold text-slate-100">{t('dentureTempModalTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setIsAddTempOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempPatientNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder={t('dentureTempPatientNamePlaceholder')}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempHnLabel')}</label>
                  <input
                    type="text"
                    required
                    value={tempHn}
                    onChange={(e) => setTempHn(e.target.value)}
                    placeholder={t('dentureTempHnPlaceholder')}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempPhoneLabel')}</label>
                  <input
                    type="text"
                    value={tempPhone}
                    onChange={(e) => setTempPhone(e.target.value)}
                    placeholder={t('dentureTempPhonePlaceholder')}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempAgeLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={tempAge}
                    onChange={(e) => setTempAge(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempDentistLabel')}</label>
                  <input
                    type="text"
                    value={tempDentist}
                    onChange={(e) => setTempDentist(e.target.value)}
                    placeholder={t('dentureTempDentistPlaceholder')}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempGroupLabel')}</label>
                  <select
                    value={tempGroup}
                    onChange={(e) => setTempGroup(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    <option value="เร่งด่วนมาก (ฟันปลอมทั้งปาก)">เร่งด่วนมาก</option>
                    <option value="ศักยภาพสูง (รอใส่ฟันปลอม)">ศักยภาพสูง</option>
                    <option value="ศักยภาพปานกลาง">ศักยภาพปานกลาง</option>
                    <option value="ติดตามทั่วไป">ติดตามทั่วไป</option>
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('dentureTempHistoryLabel')}</label>
                  <textarea
                    rows={2}
                    value={tempHistory}
                    onChange={(e) => setTempHistory(e.target.value)}
                    placeholder={t('dentureTempHistoryPlaceholder')}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTempOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
                >
                  {t('dentureTempSaveBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Import Temporary CSV/Text Modal */}
      {isImportTempOpen &&
        createPortal(
          <div
            onClick={() => setIsImportTempOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[70] flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleImportTempBatch}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <h3 className="text-sm font-bold text-slate-100">{t('dentureTempImportTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setIsImportTempOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={6}
                required
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={t('dentureTempImportPlaceholder')}
                className="glass-input w-full rounded-xl p-3 text-xs font-mono"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsImportTempOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                >
                  {t('dentureTempImportConfirmBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Local Edit Case Modal (Browser Storage Only, Source Sheet Read-Only) */}
      {editingCase &&
        createPortal(
          <div
            onClick={() => setEditingCase(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[75] flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditCase}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingCase.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingCase(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dentureTempPatientNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={editingCase.name}
                    onChange={(e) => setEditingCase({ ...editingCase, name: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dentureTempHnLabel')}</label>
                  <input
                    type="text"
                    required
                    value={editingCase.hn}
                    onChange={(e) => setEditingCase({ ...editingCase, hn: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dentureTempPhoneLabel')}</label>
                  <input
                    type="text"
                    value={editingCase.phone}
                    onChange={(e) => setEditingCase({ ...editingCase, phone: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dentureTempDentistLabel')}</label>
                  <input
                    type="text"
                    value={editingCase.dentist}
                    onChange={(e) => setEditingCase({ ...editingCase, dentist: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dentureTempHistoryLabel')}</label>
                  <textarea
                    rows={2}
                    value={editingCase.history}
                    onChange={(e) => setEditingCase({ ...editingCase, history: e.target.value })}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCase(null)}
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

      {/* Toast Notification System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
