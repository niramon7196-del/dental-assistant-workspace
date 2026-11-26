import React from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  Bot,
  AlertCircle,
  Layers,
  FlaskConical,
  MessageSquareHeart,
  Megaphone,
  Inbox
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveTab } from '../types/dental';

interface JudgeOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const JudgeOverviewModal: React.FC<JudgeOverviewModalProps> = ({
  isOpen,
  onClose,
  setActiveTab
}) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  const pillars = [
    {
      icon: AlertCircle,
      accent: 'text-amber-300 bg-amber-500/15 border-amber-400/35',
      cardBorder: 'border-amber-400/25',
      title: t('judgePillar1Title'),
      desc: t('judgePillar1Desc')
    },
    {
      icon: Bot,
      accent: 'text-violet-300 bg-violet-500/15 border-violet-400/35',
      cardBorder: 'border-violet-400/25',
      title: t('judgePillar2Title'),
      desc: t('judgePillar2Desc')
    },
    {
      icon: ShieldCheck,
      accent: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/35',
      cardBorder: 'border-emerald-400/25',
      title: t('judgePillar3Title'),
      desc: t('judgePillar3Desc')
    },
    {
      icon: Layers,
      accent: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/35',
      cardBorder: 'border-cyan-400/25',
      title: t('judgePillar4Title'),
      desc: t('judgePillar4Desc')
    }
  ];

  const jumpToFeature = (tab: ActiveTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl glass-modal rounded-3xl shadow-2xl border border-violet-300/35 overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 border-b border-white/15 bg-gradient-to-r from-violet-600/20 via-indigo-500/15 to-cyan-500/10 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'en' ? 'Back' : 'ย้อนกลับ'}
              className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[36px] py-1.5 rounded-xl border border-violet-300/35 text-slate-100 text-xs font-semibold cursor-pointer shrink-0 mt-0.5"
            >
              <span aria-hidden="true">↩️</span>
              <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
            </button>
            <div className="space-y-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-semibold">
                <Sparkles className="w-3 h-3" />
                <span>{t('judgeOverviewBadge')}</span>
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white text-depth break-words">{t('judgeOverviewTitle')}</h2>
              <p className="text-xs text-slate-200 break-words">{t('judgeOverviewSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="p-2 rounded-xl crystal-tile hover:bg-white/15 border border-white/20 text-slate-200 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Page 4-Pillar Grid */}
        <div className="p-5 sm:p-7 space-y-5 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl glass-subcard border ${pillar.cardBorder} p-4 space-y-2`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${pillar.accent}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100">{pillar.title}</h3>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{pillar.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Judge Jump Actions */}
          <div className="rounded-2xl glass-subcard border border-white/15 p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-200 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-cyan-300" />
              <span>{t('judgeOverviewTryActionsLabel')}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => jumpToFeature('chat_copilot')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600/40 border border-violet-400/40 text-violet-100 text-xs font-semibold cursor-pointer"
              >
                <MessageSquareHeart className="w-3.5 h-3.5 text-pink-300" />
                <span>{t('judgeOverviewTryChat')}</span>
              </button>
              <button
                type="button"
                onClick={() => jumpToFeature('queue')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-fuchsia-600/25 hover:bg-fuchsia-600/40 border border-fuchsia-400/40 text-fuchsia-100 text-xs font-semibold cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5 text-fuchsia-300" />
                <span>{t('judgeOverviewTryQueue')}</span>
              </button>
              <button
                type="button"
                onClick={() => jumpToFeature('inbox')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/40 text-cyan-100 text-xs font-semibold cursor-pointer"
              >
                <Inbox className="w-3.5 h-3.5 text-cyan-300" />
                <span>{t('judgeOverviewTryInbox')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-white/15 bg-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-300">{t('localStorageVerifiedHint')}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 border border-white/20 text-slate-100 text-xs font-semibold cursor-pointer"
          >
            <span>{t('close')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
