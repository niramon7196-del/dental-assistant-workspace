import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { ActiveTab } from './types/dental';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NewTaskModal } from './components/NewTaskModal';
import { NewLabModal } from './components/NewLabModal';
import { NewFollowUpModal } from './components/NewFollowUpModal';
import { LandingPage } from './components/LandingPage';
import { FloatingCopilotWidget } from './components/FloatingCopilotWidget';
import { QuickActionBar } from './components/QuickActionBar';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { ShieldAlert, User, Building2, Loader2 } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useWorkspace, getWorkspaceDisplayName } from './contexts/WorkspaceContext';
import { CLINIC_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from './services/workspaceStorage';
import {
  MODULE_GROUP_LABEL_KEYS,
  MODULE_REGISTRY,
  getModuleDefinition,
  isModuleAccessible
} from './modules/moduleRegistry';
import { TranslationKey } from './utils/i18n';
import { CounterQueuePage } from './components/CounterQueuePage';

const Overview = lazy(() =>
  import('./components/Overview').then((m) => ({ default: m.Overview }))
);
const AiInbox = lazy(() =>
  import('./components/AiInbox').then((m) => ({ default: m.AiInbox }))
);
const AiAssistantCenter = lazy(() =>
  import('./components/AiAssistantCenter').then((m) => ({ default: m.AiAssistantCenter }))
);
const TaskList = lazy(() =>
  import('./components/TaskList').then((m) => ({ default: m.TaskList }))
);
const LiveWorkspaceFlowView = lazy(() =>
  import('./components/LiveWorkspaceFlowView').then((m) => ({ default: m.LiveWorkspaceFlowView }))
);
const LabTracker = lazy(() =>
  import('./components/LabTracker').then((m) => ({ default: m.LabTracker }))
);
const PatientFollowUp = lazy(() =>
  import('./components/PatientFollowUp').then((m) => ({ default: m.PatientFollowUp }))
);
const DentureRecall = lazy(() =>
  import('./components/DentureRecall').then((m) => ({ default: m.DentureRecall }))
);
const WorkEvidence = lazy(() =>
  import('./components/WorkEvidence').then((m) => ({ default: m.WorkEvidence }))
);
const TeamWorkspaceView = lazy(() =>
  import('./components/TeamWorkspaceView').then((m) => ({ default: m.TeamWorkspaceView }))
);
const ModulesHub = lazy(() =>
  import('./components/ModulesHub').then((m) => ({ default: m.ModulesHub }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const ChatCopilot = lazy(() =>
  import('./components/ChatCopilot').then((m) => ({ default: m.ChatCopilot }))
);
const QueueManager = lazy(() =>
  import('./components/QueueManager').then((m) => ({ default: m.QueueManager }))
);
const SatisfactionCenter = lazy(() =>
  import('./components/SatisfactionCenter').then((m) => ({ default: m.SatisfactionCenter }))
);
const TvQueueDisplay = lazy(() =>
  import('./components/TvQueueDisplay').then((m) => ({ default: m.TvQueueDisplay }))
);
const JudgeOverviewModal = lazy(() =>
  import('./components/JudgeOverviewModal').then((m) => ({ default: m.JudgeOverviewModal }))
);
const ChairsideLanguageCopilotModal = lazy(() =>
  import('./components/ChairsideLanguageCopilotModal').then((m) => ({
    default: m.ChairsideLanguageCopilotModal
  }))
);
const SafeCustomBuilderModal = lazy(() =>
  import('./components/SafeCustomBuilderModal').then((m) => ({
    default: m.SafeCustomBuilderModal
  }))
);

const ModuleLoadingFallback: React.FC = () => (
  <div className="p-8 flex items-center justify-center">
    <div className="crystal-tile rounded-2xl px-5 py-3 inline-flex items-center gap-2.5 text-xs font-medium text-cyan-100">
      <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
      <span>กำลังเปิดโมดูล...</span>
    </div>
  </div>
);

export default function App() {
  const { t, language } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    switchWorkspace,
    currentRole,
    hasPermission,
    tasks,
    setTasks,
    queueItems,
    isTvDisplayOpen,
    setIsTvDisplayOpen,
    labOrders,
    setLabOrders,
    followUps,
    setFollowUps,
    evidenceList,
    setEvidenceList,
    inboxItems,
    setInboxItems,
    sheetConfig,
    updateSheetConfig,
    dentureCases,
    setDentureCases,
    isDentureLoading,
    dentureLoadError,
    refreshDentureCases,
    resetActiveWorkspaceDemoData,
    setJudgeDemoMode,
    recordAudit
  } = useWorkspace();

  const tvQueryState = useMemo(() => {
    if (typeof window === 'undefined') return { isTv: false, isCounter: false, wsId: '', code: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      isTv: params.get('tv') === '1',
      isCounter: params.get('counter') === '1',
      wsId: params.get('ws') || '',
      code: params.get('code') || ''
    };
  }, []);

  const [showLandingPage, setShowLandingPage] = useState<boolean>(true);
  const [activeTab, setActiveTabState] = useState<ActiveTab>('overview');
  const [tabHistory, setTabHistory] = useState<ActiveTab[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quotaWarningVisible, setQuotaWarningVisible] = useState(false);

  useEffect(() => {
    const onQuotaWarning = () => setQuotaWarningVisible(true);
    window.addEventListener('dental-storage-quota-warning', onQuotaWarning);
    return () => window.removeEventListener('dental-storage-quota-warning', onQuotaWarning);
  }, []);

  const setActiveTab = (nextTab: ActiveTab) => {
    setActiveTabState((prev) => {
      if (prev !== nextTab) {
        setTabHistory((hist) => [...hist.slice(-19), prev]);
      }
      return nextTab;
    });
  };

  const handleGoBack = () => {
    if (tabHistory.length > 0) {
      const previousTab = tabHistory[tabHistory.length - 1];
      setTabHistory((hist) => hist.slice(0, -1));
      setActiveTabState(previousTab);
      return;
    }
    if (activeTab !== 'overview') {
      setActiveTabState('overview');
      return;
    }
    setShowLandingPage(true);
  };

  // Modals state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewLabOpen, setIsNewLabOpen] = useState(false);
  const [isNewFollowUpOpen, setIsNewFollowUpOpen] = useState(false);
  const [isJudgeOverviewOpen, setIsJudgeOverviewOpen] = useState(false);
  const [isChairsideCopilotOpen, setIsChairsideCopilotOpen] = useState(false);
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(false);

  const accessibleModules = useMemo(
    () =>
      MODULE_REGISTRY.filter((mod) =>
        isModuleAccessible(
          mod,
          activeWorkspace.type,
          activeWorkspace.enabledModules,
          currentRole
        )
      ),
    [activeWorkspace.type, activeWorkspace.enabledModules, currentRole]
  );

  // Guard activeTab when switching workspaces, disabling a module, or changing roles
  const activeModDef = getModuleDefinition(activeTab);
  const isActiveTabSupported = activeModDef
    ? activeModDef.supportedWorkspaceTypes.includes(activeWorkspace.type)
    : true;
  const isActiveTabEnabled = activeModDef
    ? !activeModDef.canDisable || activeWorkspace.enabledModules[activeModDef.id] !== false
    : true;
  const isActiveTabPermitted = activeModDef
    ? hasPermission(activeModDef.requiredPermission)
    : true;

  useEffect(() => {
    if (!isActiveTabSupported) {
      setActiveTabState('overview');
    }
  }, [isActiveTabSupported, activeWorkspace.id]);

  // Counter PC queue entry page (?counter=1&code=...)
  if (tvQueryState.isCounter && tvQueryState.code) {
    return <CounterQueuePage code={tvQueryState.code} />;
  }

  // Standalone Smart TV Queue Display Mode (?tv=1&ws=...)
  if (tvQueryState.isTv) {
    const targetWs =
      workspaces.find((ws) => ws.id === tvQueryState.wsId) ||
      workspaces.find((ws) => ws.type === 'clinic') ||
      activeWorkspace;
    return (
      <ModuleErrorBoundary moduleName="TV Queue Display">
        <Suspense fallback={<ModuleLoadingFallback />}>
          <TvQueueDisplay
            workspaceId={targetWs.id}
            workspaceName={getWorkspaceDisplayName(targetWs, language)}
            isStandaloneWindow
            relayCode={tvQueryState.code}
          />
        </Suspense>
      </ModuleErrorBoundary>
    );
  }

  if (showLandingPage) {
    return (
      <LandingPage
        onEnterWorkspace={() => {
          setJudgeDemoMode(false);
          setShowLandingPage(false);
        }}
        onEnterJudgeDemo={() => {
          setJudgeDemoMode(true);
          setActiveTabState('overview');
          setShowLandingPage(false);
        }}
      />
    );
  }

  const isPersonal = activeWorkspace.type === 'personal';

  const pageMeta: Record<ActiveTab, { title: string; subtitle: string }> = {
    overview: { title: t('overview'), subtitle: t('overviewSubtitle') },
    ai_assistant: { title: t('aiAssistantHubTitle'), subtitle: t('aiAssistantHeaderSubtitle') },
    chat_copilot: { title: t('chatCopilotNav'), subtitle: t('chatCopilotHeaderSubtitle') },
    inbox: { title: t('aiInbox'), subtitle: t('aiInboxHeaderSubtitle') },
    tasks: { title: t('myTasks'), subtitle: t('tasksHeaderSubtitle') },
    live_workspaces: {
      title: t('liveWorkspacesNav'),
      subtitle: t('liveWorkspacesHeaderSubtitle')
    },
    queue: { title: t('queueNav'), subtitle: t('queueHeaderSubtitle') },
    satisfaction: {
      title: t('satisfactionNav'),
      subtitle: t('satisfactionHeaderSubtitle')
    },
    labs: { title: t('labTracker'), subtitle: t('labsHeaderSubtitle') },
    followups: { title: t('followups'), subtitle: t('followupsHeaderSubtitle') },
    denture: { title: t('dentureTitle'), subtitle: t('dentureHeaderSubtitle') },
    evidence: { title: t('evidence'), subtitle: t('evidenceHeaderSubtitle') },
    team: { title: t('teamWorkspaceNav'), subtitle: t('teamHeaderSubtitle') },
    modules_hub: { title: t('modulesHubNav'), subtitle: t('modulesHubHeaderSubtitle') },
    settings: { title: t('settings'), subtitle: t('settingsHeaderSubtitle') }
  };

  const zoneDotColor: Record<string, string> = {
    daily_assistant: isPersonal ? 'bg-violet-300' : 'bg-violet-400',
    clinical_cases: 'bg-emerald-400',
    vault_settings: 'bg-amber-400'
  };

  const activeZoneLabel = activeModDef
    ? t(MODULE_GROUP_LABEL_KEYS[activeModDef.group] as TranslationKey)
    : '';
  const activeZoneDot = activeModDef
    ? zoneDotColor[activeModDef.group] || 'bg-violet-400'
    : 'bg-violet-400';

  const renderGuardedNotice = (reasonKey: TranslationKey) => (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto mt-10">
      <div className="neon-glass border border-amber-400/40 rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-100 text-depth">{t(reasonKey)}</p>
        <button
          onClick={() => setActiveTab('overview')}
          className="crystal-btn px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
        >
          {t('switchToAllowedTabBtn')}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`flex h-[100dvh] w-full ${
        isPersonal ? 'cosmic-bg-personal' : 'cosmic-bg'
      } text-slate-100 font-sans overflow-hidden selection:bg-violet-500/30 selection:text-violet-200 transition-colors duration-200`}
    >
      {/* Sidebar Navigation (Tablet/iPad md+ & Desktop) */}
      <div className="hidden md:flex md:flex-col md:h-full md:min-h-0 shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tasks={tasks}
          inboxItems={inboxItems}
          labOrders={labOrders}
          dentureCases={dentureCases}
          onReturnLanding={() => setShowLandingPage(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden bg-transparent">
        {/* Unified Standard Top Bar (Search, + New Task, TH/EN, Notifications) */}
        <Header
          setActiveTab={setActiveTab}
          onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
          onOpenNewLabModal={() => setIsNewLabOpen(true)}
          onOpenNewFollowUpModal={() => setIsNewFollowUpOpen(true)}
          onOpenChairsideCopilot={() => setIsChairsideCopilotOpen(true)}
          onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* One-tap shortcuts to the 5 core chairside functions */}
        <QuickActionBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenChairsideCopilot={() => setIsChairsideCopilotOpen(true)}
          accessibleTabIds={accessibleModules.map((m) => m.id)}
        />

        {/* Compact Phone-only Nav & Workspace Switcher (<md only — hidden on iPad & Desktop) */}
        <div
          className={`flex md:hidden items-center gap-2 px-3 py-2 border-b backdrop-blur-[2px] shrink-0 ${
            isPersonal
              ? 'border-violet-300/25 bg-purple-950/10'
              : 'border-white/20 bg-slate-950/10'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              const personalId =
                workspaces.find((w) => w.type === 'personal')?.id || PERSONAL_WORKSPACE_ID;
              const clinicId =
                workspaces.find((w) => w.type === 'clinic')?.id || CLINIC_WORKSPACE_ID;
              switchWorkspace(isPersonal ? clinicId : personalId);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/25 border border-violet-300/35 text-[11px] font-semibold text-violet-100 whitespace-nowrap shrink-0"
          >
            {isPersonal ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            <span>{isPersonal ? t('dualPersonalBtn') : t('dualAssistantBtn')}</span>
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] flex-1 min-w-0">
            {accessibleModules.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTab(mod.id)}
                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 font-medium border transition-colors ${
                  activeTab === mod.id
                    ? 'bg-violet-500/30 text-white border-violet-300/45'
                    : 'crystal-tile text-slate-300 border-white/15'
                }`}
              >
                {t(mod.labelKey as TranslationKey)}
              </button>
            ))}
          </div>
        </div>

        <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] pb-28 md:pb-24">
          {/* Back Button (↩️) + Zone Badge + Main Heading cleanly positioned inside Main Content Area */}
          <div className="px-4 sm:px-6 lg:px-8 pt-4 mt-2 pb-3 max-w-7xl mx-auto">
            <div className={`${isPersonal ? 'neon-glass-personal' : 'neon-glass'} rounded-2xl px-4 sm:px-5 py-3.5`}>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <button
                type="button"
                onClick={handleGoBack}
                title={
                  tabHistory.length > 0 || activeTab !== 'overview'
                    ? language === 'en'
                      ? 'Back to previous view'
                      : 'ย้อนกลับไปหน้าก่อนหน้า'
                    : t('returnLanding')
                }
                aria-label={
                  tabHistory.length > 0 || activeTab !== 'overview'
                    ? language === 'en'
                      ? 'Back'
                      : 'ย้อนกลับ'
                    : t('returnLanding')
                }
                className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-3 min-h-[38px] py-1.5 rounded-xl border border-violet-300/40 hover:border-cyan-400/60 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  ↩️
                </span>
                <span>
                  {tabHistory.length > 0 || activeTab !== 'overview'
                    ? language === 'en'
                      ? 'Back'
                      : 'ย้อนกลับ'
                    : language === 'en'
                    ? 'Home'
                    : 'หน้าเริ่มต้น'}
                </span>
              </button>

              {activeZoneLabel && (
                <div
                  className={`crystal-tile inline-flex items-center gap-2 px-3 min-h-[38px] py-1.5 rounded-xl border text-[11px] font-medium text-slate-100 ${
                    isPersonal
                      ? 'border-violet-300/35'
                      : 'border-violet-400/30'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${activeZoneDot}`} />
                  <span className="break-words text-depth">{activeZoneLabel}</span>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight break-words text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-violet-200 to-pink-200 drop-shadow-[0_2px_10px_rgba(4,2,16,0.95)]">
              {pageMeta[activeTab]?.title || t('brand')}
            </h1>
            <p className="text-xs text-slate-100/95 mt-0.5 break-words leading-relaxed text-depth">
              {pageMeta[activeTab]?.subtitle || t('subtitle')}
            </p>
            </div>
          </div>
          {quotaWarningVisible && (
            <div className="px-4 sm:px-6 lg:px-8 pb-3 max-w-7xl mx-auto">
              <div className="rounded-2xl bg-amber-500/20 border border-amber-400/45 px-4 py-3 text-xs text-amber-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>
                    {language === 'en'
                      ? 'Browser storage is nearing capacity. Please export a JSON backup in Settings and remove unused photos if needed.'
                      : 'หน่วยความจำ LocalStorage บนอุปกรณ์ใกล้เต็ม แนะนำให้กดสำรองข้อมูล (Export JSON) ในหน้าตั้งค่า หรือลบรูปแนบเก่าที่ไม่ใช้แล้ว'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuotaWarningVisible(false)}
                  className="crystal-tile px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer shrink-0"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          )}
          {!isActiveTabEnabled ? (
            renderGuardedNotice('moduleDisabledNotice')
          ) : !isActiveTabPermitted ? (
            renderGuardedNotice('moduleAccessDeniedNotice')
          ) : (
            <ModuleErrorBoundary
              key={`${activeWorkspace.id}-${activeTab}`}
              moduleName={pageMeta[activeTab]?.title || activeTab}
              onReturnOverview={() => setActiveTab('overview')}
            >
              <Suspense fallback={<ModuleLoadingFallback />}>
                {activeTab === 'overview' && (
                  <Overview
                    tasks={tasks}
                    labOrders={labOrders}
                    followUps={followUps}
                    inboxItems={inboxItems}
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                    onOpenChairsideCopilot={() => setIsChairsideCopilotOpen(true)}
                    onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
                  />
                )}

                {activeTab === 'ai_assistant' && (
                  <AiAssistantCenter setActiveTab={setActiveTab} />
                )}

                {activeTab === 'chat_copilot' && (
                  <ChatCopilot setActiveTab={setActiveTab} />
                )}

                {activeTab === 'inbox' && (
                  <AiInbox
                    inboxItems={inboxItems}
                    setInboxItems={setInboxItems}
                    tasks={tasks}
                    setTasks={setTasks}
                    evidenceList={evidenceList}
                    setEvidenceList={setEvidenceList}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'tasks' && (
                  <TaskList
                    tasks={tasks}
                    setTasks={setTasks}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                    onOpenChairsideCopilot={() => setIsChairsideCopilotOpen(true)}
                    onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
                    searchQuery={searchQuery}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'live_workspaces' && (
                  <LiveWorkspaceFlowView
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                  />
                )}

                {activeTab === 'queue' && (
                  <QueueManager
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                    onOpenChairsideCopilot={() => setIsChairsideCopilotOpen(true)}
                  />
                )}

                {activeTab === 'satisfaction' && (
                  <SatisfactionCenter
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                  />
                )}

                {activeTab === 'labs' && (
                  <LabTracker
                    labOrders={labOrders}
                    setLabOrders={setLabOrders}
                    onOpenNewLabModal={() => setIsNewLabOpen(true)}
                    searchQuery={searchQuery}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'followups' && (
                  <PatientFollowUp
                    followUps={followUps}
                    setFollowUps={setFollowUps}
                    onOpenNewFollowUpModal={() => setIsNewFollowUpOpen(true)}
                    searchQuery={searchQuery}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'denture' && (
                  <DentureRecall
                    cases={dentureCases}
                    setCases={setDentureCases}
                    sheetConfig={sheetConfig}
                    isLoading={isDentureLoading}
                    loadError={dentureLoadError}
                    onRefreshCases={() => refreshDentureCases()}
                    onOpenSettings={() => setActiveTab('settings')}
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                  />
                )}

                {activeTab === 'evidence' && (
                  <WorkEvidence
                    evidenceList={evidenceList}
                    setEvidenceList={setEvidenceList}
                    searchQuery={searchQuery}
                    setActiveTab={setActiveTab}
                    onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
                  />
                )}

                {activeTab === 'team' && activeWorkspace.type === 'clinic' && (
                  <TeamWorkspaceView />
                )}

                {activeTab === 'modules_hub' && (
                  <ModulesHub
                    setActiveTab={setActiveTab}
                    onOpenJudgeOverview={() => setIsJudgeOverviewOpen(true)}
                    onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    onResetDemoData={resetActiveWorkspaceDemoData}
                    sheetConfig={sheetConfig}
                    onUpdateSheetConfig={updateSheetConfig}
                    onOpenJudgeOverview={() => setIsJudgeOverviewOpen(true)}
                    onNavigateOverview={() => setActiveTab('overview')}
                  />
                )}
              </Suspense>
            </ModuleErrorBoundary>
          )}
        </main>
      </div>

      {/* TV Queue Display Overlay Mode */}
      {isTvDisplayOpen && (
        <ModuleErrorBoundary
          moduleName="TV Queue Display"
          onReturnOverview={() => setIsTvDisplayOpen(false)}
        >
          <Suspense fallback={null}>
            <TvQueueDisplay
              workspaceId={activeWorkspace.id}
              workspaceName={getWorkspaceDisplayName(activeWorkspace, language)}
              items={queueItems}
              onClose={() => setIsTvDisplayOpen(false)}
            />
          </Suspense>
        </ModuleErrorBoundary>
      )}

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onAddTask={(newTask) => {
          setTasks((prev) => [{ ...newTask, workspaceId: activeWorkspace.id }, ...prev]);
          recordAudit('task_create', newTask.title);
        }}
      />

      <NewLabModal
        isOpen={isNewLabOpen}
        onClose={() => setIsNewLabOpen(false)}
        onAddLab={(newLab) => {
          setLabOrders((prev) => [newLab, ...prev]);
          recordAudit('task_update', `Lab order ${newLab.orderReference}`);
        }}
      />

      <NewFollowUpModal
        isOpen={isNewFollowUpOpen}
        onClose={() => setIsNewFollowUpOpen(false)}
        onAddFollowUp={(newFu) => {
          setFollowUps((prev) => [newFu, ...prev]);
          recordAudit('task_update', `Follow-up ${newFu.patientRefId}`);
        }}
      />

      {/* 1-Page Judge Overview Modal (Lazy-loaded) */}
      {isJudgeOverviewOpen && (
        <ModuleErrorBoundary
          moduleName="Judge Overview"
          onReturnOverview={() => setIsJudgeOverviewOpen(false)}
        >
          <Suspense fallback={null}>
            <JudgeOverviewModal
              isOpen={isJudgeOverviewOpen}
              onClose={() => setIsJudgeOverviewOpen(false)}
              setActiveTab={setActiveTab}
            />
          </Suspense>
        </ModuleErrorBoundary>
      )}

      {/* Chairside Language Copilot Modal (Lazy-loaded & unmounted when closed — zero idle overhead) */}
      {isChairsideCopilotOpen && (
        <ModuleErrorBoundary
          moduleName={t('chairsideCopilotBtn')}
          onReturnOverview={() => setIsChairsideCopilotOpen(false)}
        >
          <Suspense fallback={null}>
            <ChairsideLanguageCopilotModal
              isOpen={isChairsideCopilotOpen}
              onClose={() => setIsChairsideCopilotOpen(false)}
            />
          </Suspense>
        </ModuleErrorBoundary>
      )}

      {/* Safe Custom Builder Modal (Lazy-loaded & isolated localStorage partition) */}
      {isCustomBuilderOpen && (
        <ModuleErrorBoundary
          moduleName={t('customBuilderBtn')}
          onReturnOverview={() => setIsCustomBuilderOpen(false)}
        >
          <Suspense fallback={null}>
            <SafeCustomBuilderModal
              isOpen={isCustomBuilderOpen}
              onClose={() => setIsCustomBuilderOpen(false)}
            />
          </Suspense>
        </ModuleErrorBoundary>
      )}

      {/* Floating 3D Mascot AI Copilot Widget (Auto-hidden while TV Display Mode or full-screen modal is active) */}
      {!isTvDisplayOpen && (
        <FloatingCopilotWidget
          setActiveTab={setActiveTab}
          isSuppressed={
            isNewTaskOpen ||
            isNewLabOpen ||
            isNewFollowUpOpen ||
            isJudgeOverviewOpen ||
            isChairsideCopilotOpen ||
            isCustomBuilderOpen
          }
        />
      )}
    </div>
  );
}
