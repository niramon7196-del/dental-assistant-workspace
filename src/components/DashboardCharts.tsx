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

interface DashboardChartsProps {
  queueAndTodayCount: number;
  labsActiveCount: number;
  followUpAndDentureCount: number;
  stockAndEvidenceCount: number;
  completedQueueCount: number;
  completedLabsCount: number;
  completedFollowUpsCount: number;
  isPersonal: boolean;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  queueAndTodayCount,
  labsActiveCount,
  followUpAndDentureCount,
  stockAndEvidenceCount,
  completedQueueCount,
  completedLabsCount,
  completedFollowUpsCount,
  isPersonal
}) => {
  const { t, language } = useLanguage();
  const { isJudgeDemoActive } = useWorkspace();

  const glassClass = isPersonal ? 'neon-glass-personal' : 'neon-glass';

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
    const qToday = queueAndTodayCount + completedQueueCount;
    const lToday = labsActiveCount + completedLabsCount;
    const fToday = followUpAndDentureCount + completedFollowUpsCount;

    const qSeries = isJudgeDemoActive
      ? [
          Math.max(2, qToday - 4),
          Math.max(3, qToday - 2),
          Math.max(2, qToday - 3),
          Math.max(4, qToday - 1),
          Math.max(3, qToday - 2),
          Math.max(5, qToday - 1),
          qToday
        ]
      : [0, 0, 0, 0, 0, 0, qToday];
    const lSeries = isJudgeDemoActive
      ? [
          Math.max(1, lToday - 3),
          Math.max(2, lToday - 2),
          Math.max(2, lToday - 2),
          Math.max(3, lToday - 1),
          Math.max(2, lToday - 2),
          Math.max(3, lToday - 1),
          lToday
        ]
      : [0, 0, 0, 0, 0, 0, lToday];
    const fSeries = isJudgeDemoActive
      ? [
          Math.max(2, fToday - 3),
          Math.max(3, fToday - 2),
          Math.max(2, fToday - 3),
          Math.max(4, fToday - 1),
          Math.max(3, fToday - 2),
          Math.max(4, fToday - 1),
          fToday
        ]
      : [0, 0, 0, 0, 0, 0, fToday];

    return {
      labels: weekLabels,
      datasets: [
        {
          label: t('chartTrendSeriesQueue'),
          data: qSeries,
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
          pointRadius: qToday > 0 ? 4 : 2,
          pointBackgroundColor: '#f5d0fe',
          pointBorderColor: '#a855f7',
          tension: 0.35,
          fill: true
        },
        {
          label: t('chartTrendSeriesLab'),
          data: lSeries,
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.08)',
          borderWidth: 2,
          pointRadius: lToday > 0 ? 4 : 2,
          pointBackgroundColor: '#99f6e4',
          tension: 0.35,
          fill: false
        },
        {
          label: t('chartTrendSeriesFollowup'),
          data: fSeries,
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251, 146, 60, 0.08)',
          borderWidth: 2,
          pointRadius: fToday > 0 ? 4 : 2,
          pointBackgroundColor: '#fed7aa',
          tension: 0.35,
          fill: false
        }
      ]
    };
  }, [
    weekLabels,
    t,
    isJudgeDemoActive,
    queueAndTodayCount,
    completedQueueCount,
    labsActiveCount,
    completedLabsCount,
    followUpAndDentureCount,
    completedFollowUpsCount
  ]);

  const hasAnyTrendData =
    queueAndTodayCount +
      completedQueueCount +
      labsActiveCount +
      completedLabsCount +
      followUpAndDentureCount +
      completedFollowUpsCount >
    0;

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
            color: '#cbd5e1',
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 }
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
          ticks: { color: '#e2e8f0', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 5,
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#e2e8f0', precision: 0, font: { size: 11 } }
        }
      }
    }),
    []
  );

  const zoneValues = useMemo(
    () => [
      queueAndTodayCount,
      labsActiveCount,
      followUpAndDentureCount,
      stockAndEvidenceCount
    ],
    [queueAndTodayCount, labsActiveCount, followUpAndDentureCount, stockAndEvidenceCount]
  );

  const totalZoneItems = zoneValues.reduce((acc, n) => acc + n, 0);

  const doughnutData = useMemo(
    () => ({
      labels:
        totalZoneItems > 0
          ? [t('zoneTabQueue'), t('zoneTabLab'), t('zoneTabFollowup'), t('zoneTabEvidence')]
          : [t('zoneEmptyRows')],
      datasets: [
        {
          data: totalZoneItems > 0 ? zoneValues : [1],
          backgroundColor:
            totalZoneItems > 0
              ? ['#a855f7', '#2dd4bf', '#fb923c', '#ec4899']
              : ['rgba(255, 255, 255, 0.14)'],
          borderColor: 'rgba(255, 255, 255, 0.22)',
          borderWidth: 2,
          hoverOffset: totalZoneItems > 0 ? 5 : 0
        }
      ]
    }),
    [t, totalZoneItems, zoneValues]
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
          enabled: totalZoneItems > 0,
          backgroundColor: 'rgba(16, 10, 36, 0.72)',
          borderColor: 'rgba(216, 180, 254, 0.40)',
          borderWidth: 1,
          padding: 10
        }
      }
    }),
    [totalZoneItems]
  );

  const zoneLegendItems = [
    { label: t('zoneTabQueue'), count: queueAndTodayCount, dotClass: 'bg-purple-400' },
    { label: t('zoneTabLab'), count: labsActiveCount, dotClass: 'bg-teal-400' },
    { label: t('zoneTabFollowup'), count: followUpAndDentureCount, dotClass: 'bg-orange-400' },
    { label: t('zoneTabEvidence'), count: stockAndEvidenceCount, dotClass: 'bg-pink-400' }
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Line Chart: 7-day Assistant Workload Trend */}
      <div className={`${glassClass} rounded-2xl p-5 xl:col-span-7 flex flex-col`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-100">{t('chartTrendTitle')}</h3>
          {!hasAnyTrendData && (
            <span className="text-[11px] text-slate-400">{t('chartEmptyNote')}</span>
          )}
        </div>
        <div className="relative h-[230px] w-full touch-pan-y">
          <Line data={lineData} options={lineOptions} />
        </div>
      </div>

      {/* Doughnut Chart: Zone Percentage Split with Center Total */}
      <div className={`${glassClass} rounded-2xl p-5 xl:col-span-5 flex flex-col justify-between`}>
        <h3 className="text-sm font-semibold text-slate-100 mb-3">{t('chartZoneRatioTitle')}</h3>
        <div className="flex flex-col sm:flex-row items-center gap-5 my-auto">
          <div className="relative w-44 h-44 shrink-0 touch-pan-y">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-slate-300">{t('chartTotalItemsCenter')}</span>
              <span className="text-3xl font-extrabold bg-gradient-to-r from-cyan-200 via-violet-200 to-pink-200 bg-clip-text text-transparent tabular-nums kpi-num-glow">
                {formatNumberByLanguage(totalZoneItems, language)}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2.5 text-xs">
            {zoneLegendItems.map((item) => {
              const pct =
                totalZoneItems > 0 ? Math.round((item.count / totalZoneItems) * 100) : 0;
              return (
                <div
                  key={item.label}
                  className="crystal-tile flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dotClass}`} />
                    <span className="text-slate-100 font-medium truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                    <span className="text-slate-300 text-[11px]">
                      {formatNumberByLanguage(item.count, language)}
                    </span>
                    <span className="text-white font-semibold w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
