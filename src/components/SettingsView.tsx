import React, { useState, useEffect } from 'react';
import {
  Sparkles, 
  RotateCcw, 
  ShieldAlert, 
  Database, 
  CheckCircle2,
  Lock,
  Sheet,
  PlugZap,
  AlertTriangle,
  Download,
  Upload,
  Server,
  FileSpreadsheet
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { SheetConfig } from '../types/dental';
import {
  saveSheetConfig,
  validateRawSatisfactionTabName
} from '../services/sheetService';
import { checkAiServerHealth } from '../services/aiService';

interface SettingsViewProps {
  onResetDemoData: () => void;
  sheetConfig?: SheetConfig;
  onUpdateSheetConfig?: (config: SheetConfig) => void;
  onOpenJudgeOverview?: () => void;
  onNavigateOverview?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onResetDemoData,
  sheetConfig: externalConfig,
  onUpdateSheetConfig,
  onOpenJudgeOverview
}) => {
  const { t } = useLanguage();
  const {
    activeWorkspace,
    exportActiveWorkspaceBackup,
    importActiveWorkspaceBackup
  } = useWorkspace();
  const [confirmResetStep, setConfirmResetStep] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const importBackupInputRef = React.useRef<HTMLInputElement | null>(null);
  const [serverAiStatus, setServerAiStatus] = useState<{
    checked: boolean;
    ok: boolean;
    aiConfigured: boolean;
    model: string;
  }>({ checked: false, ok: false, aiConfigured: false, model: 'gemini-4-hydrogen' });

  // 3 Google Sheet URL Slots (Scoped strictly to active workspace — never leak clinic links to Personal Space)
  const [webAppUrl, setWebAppUrl] = useState<string>(() => externalConfig?.webAppUrl ?? '');
  const [inventorySheetUrl, setInventorySheetUrl] = useState<string>(
    () => externalConfig?.inventorySheetUrl ?? ''
  );
  const [satisfactionSheetUrl, setSatisfactionSheetUrl] = useState<string>(
    () => externalConfig?.satisfactionSheetUrl ?? ''
  );
  const [satisfactionFormUrl, setSatisfactionFormUrl] = useState<string>(
    () => externalConfig?.satisfactionFormUrl ?? ''
  );
  const [satisfactionRawTabName, setSatisfactionRawTabName] = useState<string>(
    () => externalConfig?.satisfactionRawTabName ?? 'การตอบแบบฟอร์ม 1'
  );
  const [token, setToken] = useState<string>(() => externalConfig?.token ?? '');
  const [operatorName, setOperatorName] = useState<string>(() => externalConfig?.operatorName ?? '');
  const [sheetSavedMsg, setSheetSavedMsg] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void checkAiServerHealth().then((status) => {
      if (active) {
        setServerAiStatus({ checked: true, ...status });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (externalConfig) {
      setWebAppUrl(externalConfig.webAppUrl || '');
      setInventorySheetUrl(externalConfig.inventorySheetUrl || '');
      setSatisfactionSheetUrl(externalConfig.satisfactionSheetUrl || '');
      setSatisfactionFormUrl(externalConfig.satisfactionFormUrl || '');
      setSatisfactionRawTabName(externalConfig.satisfactionRawTabName || 'การตอบแบบฟอร์ม 1');
      setToken(externalConfig.token || '');
      setOperatorName(externalConfig.operatorName || '');
    }
  }, [externalConfig]);

  const rawTabValidation = validateRawSatisfactionTabName(satisfactionRawTabName);

  const handleReset = () => {
    onResetDemoData();
    setConfirmResetStep(false);
    setWebAppUrl('');
    setInventorySheetUrl('');
    setSatisfactionSheetUrl('');
    setSatisfactionFormUrl('');
    setSatisfactionRawTabName('การตอบแบบฟอร์ม 1');
    setToken('');
    setOperatorName('');
    setTestResult(null);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const handleDownloadBackup = () => {
    const json = exportActiveWorkspaceBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-backup-${activeWorkspace.tenantCode.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupError(null);
    setBackupMsg(t('backupDownloadedMsg'));
    setTimeout(() => setBackupMsg(null), 3500);
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = importActiveWorkspaceBackup(text);
      if (res.ok) {
        setBackupError(null);
        setBackupMsg(t('importBackupSuccessMsg').replace('{count}', String(res.importedCount)));
      } else {
        setBackupMsg(null);
        setBackupError(res.error || t('importBackupErrorMsg'));
      }
    } catch {
      setBackupMsg(null);
      setBackupError(t('importBackupErrorMsg'));
    }
    setTimeout(() => {
      setBackupMsg(null);
      setBackupError(null);
    }, 4500);
  };

  const buildConfigPayload = (): SheetConfig => ({
    webAppUrl: webAppUrl.trim(),
    inventorySheetUrl: inventorySheetUrl.trim(),
    satisfactionSheetUrl: satisfactionSheetUrl.trim(),
    satisfactionFormUrl: satisfactionFormUrl.trim(),
    satisfactionRawTabName: rawTabValidation.ok
      ? satisfactionRawTabName.trim() || 'การตอบแบบฟอร์ม 1'
      : 'การตอบแบบฟอร์ม 1',
    token: token.trim(),
    operatorName: operatorName.trim()
  });

  const handleSaveSheetConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTabValidation.ok) {
      setTestResult({
        ok: false,
        message: rawTabValidation.error || t('satRawAppendGuardrail')
      });
      return;
    }
    const nextConfig = buildConfigPayload();
    if (activeWorkspace.type === 'clinic') {
      saveSheetConfig(nextConfig);
    }
    onUpdateSheetConfig?.(nextConfig);
    setTestResult(null);
    setSheetSavedMsg(true);
    setTimeout(() => setSheetSavedMsg(false), 3000);
  };

  const handleValidateSheetUrls = () => {
    if (!rawTabValidation.ok) {
      setTestResult({
        ok: false,
        message: rawTabValidation.error || t('satRawAppendGuardrail')
      });
      return;
    }
    const urls = [
      webAppUrl.trim(),
      inventorySheetUrl.trim(),
      satisfactionSheetUrl.trim(),
      satisfactionFormUrl.trim()
    ].filter(Boolean);
    if (urls.length === 0) {
      setTestResult({
        ok: false,
        message: t('sheetTestFailMsg')
      });
      return;
    }
    const allValidHttp = urls.every((u) => /^https?:\/\/.+/i.test(u));
    if (!allValidHttp) {
      setTestResult({
        ok: false,
        message: t('sheetTestFailMsg')
      });
      return;
    }
    const nextConfig = buildConfigPayload();
    if (activeWorkspace.type === 'clinic') {
      saveSheetConfig(nextConfig);
    }
    onUpdateSheetConfig?.(nextConfig);
    setTestResult({
      ok: true,
      message: t('sheetSavedMsg')
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pb-8 space-y-6 max-w-7xl mx-auto">
      {/* Compact Action Strip */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleDownloadBackup}
          className="flex items-center gap-2 crystal-tile hover:bg-white/15 text-slate-100 text-xs font-medium px-4 py-2 rounded-xl cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4 text-emerald-300" />
          <span>{t('exportBackupBtn')}</span>
        </button>
        <button
          type="button"
          onClick={() => importBackupInputRef.current?.click()}
          className="flex items-center gap-2 crystal-tile hover:bg-white/15 border border-cyan-400/35 text-cyan-100 text-xs font-medium px-4 py-2 rounded-xl cursor-pointer shrink-0"
        >
          <Upload className="w-4 h-4 text-cyan-300" />
          <span>{t('importBackupBtn')}</span>
        </button>
        <input
          ref={importBackupInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void handleImportBackupFile(e)}
          className="hidden"
        />
      </div>

      {backupMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{backupMsg}</span>
        </div>
      )}

      {backupError && (
        <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{backupError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compact 1-Page App Overview Guide */}
        {onOpenJudgeOverview && (
          <div className="md:col-span-2 neon-glass rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/35 flex items-center justify-center text-violet-300 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-100">{t('judgeOverviewTitle')}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{t('judgeOverviewSubtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenJudgeOverview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 border border-violet-300/40 text-violet-100 text-xs font-semibold cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-violet-300" />
              <span>{t('judgeDemoOverviewBtn')}</span>
            </button>
          </div>
        )}

        {/* 3-Slot Google Sheet Connection Card (Standby Mode — Local URL Storage Only) */}
        <div className="md:col-span-2 neon-glass rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{t('sheetConfigTitle')}</h3>
                <p className="text-[11px] text-slate-400">{t('sheetConfigSubtitle')}</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border self-start sm:self-center ${
                webAppUrl.trim() || inventorySheetUrl.trim() || satisfactionSheetUrl.trim()
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-violet-500/15 text-violet-200 border-violet-500/30'
              }`}
            >
              {webAppUrl.trim() || inventorySheetUrl.trim() || satisfactionSheetUrl.trim()
                ? t('sheetBadgeConnected')
                : t('sheetBadgeStandby')}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-violet-500/15 border border-violet-400/30 text-[11px] text-violet-100/90 leading-relaxed">
            {t('sheetStandbyNotice')}
          </div>

          <form onSubmit={handleSaveSheetConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Slot 1: Extraction & Denture Recall Sheet */}
            <div className="md:col-span-2 p-4 rounded-xl glass-subcard space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-slate-100 font-semibold">{t('sheetSlot1Title')}</label>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    webAppUrl.trim()
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                      : 'crystal-tile text-slate-300'
                  }`}
                >
                  {webAppUrl.trim() ? t('sheetSlotReadyStatus') : t('sheetSlotEmptyStatus')}
                </span>
              </div>
              <input
                type="url"
                placeholder={t('sheetSlot1Placeholder')}
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

            {/* Slot 2: Dental Material Inventory Sheet */}
            <div className="md:col-span-2 p-4 rounded-xl glass-subcard space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-slate-100 font-semibold">{t('sheetSlot2Title')}</label>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    inventorySheetUrl.trim()
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                      : 'crystal-tile text-slate-300'
                  }`}
                >
                  {inventorySheetUrl.trim() ? t('sheetSlotReadyStatus') : t('sheetSlotEmptyStatus')}
                </span>
              </div>
              <input
                type="url"
                placeholder={t('sheetSlot2Placeholder')}
                value={inventorySheetUrl}
                onChange={(e) => setInventorySheetUrl(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

            {/* Slot 3: Patient Satisfaction Survey Sheet */}
            <div className="md:col-span-2 p-4 rounded-xl glass-subcard space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-slate-100 font-semibold">{t('sheetSlot3Title')}</label>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    satisfactionSheetUrl.trim()
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                      : 'crystal-tile text-slate-300'
                  }`}
                >
                  {satisfactionSheetUrl.trim() ? t('sheetSlotReadyStatus') : t('sheetSlotEmptyStatus')}
                </span>
              </div>
              <input
                type="url"
                placeholder={t('sheetSlot3Placeholder')}
                value={satisfactionSheetUrl}
                onChange={(e) => setSatisfactionSheetUrl(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400 font-mono"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-200 block">
                    {t('satSurveyUrlLabel')}
                  </label>
                  <input
                    type="url"
                    placeholder={t('satSurveyUrlPlaceholder')}
                    value={satisfactionFormUrl}
                    onChange={(e) => setSatisfactionFormUrl(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-200 block">
                    {t('satRawTabLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder="การตอบแบบฟอร์ม 1"
                    value={satisfactionRawTabName}
                    onChange={(e) => setSatisfactionRawTabName(e.target.value)}
                    className={`w-full glass-input rounded-xl px-3 py-2 text-slate-100 font-mono ${
                      rawTabValidation.ok
                        ? ''
                        : '!border-rose-400/80'
                    }`}
                  />
                </div>
              </div>

              {!rawTabValidation.ok ? (
                <p className="text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  <span>{rawTabValidation.error}</span>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  {t('satRawAppendGuardrail')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-200 font-medium">{t('sheetTokenLabel')}</label>
              <input
                type="password"
                placeholder={t('sheetTokenPlaceholder')}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-200 font-medium">{t('sheetOperatorLabel')}</label>
              <input
                type="text"
                placeholder={t('sheetOperatorPlaceholder')}
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleValidateSheetUrls}
                  className="flex items-center gap-2 crystal-tile hover:bg-white/15 text-slate-100 font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <PlugZap className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{t('sheetTestBtn')}</span>
                </button>

                {sheetSavedMsg && (
                  <span className="text-emerald-300 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('sheetSavedMsg')}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="crystal-btn bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-5 py-2 rounded-xl shadow-lg shadow-violet-600/25 cursor-pointer"
              >
                {t('sheetSaveBtn')}
              </button>
            </div>
          </form>

          {testResult && (
            <div
              className={`rounded-xl p-3 text-xs flex items-center gap-2 border ${
                testResult.ok
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* AI Assistant Server-Side Status */}
        <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-100">{t('aiConfigTitle')}</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                !serverAiStatus.checked
                  ? 'crystal-tile text-slate-200'
                  : serverAiStatus.aiConfigured
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                  : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
              }`}
            >
              {!serverAiStatus.checked
                ? t('aiStatusChecking')
                : serverAiStatus.aiConfigured
                ? t('aiStatusReady')
                : t('aiStatusMissingSecret')}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{t('aiConfigDesc')}</p>

          <div className="p-4 rounded-xl glass-subcard space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('aiModelLabel')}</span>
              <span className="font-mono font-semibold text-violet-300">{serverAiStatus.model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('aiEndpointLabel')}</span>
              <span className="font-mono text-slate-100">{t('aiEndpointValue')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t('aiMaskingLabel')}</span>
              <span className="text-emerald-300 font-medium">{t('aiMaskingValue')}</span>
            </div>
            <p className="text-[11px] text-slate-300 pt-1.5 border-t border-white/15">
              {t('aiSecretsHint')}
            </p>
          </div>
        </div>

        {/* Demo Data Management */}
        <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">{t('demoDataTitle')}</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{t('demoDataDesc')}</p>

          <div className="p-4 rounded-xl glass-subcard border border-amber-400/30 space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
              <p>{t('demoModeNotice')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center justify-center gap-2 crystal-tile hover:bg-white/15 border border-emerald-400/35 text-emerald-100 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-300" />
                <span>{t('exportBackupBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => importBackupInputRef.current?.click()}
                className="flex items-center justify-center gap-2 crystal-tile hover:bg-white/15 border border-cyan-400/35 text-cyan-100 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <Upload className="w-4 h-4 text-cyan-300" />
                <span>{t('importBackupBtn')}</span>
              </button>
            </div>
            {!confirmResetStep ? (
              <button
                type="button"
                onClick={() => setConfirmResetStep(true)}
                className="w-full flex items-center justify-center gap-2 crystal-tile hover:bg-white/15 text-amber-200 font-medium px-4 py-2.5 rounded-xl border border-amber-400/35 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('resetDemoData')}</span>
              </button>
            ) : (
              <div className="space-y-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-400/40">
                <p className="text-[11px] text-rose-100 leading-relaxed">
                  {t('resetWorkspaceConfirmHint')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('confirmResetWorkspaceBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetStep(false)}
                    className="px-3.5 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 text-xs font-medium cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                </div>
              </div>
            )}
            {resetSuccess && (
              <p className="text-center text-xs text-emerald-300 font-medium flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('resetSuccess')}
              </p>
            )}
          </div>
        </div>

        {/* Honest Multi-Clinic Architecture Readiness */}
        <div className="md:col-span-2 neon-glass rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-start gap-2.5">
            <Server className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{t('archReadinessTitle')}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{t('archReadinessSubtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-400/35 space-y-1.5">
              <span className="font-semibold text-emerald-300 block">{t('archLiveLayerTitle')}</span>
              <p className="text-slate-200 text-[11px] leading-relaxed">{t('archLiveLayerDesc')}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/35 space-y-1.5">
              <span className="font-semibold text-amber-300 block">{t('archNextBackendTitle')}</span>
              <p className="text-slate-200 text-[11px] leading-relaxed">{t('archNextBackendDesc')}</p>
            </div>
          </div>
        </div>

        {/* Workspace Security & Privacy */}
        <div className="md:col-span-2 neon-glass rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">{t('securityTitle')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-200">
            <div className="p-4 rounded-xl glass-subcard space-y-1.5">
              <span className="font-semibold text-slate-100 block">{t('scopeTitle')}</span>
              <p className="text-slate-300 text-[11px]">{t('scopeDesc')}</p>
            </div>
            <div className="p-4 rounded-xl glass-subcard space-y-1.5">
              <span className="font-semibold text-slate-100 block">{t('privacyTitle')}</span>
              <p className="text-slate-300 text-[11px]">{t('privacyDesc')}</p>
            </div>
            <div className="p-4 rounded-xl glass-subcard space-y-1.5">
              <span className="font-semibold text-slate-100 block">{t('humanControlTitle')}</span>
              <p className="text-slate-300 text-[11px]">{t('humanControlDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
