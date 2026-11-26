import React, { useState } from 'react';
import {
  Blocks,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  Shield,
  FileText,
  LayoutGrid
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  FUTURE_MODULE_BLUEPRINTS,
  MODULE_GROUP_LABEL_KEYS,
  MODULE_REGISTRY
} from '../modules/moduleRegistry';
import { ActiveTab } from '../types/dental';
import { formatNumberByLanguage } from '../utils/i18n';

interface ModulesHubProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenJudgeOverview?: () => void;
  onOpenCustomBuilder?: () => void;
}

export const ModulesHub: React.FC<ModulesHubProps> = ({
  setActiveTab,
  onOpenJudgeOverview,
  onOpenCustomBuilder
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    hasPermission,
    toggleModule
  } = useWorkspace();
  const [subTab, setSubTab] = useState<'installed' | 'roadmap'>('installed');

  const canManageModules = hasPermission('manage_modules');

  const compatibleModules = MODULE_REGISTRY.filter((m) =>
    m.supportedWorkspaceTypes.includes(activeWorkspace.type)
  );
  const activeCount = compatibleModules.filter(
    (m) => !m.canDisable || activeWorkspace.enabledModules[m.id] !== false
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Compact Toolbar: Active Count + Submenus */}
      <div className="crystal-tile rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Blocks className="w-4 h-4 text-violet-400" />
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
            {t('modulesActiveCount')
              .replace('{active}', formatNumberByLanguage(activeCount, language))
              .replace('{total}', formatNumberByLanguage(compatibleModules.length, language))}
          </span>
          {onOpenCustomBuilder && (
            <button
              type="button"
              onClick={onOpenCustomBuilder}
              className="crystal-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white text-[11px] font-semibold cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t('customBuilderBtn')}</span>
            </button>
          )}
          {onOpenJudgeOverview && (
            <button
              type="button"
              onClick={onOpenJudgeOverview}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl crystal-tile hover:bg-white/15 border border-violet-300/35 text-violet-100 text-[11px] font-semibold cursor-pointer"
            >
              <FileText className="w-3 h-3 text-violet-300" />
              <span>{t('judgeDemoOverviewBtn')}</span>
            </button>
          )}
        </div>

        {/* Module Hub Submenus */}
        <div className="flex items-center gap-2 glass-subcard p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('installed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subTab === 'installed'
                ? 'bg-violet-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('modulesHubInstalled')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('roadmap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subTab === 'roadmap'
                ? 'bg-violet-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('modulesHubRoadmap')}
          </button>
        </div>
      </div>

      {subTab === 'installed' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {compatibleModules.map((mod) => {
            const isEnabled = !mod.canDisable || activeWorkspace.enabledModules[mod.id] !== false;
            const hasAccess = hasPermission(mod.requiredPermission);

            return (
              <div
                key={mod.id}
                className={`neon-glass rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4 transition-all ${
                  isEnabled
                    ? 'hover:border-violet-400/60'
                    : 'opacity-70'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                        {t(MODULE_GROUP_LABEL_KEYS[mod.group])}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 mt-0.5">{t(mod.labelKey)}</h3>
                    </div>

                    {mod.canDisable ? (
                      <button
                        type="button"
                        disabled={!canManageModules}
                        onClick={() => toggleModule(mod.id, !isEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 shrink-0 ${
                          isEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                        }`}
                        title={t('modulesToggleLabel')}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] crystal-tile text-slate-200 shrink-0">
                        <Lock className="w-3 h-3 text-violet-300" />
                        {t('moduleCoreRequired')}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{t(mod.descriptionKey)}</p>

                  <div className="space-y-1.5 pt-2 border-t border-white/15 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">{t('moduleDataScopeLabel')}</span>
                      <span className="font-mono text-slate-200">{mod.dataScopeKey}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">{t('modulePermissionReqLabel')}</span>
                      <span className="text-emerald-300 font-medium">
                        {t(`perm_${mod.requiredPermission}`)}
                      </span>
                    </div>
                  </div>

                  {mod.submenus.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-300">{t('moduleSubmenusLabel')}</span>
                      {mod.submenus.map((sub) => (
                        <span
                          key={sub.id}
                          className="px-2 py-0.5 rounded-md glass-subcard text-[10px] text-slate-200"
                        >
                          {t(sub.labelKey)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/15 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      isEnabled && hasAccess ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isEnabled
                      ? hasAccess
                        ? t('activeWorkspaceLabel')
                        : t('moduleAccessDeniedNotice')
                      : t('moduleDisabledNotice')}
                  </span>

                  {isEnabled && hasAccess && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(mod.id as ActiveTab)}
                      className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 font-semibold cursor-pointer shrink-0"
                    >
                      <span>{t('viewAll')}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="crystal-tile rounded-2xl p-5 flex items-start gap-3">
            <Layers className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">{t('futureModulesTitle')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('futureModulesSubtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FUTURE_MODULE_BLUEPRINTS.map((bp) => (
              <div
                key={bp.id}
                className="neon-glass rounded-2xl p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                      {t(bp.categoryKey)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/25">
                      {t('futurePlannedBadge')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>{t(bp.titleKey)}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{t(bp.descriptionKey)}</p>
                </div>

                <div className="pt-2 border-t border-white/15 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {bp.targetWorkspaceTypes.map((wt) => (
                      <span
                        key={wt}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold crystal-tile text-slate-200 uppercase"
                      >
                        {wt}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {bp.requiredBackendCapabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] glass-subcard text-slate-300"
                      >
                        <Shield className="w-2.5 h-2.5 text-slate-400" />
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
