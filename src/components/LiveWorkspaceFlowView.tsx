import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ScriptableContext
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Layers,
  Package,
  PhoneCall,
  FolderPlus,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  Copy,
  Save,
  ShieldCheck,
  RefreshCw,
  Loader2,
  X,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bot,
  Sparkles,
  Send,
  ArrowRight
} from 'lucide-react';
import type { ActiveTab } from '../types/dental';
import type {
  LiveCategoryBoard,
  LiveCategoryKind,
  LiveCategoryRecord,
  LiveRecordStatus
} from '../types/platform';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatDateByLanguage, formatNumberByLanguage } from '../utils/i18n';
import {
  buildLiveBoardSummaryReport,
  computeLiveBoardMetrics,
  fetchLiveCategoryFromSheet,
  parseLiveCategoryPaste
} from '../services/liveCategoryService';
import { AttachmentCell } from './AttachmentCell';
import { StandardQuickActionBar } from './ModuleDashboardSections';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

interface LiveWorkspaceFlowViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal?: () => void;
}

const STATUS_META: Record<
  LiveRecordStatus,
  { badgeClass: string; colorHex: string; th: string; en: string }
> = {
  pending: {
    badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-400/35',
    colorHex: '#f59e0b',
    th: 'รอดำเนินการ',
    en: 'Pending'
  },
  in_progress: {
    badgeClass: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/35',
    colorHex: '#22d3ee',
    th: 'กำลังดำเนินการ',
    en: 'In Progress'
  },
  followup: {
    badgeClass: 'bg-rose-500/15 text-rose-200 border-rose-400/35',
    colorHex: '#f43f5e',
    th: 'ต้องติดตาม / ใกล้หมด',
    en: 'Follow-up / Alert'
  },
  completed: {
    badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35',
    colorHex: '#10b981',
    th: 'เสร็จสิ้น / ปกติ',
    en: 'Completed / OK'
  }
};

export interface StockAiProposal {
  type: 'restock' | 'dispense' | 'add_new';
  targetRecordId?: string;
  targetSku: string;
  targetTitle: string;
  groupLabel?: string;
  unitLabel?: string;
  amount: number;
  oldOpening: number;
  oldReceived: number;
  newReceived: number;
  oldDispensed: number;
  newDispensed: number;
  oldBalance: number;
  newBalance: number;
  oldStatus?: LiveRecordStatus;
  newStatus: LiveRecordStatus;
  minThreshold: number;
  expiryDate?: string;
  notes?: string;
  summaryText: string;
}

