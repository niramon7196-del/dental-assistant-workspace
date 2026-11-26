import React, { useState } from 'react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  FlaskConical,
  Users,
  FileText,
  Settings,
  Database,
  Sparkles,
  Stethoscope,
  PhoneCall,
  Bot,
  Blocks,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareHeart,
  Megaphone,
  User,
  Building2,
  Home,
  QrCode,
  Layers
} from 'lucide-react';
import { ActiveTab, TaskItem, InboxItem, LabOrder, DentureCase } from '../types/dental';
import { ModuleId } from '../types/platform';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  MODULE_GROUP_LABEL_KEYS,
  MODULE_GROUP_ORDER,
  MODULE_REGISTRY,
  isModuleAccessible
} from '../modules/moduleRegistry';
import { formatNumberByLanguage } from '../utils/i18n';
import { CLINIC_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '../services/workspaceStorage';
import mascotWelcome from '../assets/images/mascot_welcome_1795242056750.jpg';

const SIDEBAR_MASCOT_URL =
  'https://i.postimg.cc/NjktjjyL/915124600-1800868747806524-2398384840772570514-n.webp';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  tasks: TaskItem[];
  inboxItems: InboxItem[];
  labOrders: LabOrder[];
  dentureCases: DentureCase[];
  onReturnLanding?: () => void;
}

