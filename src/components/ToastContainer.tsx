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
      className="fixed bottom-24 right-4 sm:bottom-24 sm:right-5 z-[60] flex flex-col gap-2.5 max-w-sm w-full px-3 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const isLoading = toast.type === 'loading';

        const cardStyle: React.CSSProperties = isError
          ? {
              backgroundColor: 'rgba(15, 16, 34, 0.88)',
              border: '1px solid rgba(244, 114, 182, 0.55)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 14px rgba(244, 114, 182, 0.24)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }
          : isSuccess
          ? {
              backgroundColor: 'rgba(12, 20, 36, 0.86)',
              border: '1px solid rgba(52, 211, 153, 0.5)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.48), 0 0 14px rgba(52, 211, 153, 0.22)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }
          : {
              backgroundColor: 'rgba(12, 16, 32, 0.85)',
              border: '1px solid rgba(34, 211, 238, 0.42)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.48), 0 0 14px rgba(139, 92, 246, 0.2)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            };

        const titleColor = isError
          ? '#F472B6'
          : isSuccess
          ? '#34D399'
          : isLoading
          ? '#C4B5FD'
          : '#22D3EE';

        return (
          <div
            key={toast.id}
            style={cardStyle}
            className="pointer-events-auto rounded-2xl p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isError && <AlertTriangle className="w-4 h-4 text-[#F472B6]" />}
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#34D399]" />}
                {isLoading && <Loader2 className="w-4 h-4 text-[#C4B5FD] animate-spin" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-[#22D3EE]" />}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p
                  style={{ color: titleColor }}
                  className="text-xs font-semibold leading-snug break-words"
                >
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-[11px] text-[#F1F5F9] leading-relaxed break-words">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium transition-colors"
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
                className="text-[#C4B5FD] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
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

export default ToastContainer;
