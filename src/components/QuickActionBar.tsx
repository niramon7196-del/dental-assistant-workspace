import React, { useState } from 'react';
import { Languages, Tv, Inbox, ClipboardList, Stethoscope } from 'lucide-react';
import { ActiveTab } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslationKey } from '../utils/i18n';
import { HybridAiBadge } from './HybridAiBadge';

interface QuickActionBarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenChairsideCopilot: () => void;
  /** Tabs the current workspace/role can open (from moduleRegistry). */
  accessibleTabIds: readonly string[];
}

interface QuickAction {
  key: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  tab?: ActiveTab;
  onModal?: boolean;
}

const ACTIONS: readonly QuickAction[] = [
  { key: 'chairside', labelKey: 'quickBarChairside', icon: Languages, onModal: true },
  { key: 'queue', labelKey: 'quickBarQueue', icon: Tv, tab: 'queue' },
  { key: 'inbox', labelKey: 'quickBarInbox', icon: Inbox, tab: 'inbox' },
  { key: 'tasks', labelKey: 'quickBarTasks', icon: ClipboardList, tab: 'tasks' },
  { key: 'cases', labelKey: 'quickBarCases', icon: Stethoscope, tab: 'followups' }
];

/**
 * One-tap shortcuts to the 5 core chairside functions.
 * Touch targets are >= 44px (iPad), no blur/animation (thermal budget),
 * and it never scrolls the page: only the strip itself scrolls on narrow screens.
 */
export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenChairsideCopilot,
  accessibleTabIds
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  return (
    <nav
      aria-label={t('quickBarAria')}
      className="shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar border-b border-white/10 bg-slate-950/40"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center min-h-[44px] px-3 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-100 shrink-0"
      >
        {open ? 'ซ่อนเมนู ▲' : 'เมนูด่วน ▼'}
      </button>
      {open && ACTIONS.filter((a) => a.onModal || (a.tab && accessibleTabIds.includes(a.tab))).map(
        (a) => {
          const Icon = a.icon;
          const isActive = a.tab !== undefined && activeTab === a.tab;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => (a.onModal ? onOpenChairsideCopilot() : setActiveTab(a.tab!))}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-violet-500/30 text-white border-violet-300/50'
                  : 'bg-white/5 text-slate-200 border-white/15 active:bg-white/15'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t(a.labelKey)}</span>
            </button>
          );
        }
      )}
      {open && <HybridAiBadge />}
    </nav>
  );
};