function parseStockAiCommand(
  rawPrompt: string,
  records: LiveCategoryRecord[]
): StockAiProposal | null {
  const text = rawPrompt.trim();
  if (!text) return null;

  const isRestock = /เติม|รับเข้า|เพิ่มจำนวน|สั่งเข้า|นำเข้า|restock|receive|add stock/i.test(text);
  const isDispense = /เบิก|ตัดจ่าย|ใช้ไป|จ่ายออก|เบิกใช้|dispense|use|deduct|withdraw/i.test(text);
  const isAddNew = /เพิ่มรายการใหม่|สร้างรายการใหม่|เพิ่มเวชภัณฑ์|เพิ่มสินค้า|new item|add item|create item/i.test(text);

  // Extract SKU if mentioned
  const skuMatch = text.match(/DEN[-_ ]?0*(\d+)/i) || text.match(/[A-Z0-9]{3,8}-0*(\d+)/i);
  let matchedRecord: LiveCategoryRecord | undefined;
  let targetSku = '';

  if (skuMatch) {
    const rawCode = skuMatch[0].toUpperCase().replace(/\s+/g, '-');
    targetSku = rawCode;
    matchedRecord = records.find(
      (r) =>
        r.referenceCode.toUpperCase().replace(/\s+/g, '-') === rawCode ||
        r.referenceCode.toUpperCase().includes(rawCode)
    );
  }

  // If no SKU match, search by title keyword
  if (!matchedRecord && !isAddNew) {
    matchedRecord = records.find(
      (r) =>
        text.toLowerCase().includes(r.title.toLowerCase()) ||
        r.title.toLowerCase().includes(text.toLowerCase())
    );
    if (matchedRecord) {
      targetSku = matchedRecord.referenceCode;
    }
  }

  // Extract quantity
  let amount = 1;
  const numMatches = text.match(
    /(?:รับเข้า|ใช้ไป|จำนวน|คงเหลือ|ยกมา|เติม|เบิก|ตัดจ่าย|เพิ่ม|ยอด)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:ชิ้น|กล่อง|คู่|ห่อ|หลอด|ขวด|ชุด|ถุง|เล่ม|แกลลอน|ม้วน|กระปุก|กระป๋อง|แพ็ค)?/i
  );
  if (numMatches && numMatches[1]) {
    amount = parseFloat(numMatches[1]);
  }

  if (isAddNew) {
    if (!targetSku || records.some((r) => r.referenceCode === targetSku)) {
      const denNums = records
        .map((r) => {
          const m = r.referenceCode.match(/DEN-0*(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const nextNum = (denNums.length > 0 ? Math.max(...denNums) : 35) + 1;
      targetSku = `DEN-${String(nextNum).padStart(3, '0')}`;
    }

    let title = 'เวชภัณฑ์ทันตกรรมใหม่';
    const nameMatch = text.match(/ชื่อ\s+([^คงเหลือขั้นต่ำหมวดหมู่หน่วย\n\r,]+)/i);
    if (nameMatch && nameMatch[1].trim()) {
      title = nameMatch[1].trim();
    } else {
      const cleaned = text
        .replace(/เพิ่มรายการใหม่|สร้างรายการใหม่|รหัส\s*[A-Z0-9-]+|คงเหลือ\s*\d+|ขั้นต่ำ\s*\d+|ชื่อ/gi, '')
        .trim();
      if (cleaned) title = cleaned;
    }

    let minThreshold = 2;
    const minMatch = text.match(/ขั้นต่ำ\s*(\d+)/i);
    if (minMatch && minMatch[1]) {
      minThreshold = parseInt(minMatch[1], 10);
    }

    let group = 'หมวดวัสดุใช้สิ้นเปลือง';
    const groupMatch = text.match(/หมวด(?:หมู่)?\s*([^\s,]+)/i);
    if (groupMatch && groupMatch[1]) {
      group = groupMatch[1].trim();
    }

    let unit = 'ชิ้น';
    const unitMatch = text.match(/หน่วย\s*([^\s,]+)/i);
    if (unitMatch && unitMatch[1]) {
      unit = unitMatch[1].trim();
    }

    const net = amount;
    const newStatus: LiveRecordStatus =
      net <= minThreshold ? 'followup' : net <= minThreshold + 3 ? 'pending' : 'completed';

    return {
      type: 'add_new',
      targetSku,
      targetTitle: title,
      groupLabel: group,
      unitLabel: unit,
      amount,
      oldOpening: 0,
      oldReceived: 0,
      newReceived: 0,
      oldDispensed: 0,
      newDispensed: 0,
      oldBalance: 0,
      newBalance: net,
      newStatus,
      minThreshold,
      summaryText: `เพิ่มรายการใหม่ ${targetSku} (${title}) คงเหลือสุทธิ ${net} ${unit} (จุดสั่งซื้อ: ${minThreshold})`
    };
  }

  // Restock or Dispense
  if (!matchedRecord) {
    return null;
  }

  const oldOpening = matchedRecord.openingBalance ?? (matchedRecord.quantityOrMetric);
  const oldReceived = matchedRecord.receivedQty ?? 0;
  const oldDispensed = matchedRecord.dispensedQty ?? 0;
  const minThreshold = matchedRecord.minThreshold ?? 2;

  if (isDispense) {
    const newDispensed = oldDispensed + amount;
    const newBalance = Math.max(0, oldOpening + oldReceived - newDispensed);
    const newStatus: LiveRecordStatus =
      newBalance <= minThreshold ? 'followup' : newBalance <= minThreshold + 3 ? 'pending' : 'completed';

    return {
      type: 'dispense',
      targetRecordId: matchedRecord.id,
      targetSku: matchedRecord.referenceCode,
      targetTitle: matchedRecord.title,
      groupLabel: matchedRecord.groupLabel,
      unitLabel: matchedRecord.unitLabel,
      amount,
      oldOpening,
      oldReceived,
      newReceived: oldReceived,
      oldDispensed,
      newDispensed,
      oldBalance: matchedRecord.quantityOrMetric,
      newBalance,
      oldStatus: matchedRecord.status,
      newStatus,
      minThreshold,
      summaryText: `เบิกใช้ ${matchedRecord.referenceCode} (${matchedRecord.title}) ตัดจ่าย -${amount} ${matchedRecord.unitLabel} → คงเหลือสุทธิใหม่ ${newBalance} ${matchedRecord.unitLabel}`
    };
  }

  // Default to restock
  const newReceived = oldReceived + amount;
  const newBalance = oldOpening + newReceived - oldDispensed;
  const newStatus: LiveRecordStatus =
    newBalance <= minThreshold ? 'followup' : newBalance <= minThreshold + 3 ? 'pending' : 'completed';

  return {
    type: 'restock',
    targetRecordId: matchedRecord.id,
    targetSku: matchedRecord.referenceCode,
    targetTitle: matchedRecord.title,
    groupLabel: matchedRecord.groupLabel,
    unitLabel: matchedRecord.unitLabel,
    amount,
    oldOpening,
    oldReceived,
    newReceived,
    oldDispensed,
    newDispensed: oldDispensed,
    oldBalance: matchedRecord.quantityOrMetric,
    newBalance,
    oldStatus: matchedRecord.status,
    newStatus,
    minThreshold,
    summaryText: `เติมสต๊อก ${matchedRecord.referenceCode} (${matchedRecord.title}) รับเข้า +${amount} ${matchedRecord.unitLabel} → คงเหลือสุทธิใหม่ ${newBalance} ${matchedRecord.unitLabel}`
  };
}

export const LiveWorkspaceFlowView: React.FC<LiveWorkspaceFlowViewProps> = ({
  setActiveTab,
  onOpenNewTaskModal
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    liveBoards,
    addLiveBoard,
    updateLiveBoardMeta,
    deleteLiveBoard,
    importLiveBoardRecords,
    upsertLiveBoardRecord,
    deleteLiveBoardRecord,
    clearLiveBoardRecords,
    saveLiveBoardReportToWorkspace
  } = useWorkspace();

  const isPersonal = activeWorkspace.type === 'personal';
  const glassSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const [selectedBoardId, setSelectedBoardId] = useState<string>(() => liveBoards[0]?.id || '');
  const activeBoard: LiveCategoryBoard | undefined = useMemo(
    () => liveBoards.find((b) => b.id === selectedBoardId) || liveBoards[0],
    [liveBoards, selectedBoardId]
  );

  useEffect(() => {
    if (activeBoard && activeBoard.id !== selectedBoardId) {
      setSelectedBoardId(activeBoard.id);
    }
  }, [activeBoard, selectedBoardId]);

  // Toolbar & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LiveRecordStatus>('all');
  const [showSheetSyncDrawer, setShowSheetSyncDrawer] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetTabInput, setSheetTabInput] = useState('');
  const [isPullingSheet, setIsPullingSheet] = useState(false);
  const [sheetStatusBanner, setSheetStatusBanner] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);
  const [confirmClearBoard, setConfirmClearBoard] = useState(false);
  const [confirmDeleteBoardId, setConfirmDeleteBoardId] = useState<string | null>(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);

  // Sync URL inputs when switching category board
  useEffect(() => {
    setSheetUrlInput(activeBoard?.readOnlySheetUrl || '');
    setSheetTabInput(activeBoard?.readOnlySheetTab || '');
    setSheetStatusBanner(null);
    setConfirmClearBoard(false);
    setConfirmDeleteRowId(null);
    setStatusFilter('all');
    setSearchQuery('');
  }, [activeBoard?.id, activeBoard?.readOnlySheetUrl, activeBoard?.readOnlySheetTab]);

  // Modals State
  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState('');
  const [boardDescDraft, setBoardDescDraft] = useState('');
  const [boardKindDraft, setBoardKindDraft] = useState<LiveCategoryKind>('custom');
  const [boardMetricDraft, setBoardMetricDraft] = useState('');

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteReplaceMode, setPasteReplaceMode] = useState<'append' | 'replace'>('append');

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryRef, setEntryRef] = useState('');
  const [entryGroup, setEntryGroup] = useState('');
  const [entryStatus, setEntryStatus] = useState<LiveRecordStatus>('pending');
  const [entryQty, setEntryQty] = useState<string>('1');
  const [entryUnit, setEntryUnit] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [entryNotes, setEntryNotes] = useState('');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTextDraft, setReportTextDraft] = useState('');
  const [reportCopied, setReportCopied] = useState(false);
  const [reportSavedToast, setReportSavedToast] = useState(false);

  const [entryOpening, setEntryOpening] = useState<string>('10');
  const [entryReceived, setEntryReceived] = useState<string>('0');
  const [entryDispensed, setEntryDispensed] = useState<string>('0');
  const [entryMinThreshold, setEntryMinThreshold] = useState<string>('2');

  const [stockAiPrompt, setStockAiPrompt] = useState<string>('');
  const [stockAiProposal, setStockAiProposal] = useState<StockAiProposal | null>(null);
  const [stockAiFeedback, setStockAiFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [inventoryFilterMode, setInventoryFilterMode] = useState<'all' | 'low' | 'expired'>('all');

  const records = activeBoard?.records || [];

  const metrics = useMemo(() => computeLiveBoardMetrics(records), [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (activeBoard?.kind === 'inventory') {
        if (inventoryFilterMode === 'low') {
          const min = rec.minThreshold ?? 2;
          if (rec.quantityOrMetric > min && rec.status !== 'followup' && rec.status !== 'pending') return false;
        }
        if (inventoryFilterMode === 'expired') {
          const isExp = new Date(rec.recordDate).getTime() < Date.now() + 86400000 * 30;
          if (!isExp) return false;
        }
      }
      if (!q) return true;
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.referenceCode.toLowerCase().includes(q) ||
        rec.groupLabel.toLowerCase().includes(q) ||
        (rec.notes || '').toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, statusFilter, activeBoard?.kind, inventoryFilterMode]);

  const pastePreview = useMemo(() => {
    if (!activeBoard || !pasteRawText.trim()) return { records: [], skippedRows: 0 };
    return parseLiveCategoryPaste(pasteRawText, activeBoard.id, activeBoard.kind, 'sheet_paste');
  }, [activeBoard, pasteRawText]);

  // Charts Data (Chart.js — clean dark crystal aesthetic)
  const lineChartData = useMemo(
    () => ({
      labels: metrics.dailyTrend.map((d) => d.label),
      datasets: [
        {
          label: language === 'en' ? 'Items by Date' : 'จำนวนรายการตามวันที่',
          data: metrics.dailyTrend.map((d) => d.count),
          borderColor: isPersonal ? '#d8b4fe' : '#22d3ee',
          borderWidth: 2.5,
          tension: 0.36,
          fill: true,
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(168, 85, 247, 0.14)';
            const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, isPersonal ? 'rgba(216, 180, 254, 0.35)' : 'rgba(34, 211, 238, 0.32)');
            grad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');
            return grad;
          },
          pointBackgroundColor: '#ffffff',
          pointBorderColor: isPersonal ? '#c084fc' : '#22d3ee',
          pointRadius: 4
        }
      ]
    }),
    [isPersonal, language, metrics.dailyTrend]
  );

  const lineOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e1', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#cbd5e1', font: { size: 11 }, precision: 0 },
          grid: { color: 'rgba(255,255,255,0.08)' }
        }
      }
    }),
    []
  );

  const doughnutData = useMemo(
    () => ({
      labels: [
        STATUS_META.completed[language],
        STATUS_META.in_progress[language],
        STATUS_META.pending[language],
        STATUS_META.followup[language]
      ],
      datasets: [
        {
          data: [
            metrics.completedCount,
            metrics.inProgressCount,
            metrics.pendingCount,
            metrics.followupCount
          ],
          backgroundColor: ['#34D399', '#38BDF8', '#FBBF24', '#F43F5E'],
          borderColor: 'rgba(15, 23, 42, 0.45)',
          borderWidth: 2
        }
      ]
    }),
    [
      language,
      metrics.completedCount,
      metrics.followupCount,
      metrics.inProgressCount,
      metrics.pendingCount
    ]
  );

  const doughnutOptions: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#ffffff', boxWidth: 10, padding: 12, font: { size: 11, weight: 'bold' } }
        }
      }
    }),
    []
  );

  const barChartColors = ['#38BDF8', '#34D399', '#FBBF24', '#EC4899', '#A855F7', '#6366F1', '#14B8A6', '#FB923C'];
  const barChartData = useMemo(
    () => ({
      labels: metrics.groupBreakdown.map((g) => g.group),
      datasets: [
        {
          label: language === 'en' ? 'Records' : 'จำนวนรายการ',
          data: metrics.groupBreakdown.map((g) => g.count),
          backgroundColor: metrics.groupBreakdown.map((_, i) => barChartColors[i % barChartColors.length]),
          borderColor: '#ffffff',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    }),
    [language, metrics.groupBreakdown]
  );

  const barOptions: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      layout: { padding: { left: 16, right: 16, top: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#ffffff',
          bodyColor: '#38bdf8',
          borderColor: 'rgba(56, 189, 248, 0.45)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: '#38bdf8', font: { size: 11, weight: 'bold' }, precision: 0 },
          grid: { color: 'rgba(255,255,255,0.08)' }
        },
        y: {
          afterFit: (axis) => {
            // Guarantee at least 150px on the left so full Thai category names NEVER get clipped at the front
            if (axis.width < 150) {
              axis.width = 150;
            }
          },
          ticks: {
            color: '#e2e8f0',
            font: { size: 10.5, weight: 'bold' },
            padding: 8,
            autoSkip: false
          },
          grid: { display: false }
        }
      }
    }),
    []
  );

  // Handlers
  const openCreateBoardModal = () => {
    setEditingBoardId(null);
    setBoardNameDraft('');
    setBoardDescDraft('');
    setBoardKindDraft('custom');
    setBoardMetricDraft(language === 'en' ? 'Qty / Score' : 'จำนวน / คะแนน');
    setIsBoardModalOpen(true);
  };

  const openEditBoardModal = (board: LiveCategoryBoard) => {
    setEditingBoardId(board.id);
    setBoardNameDraft(board.name);
    setBoardDescDraft(board.description || '');
    setBoardKindDraft(board.kind);
    setBoardMetricDraft(board.metricLabel || '');
    setIsBoardModalOpen(true);
  };

  const handleSaveBoardModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardNameDraft.trim()) return;
    if (editingBoardId) {
      updateLiveBoardMeta(editingBoardId, {
        name: boardNameDraft.trim(),
        description: boardDescDraft.trim() || undefined,
        kind: boardKindDraft,
        metricLabel: boardMetricDraft.trim() || undefined
      });
    } else {
      const created = addLiveBoard({
        name: boardNameDraft.trim(),
        description: boardDescDraft.trim() || undefined,
        kind: boardKindDraft,
        metricLabel: boardMetricDraft.trim() || undefined
      });
      setSelectedBoardId(created.id);
    }
    setIsBoardModalOpen(false);
  };

  const handlePullFromSheet = async () => {
    if (!activeBoard) return;
    setIsPullingSheet(true);
    setSheetStatusBanner(null);

    updateLiveBoardMeta(activeBoard.id, {
      readOnlySheetUrl: sheetUrlInput.trim(),
      readOnlySheetTab: sheetTabInput.trim()
    });

    const result = await fetchLiveCategoryFromSheet(
      sheetUrlInput,
      sheetTabInput,
      activeBoard.id,
      activeBoard.kind,
      language
    );
    setIsPullingSheet(false);

    if (!result.ok) {
      setSheetStatusBanner({
        type: 'error',
        message: result.error || t('liveWsPullErrorDefault')
      });
      return;
    }

    if (result.records.length === 0) {
      setSheetStatusBanner({
        type: 'error',
        message: t('liveWsPullEmptyNotice')
      });
      return;
    }

    importLiveBoardRecords(activeBoard.id, result.records, 'replace');
    setSheetStatusBanner({
      type: 'ok',
      message: t('liveWsPullSuccessMsg')
        .replace('{count}', formatNumberByLanguage(result.records.length, language))
        .replace('{tab}', result.tabName)
    });
  };

  const handleImportPasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBoard || pastePreview.records.length === 0) return;
    importLiveBoardRecords(activeBoard.id, pastePreview.records, pasteReplaceMode);
    setSheetStatusBanner({
      type: 'ok',
      message: t('liveWsPasteSuccessMsg').replace(
        '{count}',
        formatNumberByLanguage(pastePreview.records.length, language)
      )
    });
    setPasteRawText('');
    setIsPasteModalOpen(false);
  };

  const openAddEntryModal = () => {
    if (!activeBoard) return;
    const defaultUnit =
      activeBoard.kind === 'inventory'
        ? language === 'en'
          ? 'pcs'
          : 'ชิ้น'
        : activeBoard.kind === 'followup_recall'
        ? language === 'en'
          ? 'case'
          : 'เคส'
        : language === 'en'
        ? 'item'
        : 'รายการ';

    const nextSku = activeBoard.kind === 'inventory'
      ? (() => {
          const denNums = records
            .map((r) => {
              const m = r.referenceCode.match(/DEN-0*(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => n > 0);
          const next = (denNums.length > 0 ? Math.max(...denNums) : records.length) + 1;
          return `DEN-${String(next).padStart(3, '0')}`;
        })()
      : '';

    setEditingRecordId(null);
    setEntryTitle('');
    setEntryRef(nextSku);
    setEntryGroup(activeBoard.kind === 'inventory' ? 'หมวดวัสดุใช้สิ้นเปลือง' : '');
    setEntryStatus('completed');
    setEntryQty('10');
    setEntryUnit(defaultUnit);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryNotes('');
    setEntryOpening('10');
    setEntryReceived('0');
    setEntryDispensed('0');
    setEntryMinThreshold('2');
    setIsEntryModalOpen(true);
  };

  const openEditEntryModal = (rec: LiveCategoryRecord) => {
    setEditingRecordId(rec.id);
    setEntryTitle(rec.title);
    setEntryRef(rec.referenceCode);
    setEntryGroup(rec.groupLabel);
    setEntryStatus(rec.status);
    setEntryQty(String(rec.quantityOrMetric));
    setEntryUnit(rec.unitLabel);
    setEntryDate(rec.recordDate);
    setEntryNotes(rec.notes || '');
    setEntryOpening(String(rec.openingBalance ?? rec.quantityOrMetric));
    setEntryReceived(String(rec.receivedQty ?? 0));
    setEntryDispensed(String(rec.dispensedQty ?? 0));
    setEntryMinThreshold(String(rec.minThreshold ?? 2));
    setIsEntryModalOpen(true);
  };

  const handleSaveEntryModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBoard || !entryTitle.trim()) return;
    const existing = editingRecordId
      ? activeBoard.records.find((r) => r.id === editingRecordId)
      : undefined;

    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const op = Number(entryOpening) || 0;
    const rc = Number(entryReceived) || 0;
    const dp = Number(entryDispensed) || 0;
    const mn = Number(entryMinThreshold) || 2;
    const net = activeBoard.kind === 'inventory' ? op + rc - dp : Number(entryQty);

    const calculatedStatus: LiveRecordStatus =
      activeBoard.kind === 'inventory'
        ? net <= mn
          ? 'followup'
          : net <= mn + 3
          ? 'pending'
          : 'completed'
        : entryStatus;

    const nextRecord: LiveCategoryRecord = {
      id: existing?.id || `lrec-man-${Date.now()}`,
      boardId: activeBoard.id,
      title: entryTitle.trim(),
      referenceCode:
        entryRef.trim() ||
        `${activeBoard.kind === 'inventory' ? 'DEN' : 'REF'}-${String(records.length + 1).padStart(3, '0')}`,
      groupLabel:
        entryGroup.trim() ||
        (activeBoard.kind === 'inventory'
          ? 'หมวดวัสดุใช้สิ้นเปลือง'
          : activeBoard.kind === 'followup_recall'
          ? 'เคสติดตาม'
          : 'หมวดหลัก'),
      status: calculatedStatus,
      quantityOrMetric: Number.isFinite(net) ? net : 1,
      unitLabel: entryUnit.trim() || (activeBoard.kind === 'inventory' ? 'ชิ้น' : 'รายการ'),
      recordDate: entryDate || new Date().toISOString().split('T')[0],
      notes: entryNotes.trim() || undefined,
      source: existing?.source || 'manual_entry',
      attachmentEvidenceId: existing?.attachmentEvidenceId,
      updatedAt: nowStamp,
      openingBalance: activeBoard.kind === 'inventory' ? op : existing?.openingBalance,
      receivedQty: activeBoard.kind === 'inventory' ? rc : existing?.receivedQty,
      dispensedQty: activeBoard.kind === 'inventory' ? dp : existing?.dispensedQty,
      minThreshold: activeBoard.kind === 'inventory' ? mn : existing?.minThreshold
    };

    upsertLiveBoardRecord(activeBoard.id, nextRecord);
    setIsEntryModalOpen(false);
  };

  const handleAnalyzeStockAiCommand = (promptOverride?: string) => {
    const text = (promptOverride || stockAiPrompt).trim();
    if (!text) {
      setStockAiProposal(null);
      setStockAiFeedback({
        ok: false,
        message: 'กรุณากรอกคำสั่ง AI เช่น "เติม DEN-001 รับเข้า 3" หรือ "เบิก DEN-006 ใช้ไป 2"'
      });
      return;
    }
    const proposal = parseStockAiCommand(text, records);
    if (!proposal) {
      setStockAiProposal(null);
      setStockAiFeedback({
        ok: false,
        message: 'AI ไม่พบรายการที่ตรงกับคำสั่ง กรุณาระบุรหัสสินค้า (เช่น DEN-001) หรือชื่อวัสดุ พร้อมจำนวนที่ต้องการเติม/เบิก'
      });
      return;
    }
    setStockAiFeedback(null);
    setStockAiProposal(proposal);
  };

  const handleConfirmStockAiProposal = () => {
    if (!stockAiProposal || !activeBoard) return;
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    if (stockAiProposal.type === 'add_new') {
      const newRecord: LiveCategoryRecord = {
        id: `stock-${stockAiProposal.targetSku.toLowerCase()}-${Date.now()}`,
        boardId: activeBoard.id,
        title: stockAiProposal.targetTitle,
        referenceCode: stockAiProposal.targetSku,
        groupLabel: stockAiProposal.groupLabel || 'หมวดวัสดุใช้สิ้นเปลือง',
        status: stockAiProposal.newStatus,
        quantityOrMetric: stockAiProposal.newBalance,
        unitLabel: stockAiProposal.unitLabel || 'ชิ้น',
        recordDate:
          stockAiProposal.expiryDate ||
          new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0],
        notes: `เพิ่มผ่านคำสั่ง AI: ${stockAiProposal.summaryText}`,
        source: 'manual_entry',
        updatedAt: nowStamp,
        openingBalance: stockAiProposal.amount,
        receivedQty: 0,
        dispensedQty: 0,
        minThreshold: stockAiProposal.minThreshold
      };
      upsertLiveBoardRecord(activeBoard.id, newRecord);
    } else {
      const target = records.find(
        (r) =>
          r.id === stockAiProposal.targetRecordId ||
          r.referenceCode.toUpperCase() === stockAiProposal.targetSku.toUpperCase()
      );
      if (target) {
        const updated: LiveCategoryRecord = {
          ...target,
          openingBalance: stockAiProposal.oldOpening,
          receivedQty: stockAiProposal.newReceived,
          dispensedQty: stockAiProposal.newDispensed,
          quantityOrMetric: stockAiProposal.newBalance,
          minThreshold: stockAiProposal.minThreshold,
          status: stockAiProposal.newStatus,
          updatedAt: nowStamp,
          notes: `อัปเดตผ่าน AI: ${stockAiProposal.summaryText}`
        };
        upsertLiveBoardRecord(activeBoard.id, updated);
      }
    }

    setStockAiFeedback({
      ok: true,
      message: `อัปเดตตารางสต๊อกสำเร็จ: ${stockAiProposal.summaryText}`
    });
    setStockAiProposal(null);
    setStockAiPrompt('');
    setTimeout(() => setStockAiFeedback(null), 4500);
  };

  const handleOpenReportModal = () => {
    if (!activeBoard) return;
    setReportTextDraft(buildLiveBoardSummaryReport(activeBoard, metrics, language));
    setReportCopied(false);
    setReportSavedToast(false);
    setIsReportModalOpen(true);
  };

  const handleCopyReport = async () => {
    if (!reportTextDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(reportTextDraft);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSaveReportToVault = async () => {
    if (!activeBoard || !reportTextDraft.trim()) return;
    await saveLiveBoardReportToWorkspace(activeBoard.name, reportTextDraft, records.length);
    setReportSavedToast(true);
    setTimeout(() => setReportSavedToast(false), 3000);
  };

  const getBoardIcon = (kind: LiveCategoryKind) => {
    if (kind === 'inventory') return Package;
    if (kind === 'followup_recall') return PhoneCall;
    return Layers;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-24 space-y-5 max-w-7xl mx-auto">
      {/* 1. Category Board Switcher Strip (Stock, Extraction/Denture Follow-up, Custom Categories) */}
      <div className={`${glassSurface} rounded-2xl p-3.5 sm:p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-300" />
            <span className="text-xs font-semibold text-slate-100">
              {t('liveWsSelectorTitle')}
            </span>
          </div>
          <button
            type="button"
            onClick={openCreateBoardModal}
            className="crystal-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t('liveWsNewBoardBtn')}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {liveBoards.map((board) => {
            const Icon = getBoardIcon(board.kind);
            const isSelected = activeBoard?.id === board.id;
            return (
              <div
                key={board.id}
                className={`inline-flex items-center rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-violet-600/35 via-fuchsia-500/20 to-cyan-500/20 border-violet-300/55 shadow-[0_0_18px_rgba(168,85,247,0.22)]'
                    : 'crystal-tile border-white/15 hover:border-violet-300/35'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedBoardId(board.id)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-100 cursor-pointer"
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-cyan-300' : 'text-violet-300'
                    }`}
                  />
                  <span>{board.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-white/10 text-slate-200 border border-white/15">
                    {formatNumberByLanguage(board.records.length, language)}
                  </span>
                </button>
                {isSelected && (
                  <div className="flex items-center pr-1.5 gap-0.5 border-l border-white/10 pl-1">
                    <button
                      type="button"
                      onClick={() => openEditBoardModal(board)}
                      title={t('editBtn')}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {liveBoards.length > 1 && (
                      confirmDeleteBoardId === board.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            deleteLiveBoard(board.id);
                            setConfirmDeleteBoardId(null);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[10px] font-semibold cursor-pointer"
                        >
                          {t('confirmDeleteBtn')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBoardId(board.id)}
                          title={t('deleteBtn')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!activeBoard ? (
        <div className={`${glassSurface} rounded-2xl p-8 text-center space-y-3`}>
          <p className="text-sm font-semibold text-slate-100">{t('liveWsNoBoardsTitle')}</p>
          <button
            type="button"
            onClick={openCreateBoardModal}
            className="crystal-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>{t('liveWsNewBoardBtn')}</span>
          </button>
        </div>
      ) : (
        <>
          {/* 2. TOP SECTION: Action Header + Read-Only Sync + 4 Gradient KPI Cards */}
          <div className={`${glassSurface} rounded-2xl p-4 sm:p-5 space-y-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white">{activeBoard.name}</h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-400/35">
                    <ShieldCheck className="w-3 h-3" />
                    {t('satReadOnlyBadge')}
                  </span>
                </div>
                {activeBoard.description && (
                  <p className="text-xs text-slate-300/85">{activeBoard.description}</p>
                )}
              </div>

              {/* Action Toolbar (Matching SatisfactionCenter Flow) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasteRawText('');
                    setPasteReplaceMode('append');
                    setIsPasteModalOpen(true);
                  }}
                  className="crystal-btn inline-flex items-center gap-1.5 px-3.5 min-h-[38px] py-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-violet-500/20"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>{t('liveWsPasteBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSheetSyncDrawer((prev) => !prev)}
                  className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3 min-h-[38px] py-2 rounded-xl border border-cyan-400/35 text-cyan-200 hover:text-white text-xs font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{t('liveWsSheetPullToggle')}</span>
                </button>

                <button
                  type="button"
                  onClick={openAddEntryModal}
                  className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3 min-h-[38px] py-2 rounded-xl border border-violet-400/35 text-violet-100 hover:text-white text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('liveWsAddRowBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenReportModal}
                  className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3 min-h-[38px] py-2 rounded-xl border border-amber-400/35 text-amber-200 hover:text-white text-xs font-medium cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t('liveWsReportBtn')}</span>
                </button>

                {records.length > 0 &&
                  (confirmClearBoard ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          clearLiveBoardRecords(activeBoard.id);
                          setConfirmClearBoard(false);
                        }}
                        className="px-3 min-h-[38px] py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        {t('confirmClearAllBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearBoard(false)}
                        className="crystal-tile px-2.5 min-h-[38px] py-2 rounded-xl text-xs text-slate-300 cursor-pointer"
                      >
                        {t('cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearBoard(true)}
                      className="crystal-tile inline-flex items-center gap-1.5 px-3 min-h-[38px] py-2 rounded-xl border border-rose-400/30 text-rose-200 hover:bg-rose-500/15 text-xs font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('liveWsClearRecordsBtn')}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Optional Read-Only Google Sheet Drawer */}
            {showSheetSyncDrawer && (
              <div className="crystal-tile rounded-xl p-4 border border-cyan-400/30 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('liveWsReadOnlyTitle')}
                    </p>
                    <p className="text-[11px] text-slate-300/85 leading-relaxed">
                      {t('satRawAppendGuardrail')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSheetSyncDrawer(false)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  <input
                    type="url"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="glass-input md:col-span-6 px-3 py-2 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={sheetTabInput}
                    onChange={(e) => setSheetTabInput(e.target.value)}
                    placeholder={t('liveWsSheetTabPlaceholder')}
                    className="glass-input md:col-span-3 px-3 py-2 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    disabled={isPullingSheet}
                    onClick={() => void handlePullFromSheet()}
                    className="crystal-btn md:col-span-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {isPullingSheet ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{t('liveWsPullNowBtn')}</span>
                  </button>
                </div>
              </div>
            )}

            {sheetStatusBanner && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 border ${
                  sheetStatusBanner.type === 'ok'
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                }`}
              >
                <span>{sheetStatusBanner.message}</span>
                <button
                  type="button"
                  onClick={() => setSheetStatusBanner(null)}
                  className="p-0.5 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* AI Stock Command Center (In-Page AI Command Bar) */}
          {activeBoard.kind === 'inventory' && (
            <div className="crystal-tile rounded-2xl p-4 sm:p-5 border border-cyan-400/40 shadow-xl space-y-3.5 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/25 to-violet-500/25 border border-cyan-300/40 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>ช่องคำสั่ง AI สั่งการสต๊อก & จัดการเวชภัณฑ์ด่วน</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/35 font-mono">
                        Instant Routing
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      พิมพ์สั่งเติมสต๊อก, เบิกใช้, หรือเพิ่มรายการใหม่ AI จะคำนวณและแสดงตัวอย่างก่อนส่งลงตารางจริง
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 rounded-xl self-start sm:self-auto">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>บันทึกถาวรลงระบบ</span>
                </div>
              </div>

              {/* Quick Prompt Example Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                <span className="text-[11px] font-semibold text-cyan-300 shrink-0 mr-1 flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  ตัวอย่างคำสั่งเร็ว:
                </span>
                {[
                  'เติม DEN-001 รับเข้า 3',
                  'เบิก DEN-006 ใช้ไป 2',
                  'เติม DEN-008 รับเข้า 5',
                  'เบิก DEN-004 ใช้ไป 3',
                  'เพิ่มรายการใหม่ รหัส DEN-036 ชื่อ ถุงมือตรวจ Size L คงเหลือ 5 ขั้นต่ำ 2'
                ].map((chipText, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setStockAiPrompt(chipText);
                      handleAnalyzeStockAiCommand(chipText);
                    }}
                    className="px-2.5 py-1 rounded-xl crystal-tile hover:bg-white/15 text-[11px] text-slate-200 hover:text-white border border-white/15 whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    {chipText}
                  </button>
                ))}
              </div>

              {/* Prompt Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAnalyzeStockAiCommand();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1">
                  <Bot className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={stockAiPrompt}
                    onChange={(e) => setStockAiPrompt(e.target.value)}
                    placeholder='เช่น "เติม DEN-001 รับเข้า 3", "เบิก DEN-006 ใช้ไป 2", "เพิ่มรายการใหม่ รหัส DEN-036..."'
                    className="glass-input w-full pl-9 pr-3 py-2.5 rounded-xl text-xs text-white placeholder:text-slate-400 font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>วิเคราะห์คำสั่ง AI</span>
                </button>
              </form>

              {/* Feedback Notice */}
              {stockAiFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                    stockAiFeedback.ok
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {stockAiFeedback.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                    )}
                    <span>{stockAiFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStockAiFeedback(null)}
                    className="p-0.5 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* AI Proposal Preview Card */}
              {stockAiProposal && (
                <div className="rounded-xl p-4 bg-gradient-to-r from-slate-900/90 via-violet-950/60 to-cyan-950/60 border border-cyan-400/50 shadow-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                          stockAiProposal.type === 'restock'
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                            : stockAiProposal.type === 'dispense'
                            ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                            : 'bg-violet-500/20 border-violet-400/40 text-violet-300'
                        }`}
                      >
                        {stockAiProposal.type === 'restock'
                          ? '🟢 เติมสต๊อก / รับเข้า (+)'
                          : stockAiProposal.type === 'dispense'
                          ? '🟠 เบิกใช้ / ตัดจ่าย (-)'
                          : '🟣 เพิ่มรายการเวชภัณฑ์ใหม่'}
                      </span>
                      <span className="font-mono text-cyan-300 font-bold text-xs">
                        {stockAiProposal.targetSku}
                      </span>
                      <span className="text-white font-semibold text-xs">
                        {stockAiProposal.targetTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmStockAiProposal}
                        className="crystal-btn px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>ยืนยันอัปเดตตารางทันที</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockAiProposal(null)}
                        className="crystal-tile px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Diffs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl crystal-tile">
                      <span className="text-slate-400 text-[10px] block">ยอดยกมา</span>
                      <span className="text-slate-200 font-semibold tabular-nums text-sm">
                        {stockAiProposal.oldOpening} {stockAiProposal.unitLabel}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl crystal-tile">
                      <span className="text-slate-400 text-[10px] block">รับเข้า (+)</span>
                      <span className="text-emerald-300 font-semibold tabular-nums text-sm flex items-center gap-1">
                        <span>{stockAiProposal.oldReceived}</span>
                        {stockAiProposal.newReceived !== stockAiProposal.oldReceived && (
                          <>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <strong className="text-emerald-200">+{stockAiProposal.newReceived}</strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl crystal-tile">
                      <span className="text-slate-400 text-[10px] block">ตัดจ่าย / เบิกใช้ (-)</span>
                      <span className="text-amber-300 font-semibold tabular-nums text-sm flex items-center gap-1">
                        <span>{stockAiProposal.oldDispensed}</span>
                        {stockAiProposal.newDispensed !== stockAiProposal.oldDispensed && (
                          <>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <strong className="text-amber-200">-{stockAiProposal.newDispensed}</strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-400/40">
                      <span className="text-cyan-300 text-[10px] font-bold block">คงเหลือสุทธิใหม่</span>
                      <span className="text-cyan-100 font-extrabold tabular-nums text-base flex items-center gap-1">
                        <span>{stockAiProposal.oldBalance}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                        <strong className="text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                          {stockAiProposal.newBalance} {stockAiProposal.unitLabel}
                        </strong>
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl crystal-tile">
                      <span className="text-slate-400 text-[10px] block">สถานะหลังอัปเดต</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${
                          STATUS_META[stockAiProposal.newStatus].badgeClass
                        }`}
                      >
                        {STATUS_META[stockAiProposal.newStatus][language]}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4 Gradient KPI Cards (Interactive Click-to-Filter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`kpi-glow-purple rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                statusFilter === 'all' ? 'ring-2 ring-violet-300/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-violet-100/90">
                  {t('liveWsKpiTotalTitle')}
                </span>
                <div className="p-2 rounded-xl bg-violet-400/20 text-violet-200 border border-violet-300/35 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold text-white tabular-nums kpi-num-glow">
                  {formatNumberByLanguage(metrics.totalCount, language)}
                </span>
                <span className="text-[11px] font-medium text-violet-200/90 tabular-nums">
                  {activeBoard.metricLabel || t('liveWsKpiMetricSum')}:{' '}
                  {formatNumberByLanguage(metrics.totalQuantity, language)}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'in_progress' ? 'all' : 'in_progress'))
              }
              className={`kpi-glow-cyan rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                statusFilter === 'in_progress' ? 'ring-2 ring-cyan-300/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-cyan-100/90">
                  {t('liveWsKpiInProgressTitle')}
                </span>
                <div className="p-2 rounded-xl bg-cyan-400/20 text-cyan-200 border border-cyan-300/35 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold text-white tabular-nums kpi-num-glow">
                  {formatNumberByLanguage(metrics.inProgressCount, language)}
                </span>
                <span className="text-[11px] font-medium text-cyan-200/90">
                  {STATUS_META.in_progress[language]}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === 'followup' ? 'all' : 'followup'))}
              className={`kpi-glow-amber rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                statusFilter === 'followup' ? 'ring-2 ring-amber-300/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-amber-100/90">
                  {t('liveWsKpiAttentionTitle')}
                </span>
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-300/35 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold text-white tabular-nums kpi-num-glow">
                  {formatNumberByLanguage(metrics.attentionCount, language)}
                </span>
                <span className="text-[11px] font-medium text-amber-200/90 tabular-nums">
                  {t('liveWsKpiPendingSub')}: {formatNumberByLanguage(metrics.pendingCount, language)}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'completed' ? 'all' : 'completed'))
              }
              className={`kpi-glow-rose rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                statusFilter === 'completed' ? 'ring-2 ring-rose-300/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-rose-100/90">
                  {t('liveWsKpiCompletedTitle')}
                </span>
                <div className="p-2 rounded-xl bg-rose-400/20 text-rose-200 border border-rose-300/35 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold text-white tabular-nums kpi-num-glow">
                  {formatNumberByLanguage(metrics.completedCount, language)}
                </span>
                <span className="text-[11px] font-semibold text-rose-200/95 tabular-nums">
                  {metrics.completionRate}%
                </span>
              </div>
            </button>
          </div>

          {/* 3. MIDDLE SECTION: Live Charts OR Empty Ready State */}
          {records.length === 0 ? (
            <div
              className={`${glassSurface} rounded-2xl border border-dashed border-violet-300/35 p-8 text-center space-y-4`}
            >
              <div className="w-12 h-12 rounded-2xl crystal-tile bg-gradient-to-br from-violet-500/25 to-cyan-500/20 border border-violet-300/40 flex items-center justify-center text-violet-200 mx-auto">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xl mx-auto">
                <h3 className="text-sm font-bold text-white">{t('liveWsEmptyTitle')}</h3>
                <p className="text-xs text-slate-300/85 leading-relaxed">{t('liveWsEmptyHint')}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPasteRawText('');
                    setPasteReplaceMode('append');
                    setIsPasteModalOpen(true);
                  }}
                  className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>{t('liveWsPasteBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={openAddEntryModal}
                  className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-100 text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('liveWsAddRowBtn')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Chart 1: Daily Volume Trend (Line) */}
              <div className={`${glassSurface} rounded-2xl p-5 lg:col-span-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-300" />
                    <span>{t('liveWsTrendChartTitle')}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {formatNumberByLanguage(metrics.dailyTrend.length, language)} {t('liveWsDaysUnit')}
                  </span>
                </div>
                <div className="h-52">
                  <Line data={lineChartData} options={lineOptions} />
                </div>
              </div>

              {/* Chart 2: Status Doughnut */}
              <div className={`${glassSurface} rounded-2xl p-5 lg:col-span-3 space-y-3`}>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('liveWsStatusChartTitle')}
                </h3>
                <div className="h-52">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </div>

              {/* Chart 3: Subgroup Horizontal Bar */}
              <div className={`${glassSurface} rounded-2xl p-5 lg:col-span-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>{t('liveWsGroupChartTitle')}</span>
                  </h3>
                  <span className="text-[11px] text-cyan-300 font-semibold tabular-nums">
                    {metrics.groupBreakdown.length} หมวด
                  </span>
                </div>
                <div className="h-60 min-h-[235px]">
                  <Bar data={barChartData} options={barOptions} />
                </div>
              </div>
            </div>
          )}

          {/* 4. BOTTOM SECTION: Search, Status Filter & Editable/Deletable Table */}
          <div className={`${glassSurface} rounded-2xl p-4 sm:p-5 space-y-4`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('liveWsSearchPlaceholder')}
                  className="glass-input w-full pl-8 pr-3 py-2 rounded-xl text-xs"
                />
              </div>

              {activeBoard.kind === 'inventory' ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInventoryFilterMode('all')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                      inventoryFilterMode === 'all'
                        ? 'bg-violet-600/40 border-violet-300 text-white'
                        : 'crystal-tile border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryFilterMode('low')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                      inventoryFilterMode === 'low'
                        ? 'bg-amber-600/40 border-amber-300 text-white'
                        : 'crystal-tile border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    ใกล้หมด / ถึงจุดสั่งซื้อ
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryFilterMode('expired')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                      inventoryFilterMode === 'expired'
                        ? 'bg-rose-600/40 border-rose-300 text-white'
                        : 'crystal-tile border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    หมดอายุ / ใกล้หมดอายุ
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    ['all', 'pending', 'in_progress', 'followup', 'completed'] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer ${
                        statusFilter === st
                          ? 'bg-violet-500/30 border-violet-300/55 text-white'
                          : 'crystal-tile border-white/15 text-slate-300 hover:text-white'
                      }`}
                    >
                      {st === 'all' ? t('allStatuses') : STATUS_META[st][language]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {activeBoard.kind === 'inventory' ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 text-[11px] text-slate-300/90">
                      <th className="py-2.5 px-3 font-semibold">รหัส SKU</th>
                      <th className="py-2.5 px-3 font-semibold">ชื่อวัสดุ / เวชภัณฑ์</th>
                      <th className="py-2.5 px-3 font-semibold">หมวดหมู่</th>
                      <th className="py-2.5 px-3 font-semibold">หน่วย</th>
                      <th className="py-2.5 px-3 font-semibold text-right">ยอดยกมา</th>
                      <th className="py-2.5 px-3 font-semibold text-right">รับเข้า (+)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">เบิกใช้ (-)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">คงเหลือสุทธิ</th>
                      <th className="py-2.5 px-3 font-semibold text-right">จุดสั่งซื้อ</th>
                      <th className="py-2.5 px-3 font-semibold">วันหมดอายุ</th>
                      <th className="py-2.5 px-3 font-semibold">สถานะ</th>
                      <th className="py-2.5 px-3 font-semibold text-right">จัดการ/แก้ไข</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400">
                          {records.length === 0 ? t('liveWsTableEmptyInitial') : t('liveWsTableNoMatch')}
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => {
                        const opening = rec.openingBalance ?? rec.quantityOrMetric;
                        const received = rec.receivedQty ?? 0;
                        const withdrawn = rec.dispensedQty ?? 0;
                        const balance = rec.quantityOrMetric;
                        const reorderPoint = rec.minThreshold ?? 2;
                        return (
                          <tr key={rec.id} className="hover:bg-white/[0.04] transition-colors">
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-cyan-300 font-bold">
                              {rec.referenceCode}
                            </td>
                            <td className="py-2.5 px-3 min-w-[200px] max-w-[280px]">
                              <p className="font-semibold text-white break-words leading-snug">{rec.title}</p>
                              {rec.notes && (
                                <p className="text-[11px] text-slate-300/80 mt-0.5 line-clamp-1 truncate max-w-full" title={rec.notes}>
                                  {rec.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-purple-200 font-medium">{rec.groupLabel}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">{rec.unitLabel}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right text-slate-200 tabular-nums font-semibold">
                              {formatNumberByLanguage(opening, language)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right tabular-nums font-semibold">
                              {received > 0 ? (
                                <span className="text-emerald-300">+{formatNumberByLanguage(received, language)}</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right tabular-nums font-semibold">
                              {withdrawn > 0 ? (
                                <span className="text-amber-300">-{formatNumberByLanguage(withdrawn, language)}</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right font-extrabold text-cyan-200 tabular-nums text-sm">
                              {formatNumberByLanguage(balance, language)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right text-rose-300/90 tabular-nums font-semibold">
                              {formatNumberByLanguage(reorderPoint, language)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-300 tabular-nums">
                              {formatDateByLanguage(rec.recordDate, language)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <select
                                value={rec.status}
                                onChange={(e) =>
                                  upsertLiveBoardRecord(activeBoard.id, {
                                    ...rec,
                                    status: e.target.value as LiveRecordStatus,
                                    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
                                  })
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-950/20 backdrop-blur-[2px] cursor-pointer ${
                                  STATUS_META[rec.status].badgeClass
                                }`}
                              >
                                {(['pending', 'in_progress', 'followup', 'completed'] as const).map((st) => (
                                  <option key={st} value={st} className="bg-slate-900 text-slate-100">
                                    {STATUS_META[st][language]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditEntryModal(rec)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg crystal-tile text-[11px] text-slate-200 hover:text-white cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>{t('editBtn')}</span>
                                </button>
                                {confirmDeleteRowId === rec.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteLiveBoardRecord(activeBoard.id, rec.id);
                                      setConfirmDeleteRowId(null);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    {t('confirmDeleteBtn')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteRowId(rec.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-[11px] text-rose-200 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('deleteBtn')}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 text-[11px] text-slate-300/90">
                      <th className="py-2.5 px-3 font-semibold">{t('liveWsColDate')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('liveWsColRef')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('liveWsColTitle')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('liveWsColGroup')}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        {activeBoard.metricLabel || t('liveWsColQty')}
                      </th>
                      <th className="py-2.5 px-3 font-semibold">{t('liveWsColStatus')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('evidence')}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{t('actionsCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          {records.length === 0 ? t('liveWsTableEmptyInitial') : t('liveWsTableNoMatch')}
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/[0.04] transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-300 tabular-nums">
                            {formatDateByLanguage(rec.recordDate, language)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-cyan-200">
                            {rec.referenceCode}
                          </td>
                          <td className="py-2.5 px-3 min-w-[200px]">
                            <p className="font-semibold text-slate-100">{rec.title}</p>
                            {rec.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {rec.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-200">
                            {rec.groupLabel}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-semibold text-white tabular-nums">
                            {formatNumberByLanguage(rec.quantityOrMetric, language)} {rec.unitLabel}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <select
                              value={rec.status}
                              onChange={(e) =>
                                upsertLiveBoardRecord(activeBoard.id, {
                                  ...rec,
                                  status: e.target.value as LiveRecordStatus,
                                  updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-950/20 backdrop-blur-[2px] cursor-pointer ${
                                STATUS_META[rec.status].badgeClass
                              }`}
                            >
                              {(
                                ['pending', 'in_progress', 'followup', 'completed'] as const
                              ).map((st) => (
                                <option key={st} value={st} className="bg-slate-900 text-slate-100">
                                  {STATUS_META[st][language]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <AttachmentCell
                              evidenceId={rec.attachmentEvidenceId}
                              itemTitle={rec.title}
                              contextLabel={activeBoard.name}
                              onAttached={(evId) =>
                                upsertLiveBoardRecord(activeBoard.id, {
                                  ...rec,
                                  attachmentEvidenceId: evId,
                                  updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
                                })
                              }
                              onRemoved={() =>
                                upsertLiveBoardRecord(activeBoard.id, {
                                  ...rec,
                                  attachmentEvidenceId: undefined,
                                  updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
                                })
                              }
                            />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditEntryModal(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg crystal-tile text-[11px] text-slate-200 hover:text-white cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{t('editBtn')}</span>
                              </button>
                              {confirmDeleteRowId === rec.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteLiveBoardRecord(activeBoard.id, rec.id);
                                    setConfirmDeleteRowId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  {t('confirmDeleteBtn')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRowId(rec.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-[11px] text-rose-200 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{t('deleteBtn')}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <StandardQuickActionBar
            setActiveTab={setActiveTab}
            primaryActionLabel={t('newTask')}
            onPrimaryAction={onOpenNewTaskModal}
          />
        </>
      )}

      {/* Modal 1: Create / Rename Category Board */}
      {isBoardModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveBoardModal}
              className="glass-modal w-full max-w-md rounded-2xl p-5 space-y-4 border border-violet-300/30"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  {editingBoardId ? t('liveWsEditBoardTitle') : t('liveWsNewBoardBtn')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBoardModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    {t('liveWsBoardNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={boardNameDraft}
                    onChange={(e) => setBoardNameDraft(e.target.value)}
                    placeholder={t('liveWsBoardNamePlaceholder')}
                    className="glass-input w-full px-3 py-2 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    {t('liveWsBoardKindLabel')}
                  </label>
                  <select
                    value={boardKindDraft}
                    onChange={(e) => setBoardKindDraft(e.target.value as LiveCategoryKind)}
                    className="glass-input w-full px-3 py-2 rounded-xl"
                  >
                    <option value="inventory">{t('liveWsKindInventory')}</option>
                    <option value="followup_recall">{t('liveWsKindFollowup')}</option>
                    <option value="custom">{t('liveWsKindCustom')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    {t('liveWsBoardMetricLabel')}
                  </label>
                  <input
                    type="text"
                    value={boardMetricDraft}
                    onChange={(e) => setBoardMetricDraft(e.target.value)}
                    placeholder="จำนวนคงเหลือ / คะแนน / ซี่"
                    className="glass-input w-full px-3 py-2 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    {t('liveWsBoardDescLabel')}
                  </label>
                  <input
                    type="text"
                    value={boardDescDraft}
                    onChange={(e) => setBoardDescDraft(e.target.value)}
                    placeholder={t('liveWsBoardDescPlaceholder')}
                    className="glass-input w-full px-3 py-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBoardModalOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-xs text-slate-300 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold cursor-pointer"
                >
                  {editingBoardId ? t('saveChangesBtn') : t('liveWsCreateBoardConfirm')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal 2: Paste Sheet / Excel / Form Rows (Instant Convert + Live Charts) */}
      {isPasteModalOpen &&
        activeBoard &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <form
              onSubmit={handleImportPasteSubmit}
              className="glass-modal w-full max-w-2xl rounded-2xl p-5 space-y-4 border border-violet-300/30 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-white">
                    {t('liveWsPasteModalTitle')} — {activeBoard.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300/90 leading-relaxed">
                {t('liveWsPasteModalHint')}
              </p>

              <textarea
                rows={8}
                value={pasteRawText}
                onChange={(e) => setPasteRawText(e.target.value)}
                placeholder={t('liveWsPastePlaceholder')}
                className="glass-input w-full p-3 rounded-xl text-xs font-mono leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="pasteMode"
                      checked={pasteReplaceMode === 'append'}
                      onChange={() => setPasteReplaceMode('append')}
                    />
                    <span>{t('liveWsModeAppend')}</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="pasteMode"
                      checked={pasteReplaceMode === 'replace'}
                      onChange={() => setPasteReplaceMode('replace')}
                    />
                    <span>{t('liveWsModeReplace')}</span>
                  </label>
                </div>

                <span className="text-cyan-300 font-semibold tabular-nums">
                  {t('liveWsDetectedRowsCount').replace(
                    '{count}',
                    formatNumberByLanguage(pastePreview.records.length, language)
                  )}
                </span>
              </div>

              {pastePreview.records.length > 0 && (
                <div className="crystal-tile rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-violet-200">
                    {t('liveWsPreviewFirstRows')}
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-[11px]">
                    {pastePreview.records.slice(0, 4).map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 text-slate-200 border-b border-white/10 pb-1 last:border-0"
                      >
                        <span className="truncate font-medium">
                          [{row.referenceCode}] {row.title}
                        </span>
                        <span className="shrink-0 text-cyan-200 tabular-nums">
                          {row.quantityOrMetric} {row.unitLabel} · {STATUS_META[row.status][language]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-xs text-slate-300 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={pastePreview.records.length === 0}
                  className="crystal-btn px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {t('liveWsImportConfirmBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal 3: Add / Edit Row Entry */}
      {isEntryModalOpen &&
        activeBoard &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveEntryModal}
              className="glass-modal w-full max-w-xl rounded-2xl p-5 sm:p-6 space-y-4 border border-violet-300/30 max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/20 text-cyan-300 border border-violet-400/30">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {activeBoard.kind === 'inventory'
                        ? editingRecordId
                          ? 'แก้ไขรายการเวชภัณฑ์ & ปรับยอดสต๊อก'
                          : 'เพิ่มรายการเวชภัณฑ์ใหม่'
                        : editingRecordId
                        ? t('liveWsEditRowTitle')
                        : t('liveWsAddRowBtn')}
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      {activeBoard.kind === 'inventory'
                        ? 'คำนวณยอดยกมา รับเข้า เบิกใช้ และสถานะสต๊อกอัตโนมัติ'
                        : activeBoard.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeBoard.kind === 'inventory' ? (
                /* Dedicated Dental Stock Inputs */
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-200 mb-1 font-semibold">
                        รหัส SKU / สินค้า
                      </label>
                      <input
                        type="text"
                        required
                        value={entryRef}
                        onChange={(e) => setEntryRef(e.target.value)}
                        placeholder="DEN-001"
                        className="glass-input w-full px-3 py-2 rounded-xl font-mono text-cyan-200 font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-200 mb-1 font-semibold">
                        ชื่อเวชภัณฑ์ / วัสดุทันตกรรม
                      </label>
                      <input
                        type="text"
                        required
                        value={entryTitle}
                        onChange={(e) => setEntryTitle(e.target.value)}
                        placeholder="เช่น ถุงมือตรวจฟัน ไซส์ M (กล่อง)"
                        className="glass-input w-full px-3 py-2 rounded-xl font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-200 mb-1 font-semibold">
                        หมวดหมู่วัสดุ
                      </label>
                      <input
                        type="text"
                        value={entryGroup}
                        onChange={(e) => setEntryGroup(e.target.value)}
                        placeholder="หมวดวัสดุใช้สิ้นเปลือง"
                        className="glass-input w-full px-3 py-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-200 mb-1 font-semibold">
                        หน่วยนับ
                      </label>
                      <input
                        type="text"
                        value={entryUnit}
                        onChange={(e) => setEntryUnit(e.target.value)}
                        placeholder="กล่อง, หลอด, ขวด, ชิ้น"
                        className="glass-input w-full px-3 py-2 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* 4 Quantities: Opening, Received, Dispensed, Min Threshold */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-900/70 border border-white/10 shadow-inner">
                    <div>
                      <label className="block text-slate-300 mb-1 text-[11px] font-medium text-center">
                        ยอดยกมา
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entryOpening}
                        onChange={(e) => setEntryOpening(e.target.value)}
                        className="glass-input w-full px-2.5 py-1.5 rounded-lg text-center font-bold text-slate-100 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-emerald-300 mb-1 text-[11px] font-semibold text-center">
                        รับเข้า (+)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entryReceived}
                        onChange={(e) => setEntryReceived(e.target.value)}
                        className="glass-input w-full px-2.5 py-1.5 rounded-lg text-center font-bold text-emerald-300 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300 mb-1 text-[11px] font-semibold text-center">
                        ตัดจ่าย (-)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entryDispensed}
                        onChange={(e) => setEntryDispensed(e.target.value)}
                        className="glass-input w-full px-2.5 py-1.5 rounded-lg text-center font-bold text-amber-300 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-rose-300 mb-1 text-[11px] font-semibold text-center">
                        จุดสั่งซื้อขั้นต่ำ
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entryMinThreshold}
                        onChange={(e) => setEntryMinThreshold(e.target.value)}
                        className="glass-input w-full px-2.5 py-1.5 rounded-lg text-center font-bold text-rose-300 tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Computed Net Balance Live Preview Bar */}
                  {(() => {
                    const op = Number(entryOpening) || 0;
                    const rc = Number(entryReceived) || 0;
                    const dp = Number(entryDispensed) || 0;
                    const mn = Number(entryMinThreshold) || 2;
                    const net = op + rc - dp;
                    const isLow = net <= mn;
                    const isWarning = net <= mn + 3 && !isLow;
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-r from-cyan-950/50 via-slate-900/60 to-violet-950/40 border border-cyan-400/40 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 text-xs">คงเหลือสุทธิ (คำนวณอัตโนมัติ):</span>
                          <span className="text-base font-extrabold text-cyan-200 tabular-nums">
                            {net} {entryUnit || 'ชิ้น'}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border self-start sm:self-auto ${
                            isLow
                              ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                              : isWarning
                              ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                              : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                          }`}
                        >
                          {isLow
                            ? '🚨 ใกล้หมด / ต้องสั่งซื้อ'
                            : isWarning
                            ? '⚠️ ใกล้ถึงจุดสั่งซื้อ'
                            : '✅ สต๊อกพร้อมใช้งาน'}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-200 mb-1 font-semibold">
                        วันหมดอายุ (EXP)
                      </label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="glass-input w-full px-3 py-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-200 mb-1 font-semibold">
                        สถานะการทำงาน
                      </label>
                      <select
                        value={entryStatus}
                        onChange={(e) => setEntryStatus(e.target.value as LiveRecordStatus)}
                        className="glass-input w-full px-3 py-2 rounded-xl"
                      >
                        {(['completed', 'pending', 'followup', 'in_progress'] as const).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_META[st][language]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold">
                      หมายเหตุ / ตำแหน่งจัดเก็บ / ล็อต
                    </label>
                    <textarea
                      rows={2}
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value)}
                      placeholder="เช่น ตู้เก็บสต๊อกชั้น B3, Lot 202409, สั่งจาก DKSH"
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                /* Standard Board Inputs (Non-Inventory) */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColTitle')}
                    </label>
                    <input
                      type="text"
                      required
                      value={entryTitle}
                      onChange={(e) => setEntryTitle(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColRef')}
                    </label>
                    <input
                      type="text"
                      value={entryRef}
                      onChange={(e) => setEntryRef(e.target.value)}
                      placeholder="HN / SKU / Ref"
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColGroup')}
                    </label>
                    <input
                      type="text"
                      value={entryGroup}
                      onChange={(e) => setEntryGroup(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {activeBoard.metricLabel || t('liveWsColQty')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={entryQty}
                      onChange={(e) => setEntryQty(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsUnitLabel')}
                    </label>
                    <input
                      type="text"
                      value={entryUnit}
                      onChange={(e) => setEntryUnit(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColStatus')}
                    </label>
                    <select
                      value={entryStatus}
                      onChange={(e) => setEntryStatus(e.target.value as LiveRecordStatus)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    >
                      {(['pending', 'in_progress', 'followup', 'completed'] as const).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_META[st][language]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColDate')}
                    </label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 mb-1 font-medium">
                      {t('liveWsColNotes')}
                    </label>
                    <textarea
                      rows={2}
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-xs text-slate-300 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer shadow-md shadow-violet-500/20"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal 4: Summary Report (Copy + Save to Tasks & Evidence Vault) */}
      {isReportModalOpen &&
        activeBoard &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-modal w-full max-w-2xl rounded-2xl p-5 space-y-4 border border-amber-300/30 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-300" />
                  <h3 className="text-sm font-bold text-white">
                    {t('liveWsReportModalTitle')} — {activeBoard.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={12}
                value={reportTextDraft}
                onChange={(e) => setReportTextDraft(e.target.value)}
                className="glass-input w-full p-3.5 rounded-xl text-xs font-mono leading-relaxed"
              />

              {reportSavedToast && (
                <div className="rounded-xl px-3 py-2 bg-emerald-500/15 border border-emerald-400/35 text-emerald-200 text-xs">
                  {t('liveWsReportSavedToast')}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyReport()}
                  className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-100 cursor-pointer"
                >
                  {reportCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                  <span>{reportCopied ? t('liveWsCopiedToast') : t('satExecReportCopyBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSaveReportToVault()}
                  className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('satExecReportSaveBtn')}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
