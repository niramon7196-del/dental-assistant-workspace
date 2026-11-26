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
  QrCode,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Loader2,
  PhoneCall,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Plus,
  ShieldCheck,
  RefreshCw,
  ThumbsUp,
  Wrench,
  X,
  ClipboardPaste,
  Save,
  Star,
  Lock,
  Search,
  Trash2,
  Copy,
  Check,
  Pencil,
  Activity
} from 'lucide-react';
import {
  ActiveTab,
  SatisfactionProcedureType,
  SatisfactionResponse,
  SatisfactionScores
} from '../types/dental';
import { SatisfactionAiAnalysisResult } from '../types/platform';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatNumberByLanguage } from '../utils/i18n';
import {
  PROCEDURE_CATALOG,
  buildDeterministicExecutiveReport,
  computeSatisfactionMetrics,
  exportSatisfactionExcelWorkbook,
  formatMonthLabel,
  getMonthKeyFromDate,
  getProcedureLabel,
  parseSatisfactionCsvOrTsvDetailed
} from '../services/satisfactionService';
import { AiServiceError, analyzeSatisfactionWithAi } from '../services/aiService';
import {
  fetchSatisfactionFromSheet,
  saveSheetConfig,
  validateRawSatisfactionTabName
} from '../services/sheetService';
import { PostOpSurveyModal } from './PostOpSurveyModal';
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

interface SatisfactionCenterProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal?: () => void;
}

const DEFAULT_SCORES: SatisfactionScores = {
  receptionCare: 5,
  treatmentExplanation: 5,
  cleanlinessProfessionalism: 5,
  waitingAndDuration: 4,
  overallExperience: 5
};