const MODULE_ICONS: Record<ModuleId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  ai_assistant: Bot,
  chat_copilot: MessageSquareHeart,
  inbox: Inbox,
  tasks: CheckSquare,
  live_workspaces: Layers,
  queue: Megaphone,
  satisfaction: QrCode,
  labs: FlaskConical,
  followups: Users,
  denture: PhoneCall,
  evidence: FileText,
  team: ShieldCheck,
  modules_hub: Blocks,
  settings: Settings
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  tasks,
  inboxItems,
  labOrders,
  dentureCases,
  onReturnLanding
}) => {
  const { t, language } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    switchWorkspace,
    currentRole,
    queueItems,
    satisfactionResponses,
    liveBoards
  } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mascotSrc, setMascotSrc] = useState(SIDEBAR_MASCOT_URL);

  const isPersonal = activeWorkspace.type === 'personal';
  const personalWsId =
    workspaces.find((w) => w.type === 'personal')?.id || PERSONAL_WORKSPACE_ID;
  const assistantWsId =
    workspaces.find((w) => w.type === 'clinic')?.id || CLINIC_WORKSPACE_ID;

  const unreadInboxCount = inboxItems.filter(
    (i) => i.status === 'Unprocessed' || i.status === 'Reviewed'
  ).length;
  const dueTodayCount = tasks.filter((task) => {
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate === today && task.status !== 'Completed' && task.status !== 'Cancelled';
  }).length;
  const waitingQueueCount = queueItems.filter(
    (q) => q.status === 'waiting' || q.status === 'called'
  ).length;
  const activeLabCount = labOrders.filter(
    (l) => l.status !== 'Delivered' && l.status !== 'Quality Checked' && l.status !== 'Cancelled'
  ).length;
  const pendingDentureCallCount = dentureCases.filter((c) => c.status === 'ยังไม่ได้โทร').length;
  const pendingSatisfactionCallbackCount = satisfactionResponses.filter(
    (r) => r.wantsCallback && r.triageStatus === 'new'
  ).length;

  const liveBoardsRecordCount = liveBoards.reduce((sum, b) => sum + b.records.length, 0);

  const getBadge = (id: ModuleId): { text?: string; color?: string } => {
    if (id === 'live_workspaces' && liveBoardsRecordCount > 0) {
      return {
        text: formatNumberByLanguage(liveBoardsRecordCount, language),
        color: 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
      };
    }
    if (id === 'inbox' && unreadInboxCount > 0) {
      return {
        text: formatNumberByLanguage(unreadInboxCount, language),
        color: 'bg-violet-500/20 text-violet-300 border border-violet-400/35'
      };
    }
    if (id === 'tasks' && dueTodayCount > 0) {
      return {
        text: `${formatNumberByLanguage(dueTodayCount, language)} ${t('dueShort')}`,
        color: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/35'
      };
    }
    if (id === 'queue' && waitingQueueCount > 0) {
      return {
        text: formatNumberByLanguage(waitingQueueCount, language),
        color: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/35'
      };
    }
    if (id === 'satisfaction' && pendingSatisfactionCallbackCount > 0) {
      return {
        text: formatNumberByLanguage(pendingSatisfactionCallbackCount, language),
        color: 'bg-rose-500/20 text-rose-300 border border-rose-400/35'
      };
    }
    if (id === 'labs' && activeLabCount > 0) {
      return {
        text: formatNumberByLanguage(activeLabCount, language),
        color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
      };
    }
    if (id === 'denture' && pendingDentureCallCount > 0) {
      return {
        text: `${formatNumberByLanguage(pendingDentureCallCount, language)} ${t('denturePendingCallBadgeSuffix')}`,
        color: 'bg-amber-500/20 text-amber-300 border border-amber-400/35'
      };
    }
    return {};
  };

  const accessibleModules = MODULE_REGISTRY.filter((mod) =>
    isModuleAccessible(mod, activeWorkspace.type, activeWorkspace.enabledModules, currentRole)
  );

  const zoneDotColor: Record<string, string> = {
    daily_assistant: isPersonal ? 'bg-violet-300' : 'bg-violet-400',
    clinical_cases: 'bg-cyan-400',
    vault_settings: 'bg-amber-400'
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-60 lg:w-64'
      } ${
        isPersonal ? 'neon-glass-personal' : 'neon-glass'
      } h-full min-h-0 border-y-0 border-l-0 flex flex-col shrink-0 overflow-hidden select-none z-20 transition-[width,background-color] duration-200`}
    >
      {/* Brand Header + Collapse Toggle */}
      <div
        className={`h-[64px] px-4 border-b flex items-center justify-between gap-2 shrink-0 ${
          isPersonal ? 'border-violet-300/15' : 'border-violet-400/15'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md text-white shrink-0 ${
              isPersonal
                ? 'bg-gradient-to-br from-violet-400 via-fuchsia-400 to-purple-500 shadow-violet-400/25'
                : 'bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 shadow-violet-500/25'
            }`}
          >
            <Stethoscope className="w-4.5 h-4.5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-100 text-sm tracking-tight truncate">
                {t('brand')}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isPersonal ? 'bg-violet-300' : 'bg-cyan-400'
                  }`}
                ></span>
                <span
                  className={`text-[11px] font-medium tracking-wide flex items-center gap-1 truncate ${
                    isPersonal ? 'text-violet-200' : 'text-cyan-300'
                  }`}
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  {isPersonal ? t('dualPersonalBtn') : t('assistantProBadge')}
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 border border-transparent hover:border-violet-400/25 transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* 3D Assistant Mascot + 1-Click Workspace Switcher */}
      <div
        className={`px-3 py-3 border-b shrink-0 space-y-2.5 ${
          isPersonal ? 'border-violet-300/15' : 'border-violet-400/15'
        }`}
      >
        {!collapsed ? (
          <>
            <div className="relative rounded-2xl p-2.5 bg-gradient-to-br from-violet-500/12 via-white/[0.04] to-cyan-500/10 border border-white/25 flex items-center gap-3 overflow-hidden shadow-[0_0_14px_rgba(168,85,247,0.16)]">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-violet-300/45 shadow-[0_0_16px_rgba(168,85,247,0.35)] bg-slate-950/15">
                <img
                  src={mascotSrc}
                  alt={t('brand')}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (mascotSrc !== mascotWelcome) setMascotSrc(mascotWelcome);
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {t('copilotWidgetTitle')}
                </p>
                <p className="text-[10px] text-violet-200/80 line-clamp-2 leading-snug mt-0.5">
                  {isPersonal ? t('personalSpacesGroup') : t('clinicSpacesGroup')}
                </p>
              </div>
            </div>

            {/* 1-Click Personal Space / Assistant Workspace Switcher */}
            <div className="crystal-tile grid grid-cols-2 gap-1 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => switchWorkspace(personalWsId)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer truncate ${
                  isPersonal
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title={t('personalSpacesGroup')}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{t('dualPersonalBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => switchWorkspace(assistantWsId)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer truncate ${
                  !isPersonal
                    ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title={t('clinicSpacesGroup')}
              >
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{t('dualAssistantBtn')}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => switchWorkspace(isPersonal ? assistantWsId : personalWsId)}
              title={isPersonal ? t('clinicSpacesGroup') : t('personalSpacesGroup')}
              className="w-11 h-11 rounded-xl overflow-hidden border border-violet-300/40 shadow-[0_0_14px_rgba(168,85,247,0.3)] cursor-pointer"
            >
              <img
                src={mascotSrc}
                alt={t('brand')}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (mascotSrc !== mascotWelcome) setMascotSrc(mascotWelcome);
                }}
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        )}
      </div>

      {/* 3-Zone Modular Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-3.5 space-y-4 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
        {MODULE_GROUP_ORDER.map((group, groupIdx) => {
          const items = accessibleModules.filter((m) => m.group === group);
          if (items.length === 0) return null;

          return (
            <div
              key={group}
              className={`space-y-1 ${
                groupIdx > 0
                  ? isPersonal
                    ? 'pt-3 border-t border-violet-300/15'
                    : 'pt-3 border-t border-white/10'
                  : ''
              }`}
            >
              {!collapsed && (
                <div className="px-3 pb-1 flex items-center gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${zoneDotColor[group] || 'bg-slate-400'}`} />
                  <span className="truncate">{t(MODULE_GROUP_LABEL_KEYS[group])}</span>
                </div>
              )}

              {items.map((item) => {
                const Icon = MODULE_ICONS[item.id];
                const isActive = activeTab === item.id;
                const badge = getBadge(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as ActiveTab)}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={`w-full flex items-center ${
                      collapsed ? 'justify-center px-2' : 'justify-between px-3'
                    } py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                      isActive
                        ? isPersonal
                          ? 'bg-gradient-to-r from-violet-500/30 to-fuchsia-500/15 text-white border border-violet-300/45 shadow-[0_0_16px_rgba(192,132,252,0.18)]'
                          : 'bg-gradient-to-r from-violet-600/30 to-cyan-500/15 text-white border border-violet-400/45 shadow-[0_0_16px_rgba(34,211,238,0.14)]'
                        : isPersonal
                        ? 'text-violet-200/75 hover:text-white hover:bg-white/[0.06] border border-transparent'
                        : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? isPersonal
                              ? 'text-violet-200'
                              : 'text-cyan-300'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </div>
                    {!collapsed && badge.text !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums shrink-0 ${
                          badge.color || 'bg-white/10 text-slate-200 border border-white/15'
                        }`}
                      >
                        {badge.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Compact Workspace Footer Note + Return to Welcome */}
      {!collapsed && (
        <div
          className={`p-3 border-t shrink-0 space-y-2 ${
            isPersonal ? 'border-violet-300/15' : 'border-white/10'
          }`}
        >
          <div className="crystal-tile rounded-xl border border-violet-400/25 p-2.5 text-[11px] text-slate-200 flex items-start gap-2">
            <Database className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-300" />
            <p className="leading-tight">
              <strong className="font-semibold text-violet-200">{t('demoModeActive')}:</strong>{' '}
              {t('demoModeNotice')}
            </p>
          </div>
          {onReturnLanding && (
            <button
              type="button"
              onClick={onReturnLanding}
              className="crystal-tile w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.08] text-[11px] text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-violet-300" />
              <span>{t('returnLanding')}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
