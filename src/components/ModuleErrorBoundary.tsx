import React from 'react';
import { AlertTriangle, RotateCw, LayoutDashboard } from 'lucide-react';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  resetKey?: string;
  onReturnOverview?: () => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error || 'Unexpected error')
    };
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}]`, error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto mt-6">
        <div className="neon-glass rounded-2xl p-6 border border-rose-400/40 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-white">
                โมดูล “{this.props.moduleName}” พบข้อขัดข้องชั่วคราว
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                ระบบแยกโมดูลอิสระป้องกันไม่ให้กระทบคิว สต๊อก แชท หรือข้อมูลอื่นในเครื่อง ข้อมูลทั้งหมดยังคงปลอดภัย
              </p>
            </div>
          </div>

          {this.state.errorMessage && (
            <div className="crystal-tile rounded-xl p-3 text-[11px] font-mono text-rose-200 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="crystal-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>โหลดโมดูลนี้อีกครั้ง</span>
            </button>
            {this.props.onReturnOverview && (
              <button
                type="button"
                onClick={this.props.onReturnOverview}
                className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-100 text-xs font-medium cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-300" />
                <span>กลับหน้าภาพรวม</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
