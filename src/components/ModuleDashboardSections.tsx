import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ScriptableContext
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Activity,
  ArrowRight,
  LayoutDashboard,
  Megaphone,
  MessageSquareHeart,
  MonitorPlay,
  PackageCheck,
  Plus
} from 'lucide-react';
import { ActiveTab } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatNumberByLanguage } from '../utils/i18n';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

export type KpiTone = 'purple' | 'cyan' | 'amber' | 'rose';

export interface StandardKpiItem {
  id: string;
  label: string;
  value: number | string;
  subLabel?: string;
  tone: KpiTone;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
}

export const StandardKpiGrid: React.FC<{ items: StandardKpiItem[] }> = ({ items }) => {
  const { language } = useLanguage();

  const toneConfig: Record<
    KpiTone,
    { cardClass: string; titleClass: string; iconWrapClass: string; subClass: string }
  > = {
    purple: {
      cardClass: 'kpi-glow-purple',
      titleClass: 'text-violet-100/90',
      iconWrapClass: 'bg-violet-400/20 text-violet-200 border-violet-300/35',
      subClass: 'text-violet-200/90'
    },
    cyan: {
      cardClass: 'kpi-glow-cyan',
      titleClass: 'text-cyan-100/90',
      iconWrapClass: 'bg-cyan-400/20 text-cyan-200 border-cyan-300/35',
      subClass: 'text-cyan-200/90'
    },
    amber: {
      cardClass: 'kpi-glow-amber',
      titleClass: 'text-amber-100/90',
      iconWrapClass: 'bg-amber-400/20 text-amber-200 border-amber-300/35',
      subClass: 'text-amber-200/90'
    },
    rose: {
      cardClass: 'kpi-glow-rose',
      titleClass: 'text-rose-100/90',
      iconWrapClass: 'bg-rose-400/20 text-rose-200 border-rose-300/35',
      subClass: 'text-rose-200/90'
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.slice(0, 4).map((item) => {
        const cfg = toneConfig[item.tone];
        const Icon = item.icon;
        const formattedVal =
          typeof item.value === 'number'
            ? formatNumberByLanguage(item.value, language)
            : item.value;

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`${cfg.cardClass} rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer group ${
              item.active ? 'ring-2 ring-white/55' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-xs font-semibold leading-snug ${cfg.titleClass}`}>
                {item.label}
              </span>
              <div className={`p-2 rounded-xl border shrink-0 ${cfg.iconWrapClass}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight kpi-num-glow">
                {formattedVal}
              </span>
              {item.subLabel && (
                <span
                  className={`text-[11px] font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform truncate ${cfg.subClass}`}
                >
                  <span className="truncate">{item.subLabel}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export interface RatioSlice {
  label: string;
  count: number;
  dotClass: string;
  colorHex: string;
}

export interface ModuleActivityItem {
  id: string;
  title: string;
  meta: string;
  dotClass?: string;
}

interface StandardAnalyticsAndActivityProps {
  trendTitle?: string;
  trendSeriesPrimaryLabel: string;
  trendSeriesPrimaryData: number[]; // length 7
  trendSeriesSecondaryLabel?: string;
  trendSeriesSecondaryData?: number[]; // length 7
  ratioTitle?: string;
  ratioSlices: RatioSlice[];
  activityTitle?: string;
  activities: ModuleActivityItem[];
  emptyActivityText?: string;
}

export const StandardAnalyticsAndActivity: React.FC<StandardAnalyticsAndActivityProps> = ({
  trendTitle,
  trendSeriesPrimaryLabel,
  trendSeriesPrimaryData,
  trendSeriesSecondaryLabel,
  trendSeriesSecondaryData,
  ratioTitle,
  ratioSlices,
  activityTitle,
  activities,
  emptyActivityText
}) => {
  const { t, language } = useLanguage();
  const { activeWorkspace } = useWorkspace();
  const glassClass = activeWorkspace.type === 'personal' ? 'neon-glass-personal' : 'neon-glass';

  const weekLabels = useMemo(
    () => [
      t('chartWeekdayMon'),
      t('chartWeekdayTue'),
      t('chartWeekdayWed'),
      t('chartWeekdayThu'),
      t('chartWeekdayFri'),
      t('chartWeekdaySat'),
      t('chartWeekdaySun')
    ],
    [t]
  );

  const lineData = useMemo(() => {
    const datasets: Array<{
      label: string;
      data: number[];
      borderColor: string | ((ctx: ScriptableContext<'line'>) => string | CanvasGradient);
      backgroundColor: string | ((ctx: ScriptableContext<'line'>) => string | CanvasGradient);
      borderWidth: number;
      pointRadius: number;
      pointBackgroundColor: string;
      tension: number;
      fill: boolean;
    }> = [
      {
        label: trendSeriesPrimaryLabel,
        data: trendSeriesPrimaryData,
        borderColor: (ctx: ScriptableContext<'line'>) => {
          const { chart } = ctx;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return '#c084fc';
          const grad = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
          grad.addColorStop(0, '#a855f7');
          grad.addColorStop(0.55, '#ec4899');
          grad.addColorStop(1, '#22d3ee');
          return grad;
        },
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const { chart } = ctx;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(192, 132, 252, 0.16)';
          const grad = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(192, 132, 252, 0.32)');
          grad.addColorStop(0.55, 'rgba(236, 72, 153, 0.14)');
          grad.addColorStop(1, 'rgba(15, 10, 34, 0.0)');
          return grad;
        },
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointBackgroundColor: '#f5d0fe',
        tension: 0.36,
        fill: true
      }
    ];

    if (trendSeriesSecondaryLabel && trendSeriesSecondaryData) {
      datasets.push({
        label: trendSeriesSecondaryLabel,
        data: trendSeriesSecondaryData,
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#99f6e4',
        tension: 0.36,
        fill: false
      });
    }

    return { labels: weekLabels, datasets };
  }, [
    weekLabels,
    trendSeriesPrimaryLabel,
    trendSeriesPrimaryData,
    trendSeriesSecondaryLabel,
    trendSeriesSecondaryData
  ]);

  const lineOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: '#e2e8f0',
            boxWidth: 9,
            boxHeight: 9,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 10.5 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(216, 180, 254, 0.40)',
          borderWidth: 1,
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#e2e8f0', font: { size: 10.5 } }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 5,
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#e2e8f0', precision: 0, font: { size: 10.5 } }
        }
      }
    }),
    []
  );

  const totalRatio = ratioSlices.reduce((acc, s) => acc + s.count, 0);

  const doughnutData = useMemo(
    () => ({
      labels: totalRatio > 0 ? ratioSlices.map((s) => s.label) : [t('zoneEmptyRows')],
      datasets: [
        {
          data: totalRatio > 0 ? ratioSlices.map((s) => s.count) : [1],
          backgroundColor:
            totalRatio > 0 ? ratioSlices.map((s) => s.colorHex) : ['rgba(255, 255, 255, 0.14)'],
          borderColor: 'rgba(255, 255, 255, 0.22)',
          borderWidth: 2,
          hoverOffset: totalRatio > 0 ? 5 : 0
        }
      ]
    }),
    [ratioSlices, totalRatio, t]
  );

  const doughnutOptions: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: { duration: 220 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: totalRatio > 0,
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(216, 180, 254, 0.40)',
          borderWidth: 1,
          padding: 10
        }
      }
    }),
    [totalRatio]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left: Gradient Line Trend */}
      <div className={`${glassClass} rounded-2xl p-5 xl:col-span-5 flex flex-col`}>
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          {trendTitle || t('moduleTrendTitle')}
        </h3>
        <div className="relative h-[200px] w-full touch-pan-y">
          <Line data={lineData} options={lineOptions} />
        </div>
      </div>

      {/* Center: Doughnut Status Split */}
      <div className={`${glassClass} rounded-2xl p-5 xl:col-span-4 flex flex-col justify-between`}>
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          {ratioTitle || t('moduleRatioTitle')}
        </h3>
        <div className="flex flex-col sm:flex-row xl:flex-row items-center gap-4 my-auto">
          <div className="relative w-36 h-36 shrink-0 touch-pan-y">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-300">{t('chartTotalItemsCenter')}</span>
              <span className="text-xl font-bold text-white tabular-nums kpi-num-glow">
                {formatNumberByLanguage(totalRatio, language)}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2 text-xs">
            {ratioSlices.map((slice) => {
              const pct = totalRatio > 0 ? Math.round((slice.count / totalRatio) * 100) : 0;
              return (
                <div
                  key={slice.label}
                  className="crystal-tile flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${slice.dotClass}`} />
                    <span className="text-slate-100 font-medium truncate text-[11px]">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums text-[11px]">
                    <span className="text-slate-300">
                      {formatNumberByLanguage(slice.count, language)}
                    </span>
                    <span className="text-white font-semibold w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Recent Activity / Live Stream */}
      <div className={`${glassClass} rounded-2xl p-5 xl:col-span-3 flex flex-col`}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-300 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {activityTitle || t('recentModuleActivityTitle')}
          </h3>
        </div>
        {activities.length === 0 ? (
          <div className="crystal-tile rounded-xl p-4 text-center my-auto text-xs text-slate-300">
            {emptyActivityText || t('zoneEmptyRows')}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[200px] pr-0.5">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="glass-subcard flex items-start gap-2.5 p-2.5 rounded-xl text-xs"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.dotClass || 'bg-violet-400'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-100 font-medium line-clamp-1">{act.title}</p>
                  <p className="text-[11px] text-slate-300/80 truncate mt-0.5">{act.meta}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface StandardQuickActionBarProps {
  setActiveTab?: (tab: ActiveTab) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export const StandardQuickActionBar: React.FC<StandardQuickActionBarProps> = ({
  setActiveTab,
  primaryActionLabel,
  onPrimaryAction
}) => {
  const { t } = useLanguage();
  const { activeWorkspace, setIsTvDisplayOpen } = useWorkspace();
  const isPersonal = activeWorkspace.type === 'personal';
  const glassSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';
  const showQueueWidget = activeWorkspace.enabledModules.queue !== false;
  const showChatCopilotBtn = activeWorkspace.enabledModules.chat_copilot !== false;

  if (!setActiveTab && !onPrimaryAction) return null;

  return (
    <div className={`${glassSurface} rounded-2xl p-3.5 sm:pr-20 flex flex-wrap items-center gap-2.5`}>
      {onPrimaryAction && primaryActionLabel && (
        <button
          type="button"
          onClick={onPrimaryAction}
          className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{primaryActionLabel.replace(/^\+\s*/, '')}</span>
        </button>
      )}

      {setActiveTab && (
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className="crystal-btn crystal-tile inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl border border-white/25 text-slate-100 text-xs font-semibold cursor-pointer"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-violet-300" />
          <span>{t('quickBarOverview')}</span>
        </button>
      )}

      {setActiveTab && showQueueWidget && (
        <>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{t('quickBarCallQueue')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTvDisplayOpen(true)}
            className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold cursor-pointer"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>{t('quickBarOpenTv')}</span>
          </button>
        </>
      )}

      {setActiveTab && showChatCopilotBtn && (
        <button
          type="button"
          onClick={() => setActiveTab('chat_copilot')}
          className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-semibold cursor-pointer"
        >
          <MessageSquareHeart className="w-3.5 h-3.5" />
          <span>{t('quickBarChatCopilot')}</span>
        </button>
      )}

      {setActiveTab && (
        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className="crystal-btn inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold cursor-pointer"
        >
          <PackageCheck className="w-3.5 h-3.5" />
          <span>{t('quickBarUploadEvidence')}</span>
        </button>
      )}
    </div>
  );
};
