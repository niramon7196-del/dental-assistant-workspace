import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  FlaskConical,
  ArrowRight,
  PhoneCall,
  MessageSquareHeart,
  Megaphone,
  MonitorPlay,
  Target,
  Plus,
  Trash2,
  PackageCheck,
  Clock,
  Activity,
  QrCode,
  AlertTriangle,
  FileText,
  Layers,
  Download,
  Upload,
  CheckCircle2,
  Sparkles,
  Languages,
  LayoutGrid
} from 'lucide-react';
import { TaskItem, LabOrder, PatientFollowUpItem, InboxItem, ActiveTab } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  translateCategory,
  translateLabWorkType
} from '../utils/i18n';
import {
  resolveLocalizedFollowUp,
  resolveLocalizedLab,
  resolveLocalizedTask
} from '../data/initialData';
import { computeSatisfactionMetrics, formatMonthLabel } from '../services/satisfactionService';
import { DashboardCharts } from './DashboardCharts';
import { ZoneDataTable } from './ZoneDataTable';
import { PostOpSurveyModal } from './PostOpSurveyModal';

interface OverviewProps {
  tasks: TaskItem[];
  labOrders: LabOrder[];
  followUps: PatientFollowUpItem[];
  inboxItems: InboxItem[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onOpenChairsideCopilot?: () => void;
  onOpenCustomBuilder?: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
  tasks,
  labOrders,
  followUps,
  inboxItems,
  setActiveTab,
  onOpenNewTaskModal,
  onOpenChairsideCopilot,
  onOpenCustomBuilder
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    privateNotes,
    queueItems,
    dentureCases,
    evidenceList,
    auditLogs,
    dailyGoals,
    addDailyGoal,
    toggleDailyGoal,
    deleteDailyGoal,
    setIsTvDisplayOpen,
    satisfactionResponses,
    satisfactionSettings,
    liveBoards,
    isJudgeDemoActive,
    toggleJudgeDemoMode,
    exportActiveWorkspaceBackup,
    importActiveWorkspaceBackup
  } = useWorkspace();
  const [goalInput, setGoalInput] = useState('');
  const [isPostOpSurveyOpen, setIsPostOpSurveyOpen] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const isClinic = activeWorkspace.type === 'clinic';
  const isPersonal = !isClinic;
  const showLabsWidget = isJudgeDemoActive || activeWorkspace.enabledModules.labs !== false;
  const showFollowUpsWidget = isJudgeDemoActive || activeWorkspace.enabledModules.followups !== false;
  const showQueueWidget = isJudgeDemoActive || activeWorkspace.enabledModules.queue !== false;
  const showChatCopilotBtn = isJudgeDemoActive || activeWorkspace.enabledModules.chat_copilot !== false;
  const showSatisfactionWidget = isJudgeDemoActive || activeWorkspace.enabledModules.satisfaction !== false;
  const showLiveWorkspacesWidget = isJudgeDemoActive || activeWorkspace.enabledModules.live_workspaces !== false;
  const liveBoardsTotalItems = liveBoards.reduce((sum, b) => sum + b.records.length, 0);

  const satMetrics = useMemo(
    () => computeSatisfactionMetrics(satisfactionResponses, satisfactionSettings.monthlyGoal),
    [satisfactionResponses, satisfactionSettings.monthlyGoal]
  );

  const glassSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const localizedTasks = useMemo(
    () => tasks.map((item) => resolveLocalizedTask(item, language)),
    [tasks, language]
  );
  const localizedLabs = useMemo(
    () => (showLabsWidget ? labOrders.map((lab) => resolveLocalizedLab(lab, language)) : []),
    [showLabsWidget, labOrders, language]
  );
  const localizedFollowUps = useMemo(
    () =>
      showFollowUpsWidget ? followUps.map((fu) => resolveLocalizedFollowUp(fu, language)) : [],
    [showFollowUpsWidget, followUps, language]
  );

  const tasksDueToday = localizedTasks.filter(
    (item) => item.dueDate === today && item.status !== 'Completed' && item.status !== 'Cancelled'
  );
  const newIncomingInstructions = inboxItems.filter((i) => i.status === 'Unprocessed');