export const SatisfactionCenter: React.FC<SatisfactionCenterProps> = ({
  setActiveTab,
  onOpenNewTaskModal
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    sheetConfig,
    updateSheetConfig,
    satisfactionResponses,
    setSatisfactionResponses,
    satisfactionSettings,
    updateSatisfactionSettings,
    createFollowUpFromSatisfaction,
    saveExecutiveReportToWorkspace,
    recordAudit
  } = useWorkspace();

  const isPersonal = activeWorkspace.type === 'personal';
  const glassSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const effectiveSheetConfig = useMemo(() => {
    const resolvedUrl = sheetConfig.satisfactionSheetUrl?.trim() || '';
    const preferredTab =
      (sheetConfig.satisfactionRawTabName &&
      sheetConfig.satisfactionRawTabName !== 'Raw_Responses'
        ? sheetConfig.satisfactionRawTabName
        : '') ||
      (satisfactionSettings.rawSheetTabName &&
      satisfactionSettings.rawSheetTabName !== 'Raw_Responses'
        ? satisfactionSettings.rawSheetTabName
        : '') ||
      sheetConfig.satisfactionRawTabName ||
      'การตอบแบบฟอร์ม 1';
    return {
      ...sheetConfig,
      satisfactionSheetUrl: resolvedUrl,
      satisfactionRawTabName: preferredTab
    };
  }, [sheetConfig, satisfactionSettings.rawSheetTabName]);

  const [isPostOpOpen, setIsPostOpOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isExecReportOpen, setIsExecReportOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(satisfactionSettings.monthlyGoal || 30));
  const [trendMode, setTrendMode] = useState<'monthly' | 'daily'>('monthly');

  // New Entry Modal state
  const [entryProcedure, setEntryProcedure] =
    useState<SatisfactionProcedureType>('checkup_scaling');
  const [entryScores, setEntryScores] = useState<SatisfactionScores>(DEFAULT_SCORES);
  const [entryWantsCallback, setEntryWantsCallback] = useState(false);
  const [entryCallbackTopic, setEntryCallbackTopic] = useState('');
  const [entryPatientRef, setEntryPatientRef] = useState('');
  const [entryComment, setEntryComment] = useState('');
  const [entrySource, setEntrySource] = useState<'qr_scan' | 'post_op_link' | 'manual_entry'>(
    'qr_scan'
  );

  // Paste CSV/TSV Modal state
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  // AI Screening state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<SatisfactionAiAnalysisResult | null>(null);

  // Executive Report state
  const [execReportText, setExecReportText] = useState('');
  const [copiedExec, setCopiedExec] = useState(false);
  const [savedExecToast, setSavedExecToast] = useState(false);

  // Read-Only Sheet Sync state
  const [sheetUrlInput, setSheetUrlInput] = useState(
    effectiveSheetConfig.satisfactionSheetUrl || ''
  );
  const [rawTabInput, setRawTabInput] = useState(
    effectiveSheetConfig.satisfactionRawTabName || 'การตอบแบบฟอร์ม 1'
  );
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetNotice, setSheetNotice] = useState<{
    ok: boolean;
    text: string;
    showPasteCta?: boolean;
  } | null>(null);
  const [followupNotice, setFollowupNotice] = useState<string | null>(null);

  // Response Table Filter, Local Edit & Delete Confirmation (Source Sheet remains strictly Read-Only)
  const [tableFilter, setTableFilter] = useState<'all' | 'callback'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [confirmClearLocal, setConfirmClearLocal] = useState(false);
  const [editingResponse, setEditingResponse] = useState<SatisfactionResponse | null>(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);

  useEffect(() => {
    setSheetUrlInput(effectiveSheetConfig.satisfactionSheetUrl || '');
    setRawTabInput(effectiveSheetConfig.satisfactionRawTabName || 'การตอบแบบฟอร์ม 1');
  }, [
    activeWorkspace.id,
    effectiveSheetConfig.satisfactionSheetUrl,
    effectiveSheetConfig.satisfactionRawTabName
  ]);

  useEffect(() => {
    if (effectiveSheetConfig.satisfactionSheetUrl) {
      setSheetUrlInput(effectiveSheetConfig.satisfactionSheetUrl);
    }
  }, [effectiveSheetConfig.satisfactionSheetUrl]);

  const metrics = useMemo(
    () => computeSatisfactionMetrics(satisfactionResponses, satisfactionSettings.monthlyGoal),
    [satisfactionResponses, satisfactionSettings.monthlyGoal]
  );

  const tabValidation = useMemo(
    () => validateRawSatisfactionTabName(rawTabInput),
    [rawTabInput]
  );

  const filteredTableResponses = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return satisfactionResponses.filter((r) => {
      if (tableFilter === 'callback' && !r.wantsCallback) return false;
      if (!q) return true;
      const proc = getProcedureLabel(r.serviceType, language).toLowerCase();
      return (
        proc.includes(q) ||
        (r.comment || '').toLowerCase().includes(q) ||
        (r.callbackTopic || '').toLowerCase().includes(q) ||
        (r.patientRef || '').toLowerCase().includes(q) ||
        r.submittedAt.toLowerCase().includes(q)
      );
    });
  }, [satisfactionResponses, tableFilter, tableSearch, language]);

  const deterministicStrengths = useMemo(() => {
    if (metrics.totalCount === 0) return [];
    return [...metrics.dimensionAverages]
      .sort((a, b) => b.average - a.average)
      .slice(0, 2)
      .map((d) =>
        language === 'en'
          ? `${d.labelEn}: ${d.average.toFixed(2)} / 5.00`
          : `${d.labelTh}: ${d.average.toFixed(2)} / 5.00`
      );
  }, [metrics, language]);

  const deterministicImprovements = useMemo(() => {
    if (metrics.totalCount === 0) return [];
    const low = [...metrics.dimensionAverages]
      .filter((d) => d.average > 0)
      .sort((a, b) => a.average - b.average)
      .slice(0, 2)
      .filter((d) => d.average < 4.7)
      .map((d) =>
        language === 'en'
          ? `Watch "${d.labelEn}" (${d.average.toFixed(2)} / 5.00)`
          : `ติดตามพัฒนา "${d.labelTh}" (เฉลี่ย ${d.average.toFixed(2)} / 5.00)`
      );
    if (metrics.momentumStatus !== 'on_track') {
      low.unshift(
        language === 'en'
          ? 'Monthly QR scan count is below pace — send post-op care + survey link after every visit.'
          : 'ยอดสแกนเดือนนี้ยังต่ำกว่าจังหวะเป้าหมาย — แนะนำกดส่งข้อความดูแลหลังทำฟัน + QR ทันทีหลังจบเคส'
      );
    }
    return low;
  }, [metrics, language]);

  const displayedStrengths = aiResult?.strengths?.length
    ? aiResult.strengths
    : deterministicStrengths;
  const displayedImprovements = aiResult?.improvements?.length
    ? aiResult.improvements
    : deterministicImprovements;

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Math.max(1, Math.min(5000, parseInt(goalDraft, 10) || 30));
    updateSatisfactionSettings({ monthlyGoal: num });
    setGoalDraft(String(num));
    setIsEditingGoal(false);
  };

  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const newResp: SatisfactionResponse = {
      id: `sat-${Date.now()}`,
      submittedAt: now.toISOString().replace('T', ' ').slice(0, 16),
      monthKey: getMonthKeyFromDate(now),
      serviceType: entryProcedure,
      scores: { ...entryScores },
      wantsCallback: entryWantsCallback,
      callbackTopic: entryWantsCallback ? entryCallbackTopic.trim() || undefined : undefined,
      patientRef: entryPatientRef.trim() || undefined,
      comment: entryComment.trim() || undefined,
      source: entrySource,
      triageStatus: 'new',
      syncedToSheet: false
    };

    setSatisfactionResponses((prev) => [newResp, ...prev]);
    recordAudit('settings_update', `Recorded satisfaction QR response (${entryProcedure})`);
    setEntryScores(DEFAULT_SCORES);
    setEntryWantsCallback(false);
    setEntryCallbackTopic('');
    setEntryPatientRef('');
    setEntryComment('');
    setIsAddEntryOpen(false);
  };

  const buildDedupeKey = (r: SatisfactionResponse) =>
    `${r.submittedAt}::${r.patientRef || ''}::${r.serviceType}::${r.scores.receptionCare}-${r.scores.treatmentExplanation}-${r.scores.cleanlinessProfessionalism}-${r.scores.waitingAndDuration}-${r.scores.overallExperience}::${r.wantsCallback ? '1' : '0'}::${r.comment || ''}`;

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPasteError(null);
    try {
      const text = await file.text();
      setPasteRawText(text);
    } catch {
      setPasteError(
        language === 'en'
          ? 'Could not read the selected file.'
          : 'ไม่สามารถอ่านไฟล์ที่เลือกได้ กรุณาลองวางข้อความแทน'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handlePasteImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError(null);
    const parsedBatch = parseSatisfactionCsvOrTsvDetailed(pasteRawText, {
      source: 'sheet_sync'
    });
    if (parsedBatch.rows.length === 0) {
      setPasteError(
        language === 'en'
          ? 'Could not detect valid survey rows. Paste tab-separated rows from Google Sheets or import an exported CSV file.'
          : 'ไม่พบแถวข้อมูลประเมินที่อ่านได้ กรุณาก๊อปปี้แถวจากแท็บ "การตอบแบบฟอร์ม 1" ใน Google Sheets มาวาง หรือเลือกไฟล์ .csv ที่ส่งออกจากชีตได้เลย'
      );
      return;
    }

    const existingKeys = new Set(satisfactionResponses.map(buildDedupeKey));
    const freshRows = parsedBatch.rows.filter((r) => !existingKeys.has(buildDedupeKey(r)));
    const addedCount = freshRows.length;

    if (addedCount > 0) {
      setSatisfactionResponses((prev) => [...freshRows, ...prev]);
      recordAudit(
        'settings_update',
        `Imported ${addedCount} read-only satisfaction rows (${parsedBatch.importedFormat || 'raw_rows'})`
      );
    }

    setPasteRawText('');
    setIsPasteModalOpen(false);
    setSheetNotice(null);
    setPasteToast(
      language === 'en'
        ? `Imported & saved ${parsedBatch.rows.length} row(s) (${addedCount} new) permanently to this browser.`
        : `นำเข้าข้อมูลจากชีต/ฟอร์มสำเร็จ ${parsedBatch.rows.length} แถว (เพิ่มใหม่ ${addedCount} แถว) และบันทึกลงเบราว์เซอร์ถาวรแล้ว`
    );
    setTimeout(() => setPasteToast(null), 6500);
  };

  const handleRunAiAnalysis = async () => {
    if (satisfactionResponses.length === 0) return;
    setAiError(null);
    setIsAnalyzing(true);
    try {
      const res = await analyzeSatisfactionWithAi({
        metrics,
        responses: satisfactionResponses,
        uiLanguage: language
      });
      setAiResult(res);
      recordAudit('ai_assist', 'Analyzed satisfaction stats, strengths, and callback queue with AI');
    } catch (err) {
      if (err instanceof AiServiceError && err.isUnavailable) {
        setAiError(t('aiProviderUnavailableNotice'));
      } else {
        setAiError(err instanceof Error ? err.message : 'AI analysis failed');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenExecReport = () => {
    const report =
      aiResult?.executiveReportText?.trim() ||
      buildDeterministicExecutiveReport({
        metrics,
        responses: satisfactionResponses,
        language,
        strengths: displayedStrengths,
        improvements: displayedImprovements
      });
    setExecReportText(report);
    setSavedExecToast(false);
    setIsExecReportOpen(true);
  };

  const handleCopyExecReport = async () => {
    try {
      await navigator.clipboard.writeText(execReportText);
    } catch {
      // ignore
    }
    setCopiedExec(true);
    setTimeout(() => setCopiedExec(false), 2200);
  };

  const handleSaveExecToWorkspace = async () => {
    await saveExecutiveReportToWorkspace(
      execReportText,
      metrics.totalCount,
      metrics.thisMonthKey
    );
    setSavedExecToast(true);
    setTimeout(() => setSavedExecToast(false), 3200);
  };

  const handleCreateCallbackTask = (resp: SatisfactionResponse) => {
    const rec = aiResult?.callbackRecommendations.find((r) => r.responseId === resp.id);
    const created = createFollowUpFromSatisfaction(resp, rec);
    setFollowupNotice(
      language === 'en'
        ? `Created follow-up task: ${created.title}`
        : `สร้างงานติดตามแล้ว: ${created.title}`
    );
    setTimeout(() => setFollowupNotice(null), 3500);
  };

  const handleCreateAllPendingCallbacks = () => {
    const pending = metrics.callbackCases.filter((c) => c.triageStatus === 'new');
    if (pending.length === 0) return;
    pending.forEach((resp) => {
      const rec = aiResult?.callbackRecommendations.find((r) => r.responseId === resp.id);
      createFollowUpFromSatisfaction(resp, rec);
    });
    setFollowupNotice(
      language === 'en'
        ? `Created ${pending.length} follow-up tasks for all pending callback requests.`
        : `สร้างงานติดตามครบทั้ง ${pending.length} เคสที่รอติดต่อกลับแล้ว`
    );
    setTimeout(() => setFollowupNotice(null), 3500);
  };

  const handlePullFromSheet = async (explicitUrl?: string) => {
    setSheetNotice(null);
    setPasteToast(null);
    const targetTab = rawTabInput.trim() || 'การตอบแบบฟอร์ม 1';
    const candidateUrl = (
      explicitUrl !== undefined
        ? explicitUrl
        : sheetUrlInput.trim() || effectiveSheetConfig.satisfactionSheetUrl
    ).trim();

    const mergedConfig = {
      ...effectiveSheetConfig,
      satisfactionSheetUrl: candidateUrl,
      satisfactionRawTabName: targetTab
    };

    if (candidateUrl && candidateUrl !== sheetConfig.satisfactionSheetUrl) {
      updateSheetConfig(mergedConfig);
      if (!isPersonal) {
        saveSheetConfig(mergedConfig);
      }
    } else {
      updateSatisfactionSettings({ rawSheetTabName: targetTab });
    }

    setIsSyncingSheet(true);
    const res = await fetchSatisfactionFromSheet(mergedConfig, targetTab, language);
    setIsSyncingSheet(false);

    if (res.standby) {
      setSheetNotice({
        ok: false,
        showPasteCta: true,
        text:
          language === 'en'
            ? 'No Google Sheet URL saved for this space yet. Paste your sheet URL in the Read-Only section below (or use Settings), or click "Paste from Sheet / Form" to import rows/CSV immediately.'
            : 'ยังไม่มีลิงก์ชีตแบบประเมินที่บันทึกไว้ — สามารถวางลิงก์ Google Sheet ในช่องด้านล่างเพื่อบันทึกและดึงข้อมูลได้เลย หรือกด "วางข้อมูลจากชีต / ฟอร์ม" เพื่อวางแถวหรืออัปโหลดไฟล์ .csv ได้ทันที'
      });
      return;
    }

    if (!res.ok) {
      setSheetNotice({
        ok: false,
        showPasteCta: Boolean(res.accessDenied || res.tabNotFound || !res.ok),
        text:
          res.error ||
          (language === 'en'
            ? 'Could not pull from sheet.'
            : 'ไม่สามารถดึงข้อมูลจากชีตได้')
      });
      return;
    }

    if (res.rows.length === 0) {
      setSheetNotice({
        ok: true,
        text:
          language === 'en'
            ? `Read-Only pull from "${res.tabName}" succeeded, but 0 response rows were found.`
            : `อ่านแท็บ "${res.tabName}" แบบ Read-Only สำเร็จ แต่ยังไม่มีแถวข้อมูลคำตอบ (0 แถว)`
      });
      return;
    }

    const existingKeys = new Set(satisfactionResponses.map(buildDedupeKey));
    const freshRows = res.rows.filter((r) => !existingKeys.has(buildDedupeKey(r)));
    const addedCount = freshRows.length;

    if (addedCount > 0) {
      setSatisfactionResponses((prev) => [...freshRows, ...prev]);
      recordAudit(
        'settings_update',
        `Read-only pull of ${addedCount} new rows from tab "${res.tabName}"`
      );
    }

    setSheetNotice({
      ok: true,
      text:
        language === 'en'
          ? `Read-Only pull from "${res.tabName}" succeeded: ${res.rows.length} row(s) read (${addedCount} new saved permanently to browser storage) — source sheet untouched.`
          : `ดึงข้อมูลแบบอ่านอย่างเดียวจากแท็บ "${res.tabName}" สำเร็จ ${res.rows.length} แถว (เพิ่มใหม่ ${addedCount} แถว และบันทึกลงเบราว์เซอร์ถาวรแล้ว) โดยไม่แก้ไขไฟล์ชีตต้นฉบับ`
    });
  };

  // ChartJS Data & Options (Dark Premium Duo-Tone CanvasGradients)
  const dimensionBarData = useMemo(() => {
    const duoStops: [string, string][] = [
      ['#2dd4bf', '#22d3ee'], // Teal -> Cyan
      ['#a855f7', '#ec4899'], // Neon Purple -> Magenta
      ['#34d399', '#2dd4bf'], // Emerald -> Teal
      ['#fb923c', '#fbbf24'], // Peach-Orange -> Amber
      ['#ec4899', '#a855f7']  // Pink -> Violet
    ];
    return {
      labels: [
        t('satDim1Reception'),
        t('satDim2Explanation'),
        t('satDim3Cleanliness'),
        t('satDim4Duration'),
        t('satDim5Overall')
      ],
      datasets: [
        {
          label: t('satAvgOverallLabel'),
          data: metrics.dimensionAverages.map((d) => d.average),
          backgroundColor: (ctx: ScriptableContext<'bar'>) => {
            const idx = ctx.dataIndex ?? 0;
            const [startHex, endHex] = duoStops[idx % duoStops.length];
            const { chart } = ctx;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return startHex;
            const grad = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            grad.addColorStop(0, startHex);
            grad.addColorStop(1, endHex);
            return grad;
          },
          borderColor: ['#5eead4', '#f472b6', '#6ee7b7', '#fdba74', '#e879f9'],
          borderWidth: 1,
          borderRadius: 10,
          barThickness: 20
        }
      ]
    };
  }, [metrics.dimensionAverages, t]);

  const dimensionBarOptions: ChartOptions<'bar'> = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 240 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(34, 211, 238, 0.45)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0'
        }
      },
      scales: {
        x: {
          min: 0,
          max: 5,
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#e2e8f0', stepSize: 1, font: { size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f8fafc', font: { size: 11, weight: 'bold' as const } }
        }
      }
    }),
    []
  );

  const serviceDoughnutData = useMemo(() => {
    const hasSvc = metrics.serviceBreakdown.length > 0;
    return {
      labels: hasSvc
        ? metrics.serviceBreakdown.map((s) => (language === 'en' ? s.labelEn : s.labelTh))
        : [t('zoneEmptyRows')],
      datasets: [
        {
          data: hasSvc ? metrics.serviceBreakdown.map((s) => s.count) : [1],
          backgroundColor: hasSvc
            ? ['#22d3ee', '#ec4899', '#a855f7', '#fb923c', '#2dd4bf', '#f472b6']
            : ['rgba(148, 163, 184, 0.15)'],
          borderColor: 'rgba(255, 255, 255, 0.22)',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [metrics.serviceBreakdown, language, t]);

  const serviceDoughnutOptions: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      animation: { duration: 240 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: metrics.serviceBreakdown.length > 0,
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(236, 72, 153, 0.45)',
          borderWidth: 1,
          padding: 10
        }
      }
    }),
    [metrics.serviceBreakdown.length]
  );

  const activeTrendSeries =
    trendMode === 'monthly' ? metrics.monthlyTrend : metrics.recentDailyTrend;

  const trendLineData = useMemo(
    () => ({
      labels: activeTrendSeries.map((pt) =>
        trendMode === 'monthly' ? formatMonthLabel(pt.key, language) : pt.label
      ),
      datasets: [
        {
          label: t('satChartTrendScans'),
          data: activeTrendSeries.map((pt) => pt.count),
          borderColor: (ctx: ScriptableContext<'line'>) => {
            const { chart } = ctx;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return '#22d3ee';
            const grad = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            grad.addColorStop(0, '#2dd4bf');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#ec4899');
            return grad;
          },
          backgroundColor: (ctx: ScriptableContext<'line'>) => {
            const { chart } = ctx;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return 'rgba(34, 211, 238, 0.16)';
            const grad = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, 'rgba(34, 211, 238, 0.30)');
            grad.addColorStop(0.55, 'rgba(168, 85, 247, 0.14)');
            grad.addColorStop(1, 'rgba(13, 8, 28, 0.0)');
            return grad;
          },
          borderWidth: 2.75,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#22d3ee',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
          tension: 0.38,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: t('satChartTrendScore'),
          data: activeTrendSeries.map((pt) => pt.avgScore),
          borderColor: (ctx: ScriptableContext<'line'>) => {
            const { chart } = ctx;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return '#fb923c';
            const grad = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            grad.addColorStop(0, '#fb923c');
            grad.addColorStop(1, '#f472b6');
            return grad;
          },
          backgroundColor: 'rgba(251, 146, 60, 0.10)',
          borderWidth: 2.25,
          pointRadius: 3.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#fb923c',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
          tension: 0.38,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    }),
    [activeTrendSeries, trendMode, language, t]
  );

  const trendLineOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 240 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: '#cbd5e1', boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(167, 139, 250, 0.45)',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#e2e8f0', font: { size: 10 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          suggestedMax: 6,
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#5eead4', precision: 0, font: { size: 10 } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 5,
          grid: { drawOnChartArea: false },
          ticks: { color: '#fdba74', stepSize: 1, font: { size: 10 } }
        }
      }
    }),
    []
  );

  const handleAttachSatPhoto = (rowId: string, evidenceId: string) => {
    setSatisfactionResponses((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, attachmentEvidenceId: evidenceId } : r))
    );
  };

  const handleRemoveSatPhoto = (rowId: string) => {
    setSatisfactionResponses((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, attachmentEvidenceId: undefined } : r))
    );
  };

  const handleDeleteLocalResponse = (rowId: string) => {
    if (confirmDeleteRowId !== rowId) {
      setConfirmDeleteRowId(rowId);
      return;
    }
    setConfirmDeleteRowId(null);
    setSatisfactionResponses((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleSaveEditResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResponse) return;
    setSatisfactionResponses((prev) =>
      prev.map((r) => (r.id === editingResponse.id ? editingResponse : r))
    );
    setEditingResponse(null);
  };

  const dimLabels = [
    { key: 'receptionCare' as const, label: t('satDim1Reception') },
    { key: 'treatmentExplanation' as const, label: t('satDim2Explanation') },
    { key: 'cleanlinessProfessionalism' as const, label: t('satDim3Cleanliness') },
    { key: 'waitingAndDuration' as const, label: t('satDim4Duration') },
    { key: 'overallExperience' as const, label: t('satDim5Overall') }
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-24 space-y-5 max-w-7xl mx-auto">
      {/* Monthly Scan Pulse + 4 Crystal Duo-Tone KPI Cards + 1-Click Outreach */}
      <div className={`${glassSurface} rounded-2xl p-5 space-y-4 border border-violet-400/25`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1 (Duo-Tone Purple <-> Pink): Scans This Month */}
          <div className="kpi-glow-purple rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-violet-100">
                {t('satMonthlyScanTitle')}
              </span>
              <div className="p-1.5 rounded-xl bg-fuchsia-400/20 border border-fuchsia-300/35 text-fuchsia-200">
                <QrCode className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight kpi-num-glow">
                {formatNumberByLanguage(metrics.thisMonthCount, language)}
              </span>
              <span className="text-xs text-slate-300 tabular-nums">
                / {formatNumberByLanguage(metrics.monthlyGoal, language)}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 border border-white/15 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 via-fuchsia-400 to-amber-300 rounded-full transition-all"
                style={{ width: `${metrics.goalProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-cyan-300 font-semibold tabular-nums">{metrics.goalProgressPct}%</span>
              {!isEditingGoal ? (
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(String(metrics.monthlyGoal));
                    setIsEditingGoal(true);
                  }}
                  className="text-violet-200 hover:text-white underline cursor-pointer"
                >
                  {t('satEditGoalBtn')}
                </button>
              ) : (
                <form onSubmit={handleSaveGoal} className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                    className="glass-input w-14 border-violet-400 rounded px-1.5 py-0.5 text-[11px]"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] cursor-pointer"
                  >
                    OK
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Card 2 (Duo-Tone Teal <-> Cyan): vs Previous Month */}
          <div className="kpi-glow-cyan rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-cyan-100">
                {t('satPrevMonthLabel')} ({formatMonthLabel(metrics.prevMonthKey, language)})
              </span>
              <div className="p-1.5 rounded-xl bg-teal-400/20 border border-teal-300/35 text-teal-200">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight kpi-num-glow">
                {formatNumberByLanguage(metrics.prevMonthCount, language)}
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  metrics.monthDelta >= 0 ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {metrics.monthDelta >= 0 ? '+' : ''}
                {metrics.monthDelta}
                {metrics.monthGrowthPct !== null ? ` (${metrics.monthGrowthPct}%)` : ''}
              </span>
            </div>
            <p className="text-[11px] text-cyan-100/75">
              {formatMonthLabel(metrics.thisMonthKey, language)}
            </p>
          </div>

          {/* Card 3 (Duo-Tone Peach <-> Amber): Total Respondents & Avg Score */}
          <div className="kpi-glow-amber rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-100">
                {t('satRespondentsTotal')}
              </span>
              <div className="p-1.5 rounded-xl bg-orange-400/20 border border-orange-300/35 text-amber-200">
                <Star className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight kpi-num-glow">
                {formatNumberByLanguage(metrics.totalCount, language)}
              </span>
              <span className="text-xs font-bold text-amber-200 tabular-nums">
                ★ {metrics.overallAverage.toFixed(2)} / 5.00
              </span>
            </div>
            <p className="text-[11px] text-amber-100/75">{t('satAvgOverallLabel')}</p>
          </div>

          {/* Card 4 (Duo-Tone Magenta <-> Violet): Pending Callbacks */}
          <div className="kpi-glow-rose rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-pink-100">
                {t('satCallbackQueueTitle')}
              </span>
              <div className="p-1.5 rounded-xl bg-pink-400/20 border border-pink-300/35 text-pink-200">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight kpi-num-glow">
                {formatNumberByLanguage(metrics.callbackCases.length, language)}
              </span>
              <span className="text-xs text-rose-200 font-semibold">
                ({metrics.pendingCallbackCount} {language === 'en' ? 'pending' : 'รอติดตาม'})
              </span>
            </div>
            <p className="text-[11px] text-pink-100/75">
              {language === 'en'
                ? 'Auto-screened from survey callback responses'
                : 'คัดกรองอัตโนมัติจากคำตอบในแบบประเมิน'}
            </p>
          </div>
        </div>

        {/* Dynamic Low / Stagnant Scan Alert Banner */}
        <div
          className={`crystal-tile p-3.5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
            metrics.momentumStatus === 'on_track'
              ? 'border-emerald-400/35 text-emerald-100'
              : 'border-amber-400/45 text-amber-100'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {metrics.momentumStatus === 'on_track' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {metrics.momentumStatus === 'stagnant'
                  ? t('satAlertStagnantTitle')
                  : metrics.momentumStatus === 'low'
                  ? t('satAlertLowTitle')
                  : t('satPaceOnTrack')}
              </p>
              <p className="text-[11px] opacity-85 mt-0.5">{t('satAlertHint')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPostOpOpen(true)}
            className="crystal-btn inline-flex items-center justify-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{t('satPostOpShortcutBtn')}</span>
          </button>
        </div>

        {/* Quick Toolbar (Crystal Embossed Touch Targets) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSyncingSheet}
            onClick={() => void handlePullFromSheet()}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
            <span>{t('satSyncSheetBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPasteError(null);
              setIsPasteModalOpen(true);
            }}
            className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl border border-cyan-400/40 text-cyan-100 text-xs font-semibold cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-cyan-300" />
            <span>{t('satPasteCsvBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddEntryOpen(true)}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('satAddEntryBtn').replace(/^\+\s*/, '')}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenExecReport}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 text-slate-950 text-xs font-bold cursor-pointer ml-auto"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('satExecReportBtn')}</span>
          </button>
        </div>

        {pasteToast && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/45 text-xs text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pasteToast}</span>
          </div>
        )}

        {sheetNotice && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              sheetNotice.ok
                ? 'bg-emerald-950/45 border-emerald-500/45 text-emerald-100'
                : 'bg-amber-950/45 border-amber-500/45 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {sheetNotice.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{sheetNotice.text}</span>
            </div>
            {sheetNotice.showPasteCta && (
              <button
                type="button"
                onClick={() => {
                  setPasteError(null);
                  setIsPasteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{t('satOpenPasteFallbackBtn')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Live Charts Row */}
      {satisfactionResponses.length === 0 ? (
        <div className={`${glassSurface} rounded-2xl p-8 text-center space-y-3 border border-dashed border-white/15`}>
          <QrCode className="w-10 h-10 text-violet-300 mx-auto opacity-80" />
          <p className="text-xs text-slate-300 max-w-xl mx-auto leading-relaxed">
            {t('satNoResponsesYet')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Chart 1: 5-Aspect Bar Chart + At-a-Glance Score Strip */}
          <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-6 flex flex-col justify-between gap-3`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                {t('satChartDimensionsTitle')}
              </h3>
              <span className="text-xs font-bold text-cyan-300 tabular-nums">
                ★ {metrics.overallAverage.toFixed(2)} / 5.00
              </span>
            </div>
            <div className="relative h-[225px] w-full">
              <Bar data={dimensionBarData} options={dimensionBarOptions} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
              {metrics.dimensionAverages.map((dim, idx) => {
                const accentColors = [
                  'text-teal-300',
                  'text-pink-300',
                  'text-emerald-300',
                  'text-amber-300',
                  'text-violet-300'
                ];
                return (
                  <div
                    key={dim.key}
                    className="crystal-tile rounded-xl px-2.5 py-2 text-center min-w-0 flex flex-col justify-between"
                  >
                    <p className="text-[10px] text-slate-300/90 line-clamp-2 leading-tight break-words">
                      {language === 'en' ? dim.labelEn : dim.labelTh}
                    </p>
                    <p className={`text-xs font-bold tabular-nums mt-1 ${accentColors[idx % accentColors.length]}`}>
                      {dim.average.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Service Breakdown Doughnut */}
          <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-6 flex flex-col justify-between`}>
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              {t('satChartServicesTitle')}
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-5 my-auto">
              <div className="relative w-44 h-44 shrink-0">
                <Doughnut data={serviceDoughnutData} options={serviceDoughnutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-slate-400">{t('satRespondentsTotal')}</span>
                  <span className="text-2xl font-bold text-white tabular-nums kpi-num-glow">
                    {formatNumberByLanguage(metrics.totalCount, language)}
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2 text-xs">
                {metrics.serviceBreakdown.map((svc, idx) => {
                  const dotColors = [
                    'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]',
                    'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.6)]',
                    'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]',
                    'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]',
                    'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]',
                    'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]'
                  ];
                  return (
                    <div
                      key={svc.serviceType}
                      className="crystal-tile flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            dotColors[idx % dotColors.length]
                          }`}
                        />
                        <span className="text-slate-100 font-medium truncate">
                          {language === 'en' ? svc.labelEn : svc.labelTh}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                        <span className="text-slate-400 text-[11px]">{svc.count}</span>
                        <span className="text-white font-semibold w-9 text-right">
                          {svc.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart 3: Live Scan & Score Trend + Recent Activity Stream */}
          <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-7 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">{t('satChartTrendTitle')}</h3>
              <div className="crystal-tile flex items-center gap-1 p-1 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setTrendMode('monthly')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${
                    trendMode === 'monthly'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {language === 'en' ? 'Monthly (6M)' : 'รายเดือน (6 เดือน)'}
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode('daily')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${
                    trendMode === 'daily'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {language === 'en' ? 'Daily (14D)' : 'รายวัน (14 วัน)'}
                </button>
              </div>
            </div>
            <div className="relative h-[225px] w-full">
              <Line data={trendLineData} options={trendLineOptions} />
            </div>
          </div>

          <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-5 flex flex-col justify-between space-y-3`}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-slate-100">{t('recentModuleActivityTitle')}</h3>
            </div>
            <div className="space-y-2">
              {satisfactionResponses.slice(0, 5).map((resp) => (
                <div
                  key={resp.id}
                  className="glass-subcard flex items-start gap-2.5 p-2.5 rounded-xl text-xs"
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      resp.wantsCallback ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-100 font-medium truncate">
                      {getProcedureLabel(resp.serviceType, language)} · ★ {resp.scores.overallExperience}/5
                    </p>
                    <p className="text-[11px] text-slate-300/80 truncate">
                      {resp.comment || resp.submittedAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Screening, Strengths & Improvements + Callback Queue */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: AI Screening + Strengths & Improvements */}
        <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-5 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-300" />
              <span>{t('satSubmenuAnalytics')}</span>
            </h3>
            <button
              type="button"
              disabled={isAnalyzing || satisfactionResponses.length === 0}
              onClick={() => void handleRunAiAnalysis()}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isAnalyzing ? t('satAiAnalyzingBtn') : t('satAiAnalyzeBtn')}</span>
            </button>
          </div>

          {aiError && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-100 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-amber-300 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-amber-900/50 transition-colors cursor-pointer"
                title="ปิดการแจ้งเตือน"
              >
                ✕
              </button>
            </div>
          )}

          {aiResult?.summaryOverview && (
            <div className="crystal-tile p-3.5 rounded-xl border border-violet-400/30 text-xs text-slate-100 leading-relaxed">
              <div className="flex items-center justify-between text-[10px] text-violet-300 mb-1">
                <span>AI Summary</span>
                <span className="font-mono">{aiResult.model}</span>
              </div>
              {aiResult.summaryOverview}
            </div>
          )}

          <div className="space-y-3">
            <div className="crystal-tile p-3.5 rounded-xl border border-emerald-400/30 space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{t('satStrengthsTitle')}</span>
              </h4>
              {displayedStrengths.length === 0 ? (
                <p className="text-[11px] text-slate-400">{t('satNoResponsesYet')}</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-slate-200 list-disc list-inside">
                  {displayedStrengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="crystal-tile p-3.5 rounded-xl border border-amber-400/30 space-y-2">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>{t('satImprovementsTitle')}</span>
              </h4>
              {displayedImprovements.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  {language === 'en'
                    ? 'All 5 dimensions currently score 4.70+.'
                    : 'ทั้ง 5 ด้านได้คะแนนเฉลี่ยสูงกว่า 4.70 อยู่ในเกณฑ์ดีมาก'}
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs text-slate-200 list-disc list-inside">
                  {displayedImprovements.map((im, idx) => (
                    <li key={idx}>{im}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right: Callback Requests Triage Queue */}
        <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-7 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-slate-100">
                {t('satCallbackQueueTitle')} ({metrics.callbackCases.length})
              </h3>
            </div>
            {metrics.pendingCallbackCount > 0 && (
              <button
                type="button"
                onClick={handleCreateAllPendingCallbacks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('satCreateAllFollowupsBtn')}</span>
              </button>
            )}
          </div>

          {followupNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {followupNotice}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                {t('viewTasksLinkBtn')}
              </button>
            </div>
          )}

          {metrics.callbackCases.length === 0 ? (
            <div className="crystal-tile p-6 rounded-xl border border-dashed border-white/20 text-center text-xs text-slate-300/85">
              {t('satCallbackEmpty')}
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {metrics.callbackCases.map((cb) => {
                const aiRec = aiResult?.callbackRecommendations.find(
                  (r) => r.responseId === cb.id
                );
                return (
                  <div
                    key={cb.id}
                    className="crystal-tile p-4 rounded-xl border border-amber-400/30 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-violet-500/20 border border-violet-400/35 text-violet-200 font-semibold text-[11px]">
                          {getProcedureLabel(cb.serviceType, language)}
                        </span>
                        {cb.patientRef && (
                          <span className="crystal-tile font-mono text-[11px] text-slate-200 px-2 py-0.5 rounded">
                            {cb.patientRef}
                          </span>
                        )}
                        <span className="text-[11px] text-amber-300 font-semibold">
                          ★ {cb.scores.overallExperience}/5
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300">{cb.submittedAt}</span>
                    </div>

                    {cb.callbackTopic && (
                      <p className="text-slate-100 font-medium">{cb.callbackTopic}</p>
                    )}
                    {cb.comment && (
                      <p className="text-slate-200 text-[11px] italic">"{cb.comment}"</p>
                    )}
                    {aiRec && (
                      <div className="p-2.5 rounded-lg bg-violet-500/15 border border-violet-400/30 text-[11px] text-violet-100">
                        <strong className="text-white">{aiRec.suggestedTitle}:</strong>{' '}
                        {aiRec.suggestedAction}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          cb.triageStatus === 'followup_created'
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35'
                            : cb.triageStatus === 'resolved'
                            ? 'crystal-tile text-slate-200 border-white/20'
                            : 'bg-amber-500/20 text-amber-100 border-amber-400/40'
                        }`}
                      >
                        {cb.triageStatus === 'followup_created'
                          ? t('satFollowupCreatedBadge')
                          : cb.triageStatus === 'resolved'
                          ? t('satFollowupResolvedBadge')
                          : language === 'en'
                          ? 'Needs Callback'
                          : 'รอสร้างงานติดตาม'}
                      </span>

                      {cb.triageStatus === 'new' && (
                        <button
                          type="button"
                          onClick={() => handleCreateCallbackTask(cb)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{t('satCreateFollowupBtn')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Imported & Pulled Responses Table */}
      {satisfactionResponses.length > 0 && (
        <div className={`${glassSurface} rounded-2xl p-5 space-y-4 border border-white/10`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-slate-100">
                {t('satTableTitle')} ({satisfactionResponses.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="crystal-tile flex items-center gap-1 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTableFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                    tableFilter === 'all'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('zoneTabAll')} ({satisfactionResponses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('callback')}
                  className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                    tableFilter === 'callback'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {language === 'en' ? 'Callback Requested' : 'ขอติดต่อกลับ'} (
                  {metrics.callbackCases.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder={language === 'en' ? 'Filter comment/service...' : 'ค้นหาบริการ/ความเห็น...'}
                  className="glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs w-48"
                />
              </div>

              {!confirmClearLocal ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearLocal(true)}
                  className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:border-rose-400/45 text-slate-200 hover:text-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('satClearWorkspaceResponsesBtn')}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSatisfactionResponses([]);
                      setAiResult(null);
                      setConfirmClearLocal(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                  >
                    {t('satClearConfirmBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearLocal(false)}
                    className="crystal-tile px-2.5 py-1.5 rounded-xl text-slate-200 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {filteredTableResponses.length === 0 ? (
            <div className="glass-subcard p-6 text-center text-xs text-slate-300 rounded-xl">
              {t('satTableEmpty')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/15">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="glass-table-head text-slate-200 text-[11px] border-b border-white/15">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {t('zoneColPhoto')}
                    </th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {language === 'en' ? 'Date / Time' : 'วันที่ / เวลา'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {language === 'en' ? 'Service' : 'ประเภทบริการ'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {language === 'en' ? '5-Aspect Avg' : 'คะแนนเฉลี่ย (5 ด้าน)'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {language === 'en' ? 'Callback' : 'ติดต่อกลับ'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      {language === 'en' ? 'Comment' : 'ความคิดเห็น'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {language === 'en' ? 'Source' : 'ที่มา'}
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">
                      {t('actionsCol')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredTableResponses.slice(0, 60).map((row) => {
                    const rowAvg =
                      (row.scores.receptionCare +
                        row.scores.treatmentExplanation +
                        row.scores.cleanlinessProfessionalism +
                        row.scores.waitingAndDuration +
                        row.scores.overallExperience) /
                      5;
                    const isConfirmDel = confirmDeleteRowId === row.id;
                    return (
                      <tr key={row.id} className="hover:bg-white/[0.06]">
                        <td className="px-3 py-2.5">
                          <AttachmentCell
                            evidenceId={row.attachmentEvidenceId}
                            itemTitle={`${getProcedureLabel(row.serviceType, language)} (${row.submittedAt})`}
                            contextLabel={t('satisfactionTitle')}
                            onAttached={(evId) => handleAttachSatPhoto(row.id, evId)}
                            onRemoved={() => handleRemoveSatPhoto(row.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-200 whitespace-nowrap">
                          {row.submittedAt}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-violet-500/20 border border-violet-400/35 text-violet-100 text-[11px]">
                            {getProcedureLabel(row.serviceType, language)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-300 tabular-nums">
                              ★ {rowAvg.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-300/80 font-mono">
                              ({row.scores.receptionCare}/{row.scores.treatmentExplanation}/
                              {row.scores.cleanlinessProfessionalism}/{row.scores.waitingAndDuration}/
                              {row.scores.overallExperience})
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {row.wantsCallback ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-100 text-[10px] font-semibold">
                                {language === 'en' ? 'Yes' : 'ต้องการ'}
                              </span>
                              {row.triageStatus === 'new' && (
                                <button
                                  type="button"
                                  onClick={() => handleCreateCallbackTask(row)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                                >
                                  + {t('satCreateFollowupBtn')}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-slate-100 max-w-xs break-words [overflow-wrap:anywhere] whitespace-normal"
                          title={row.comment || ''}
                        >
                          {row.comment || '-'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-300/80">
                          {row.source === 'sheet_sync'
                            ? language === 'en'
                              ? 'Sheet (Read-Only)'
                              : 'ชีต (Read-Only)'
                            : row.source === 'post_op_link'
                            ? 'Post-Op Link'
                            : 'QR / Manual'}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingResponse({ ...row, scores: { ...row.scores } })}
                              className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                              title={t('editBtn')}
                              aria-label={t('editBtn')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLocalResponse(row.id)}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Strict Read-Only Sheet Source & Protection Card */}
      <div className={`${glassSurface} rounded-2xl p-5 border border-emerald-500/35 space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('satRawAppendCardTitle')}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-200 text-[10px] font-semibold">
                  <Lock className="w-3 h-3" />
                  {t('satReadOnlyBadge')}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-1">
                {t('satRawAppendGuardrail')}
              </p>
            </div>
          </div>
        </div>

        <div className="crystal-tile p-3.5 rounded-xl text-[11px] text-slate-200 space-y-2.5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-slate-200 font-semibold">
              {language === 'en'
                ? 'Google Sheet URL (Read-Only Source)'
                : 'ลิงก์ Google Sheet แบบประเมิน (อ่านอย่างเดียว / บันทึกถาวรในเครื่อง)'}
            </label>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {language === 'en'
                  ? `Saved in browser (${satisfactionResponses.length} rows)`
                  : `บันทึกถาวรในเครื่องแล้ว (${satisfactionResponses.length} รายการ)`}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-violet-300 hover:text-white underline cursor-pointer"
              >
                {language === 'en' ? 'Open Settings' : 'ตั้งค่าทั้งหมด'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={sheetUrlInput}
              onChange={(e) => setSheetUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="glass-input flex-1 min-w-0 rounded-xl px-3.5 py-2 font-mono text-xs text-cyan-200"
            />
            <button
              type="button"
              onClick={() => {
                const nextCfg = {
                  ...effectiveSheetConfig,
                  satisfactionSheetUrl: sheetUrlInput.trim(),
                  satisfactionRawTabName: rawTabInput.trim() || 'การตอบแบบฟอร์ม 1'
                };
                updateSheetConfig(nextCfg);
                if (!isPersonal) {
                  saveSheetConfig(nextCfg);
                }
                setSheetNotice({
                  ok: true,
                  text:
                    language === 'en'
                      ? 'Saved Read-Only Sheet URL to browser storage.'
                      : 'บันทึกลิงก์ชีตลงเบราว์เซอร์ถาวรแล้ว — กด "ดึงข้อมูลจากชีต (อ่านอย่างเดียว)" ได้เลย'
                });
              }}
              className="crystal-btn px-3.5 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 border border-violet-300/35 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              {language === 'en' ? 'Save Link' : 'บันทึกลิงก์'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs">
          <div className="md:col-span-5 space-y-1">
            <label className="text-slate-200 font-medium block">{t('satRawTabLabel')}</label>
            <input
              type="text"
              value={rawTabInput}
              onChange={(e) => setRawTabInput(e.target.value)}
              placeholder="การตอบแบบฟอร์ม 1"
              className={`glass-input w-full rounded-xl px-3.5 py-2 font-mono ${
                tabValidation.ok
                  ? 'border-emerald-400/45 focus:border-emerald-300'
                  : 'border-rose-400 focus:border-rose-300'
              }`}
            />
          </div>

          <div className="md:col-span-7 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!tabValidation.ok || isSyncingSheet}
              onClick={() => void handlePullFromSheet()}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{t('satSyncSheetBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPasteError(null);
                setIsPasteModalOpen(true);
              }}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{t('satPasteCsvBtn')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenExecReport}
              className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/20 text-slate-100 text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>{t('satExecReportDownloadXlsxBtn')}</span>
            </button>
          </div>
        </div>

        {!tabValidation.ok && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/45 text-xs text-rose-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
            <span>{tabValidation.error}</span>
          </div>
        )}
      </div>

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={onOpenNewTaskModal ? t('quickBarNewTask') : t('satAddEntryBtn')}
        onPrimaryAction={onOpenNewTaskModal || (() => setIsAddEntryOpen(true))}
      />

      {/* Modals */}
      <PostOpSurveyModal
        isOpen={isPostOpOpen}
        onClose={() => setIsPostOpOpen(false)}
      />

      {/* Quick Entry Modal */}
      {isAddEntryOpen &&
        createPortal(
          <div
            onClick={() => setIsAddEntryOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAddEntrySubmit}
              className="glass-modal border-violet-400/35 rounded-2xl max-w-xl w-full p-4 sm:p-5 space-y-4 text-xs shadow-2xl max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsAddEntryOpen(false)}
                    className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-violet-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <span aria-hidden="true">↩️</span>
                    <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
                  </button>
                  <h3 className="text-sm font-bold text-slate-100 break-words">{t('satAddEntryBtn')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddEntryOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-200 font-medium block">
                    {t('satSelectProcedureLabel')}
                  </label>
                  <select
                    value={entryProcedure}
                    onChange={(e) => setEntryProcedure(e.target.value as SatisfactionProcedureType)}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    {PROCEDURE_CATALOG.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t(p.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-200 font-medium block">
                    {language === 'en' ? 'Case / Queue Ref (Optional)' : 'รหัสคิว / เคส (ไม่บังคับ)'}
                  </label>
                  <input
                    type="text"
                    value={entryPatientRef}
                    onChange={(e) => setEntryPatientRef(e.target.value)}
                    placeholder="PT-104 / Q08"
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {dimLabels.map((dim) => (
                  <div
                    key={dim.key}
                    className="glass-subcard flex items-center justify-between gap-2 p-2.5 rounded-xl"
                  >
                    <span className="text-slate-100">{dim.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setEntryScores((prev) => ({ ...prev, [dim.key]: val }))
                          }
                          className={`w-7 h-7 rounded-lg font-bold cursor-pointer ${
                            entryScores[dim.key] === val
                              ? 'bg-violet-600 text-white'
                              : 'crystal-tile text-slate-300 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 space-y-2">
                <label className="flex items-center gap-2 text-amber-100 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryWantsCallback}
                    onChange={(e) => setEntryWantsCallback(e.target.checked)}
                  />
                  <span>
                    {language === 'en'
                      ? 'Patient marked "Request Clinic Callback"'
                      : 'คนไข้เลือก "ต้องการให้คลินิกติดต่อกลับ"'}
                  </span>
                </label>
                {entryWantsCallback && (
                  <input
                    type="text"
                    value={entryCallbackTopic}
                    onChange={(e) => setEntryCallbackTopic(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Callback reason / note...'
                        : 'ระบุเรื่องที่ต้องการให้ติดต่อกลับ...'
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-slate-200 font-medium block">
                  {language === 'en' ? 'Patient Comment' : 'ความคิดเห็นเพิ่มเติม'}
                </label>
                <textarea
                  rows={2}
                  value={entryComment}
                  onChange={(e) => setEntryComment(e.target.value)}
                  className="glass-input w-full rounded-xl p-3"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <select
                  value={entrySource}
                  onChange={(e) =>
                    setEntrySource(
                      e.target.value as 'qr_scan' | 'post_op_link' | 'manual_entry'
                    )
                  }
                  className="glass-input rounded-xl px-3 py-2"
                >
                  <option value="qr_scan">QR Scan</option>
                  <option value="post_op_link">Post-Op Link</option>
                  <option value="manual_entry">Manual Entry</option>
                </select>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Local Edit Satisfaction Response Modal */}
      {editingResponse &&
        createPortal(
          <div
            onClick={() => setEditingResponse(null)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditResponse}
              className="glass-modal rounded-2xl max-w-lg w-full p-5 space-y-4 text-xs my-auto"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingResponse.submittedAt}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingResponse(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('satSelectProcedureLabel')}</label>
                  <select
                    value={editingResponse.serviceType}
                    onChange={(e) =>
                      setEditingResponse({
                        ...editingResponse,
                        serviceType: e.target.value as SatisfactionProcedureType
                      })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    {PROCEDURE_CATALOG.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t(p.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">
                    {language === 'en' ? 'Case / Queue Ref' : 'รหัสคิว / เคส'}
                  </label>
                  <input
                    type="text"
                    value={editingResponse.patientRef || ''}
                    onChange={(e) =>
                      setEditingResponse({ ...editingResponse, patientRef: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {dimLabels.map((dim) => (
                  <div
                    key={dim.key}
                    className="glass-subcard flex items-center justify-between gap-2 p-2.5 rounded-xl"
                  >
                    <span className="text-slate-100">{dim.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setEditingResponse({
                              ...editingResponse,
                              scores: { ...editingResponse.scores, [dim.key]: val }
                            })
                          }
                          className={`w-7 h-7 rounded-lg font-bold cursor-pointer ${
                            editingResponse.scores[dim.key] === val
                              ? 'bg-violet-600 text-white'
                              : 'crystal-tile text-slate-300 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  {language === 'en' ? 'Comment' : 'ความคิดเห็น'}
                </label>
                <textarea
                  rows={2}
                  value={editingResponse.comment || ''}
                  onChange={(e) =>
                    setEditingResponse({ ...editingResponse, comment: e.target.value })
                  }
                  className="glass-input w-full rounded-xl p-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingResponse(null)}
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

      {/* Paste Sheet/Form Rows Modal */}
      {isPasteModalOpen &&
        createPortal(
          <div
            onClick={() => setIsPasteModalOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handlePasteImportSubmit}
              className="glass-modal border-cyan-400/35 rounded-2xl max-w-2xl w-full p-4 sm:p-5 space-y-4 text-xs shadow-2xl max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-cyan-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <span aria-hidden="true">↩️</span>
                    <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
                  </button>
                  <h3 className="text-sm font-bold text-slate-100 break-words">{t('satPasteCsvBtn')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-200 leading-relaxed">
                {language === 'en'
                  ? 'Copy & paste rows from "การตอบแบบฟอร์ม 1" in Google Sheets, or select an exported .csv / .tsv file from your device. Data is stored only in this browser — zero impact on the source sheet.'
                  : 'ก๊อปปี้แถวข้อมูลจากแท็บ "การตอบแบบฟอร์ม 1" หรือไฟล์สรุปชีตมาวาง หรือกดเลือกไฟล์ .csv / .tsv จากเครื่องเพื่อนำเข้าทันที ข้อมูลจะถูกบันทึกถาวรในเบราว์เซอร์โดยไม่กระทบไฟล์ชีตต้นฉบับ 100%'}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 crystal-tile px-3 py-2.5 rounded-xl">
                <span className="text-[11px] text-slate-200">
                  {language === 'en'
                    ? 'Have a CSV/TSV file downloaded from Google Sheets?'
                    : 'มีไฟล์ .csv / .tsv ที่ดาวน์โหลดมาจาก Google Sheets?'}
                </span>
                <label className="crystal-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 border border-violet-300/35 text-white text-[11px] font-semibold cursor-pointer">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Choose .csv / .tsv' : 'เลือกไฟล์ .csv / .tsv'}</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                    onChange={(e) => void handleCsvFileUpload(e)}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={7}
                required
                value={pasteRawText}
                onChange={(e) => {
                  setPasteRawText(e.target.value);
                  if (pasteError) setPasteError(null);
                }}
                placeholder={`ประทับเวลา\tประเภทบริการ\tการต้อนรับและความใส่ใจ\tความชัดเจนในการอธิบาย\tความสะอาดและมืออาชีพ\tระยะเวลารับบริการ\tประสบการณ์โดยรวม\tต้องการให้คลินิกติดต่อกลับ\tความคิดเห็น\n22/11/2026 10:30\tขูดหินปูน\t5\t5\t5\t4\t5\tไม่ต้องการ\tสะอาดมาก\n22/11/2026 11:15\tผ่าฟันคุด\t5\t5\t5\t5\t5\tต้องการให้ติดต่อกลับ\tสอบถามเรื่องวันตัดไหมค่ะ`}
                className="glass-input w-full rounded-xl p-3 font-mono text-[11px]"
              />
              {pasteError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/45 text-rose-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <span>{pasteError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
                >
                  {language === 'en' ? 'Import to Dashboard' : 'นำเข้าแสดงผลและบันทึกถาวร'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Executive Report Modal */}
      {isExecReportOpen &&
        createPortal(
          <div
            onClick={() => setIsExecReportOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal border-amber-400/40 rounded-2xl max-w-3xl w-full p-4 sm:p-5 space-y-4 text-xs shadow-2xl max-h-[90dvh] flex flex-col my-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsExecReportOpen(false)}
                    className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-amber-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <span aria-hidden="true">↩️</span>
                    <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
                  </button>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 min-w-0 break-words">
                    <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="break-words">{t('satExecReportTitle')}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExecReportOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={14}
                value={execReportText}
                onChange={(e) => setExecReportText(e.target.value)}
                className="glass-input flex-1 w-full rounded-xl p-3.5 text-xs leading-relaxed font-mono"
              />

              {savedExecToast && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    {t('satExecReportSavedToast')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExecReportOpen(false);
                      setActiveTab('evidence');
                    }}
                    className="underline font-semibold cursor-pointer shrink-0"
                  >
                    {t('evidence')}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    exportSatisfactionExcelWorkbook({
                      responses: satisfactionResponses,
                      metrics,
                      rawTabName: rawTabInput.trim() || 'Raw_Responses',
                      reportText: execReportText
                    })
                  }
                  className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-100 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{t('satExecReportDownloadXlsxBtn')}</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveExecToWorkspace()}
                    className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t('satExecReportSaveBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyExecReport()}
                    className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold cursor-pointer"
                  >
                    {copiedExec ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedExec ? t('copiedText') : t('satExecReportCopyBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
