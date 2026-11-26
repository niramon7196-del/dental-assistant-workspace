import React from 'react';
import { CheckCircle2, AlertTriangle, Info, RotateCcw, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const { t } = useLanguage();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-24 right-4 sm:bottom-24 sm:right-5 z-[60] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const isLoading = toast.type === 'loading';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl glass-modal border p-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${
              isError
                ? 'border-rose-400/50 text-rose-100 shadow-rose-950/30'
                : isSuccess
                ? 'border-emerald-400/45 text-emerald-100 shadow-emerald-950/25'
                : 'border-violet-400/45 text-slate-100 shadow-violet-950/25'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isError && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isLoading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-violet-400" />}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-semibold leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                    {toast.description}
                  </p>
                )}

                {toast.onRetry && (
                  <div className="pt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDismiss(toast.id);
                        toast.onRetry?.();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-md shadow-rose-600/30"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{toast.retryLabel || t('dentureRetryBtn')}</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
                aria-label={t('dismissNotification')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
