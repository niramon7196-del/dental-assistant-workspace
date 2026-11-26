import React from 'react';
import { AlertTriangle, Download, RotateCw } from 'lucide-react';
import { MASTER_REAL_DATA_STORAGE_KEY } from '../services/workspaceStorage';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error || 'Unexpected error')
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('AppErrorBoundary caught runtime error:', error, info);
  }

  private handleDownloadEmergencyBackup = () => {
    try {
      const raw =
        localStorage.getItem(MASTER_REAL_DATA_STORAGE_KEY) ||
        JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Empty backup' }, null, 2);
      const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dental-emergency-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // ignore fallback errors
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center p-4 text-slate-100">
        <div className="neon-glass max-w-lg w-full rounded-2xl p-6 space-y-4 border border-rose-400/35 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-base font-bold text-white">
                เกิดข้อผิดพลาดชั่วคราว (ข้อมูลของคุณยังปลอดภัยในเครื่อง)
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                ข้อมูลงานทั้งหมดถูกบันทึกถาวรไว้ใน localStorage / IndexedDB แล้ว คุณสามารถรีโหลดหน้าจอหรือสำรองไฟล์ข้อมูลได้ทันที
              </p>
            </div>
          </div>

          {this.state.errorMessage && (
            <div className="crystal-tile rounded-xl p-3 text-[11px] font-mono text-rose-200 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>รีโหลดหน้าเว็บ (Reload)</span>
            </button>
            <button
              type="button"
              onClick={this.handleDownloadEmergencyBackup}
              className="crystal-tile inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/15 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>สำรองไฟล์ข้อมูล (JSON)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
