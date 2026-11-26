import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Cpu,
  Activity,
  Database,
  ScanSearch
} from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import mascotWelcome from '../assets/images/mascot_welcome_1795242056750.jpg';

const LANDING_MASCOT_URL = 'https://i.postimg.cc/NjktjjyL/915124600-1800868747806524-2398384840772570514-n.webp';

interface LandingPageProps {
  onEnterWorkspace: () => void;
  onEnterJudgeDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterWorkspace,
  onEnterJudgeDemo
}) => {
  const { t } = useLanguage();
  const [mascotSrc, setMascotSrc] = useState<string>(LANDING_MASCOT_URL);

  return (
    <div className="min-h-screen landing-bg text-slate-100 flex flex-col justify-between selection:bg-violet-500/30 selection:text-violet-200 relative overflow-x-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[28rem] h-[28rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="w-full max-w-[1440px] mx-auto px-6 md:px-10 xl:px-12 py-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30 border border-white/25 text-white">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="landing-text-depth">
            <h1 className="font-semibold text-slate-50 text-sm tracking-tight">
              {t('landingBrandTitle')}
            </h1>
            <p className="text-[10px] text-violet-300 font-medium tracking-wide">
              {t('landingBrandTagline')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={onEnterJudgeDemo}
            title={t('judgeDemoHeaderTooltip')}
            className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs font-medium shadow-lg shadow-violet-500/30 border border-white/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
            <span>{t('landingJudgeDemoBtn')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-[1440px] mx-auto px-6 md:px-10 xl:px-12 py-6 md:py-8 lg:py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.2fr)] gap-8 md:gap-10 lg:gap-8 xl:gap-10 items-center z-10 my-auto">
        <div className="space-y-5 lg:space-y-6 relative z-20 lg:pr-2">
          <div className="crystal-tile inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-300/35 text-violet-100 text-xs font-medium landing-text-depth">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            <span>{t('landingHeroBadge')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-[3.5rem] 2xl:text-6xl font-bold tracking-tight leading-tight drop-shadow-[0_6px_22px_rgba(8,4,24,0.85)]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-violet-200 to-sky-200 [-webkit-text-stroke:1.25px_rgba(12,8,28,0.82)] [paint-order:stroke_fill] [text-shadow:0_2px_14px_rgba(10,6,26,0.72)]">
              {t('landingHeroTitlePrefix')}{' '}
            </span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-200 via-violet-200 to-cyan-200 [-webkit-text-stroke:1.35px_rgba(12,8,28,0.86)] [paint-order:stroke_fill] [text-shadow:0_4px_18px_rgba(10,6,26,0.76),0_0_24px_rgba(192,132,252,0.34)]">
              {t('landingHeroTitleHighlight')}
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-100/95 max-w-2xl leading-relaxed landing-text-depth">
            {t('landingHeroDesc')}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onEnterWorkspace}
              className="crystal-btn flex items-center gap-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-indigo-500 text-white px-7 py-3.5 rounded-2xl text-sm font-semibold shadow-xl shadow-violet-600/35 border border-white/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>{t('landingLaunchBtn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="crystal-tile flex items-center gap-2 text-xs text-slate-100 px-4 py-3 rounded-2xl border border-emerald-300/30 landing-text-depth">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>{t('landingSecurityBadge')}</span>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-white/15 landing-text-depth">
            <div className="crystal-tile rounded-xl p-3 border border-violet-300/25">
              <p className="text-sm font-bold text-white">{t('aiInbox')}</p>
              <p className="text-xs text-slate-200/90 mt-0.5 leading-snug">{t('landingFeatureInboxDesc')}</p>
            </div>
            <div className="crystal-tile rounded-xl p-3 border border-cyan-300/25">
              <p className="text-sm font-bold text-white">{t('labTracker')}</p>
              <p className="text-xs text-slate-200/90 mt-0.5 leading-snug">{t('landingFeatureLabDesc')}</p>
            </div>
            <div className="crystal-tile rounded-xl p-3 border border-pink-300/25">
              <p className="text-sm font-bold text-white">{t('evidence')}</p>
              <p className="text-xs text-slate-200/90 mt-0.5 leading-snug">{t('landingFeatureEvidenceDesc')}</p>
            </div>
          </div>
        </div>

        {/* Welcome Mascot Image Showcase (GPU-Friendly Floating + Synchronized AI Analysis Nodes) */}
        <div className="flex flex-col items-center lg:items-end justify-center relative z-10 lg:pl-4">
          <div className="relative w-full lg:w-[calc(100%+1.5rem)] xl:w-[calc(100%+2.5rem)] max-w-xl md:max-w-2xl lg:max-w-[660px] xl:max-w-[760px] lg:-mr-6 xl:-mr-10 flex flex-col items-center">
            {/* Soft Ambient Pastel Purple & Blue-Violet Halo */}
            <div
              aria-hidden="true"
              className="hero-mascot-glow landing-halo-breathe absolute -inset-10 sm:-inset-16 pointer-events-none"
            ></div>

            {/* Rim Highlight Ring behind Mascot */}
            <div
              aria-hidden="true"
              className="landing-mascot-rim landing-ai-ring-pulse absolute inset-6 sm:inset-10 rounded-full pointer-events-none"
            ></div>

            {/* Subtle Orbital AI Frame Rings (transform & opacity only) */}
            <div
              aria-hidden="true"
              className="landing-ai-ring-pulse-delayed absolute inset-4 sm:inset-12 rounded-full border border-violet-300/25 pointer-events-none"
            ></div>
            <div
              aria-hidden="true"
              className="landing-ai-ring-pulse absolute inset-10 sm:inset-20 rounded-full border border-cyan-300/20 pointer-events-none"
            ></div>

            {/* Lightweight SVG Curved Data Links & Data Pulse Dots (Mascot Eyes/Hand -> Right AI Frames) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 600 560"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full z-[15] pointer-events-none"
              fill="none"
            >
              <defs>
                <linearGradient id="landingLinkCyan" x1="52%" y1="32%" x2="88%" y2="15%">
                  <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.12" />
                  <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.48" />
                </linearGradient>
                <linearGradient id="landingLinkPink" x1="58%" y1="50%" x2="88%" y2="18%">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity="0.14" />
                  <stop offset="55%" stopColor="#c084fc" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.42" />
                </linearGradient>
                <linearGradient id="landingLinkViolet" x1="57%" y1="56%" x2="86%" y2="75%">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.14" />
                  <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.42" />
                </linearGradient>
              </defs>

              {/* Curve 1: Mascot Eye Area -> Top-Right AI Scan Frame */}
              <path
                d="M 316 176 C 384 128 448 96 516 86"
                stroke="url(#landingLinkCyan)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <path
                d="M 316 176 C 384 128 448 96 516 86"
                pathLength={100}
                stroke="#67e8f9"
                strokeOpacity="0.26"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray="0.1 115"
                className="landing-data-pulse-1"
              />
              <path
                d="M 316 176 C 384 128 448 96 516 86"
                pathLength={100}
                stroke="#cffafe"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeDasharray="0.1 115"
                className="landing-data-pulse-1"
              />

              {/* Curve 2: Mascot Hand Area -> Top-Right AI Scan Frame */}
              <path
                d="M 348 274 C 424 238 482 176 520 98"
                stroke="url(#landingLinkPink)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <path
                d="M 348 274 C 424 238 482 176 520 98"
                pathLength={100}
                stroke="#e879f9"
                strokeOpacity="0.24"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray="0.1 115"
                className="landing-data-pulse-2"
              />
              <path
                d="M 348 274 C 424 238 482 176 520 98"
                pathLength={100}
                stroke="#fae8ff"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeDasharray="0.1 115"
                className="landing-data-pulse-2"
              />

              {/* Curve 3: Mascot Hand/Core -> Bottom-Right AI Database Frame */}
              <g className="hidden sm:block">
                <path
                  d="M 344 316 C 414 342 468 378 510 412"
                  stroke="url(#landingLinkViolet)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
                <path
                  d="M 344 316 C 414 342 468 378 510 412"
                  pathLength={100}
                  stroke="#a78bfa"
                  strokeOpacity="0.24"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray="0.1 115"
                  className="landing-data-pulse-3"
                />
                <path
                  d="M 344 316 C 414 342 468 378 510 412"
                  pathLength={100}
                  stroke="#ede9fe"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeDasharray="0.1 115"
                  className="landing-data-pulse-3"
                />
              </g>
            </svg>

            {/* Ambient Staggered AI Analysis Nodes & Gentle Signal Flow */}
            <div
              aria-hidden="true"
              className="landing-ai-orbit-a landing-ai-node absolute top-8 left-4 sm:top-12 sm:left-10 z-20 flex items-center gap-2 px-3 py-2 rounded-2xl border border-violet-300/35 pointer-events-none"
            >
              <Cpu className="w-4 h-4 text-violet-200" />
              <div className="flex items-center gap-1">
                <span className="landing-ai-signal-a w-1.5 h-1.5 rounded-full bg-violet-300"></span>
                <span className="landing-ai-signal-b w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                <span className="landing-ai-signal-c w-1.5 h-1.5 rounded-full bg-fuchsia-300"></span>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="landing-ai-orbit-b landing-ai-node absolute top-14 right-4 sm:top-16 sm:right-10 z-20 flex items-center gap-2 px-3 py-2 rounded-2xl border border-cyan-300/35 pointer-events-none"
            >
              <ScanSearch className="w-4 h-4 text-cyan-200" />
              <span className="landing-ai-signal-b w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
            </div>

            <div
              aria-hidden="true"
              className="landing-ai-orbit-c landing-ai-node hidden sm:flex absolute bottom-28 left-6 md:left-12 z-20 items-center gap-2 px-3 py-2 rounded-2xl border border-fuchsia-300/30 pointer-events-none"
            >
              <Activity className="w-4 h-4 text-fuchsia-200" />
              <span className="landing-ai-signal-c w-1.5 h-1.5 rounded-full bg-fuchsia-300"></span>
            </div>

            <div
              aria-hidden="true"
              className="landing-ai-orbit-d landing-ai-node hidden sm:flex absolute bottom-24 right-6 md:right-12 z-20 items-center gap-2 px-3 py-2 rounded-2xl border border-emerald-300/30 pointer-events-none"
            >
              <Database className="w-4 h-4 text-emerald-200" />
              <span className="landing-ai-signal-a w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
            </div>

            {/* Layered Elliptical Shadow Underneath Mascot (syncs scale/opacity with float) */}
            <div
              aria-hidden="true"
              className="landing-shadow-breathe landing-mascot-ground-shadow absolute bottom-6 left-1/2 w-[64%] h-14 rounded-full pointer-events-none"
            ></div>

            {/* Feathered Mascot Image with Smooth GPU Hover */}
            <div className="relative w-full flex justify-center landing-mascot-hover">
              <div className="relative w-full flex justify-center landing-mascot-float-shadow">
                <img
                  src={mascotSrc}
                  alt={t('landingMascotTitle')}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (mascotSrc !== mascotWelcome) {
                      setMascotSrc(mascotWelcome);
                    }
                  }}
                  className="hero-mascot-feather relative w-full h-auto max-h-[460px] sm:max-h-[540px] md:max-h-[600px] lg:max-h-[620px] xl:max-h-[740px] object-contain mx-auto select-none"
                />
              </div>
            </div>

            {/* Balanced Caption Below Mascot */}
            <div className="relative z-10 -mt-3 sm:-mt-4 px-4 text-center space-y-1 max-w-md landing-text-depth">
              <div className="inline-flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-300 landing-ai-signal-a" />
                <span className="text-xs font-semibold text-white">
                  {t('landingMascotTitle')}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {t('landingMascotDesc')}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1440px] mx-auto px-6 md:px-10 xl:px-12 py-5 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-200/85 z-20 landing-text-depth">
        <p>© 2026 {t('brand')}. {t('landingFooterPlatform')}</p>
        <p className="mt-2 sm:mt-0 flex items-center gap-1.5 text-violet-300 font-medium">
          <Sparkles className="w-3.5 h-3.5" /> {t('landingFooterPowered')}
        </p>
      </footer>
    </div>
  );
};