  const waitingQueue = queueItems.filter((q) => q.status === 'waiting');
  const calledQueue = queueItems.filter((q) => q.status === 'called');
  const completedQueue = queueItems.filter((q) => q.status === 'completed');

  const activeLabs = localizedLabs.filter(
    (l) => l.status !== 'Delivered' && l.status !== 'Quality Checked' && l.status !== 'Cancelled'
  );
  const completedLabs = localizedLabs.filter(
    (l) => l.status === 'Delivered' || l.status === 'Quality Checked'
  );

  const upcomingFollowUps = localizedFollowUps.filter(
    (f) => f.status === 'Pending' || f.status === 'Scheduled'
  );
  const completedFollowUps = localizedFollowUps.filter((f) => f.status === 'Completed');
  const pendingDentureCallCount =
    isJudgeDemoActive || activeWorkspace.enabledModules.denture !== false
      ? dentureCases.filter((c) => c.status === 'ยังไม่ได้โทร').length
      : 0;

  const stockCheckTasks = localizedTasks.filter(
    (item) =>
      (item.taskKind === 'check' ||
        item.category === 'Inventory & Supplies' ||
        item.category === 'Sterilization & Prep') &&
      item.status !== 'Completed' &&
      item.status !== 'Cancelled'
  );

  // Zone KPI Totals
  const kpiQueueTasksCount =
    (showQueueWidget ? waitingQueue.length + calledQueue.length : 0) + tasksDueToday.length;
  const kpiLabsOrInboxCount = isClinic ? activeLabs.length : newIncomingInstructions.length;
  const kpiFollowUpDentureCount = isClinic
    ? upcomingFollowUps.length + pendingDentureCallCount
    : dailyGoals.filter((g) => !g.completed).length;
  const kpiStockEvidenceCount = stockCheckTasks.length + evidenceList.length;

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    addDailyGoal(goalInput.trim());
    setGoalInput('');
  };

  const handleExportOverviewBackup = () => {
    const json = exportActiveWorkspaceBackup();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-backup-${activeWorkspace.tenantCode.toLowerCase()}-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice({ ok: true, text: t('backupDownloadedMsg') });
    setTimeout(() => setBackupNotice(null), 3500);
  };

  const handleImportOverviewBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = importActiveWorkspaceBackup(text);
      if (res.ok) {
        setBackupNotice({
          ok: true,
          text: t('importBackupSuccessMsg').replace(
            '{count}',
            formatNumberByLanguage(res.importedCount, language)
          )
        });
      } else {
        setBackupNotice({ ok: false, text: res.error || t('importBackupErrorMsg') });
      }
    } catch {
      setBackupNotice({ ok: false, text: t('importBackupErrorMsg') });
    }
    setTimeout(() => setBackupNotice(null), 4500);
  };

  // Real-time Recent Activity stream combining Audit Logs + Tasks + Labs + Evidence
  const recentActivities = useMemo(() => {
    const fromAudit = auditLogs.slice(0, 4).map((entry) => ({
      id: `audit-${entry.id}`,
      title: entry.summary,
      category: entry.actorName,
      time: entry.timestamp,
      dotClass: 'bg-cyan-400'
    }));

    const fromTasks = localizedTasks.slice(0, 3).map((item) => ({
      id: `tk-${item.id}`,
      title: item.title,
      category: item.customCategory || translateCategory(item.category, language),
      time: formatDateByLanguage(item.createdDate, language),
      dotClass: 'bg-violet-400'
    }));

    const fromLabs = showLabsWidget
      ? localizedLabs.slice(0, 2).map((l) => ({
          id: `lb-${l.id}`,
          title: t('labOrderSummaryTitle')
            .replace('{workType}', translateLabWorkType(l.workType, language))
            .replace('{ref}', l.orderReference)
            .replace('{lab}', l.laboratoryName),
          category: t('labTracker'),
          time: formatDateByLanguage(l.dateSent, language),
          dotClass: 'bg-emerald-400'
        }))
      : [];

    return [...fromAudit, ...fromTasks, ...fromLabs].slice(0, 6);
  }, [auditLogs, localizedTasks, localizedLabs, showLabsWidget, language, t]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-24 space-y-5 max-w-7xl mx-auto">
      {/* Judge Demo Mode Switcher Bar */}
      <div className={`${glassSurface} rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/45 flex items-center justify-center text-amber-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>เปิดข้อมูลสาธิตสำหรับกรรมการ (Judge Demo Mode)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/40 font-mono">
                Mock State Only
              </span>
            </h3>
            <p className="text-[11px] text-slate-300">
              จำลองข้อมูลชั่วคราวครบทุกโมดูล (คิวตรวจ, เอไอข้างเก้าอี้, งานแล็บ, นัดติดตาม, ผลประเมิน, สต๊อก และกราฟ) ไม่ทับข้อมูลจริงหรือ Google Sheet
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenChairsideCopilot && (
            <button
              type="button"
              onClick={onOpenChairsideCopilot}
              className="crystal-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-xs font-bold cursor-pointer"
            >
              <Languages className="w-4 h-4 shrink-0" />
              <span>{t('chairsideCopilotBtn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleJudgeDemoMode}
            className={`crystal-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              isJudgeDemoActive
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                : 'crystal-tile bg-white/10 text-slate-200 hover:text-white border-white/20'
            }`}
          >
            <div className={`w-3 h-3 rounded-full ${isJudgeDemoActive ? 'bg-slate-950 animate-pulse' : 'bg-slate-400'}`} />
            <span>
              {isJudgeDemoActive ? t('judgeDemoExitHeaderBtn') : t('judgeDemoHeaderBtn')}
            </span>
          </button>
        </div>
      </div>

      {/* Lightweight Isolated 5 Core Modules Bar (iPad-Friendly: loads only active module) */}
      <div className={`${glassSurface} rounded-2xl p-3.5 border border-cyan-300/25 space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-cyan-100 uppercase tracking-wider">
            {language === 'en'
              ? '5 Lightweight Isolated Modules (Active-Only Loading)'
              : '5 โมดูลหลักแยกอิสระ (โหลดเฉพาะหน้างานที่เปิด — เบาเครื่อง iPad)'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className="crystal-tile px-3 py-2.5 rounded-xl text-left flex items-center gap-2 hover:border-emerald-300/50 transition-colors cursor-pointer"
          >
            <Megaphone className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {language === 'en' ? '1. Queue & TV' : '1. จอเรียกคิว'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenChairsideCopilot?.()}
            className="crystal-tile px-3 py-2.5 rounded-xl text-left flex items-center gap-2 hover:border-cyan-300/50 transition-colors cursor-pointer"
          >
            <Languages className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {language === 'en' ? '2. Chairside AI' : '2. เอไอข้างเก้าอี้'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat_copilot')}
            className="crystal-tile px-3 py-2.5 rounded-xl text-left flex items-center gap-2 hover:border-pink-300/50 transition-colors cursor-pointer"
          >
            <MessageSquareHeart className="w-4 h-4 text-pink-300 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {language === 'en' ? '3. Page / LINE Chat' : '3. แชทเพจ / ไลน์'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            className="crystal-tile px-3 py-2.5 rounded-xl text-left flex items-center gap-2 hover:border-amber-300/50 transition-colors cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {language === 'en' ? '4. Voice Follow-up' : '4. โทรติดตามในตัว'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenCustomBuilder?.()}
            className="crystal-tile px-3 py-2.5 rounded-xl text-left flex items-center gap-2 hover:border-violet-300/50 transition-colors cursor-pointer col-span-2 sm:col-span-1"
          >
            <LayoutGrid className="w-4 h-4 text-violet-300 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {language === 'en' ? '5. Custom Builder' : '5. สร้างงาน/หมวดใหม่'}
            </span>
          </button>
        </div>
      </div>

      {/* Row 1: 4 Gradient Zone KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 (Purple): Queue & Today Tasks */}
        <button
          type="button"
          onClick={() => setActiveTab(showQueueWidget ? 'queue' : 'tasks')}
          className="kpi-glow-purple rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-violet-100/90 leading-snug">
              {t('kpiQueueTasksTitle')}
            </span>
            <div className="p-2 rounded-xl bg-violet-400/20 text-violet-200 border border-violet-300/35 shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent tabular-nums tracking-tight kpi-num-glow">
              {formatNumberByLanguage(kpiQueueTasksCount, language)}
            </span>
            <span className="text-[11px] font-medium text-violet-200/90 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {t('kpiQueueTasksSub')}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 2 (Cyan-Green): Active Dental Labs (or Unprocessed AI Inbox in Personal Space) */}
        <button
          type="button"
          onClick={() => setActiveTab(isClinic ? 'labs' : 'inbox')}
          className="kpi-glow-cyan rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-cyan-100/90 leading-snug">
              {isClinic ? t('kpiLabsActiveTitle') : t('newIncomingInstructions')}
            </span>
            <div className="p-2 rounded-xl bg-cyan-400/20 text-cyan-200 border border-cyan-300/35 shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-cyan-200 via-teal-200 to-sky-100 bg-clip-text text-transparent tabular-nums tracking-tight kpi-num-glow">
              {formatNumberByLanguage(kpiLabsOrInboxCount, language)}
            </span>
            <span className="text-[11px] font-medium text-cyan-200/90 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {isClinic ? t('kpiLabsActiveSub') : t('openAiInbox')}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 3 (Orange-Amber): Follow-ups / Denture Recall */}
        <button
          type="button"
          onClick={() => setActiveTab(isClinic ? 'denture' : 'tasks')}
          className="kpi-glow-amber rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-amber-100/90 leading-snug">
              {isClinic ? t('kpiFollowUpDentureTitle') : t('personalGoalsTitle')}
            </span>
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-300/35 shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-orange-200 to-pink-200 bg-clip-text text-transparent tabular-nums tracking-tight kpi-num-glow">
              {formatNumberByLanguage(kpiFollowUpDentureCount, language)}
            </span>
            <span className="text-[11px] font-medium text-amber-200/90 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {isClinic ? t('kpiFollowUpDentureSub') : t('viewAll')}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 4 (Pink-Red): Stock Check & Work Evidence */}
        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className="kpi-glow-rose rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-rose-100/90 leading-snug">
              {t('kpiStockEvidenceTitle')}
            </span>
            <div className="p-2 rounded-xl bg-rose-400/20 text-rose-200 border border-rose-300/35 shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-pink-200 via-rose-200 to-violet-200 bg-clip-text text-transparent tabular-nums tracking-tight kpi-num-glow">
              {formatNumberByLanguage(kpiStockEvidenceCount, language)}
            </span>
            <span className="text-[11px] font-medium text-rose-200/90 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {t('kpiStockEvidenceSub')}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* Row 1.5: Monthly QR Scan Pulse & Post-Op Survey Outreach */}
      {showSatisfactionWidget && (
        <div className={`${glassSurface} rounded-2xl p-4 sm:p-5 border border-cyan-400/30 space-y-3`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-11 h-11 rounded-2xl crystal-tile bg-gradient-to-br from-teal-500/25 via-purple-500/25 to-pink-500/25 border border-cyan-400/40 flex items-center justify-center text-cyan-200 shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100">{t('satMonthlyScanTitle')}</h3>
                  <span className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-purple-200 to-pink-300 bg-clip-text text-transparent tabular-nums kpi-num-glow">
                    {formatNumberByLanguage(satMetrics.thisMonthCount, language)}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    / {formatNumberByLanguage(satMetrics.monthlyGoal, language)} ({satMetrics.goalProgressPct}%)
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      satMetrics.monthDelta >= 0
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    }`}
                  >
                    {t('satPrevMonthLabel')} ({formatMonthLabel(satMetrics.prevMonthKey, language)}):{' '}
                    {satMetrics.prevMonthCount} ({satMetrics.monthDelta >= 0 ? '+' : ''}
                    {satMetrics.monthDelta})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {satMetrics.momentumStatus === 'on_track' ? (
                    <span className="text-emerald-300 font-medium">{t('satPaceOnTrack')}</span>
                  ) : (
                    <span className="text-amber-300 font-medium inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {satMetrics.momentumStatus === 'stagnant'
                        ? t('satAlertStagnantTitle')
                        : t('satAlertLowTitle')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPostOpSurveyOpen(true)}
                className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{t('satPostOpShortcutShort')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('satisfaction')}
                className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl hover:border-cyan-400/40 text-slate-100 text-xs font-medium cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('satSubmenuAnalytics')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Lightweight Chart.js Line & Doughnut Analytics */}
      <DashboardCharts
        queueAndTodayCount={kpiQueueTasksCount}
        labsActiveCount={kpiLabsOrInboxCount}
        followUpAndDentureCount={kpiFollowUpDentureCount}
        stockAndEvidenceCount={kpiStockEvidenceCount}
        completedQueueCount={completedQueue.length}
        completedLabsCount={completedLabs.length}
        completedFollowUpsCount={completedFollowUps.length}
        isPersonal={isPersonal}
      />

      {/* Row 3: Live Queue / Personal Goals + Real-Time Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Recent Activity Real-Time Stream */}
        <div className={`${glassSurface} rounded-2xl p-5 xl:col-span-7 space-y-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-slate-100">{t('recentActivity')}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-violet-300 hover:text-violet-200 font-medium cursor-pointer"
            >
              {t('viewAllTasks')} ({formatNumberByLanguage(tasks.length, language)})
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="crystal-tile rounded-xl border border-dashed border-white/20 p-6 text-center space-y-3">
              <p className="text-xs font-semibold text-slate-100">{t('awaitingSheetSyncEmpty')}</p>
              <p className="text-[11px] text-slate-300/85 max-w-md mx-auto">
                {t('awaitingSheetSyncHint')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="crystal-btn px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-medium cursor-pointer"
                >
                  {t('newTask')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="crystal-btn crystal-tile px-3.5 py-2 rounded-xl border border-white/20 text-slate-100 text-xs font-medium cursor-pointer"
                >
                  {t('openAiInbox')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="crystal-tile flex items-start gap-2.5 p-3 rounded-xl text-xs"
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.dotClass}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-100 font-medium line-clamp-1">{act.title}</p>
                    <p className="text-[11px] text-slate-300/85 mt-0.5 truncate">
                      {act.category} · {act.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Queue & TV Card + Personal Daily Goals (in Personal Space) */}
        <div className="xl:col-span-5 space-y-5">
          {showQueueWidget && (
            <div className={`${glassSurface} rounded-2xl p-5 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-fuchsia-400" />
                  <h3 className="text-sm font-semibold text-slate-100">{t('queueNav')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTvDisplayOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-[11px] font-medium cursor-pointer"
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span>{t('queueTvModeBtn')}</span>
                </button>
              </div>

              {calledQueue[0] ? (
                <div className="p-3.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/35 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-fuchsia-200">
                      {calledQueue[0].queueNumber}
                    </span>
                    <span className="text-emerald-300 font-medium">
                      {calledQueue[0].roomName || t('queueStatusCalled')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white">{calledQueue[0].patientName}</p>
                  <p className="text-[11px] text-slate-300">{calledQueue[0].procedure}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">{t('queueTvNoActiveCall')}</p>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">
                  {t('queueStatusWaiting')}:{' '}
                  <strong className="text-slate-100 tabular-nums">
                    {formatNumberByLanguage(waitingQueue.length, language)}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="text-violet-300 hover:text-violet-200 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('viewAll')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {(isPersonal || !showQueueWidget) && (
            <div className={`${glassSurface} rounded-2xl p-5 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-300" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t('personalGoalsTitle')}
                  </h3>
                </div>
                <span className="text-[11px] text-violet-300 font-mono tabular-nums">
                  {dailyGoals.filter((g) => g.completed).length}/{dailyGoals.length}
                </span>
              </div>

              <form onSubmit={handleAddGoalSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder={t('personalGoalPlaceholder')}
                  className="glass-input flex-1 min-w-0 border-violet-300/25 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="crystal-btn px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('addGoalBtn')}</span>
                </button>
              </form>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {dailyGoals.length === 0 ? (
                  <p className="text-xs text-slate-300/80 py-3 text-center">
                    {t('personalGoalEmpty')}
                  </p>
                ) : (
                  dailyGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="crystal-tile flex items-center justify-between gap-2 p-2.5 rounded-xl border border-violet-300/20 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDailyGoal(goal.id)}
                        className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        {goal.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-violet-300/70 shrink-0" />
                        )}
                        <span
                          className={`truncate ${
                            goal.completed ? 'line-through text-slate-500' : 'text-slate-100'
                          }`}
                        >
                          {goal.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDailyGoal(goal.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                        aria-label={t('close')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {privateNotes.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-violet-300" />
                    {t('privateNotesTabTitle')}: {formatNumberByLanguage(privateNotes.length, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="text-violet-300 hover:text-violet-200 cursor-pointer"
                  >
                    {t('viewAll')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Interactive Zone Data Table with IndexedDB Image Thumbnails & Upload */}
      <ZoneDataTable setActiveTab={setActiveTab} isPersonal={isPersonal} />

      {/* Row 5: Bottom Quick Action Bar (Crystal Embossed, High-Contrast, iPad Touch-Friendly) */}
      <div className={`${glassSurface} rounded-2xl p-3.5 sm:pr-20 flex flex-wrap items-center gap-2.5`}>
        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('quickBarNewTask').replace(/^\+\s*/, '')}</span>
        </button>

        {showQueueWidget && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xs font-semibold cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{t('quickBarCallQueue')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTvDisplayOpen(true)}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold cursor-pointer"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>{t('quickBarOpenTv')}</span>
            </button>
          </>
        )}

        {showChatCopilotBtn && (
          <button
            type="button"
            onClick={() => setActiveTab('chat_copilot')}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-semibold cursor-pointer"
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            <span>{t('quickBarChatCopilot')}</span>
          </button>
        )}

        {onOpenChairsideCopilot && (
          <button
            type="button"
            onClick={onOpenChairsideCopilot}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{t('chairsideCopilotShortBtn')}</span>
          </button>
        )}

        {onOpenCustomBuilder && (
          <button
            type="button"
            onClick={onOpenCustomBuilder}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-xs font-semibold cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{t('customBuilderShortBtn')}</span>
          </button>
        )}

        {showLiveWorkspacesWidget && (
          <button
            type="button"
            onClick={() => setActiveTab('live_workspaces')}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 text-white text-xs font-semibold cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {t('liveWorkspacesNav')} ({formatNumberByLanguage(liveBoardsTotalItems, language)})
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold cursor-pointer"
        >
          <PackageCheck className="w-3.5 h-3.5" />
          <span>{t('quickBarUploadEvidence')}</span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportOverviewBackup}
            className="crystal-tile inline-flex items-center gap-1.5 px-3.5 min-h-[42px] py-2.5 rounded-xl border border-emerald-400/35 text-emerald-100 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-300" />
            <span>{t('exportBackupShortBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => backupFileInputRef.current?.click()}
            className="crystal-tile inline-flex items-center gap-1.5 px-3.5 min-h-[42px] py-2.5 rounded-xl border border-cyan-400/35 text-cyan-100 hover:bg-cyan-500/20 text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-300" />
            <span>{t('importBackupShortBtn')}</span>
          </button>
          <input
            ref={backupFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleImportOverviewBackupFile(e)}
            className="hidden"
          />
        </div>
      </div>

      {backupNotice && (
        <div
          className={`glass-subcard rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 border ${
            backupNotice.ok
              ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
              : 'bg-rose-500/15 border-rose-400/35 text-rose-100'
          }`}
        >
          {backupNotice.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
          )}
          <span>{backupNotice.text}</span>
        </div>
      )}

      <PostOpSurveyModal
        isOpen={isPostOpSurveyOpen}
        onClose={() => setIsPostOpSurveyOpen(false)}
      />
    </div>
  );
};
