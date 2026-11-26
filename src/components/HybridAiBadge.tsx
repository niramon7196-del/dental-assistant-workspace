import React, { useSyncExternalStore } from 'react';
import { Cpu, Cloud, Server, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  enableOnDeviceModel,
  getHybridStatus,
  setHybridEnabled,
  subscribeHybridStatus
} from '../services/hybridAi';

/**
 * Shows which AI path is active and lets the user switch Hybrid mode on.
 * The button tap is the user gesture Chrome requires to download Gemini Nano.
 */
export const HybridAiBadge: React.FC = () => {
  const { t } = useLanguage();
  const s = useSyncExternalStore(subscribeHybridStatus, getHybridStatus, getHybridStatus);

  if (!s.configured) return null;

  let label: string;
  let Icon = Server;
  if (!s.enabled) {
    label = t('hybridModeServer');
  } else if (s.downloading) {
    label = `${t('hybridDownloading')} ${Math.round(s.progress * 100)}%`;
    Icon = Loader2;
  } else if (s.lastSource === 'on-device' || (s.deviceReady && s.lastSource === null)) {
    label = t('hybridModeOnDevice');
    Icon = Cpu;
  } else if (s.lastSource === 'cloud' || !s.deviceCapable) {
    label = t('hybridModeCloud');
    Icon = Cloud;
  } else {
    label = t('hybridModeAuto');
    Icon = Cpu;
  }

  return (
    <div className="ml-auto shrink-0 flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-200 whitespace-nowrap"
        title={!s.deviceCapable ? t('hybridUnsupported') : undefined}
      >
        <Icon className={`w-4 h-4 ${s.downloading ? 'animate-spin' : ''}`} />
        {label}
      </span>
      {s.enabled ? (
        <button
          type="button"
          onClick={() => setHybridEnabled(false)}
          className="min-h-[44px] px-3 rounded-xl border border-white/15 text-xs text-slate-300 active:bg-white/15"
        >
          {t('hybridOff')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void enableOnDeviceModel()}
          className="min-h-[44px] px-3 rounded-xl border border-violet-300/50 bg-violet-500/30 text-xs font-semibold text-white active:bg-violet-500/50"
        >
          {t('hybridEnableBtn')}
        </button>
      )}
    </div>
  );
};
