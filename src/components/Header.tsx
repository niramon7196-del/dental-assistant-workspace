import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  Bell,
  FlaskConical,
  CheckSquare,
  Users,
  ChevronDown,
  Bot,
  Megaphone,
  MessageSquareHeart,
  Languages,
  LayoutGrid
} from 'lucide-react';
import { ActiveTab } from '../types/dental';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatNumberByLanguage } from '../utils/i18n';

interface HeaderProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onOpenNewLabModal: () => void;
  onOpenNewFollowUpModal: () => void;
  onOpenChairsideCopilot?: () => void;
  onOpenCustomBuilder?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  setActiveTab,
  onOpenNewTaskModal,
  onOpenNewLabModal,
  onOpenNewFollowUpModal,
  onOpenChairsideCopilot,
  onOpenCustomBuilder,
  searchQuery,
  setSearchQuery
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    hasPermission,
    tasks,
    labOrders,
    dentureCases,
    queueItems,
    isJudgeDemoActive,
    toggleJudgeDemoMode
  } = useWorkspace();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (quickMenuRef.current && !quickMenuRef.current.contains(target)) {
        setIsQuickMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const isClinic = activeWorkspace.type === 'clinic';
  const isPersonal = !isClinic;
  const newTaskCleanLabel = t('newTask').replace(/^\+\s*/, '');

  const liveAlerts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const alerts: Array<{ id: string; title: string; desc: string; tab: ActiveTab }> = [];

    const dueTasksCount = tasks.filter(
      (tk) => tk.dueDate <= today && tk.status !== 'Completed' && tk.status !== 'Cancelled'
    ).length;
    if (dueTasksCount > 0) {
      alerts.push({
        id: 'due-tasks',
        title: t('myTasks'),
        desc: t('notifDueTasksDesc').replace(
          '{count}',
          formatNumberByLanguage(dueTasksCount, language)
        ),
        tab: 'tasks'
      });
    }

    if (activeWorkspace.enabledModules.queue !== false) {
      const waitingCount = queueItems.filter((q) => q.status === 'waiting').length;
      if (waitingCount > 0) {
        alerts.push({
          id: 'waiting-queue',
          title: t('queueNav'),
          desc: t('notifWaitingQueueDesc').replace(
            '{count}',
            formatNumberByLanguage(waitingCount, language)
          ),
          tab: 'queue'
        });
      }
    }

    if (activeWorkspace.enabledModules.labs !== false) {
      const activeLabsCount = labOrders.filter(
        (l) => l.status !== 'Delivered' && l.status !== 'Quality Checked' && l.status !== 'Cancelled'
      ).length;
      if (activeLabsCount > 0) {
        alerts.push({
          id: 'active-labs',
          title: t('labTracker'),
          desc: t('notifActiveLabsDesc').replace(
            '{count}',
            formatNumberByLanguage(activeLabsCount, language)
          ),
          tab: 'labs'
        });
      }
    }

    if (activeWorkspace.enabledModules.denture !== false) {
      const pendingDentureCount = dentureCases.filter((c) => c.status === 'ยังไม่ได้โทร').length;
      if (pendingDentureCount > 0) {
        alerts.push({
          id: 'pending-denture',
          title: t('denture'),
          desc: t('notifPendingDentureDesc').replace(
            '{count}',
            formatNumberByLanguage(pendingDentureCount, language)
          ),
          tab: 'denture'
        });
      }
    }

    return alerts;
  }, [tasks, queueItems, labOrders, dentureCases, activeWorkspace.enabledModules, t, language]);

  return (
    <header
      className={`relative z-40 h-[64px] border-b backdrop-blur-[2px] px-4 sm:px-6 lg:px-8 flex flex-nowrap items-center justify-between gap-2.5 sm:gap-4 shrink-0 transition-colors ${
        isPersonal
          ? 'bg-purple-950/10 border-violet-300/30 shadow-[0_4px_20px_rgba(4,2,16,0.18)]'
          : 'bg-slate-950/10 border-white/25 shadow-[0_4px_20px_rgba(4,2,16,0.18)]'
      }`}
    >
      {/* Left: Flexible Global Search Bar */}
      <div className="relative flex-1 min-w-[80px] sm:min-w-[140px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300/75 pointer-events-none" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input w-full pl-8 pr-3 py-2 rounded-xl text-xs transition-colors placeholder:text-slate-300/60"
        />
      </div>

      {/* Right: + New Task, Judge Demo Mode, Language Switcher (TH/EN), Notifications Bell */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Primary 1-Click "+ สร้างงานใหม่" + Dropdown Quick Menu */}
        <div className="relative flex items-center" ref={quickMenuRef}>
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white pl-3 pr-2.5 py-2 rounded-l-xl text-xs font-semibold shadow-md shadow-violet-500/20 transition-colors cursor-pointer"
            title={newTaskCleanLabel}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{newTaskCleanLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsQuickMenuOpen((prev) => !prev);
              setIsNotificationsOpen(false);
            }}
            className="bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-2 rounded-r-xl border-l border-white/15 text-xs flex items-center justify-center cursor-pointer"
            title={t('quickAction')}
            aria-label={t('quickAction')}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {isQuickMenuOpen && (
            <div className="glass-dropdown absolute right-0 top-full mt-2 w-64 rounded-2xl py-2 z-[60]">
              {hasPermission('manage_tasks') && activeWorkspace.enabledModules.tasks !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    onOpenNewTaskModal();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-100 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                  <span>{newTaskCleanLabel}</span>
                </button>
              )}

              {activeWorkspace.enabledModules.queue !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setActiveTab('queue');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-emerald-300 hover:bg-emerald-500/15 transition-colors text-left cursor-pointer"
                >
                  <Megaphone className="w-4 h-4 text-emerald-400" />
                  <span>{t('queueNav')}</span>
                </button>
              )}

              {activeWorkspace.enabledModules.chat_copilot !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setActiveTab('chat_copilot');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-violet-200 hover:bg-violet-500/15 transition-colors text-left cursor-pointer"
                >
                  <MessageSquareHeart className="w-4 h-4 text-violet-400" />
                  <span>{t('chatCopilotNav')}</span>
                </button>
              )}

              {onOpenChairsideCopilot && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    onOpenChairsideCopilot();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-cyan-200 hover:bg-cyan-500/15 transition-colors text-left cursor-pointer"
                >
                  <Languages className="w-4 h-4 text-cyan-400" />
                  <span>{t('chairsideCopilotBtn')}</span>
                </button>
              )}

              {onOpenCustomBuilder && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    onOpenCustomBuilder();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-sky-200 hover:bg-sky-500/15 transition-colors text-left cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4 text-sky-400" />
                  <span>{t('customBuilderBtn')}</span>
                </button>
              )}

              {hasPermission('manage_labs') &&
                activeWorkspace.enabledModules.labs !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickMenuOpen(false);
                      onOpenNewLabModal();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>{t('newLab')}</span>
                  </button>
                )}

              {hasPermission('manage_followups') &&
                activeWorkspace.enabledModules.followups !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickMenuOpen(false);
                      onOpenNewFollowUpModal();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>{t('newFollowUp')}</span>
                  </button>
                )}

              <div className="my-1 border-t border-white/15"></div>

              {activeWorkspace.enabledModules.inbox !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setActiveTab('inbox');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-violet-300 hover:bg-violet-500/15 transition-colors text-left font-medium cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span>{t('openAiInbox')}</span>
                </button>
              )}

              {activeWorkspace.enabledModules.ai_assistant !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setActiveTab('ai_assistant');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-indigo-300 hover:bg-indigo-500/15 transition-colors text-left font-medium cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>{t('aiAssistantHubTitle')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Instant Judge Demo Mode Toggle (Next to TH/EN for 1-tap access on iPad/Desktop) */}
        <button
          type="button"
          onClick={toggleJudgeDemoMode}
          aria-pressed={isJudgeDemoActive}
          title={isJudgeDemoActive ? t('judgeDemoExitHeaderTooltip') : t('judgeDemoHeaderTooltip')}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap border ${
            isJudgeDemoActive
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/25'
              : 'crystal-tile text-amber-200 hover:text-white border-amber-400/35 hover:border-amber-300/60'
          }`}
        >
          <Sparkles
            className={`w-3.5 h-3.5 shrink-0 ${
              isJudgeDemoActive ? 'text-slate-950 animate-pulse' : 'text-amber-300'
            }`}
          />
          <span className="hidden lg:inline">
            {isJudgeDemoActive ? t('judgeDemoExitHeaderBtn') : t('judgeDemoHeaderBtn')}
          </span>
          <span className="hidden sm:inline lg:hidden">
            {isJudgeDemoActive ? t('judgeDemoExitShortBtn') : t('judgeDemoHeaderShortBtn')}
          </span>
          <span className="sm:hidden">
            {isJudgeDemoActive ? t('judgeDemoExitMicroBtn') : t('judgeDemoHeaderMicroBtn')}
          </span>
        </button>

        {/* Language Switcher TH/EN */}
        <LanguageSwitcher />

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev);
              setIsQuickMenuOpen(false);
            }}
            className="crystal-tile p-2 rounded-xl text-slate-200 hover:text-white hover:border-violet-300/45 transition-colors relative cursor-pointer"
            title={t('notificationsTooltip')}
            aria-label={t('notificationsTooltip')}
          >
            <Bell className="w-4 h-4" />
            {liveAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="glass-dropdown absolute right-0 mt-2 w-80 rounded-2xl py-3 px-4 z-[60]">
              <div className="flex items-center justify-between pb-2 border-b border-white/15">
                <span className="text-xs font-semibold text-slate-100">{t('recentAlerts')}</span>
                <span className="text-[10px] text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full border border-violet-400/30">
                  {t('notifCountBadge').replace(
                    '{count}',
                    formatNumberByLanguage(liveAlerts.length, language)
                  )}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {liveAlerts.length === 0 ? (
                  <div className="glass-subcard p-3 rounded-xl text-center space-y-1">
                    <p className="font-medium text-slate-200">{t('notifEmptyTitle')}</p>
                    <p className="text-[11px] text-slate-300/80 leading-relaxed">
                      {t('notifEmptyDesc')}
                    </p>
                  </div>
                ) : (
                  liveAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setActiveTab(alert.tab);
                      }}
                      className="glass-subcard w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <p className="font-medium text-slate-100">{alert.title}</p>
                      <p className="text-[11px] text-slate-300/85 mt-0.5">{alert.desc}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
