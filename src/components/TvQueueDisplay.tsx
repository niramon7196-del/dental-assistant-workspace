import React, { useEffect, useState } from 'react';
import { MonitorPlay, Maximize2, Minimize2, Volume2, X, Clock, ArrowRight } from 'lucide-react';
import { QueueItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { readQueueItemsDirect } from '../services/workspaceStorage';
import { fetchRemoteQueue, buildCallSentence } from '../services/queueRelay';
import { formatNumberByLanguage } from '../utils/i18n';

interface TvQueueDisplayProps {
  workspaceId: string;
  workspaceName: string;
  items?: QueueItem[];
  isStandaloneWindow?: boolean;
  onClose?: () => void;
  /** Pairing code: when set, queue is polled from the server (iPad -> counter PC). */
  relayCode?: string;
}

export const TvQueueDisplay: React.FC<TvQueueDisplayProps> = ({
  workspaceId,
  workspaceName,
  items: propItems,
  isStandaloneWindow = false,
  onClose,
  relayCode
}) => {
  const { t, language } = useLanguage();
  const [liveItems, setLiveItems] = useState<QueueItem[]>(() =>
    propItems ?? readQueueItemsDirect(workspaceId)
  );
  const [nowClock, setNowClock] = useState(() =>
    new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (propItems) {
      setLiveItems(propItems);
    }
  }, [propItems]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowClock(
        new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  // Listen to real-time updates from BroadcastChannel and localStorage storage events
  useEffect(() => {
    const syncFromStorage = () => {
      setLiveItems(readQueueItemsDirect(workspaceId));
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes(workspaceId)) {
        syncFromStorage();
      }
    };
    window.addEventListener('storage', handleStorage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('dental_assistant_queue_tv');
      channel.onmessage = (ev) => {
        if (ev.data?.workspaceId === workspaceId && Array.isArray(ev.data?.items)) {
          setLiveItems(ev.data.items);
        }
      };
    } catch {
      // Optional BroadcastChannel fallback
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
    };
  }, [workspaceId]);

  // Cross-device sync: poll the server relay every 2s (counter PC shows what the iPad publishes)
  const [soundOn, setSoundOn] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>(() => {
    try {
      return localStorage.getItem('growthlab.tvVoice.name') || '';
    } catch {
      return '';
    }
  });
  const [voiceRate, setVoiceRate] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem('growthlab.tvVoice.rate') || '');
      return Number.isFinite(v) ? v : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [voiceRepeat, setVoiceRepeat] = useState<number>(() => {
    try {
      return localStorage.getItem('growthlab.tvVoice.repeat') === '1' ? 1 : 2;
    } catch {
      return 2;
    }
  });
  const saveVoicePref = (k: string, v: string) => {
    try {
      localStorage.setItem(`growthlab.tvVoice.${k}`, v);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  const thaiVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('th'));
  const voiceChoices = thaiVoices.length > 0 ? thaiVoices : voices;

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    try {
      synth.cancel();
      synth.resume();
    } catch {
      // ignore
    }
    // Chrome/Edge can drop an utterance queued in the same tick as cancel(); wait a beat.
    window.setTimeout(() => {
      try {
        const all = synth.getVoices();
        const chosen =
          all.find((v) => v.name === voiceName) ||
          all.find((v) => v.lang.toLowerCase().startsWith(language === 'en' ? 'en' : 'th'));
        for (let i = 0; i < voiceRepeat; i += 1) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = language === 'en' ? 'en-US' : 'th-TH';
          u.rate = voiceRate;
          u.volume = 1;
          if (chosen) u.voice = chosen;
          synth.speak(u);
        }
        synth.resume();
      } catch {
        // ignore
      }
    }, 150);
  };

  const spokenRef = React.useRef<string>('');
  const firstPollRef = React.useRef(true);
  const remoteReadyRef = React.useRef(false);
  const [syncInfo, setSyncInfo] = useState<{ ok: boolean; at: string }>({ ok: true, at: '' });
  useEffect(() => {
    if (!relayCode) return;
    let stop = false;
    const tick = async () => {
      const remote = await fetchRemoteQueue(relayCode);
      if (stop) return;
      setSyncInfo({ ok: !!remote, at: new Date().toLocaleTimeString('th-TH') });
      if (!remote) return;
      remoteReadyRef.current = true;
      setLiveItems(remote);
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [relayCode]);

  // Speak the queue item whose call just changed (works for same-minute calls and re-calls)
  const prevCallKeysRef = React.useRef<Record<string, string>>({});
  useEffect(() => {
    const keys: Record<string, string> = {};
    const changed: QueueItem[] = [];
    liveItems.forEach((q) => {
      if (q.status !== 'called') return;
      const key = String(q.calledAtMs ?? q.calledAt ?? '1');
      keys[q.id] = key;
      if (prevCallKeysRef.current[q.id] !== key) changed.push(q);
    });
    const isFirst = firstPollRef.current;
    prevCallKeysRef.current = keys;
    if (isFirst) {
      // Only baseline once real data exists (avoid speaking old calls on page open)
      if (!relayCode || remoteReadyRef.current) firstPollRef.current = false;
      return;
    }
    if (changed.length === 0 || !soundOn || !('speechSynthesis' in window)) return;
    const latest = changed.sort((a, b) => (b.calledAtMs ?? 0) - (a.calledAtMs ?? 0))[0];
    speakText(
      buildCallSentence(latest.patientName, latest.roomName || '', language === 'en' ? 'en' : 'th')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveItems, soundOn, language]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore if fullscreen blocked by browser/iFrame
    }
  };

  const calledItems = liveItems
    .filter((q) => q.status === 'called')
    .sort((a, b) => (b.calledAt || '').localeCompare(a.calledAt || ''));

  const waitingItems = liveItems.filter((q) => q.status === 'waiting');

  return (
    <div
      className={`${
        isStandaloneWindow ? 'min-h-screen' : 'fixed inset-0 z-[100]'
      } cosmic-bg text-slate-100 flex flex-col justify-between p-6 sm:p-10 overflow-y-auto`}
    >
      {/* Top TV Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/15">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-wider text-violet-200 text-depth font-semibold">
              {workspaceName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-depth">
              {t('queueTvNowCalling')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl crystal-tile text-lg sm:text-xl font-mono font-bold tabular-nums text-violet-100">
            <Clock className="w-5 h-5 text-violet-300" />
            <span>{nowClock}</span>
          </div>
          {relayCode && (
            <span className={`text-xs font-semibold ${syncInfo.ok ? 'text-emerald-200' : 'text-rose-200'}`}>
              {syncInfo.ok ? `ซิงก์ล่าสุด ${syncInfo.at}` : 'ติดต่อเซิร์ฟเวอร์ไม่ได้'}
            </span>
          )}

          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold cursor-pointer ${
              soundOn ? 'bg-emerald-600/30 border-emerald-300/50 text-emerald-100' : 'crystal-tile border-white/20 text-slate-100'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{soundOn ? 'เสียงเรียก: เปิด' : 'แตะเพื่อเปิดเสียงเรียก'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowVoiceSettings((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl crystal-tile border border-white/20 text-sm font-semibold text-slate-100 cursor-pointer"
          >
            <span>ตั้งค่าเสียง</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="p-3 rounded-2xl crystal-tile hover:bg-white/15 text-slate-100 cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {!isStandaloneWindow && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600/25 hover:bg-rose-600/35 border border-rose-400/45 text-rose-100 text-sm font-semibold cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>{t('queueTvCloseBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {showVoiceSettings && (
        <div className="crystal-tile rounded-2xl border border-white/25 p-4 mb-4 grid gap-3 sm:grid-cols-3 text-sm text-slate-100">
          <label className="grid gap-1">
            <span className="font-semibold">เสียงผู้พูด</span>
            <select
              value={voiceName}
              onChange={(e) => {
                setVoiceName(e.target.value);
                saveVoicePref('name', e.target.value);
              }}
              className="glass-input min-h-[44px] px-3 rounded-xl"
            >
              <option value="">อัตโนมัติ (ค่าเริ่มต้นของเครื่อง)</option>
              {voiceChoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">ความเร็ว: {voiceRate.toFixed(2)} (ยิ่งน้อยยิ่งช้าและชัด)</span>
            <input
              type="range"
              min={0.5}
              max={1.1}
              step={0.05}
              value={voiceRate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVoiceRate(v);
                saveVoicePref('rate', String(v));
              }}
              className="min-h-[44px]"
            />
          </label>
          <div className="grid gap-1">
            <span className="font-semibold">จำนวนครั้งที่พูด</span>
            <div className="flex gap-2">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setVoiceRepeat(n);
                    saveVoicePref('repeat', String(n));
                  }}
                  className={`min-h-[44px] px-4 rounded-xl border font-semibold cursor-pointer ${
                    voiceRepeat === n ? 'bg-violet-600/80 border-violet-300/60' : 'crystal-tile border-white/20'
                  }`}
                >
                  {n} ครั้ง
                </button>
              ))}
              <button
                type="button"
                onClick={() => speakText(buildCallSentence('ทดสอบ', 'ห้อง 1', 'th'))}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600/80 border border-emerald-300/60 font-semibold cursor-pointer"
              >
                ลองฟัง
              </button>
            </div>
          </div>
          {voices.length === 0 && (
            <p className="sm:col-span-3 text-amber-200 text-xs">
              ยังไม่พบเสียงในเบราว์เซอร์นี้ ลองกด "ลองฟัง" หรือรีเฟรชหน้าอีกครั้ง
            </p>
          )}
        </div>
      )}

      {/* Main Display Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 items-stretch">
        {/* Left: Active Calling Cards (High-visibility for distance reading) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {calledItems.length === 0 ? (
            <div className="flex-1 min-h-[280px] rounded-3xl neon-glass flex flex-col items-center justify-center text-center p-10 space-y-4">
              <Volume2 className="w-16 h-16 text-violet-300/75" />
              <p className="text-2xl sm:text-3xl font-semibold text-slate-200 text-depth">
                {t('queueTvNoActiveCall')}
              </p>
              <p className="text-sm text-slate-300 max-w-md">{t('queueTvOtherClaimedHint')}</p>
            </div>
          ) : (
            calledItems.map((item, idx) => (
              <div
                key={item.id}
                className={`rounded-3xl p-7 sm:p-10 neon-glass transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${
                  idx === 0
                    ? 'border-violet-300/60 shadow-2xl shadow-violet-600/25'
                    : 'border-white/25'
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className="px-6 py-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-4xl sm:text-6xl font-black tracking-tight shadow-lg shadow-violet-600/40 shrink-0 font-mono tabular-nums">
                    {item.queueNumber}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-emerald-300 text-sm sm:text-base font-semibold">
                      <Volume2 className="w-5 h-5 animate-pulse shrink-0" />
                      <span>{t('queueStatusCalled')}</span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-extrabold text-white text-depth tracking-tight truncate">
                      {item.patientName}
                    </h2>
                    <p className="text-lg sm:text-xl text-slate-200 truncate">{item.procedure}</p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2 glass-subcard sm:bg-transparent sm:border-0 sm:backdrop-blur-none px-5 py-3 sm:p-0 rounded-2xl">
                  <span className="text-xs uppercase tracking-wider text-violet-200 font-semibold">
                    {t('roomLabel')}
                  </span>
                  <div className="flex items-center gap-2 text-2xl sm:text-4xl font-bold text-amber-300 text-depth">
                    <ArrowRight className="w-6 h-6 hidden sm:inline" />
                    <span>{item.roomName || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Waiting Next List */}
        <div className="lg:col-span-4 neon-glass rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/15">
              <h3 className="text-lg font-bold text-slate-100">{t('queueTvWaitingNext')}</h3>
              <span className="px-3 py-1 rounded-full bg-violet-500/25 text-violet-100 border border-violet-300/40 text-sm font-bold tabular-nums">
                {formatNumberByLanguage(waitingItems.length, language)}
              </span>
            </div>

            {waitingItems.length === 0 ? (
              <p className="text-sm text-slate-300 py-8 text-center">{t('queueEmptyMsg')}</p>
            ) : (
              <div className="space-y-3">
                {waitingItems.slice(0, 7).map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl glass-subcard"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-3 py-1.5 rounded-xl crystal-tile text-violet-200 font-mono font-bold text-lg shrink-0 tabular-nums">
                        {q.queueNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base sm:text-lg font-bold text-slate-100 truncate">
                          {q.patientName}
                        </p>
                        <p className="text-xs text-slate-300 truncate">{q.procedure}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-300 pt-4 border-t border-white/15 mt-4">
            {t('queueTvOtherClaimedHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
