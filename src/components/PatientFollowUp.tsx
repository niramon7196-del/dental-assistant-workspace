import React, { useState, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  ShieldCheck,
  ChevronRight,
  Users,
  Clock,
  CalendarCheck,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
  ClipboardPaste,
  PhoneCall,
  Settings
} from 'lucide-react';
import { ActiveTab, PatientFollowUpItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  translateFollowUpStatus
} from '../utils/i18n';
import { resolveLocalizedFollowUp } from '../data/initialData';
import { AttachmentCell } from './AttachmentCell';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import type { VoiceFollowUpPreset } from './VoiceFollowUpCallModal';
import type { FollowUpCallLog, FollowUpCallScriptType } from '../services/followUpCallService';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';

const VoiceFollowUpCallModal = lazy(() =>
  import('./VoiceFollowUpCallModal').then((m) => ({
    default: m.VoiceFollowUpCallModal
  }))
);

interface PatientFollowUpProps {
  followUps: PatientFollowUpItem[];
  setFollowUps: React.Dispatch<React.SetStateAction<PatientFollowUpItem[]>>;
  onOpenNewFollowUpModal: () => void;
  searchQuery: string;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const PatientFollowUp: React.FC<PatientFollowUpProps> = ({
  followUps,
  setFollowUps,
  onOpenNewFollowUpModal,
  searchQuery,
  setActiveTab
}) => {
  const { t, language } = useLanguage();
  const { recordAudit, clearWorkspaceSlice } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<PatientFollowUpItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearFollowUps, setConfirmClearFollowUps] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [voiceCallPreset, setVoiceCallPreset] = useState<VoiceFollowUpPreset | null>(null);

  const inferScriptType = (category: string): FollowUpCallScriptType => {
    const low = category.toLowerCase();
    if (low.includes('ถอน') || low.includes('คุด') || low.includes('extract')) return 'extraction';
    if (low.includes('ปลอม') || low.includes('denture')) return 'denture';
    return 'general_dental';
  };

  const handleVoiceOutcomeLogged = (log: FollowUpCallLog) => {
    const mappedStatus: PatientFollowUpItem['status'] =
      log.outcome === 'normal_recovery'
        ? 'Completed'
        : log.outcome === 'needs_recheck' || log.outcome === 'appointment_booked'
        ? 'Scheduled'
        : 'Contacted';

    setFollowUps((prev) =>
      prev.map((item) =>
        item.patientRefId === log.patientRefId
          ? {
              ...item,
              status: mappedStatus,
              nextAction: log.patientNotes ? log.patientNotes : item.nextAction
            }
          : item
      )
    );
  };

  const parsedPasteFollowUps = useMemo(() => {
    const lines = pasteRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const today = new Date().toISOString().split('T')[0];
    const normalizeStatus = (raw: string): PatientFollowUpItem['status'] => {
      const s = raw.toLowerCase();
      if (s.includes('contact') || s.includes('ติดต่อแล้ว')) return 'Contacted';
      if (s.includes('sched') || s.includes('นัดแล้ว')) return 'Scheduled';
      if (s.includes('comp') || s.includes('เสร็จ') || s.includes('ปิด')) return 'Completed';
      if (s.includes('cancel') || s.includes('ยกเลิก')) return 'Cancelled';
      return 'Pending';
    };

    const items: PatientFollowUpItem[] = [];
    const now = Date.now();
    lines.forEach((line, idx) => {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
      if (
        idx === 0 &&
        cols.some((c) => /^(hn|patient|รหัส|คนไข้|หมวด|อาการ)/i.test(c))
      ) {
        return;
      }
      items.push({
        id: `fu-imp-${now}-${idx}`,
        patientRefId: cols[0] || `PT-${String(idx + 1).padStart(3, '0')}`,
        caseCategory: cols[1] || 'เคสติดตามหลังรักษา',
        followUpReason: cols[2] || '-',
        nextAction: cols[3] || 'โทรติดตามอาการ',
        dueDate: cols[4] && /^\d{4}-\d{2}-\d{2}$/.test(cols[4]) ? cols[4] : today,
        status: normalizeStatus(cols[5] || ''),
        relatedEvidenceIds: []
      });
    });
    return items;
  }, [pasteRawText]);

  const handleConfirmPasteFollowUps = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPasteFollowUps.length === 0) {
      setPasteError(
        language === 'en'
          ? 'Please paste at least 1 valid row from Google Sheets or Excel.'
          : 'กรุณาวางข้อมูลอย่างน้อย 1 แถวจากชีต หรือ Excel'
      );
      return;
    }
    setFollowUps((prev) => [...parsedPasteFollowUps, ...prev]);
    recordAudit(
      'task_create',
      `Imported ${parsedPasteFollowUps.length} follow-up cases from pasted sheet`
    );
    setPasteRawText('');
    setPasteError(null);
    setIsPasteModalOpen(false);
  };

  const handleStatusChange = (id: string, newStatus: PatientFollowUpItem['status']) => {
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
  };

  const handleAttachPhoto = (id: string, evidenceId: string) => {
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              attachmentEvidenceId: evidenceId,
              relatedEvidenceIds: [evidenceId, ...f.relatedEvidenceIds]
            }
          : f
      )
    );
  };

  const handleRemovePhoto = (id: string, removedEvId?: string) => {
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              attachmentEvidenceId: undefined,
              relatedEvidenceIds: removedEvId
                ? f.relatedEvidenceIds.filter((ev) => ev !== removedEvId)
                : f.relatedEvidenceIds.filter((ev) => !ev.startsWith('ev-att-'))
            }
          : f
      )
    );
  };

  const handleDeleteFollowUp = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
    if (selectedFollowUpId === id) setSelectedFollowUpId(null);
    recordAudit('task_update', `Deleted local follow-up ${id}`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp) return;
    setFollowUps((prev) =>
      prev.map((f) => (f.id === editingFollowUp.id ? { ...editingFollowUp, localized: undefined } : f))
    );
    recordAudit('task_update', `Edited follow-up ${editingFollowUp.patientRefId}`);
    setEditingFollowUp(null);
  };

  const localizedFollowUps = useMemo(
    () => followUps.map((fu) => resolveLocalizedFollowUp(fu, language)),
    [followUps, language]
  );

  const selectedFollowUp = useMemo(() => {
    if (!selectedFollowUpId) return null;
    return localizedFollowUps.find((fu) => fu.id === selectedFollowUpId) || null;
  }, [localizedFollowUps, selectedFollowUpId]);

  const pendingCount = localizedFollowUps.filter((f) => f.status === 'Pending').length;
  const contactedCount = localizedFollowUps.filter((f) => f.status === 'Contacted').length;
  const scheduledCount = localizedFollowUps.filter((f) => f.status === 'Scheduled').length;
  const completedCount = localizedFollowUps.filter((f) => f.status === 'Completed').length;

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'fu-total',
      label: t('followUpTitle'),
      value: localizedFollowUps.length,
      subLabel: t('allStatuses'),
      tone: 'purple',
      icon: Users,
      active: statusFilter === 'All',
      onClick: () => setStatusFilter('All')
    },
    {
      id: 'fu-pending',
      label: translateFollowUpStatus('Pending', language),
      value: pendingCount,
      subLabel: translateFollowUpStatus('Contacted', language),
      tone: 'amber',
      icon: Clock,
      active: statusFilter === 'Pending',
      onClick: () => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')
    },
    {
      id: 'fu-scheduled',
      label: translateFollowUpStatus('Scheduled', language),
      value: scheduledCount,
      subLabel: t('dueCol'),
      tone: 'cyan',
      icon: CalendarCheck,
      active: statusFilter === 'Scheduled',
      onClick: () => setStatusFilter(statusFilter === 'Scheduled' ? 'All' : 'Scheduled')
    },
    {
      id: 'fu-completed',
      label: translateFollowUpStatus('Completed', language),
      value: completedCount,
      subLabel: t('done'),
      tone: 'rose',
      icon: CheckCircle2,
      active: statusFilter === 'Completed',
      onClick: () => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')
    }
  ];

  const filteredFollowUps = localizedFollowUps.filter((fu) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      fu.patientRefId.toLowerCase().includes(q) ||
      fu.caseCategory.toLowerCase().includes(q) ||
      fu.followUpReason.toLowerCase().includes(q) ||
      fu.nextAction.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'All' || fu.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Row 1: 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Line + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('followups')}
        trendSeriesPrimaryData={[0, 0, 0, 0, pendingCount, scheduledCount, localizedFollowUps.length]}
        trendSeriesSecondaryLabel={translateFollowUpStatus('Completed', language)}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, 0, completedCount]}
        ratioSlices={[
          {
            label: translateFollowUpStatus('Pending', language),
            count: pendingCount,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          },
          {
            label: translateFollowUpStatus('Contacted', language),
            count: contactedCount,
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          },
          {
            label: translateFollowUpStatus('Scheduled', language),
            count: scheduledCount,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          },
          {
            label: translateFollowUpStatus('Completed', language),
            count: completedCount,
            dotClass: 'bg-emerald-400',
            colorHex: '#2dd4bf'
          }
        ]}
        activities={localizedFollowUps.slice(0, 5).map((f) => ({
          id: f.id,
          title: `${f.patientRefId} · ${f.caseCategory}`,
          meta: `${f.nextAction} · ${translateFollowUpStatus(f.status, language)}`,
          dotClass:
            f.status === 'Completed'
              ? 'bg-emerald-400'
              : f.status === 'Scheduled'
              ? 'bg-cyan-400'
              : 'bg-amber-400'
        }))}
      />

      {/* Top Banner + Filter */}
      <div className="neon-glass rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {t('followUpTitle')} ({formatNumberByLanguage(followUps.length, language)})
            </h2>
            <p className="text-xs text-slate-300/80 mt-0.5">{t('followUpSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {followUps.length > 0 && (
              !confirmClearFollowUps ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearFollowUps(true)}
                  className="crystal-tile flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-400/35 text-rose-200 hover:bg-rose-500/20 text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('clearAllBtn')}</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void clearWorkspaceSlice('followUps');
                      setConfirmClearFollowUps(false);
                      setSelectedFollowUpId(null);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t('confirmClearAllBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearFollowUps(false)}
                    className="crystal-tile px-3 py-2.5 rounded-xl text-slate-200 text-xs cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                </div>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setVoiceCallPreset({ openSipDrawer: false });
                setIsVoiceCallOpen(true);
              }}
              className="crystal-btn inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{t('voiceFollowUpBtn')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceCallPreset({ openSipDrawer: true });
                setIsVoiceCallOpen(true);
              }}
              className="crystal-tile inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-300" />
              <span>{language === 'en' ? 'SIP (Optional)' : 'ตั้งค่า SIP'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPasteError(null);
                setIsPasteModalOpen(true);
              }}
              className="crystal-btn inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>{t('pasteSheetImportBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewFollowUpModal}
              className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addFollowUp')}</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="w-72">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              {t('filterStatus')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input w-full text-xs rounded-xl px-3 py-2"
            >
              <option value="All">{t('allStatuses')}</option>
              <option value="Pending">{translateFollowUpStatus('Pending', language)}</option>
              <option value="Contacted">{translateFollowUpStatus('Contacted', language)}</option>
              <option value="Scheduled">{translateFollowUpStatus('Scheduled', language)}</option>
              <option value="Completed">{translateFollowUpStatus('Completed', language)}</option>
              <option value="Cancelled">{translateFollowUpStatus('Cancelled', language)}</option>
            </select>
          </div>
          <div className="crystal-tile flex items-center gap-2 text-xs text-slate-200 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>{t('privacyProtected')}</span>
          </div>
        </div>
      </div>

      {/* Table with Photo Attach, Edit, Delete */}
      <div className="neon-glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4">{t('zoneColPhoto')}</th>
                <th className="py-3.5 px-4">{t('patientRefAndCategory')}</th>
                <th className="py-3.5 px-4">{t('followUpReason')}</th>
                <th className="py-3.5 px-4">{t('nextAction')}</th>
                <th className="py-3.5 px-4">{t('dueCol')}</th>
                <th className="py-3.5 px-4">{t('status')}</th>
                <th className="py-3.5 px-5 text-right">{t('actionsCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 px-4 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-200">{t('noFollowUpsFound')}</p>
                    <p className="text-[11px] text-slate-300/80 max-w-md mx-auto">
                      {t('awaitingSheetSyncHint')}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenNewFollowUpModal}
                        className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('addFollowUp')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFollowUps.map((fu) => {
                  const evId = fu.attachmentEvidenceId || fu.relatedEvidenceIds[0];
                  const isConfirmDel = confirmDeleteId === fu.id;
                  return (
                    <tr
                      key={fu.id}
                      onClick={() => setSelectedFollowUpId(fu.id)}
                      className="hover:bg-white/[0.06] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <AttachmentCell
                          evidenceId={evId}
                          itemTitle={`${fu.patientRefId} · ${fu.caseCategory}`}
                          contextLabel={t('followups')}
                          relatedPatientId={fu.patientRefId}
                          onAttached={(newEvId) => handleAttachPhoto(fu.id, newEvId)}
                          onRemoved={(removedId) => handleRemovePhoto(fu.id, removedId)}
                        />
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <span className="font-mono text-amber-300 font-semibold group-hover:underline">
                          {fu.patientRefId}
                        </span>
                        <p className="text-xs font-semibold text-slate-100">{fu.caseCategory}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200/90 max-w-xs">
                        <p className="line-clamp-2">{fu.followUpReason}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-100 font-medium max-w-xs">
                        <p className="line-clamp-2">{fu.nextAction}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 tabular-nums whitespace-nowrap">
                        {formatDateByLanguage(fu.dueDate, language)}
                      </td>
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={fu.status}
                          onChange={(e) =>
                            handleStatusChange(
                              fu.id,
                              e.target.value as PatientFollowUpItem['status']
                            )
                          }
                          className={`glass-input px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${
                            fu.status === 'Completed'
                              ? 'text-emerald-200 border-emerald-400/40'
                              : fu.status === 'Scheduled'
                              ? 'text-cyan-200 border-cyan-400/40'
                              : 'text-amber-200 border-amber-400/40'
                          }`}
                        >
                          <option value="Pending">{translateFollowUpStatus('Pending', language)}</option>
                          <option value="Contacted">{translateFollowUpStatus('Contacted', language)}</option>
                          <option value="Scheduled">{translateFollowUpStatus('Scheduled', language)}</option>
                          <option value="Completed">{translateFollowUpStatus('Completed', language)}</option>
                          <option value="Cancelled">{translateFollowUpStatus('Cancelled', language)}</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setVoiceCallPreset({
                                patientRefId: fu.patientRefId,
                                caseCategory: fu.caseCategory,
                                scriptType: inferScriptType(fu.caseCategory),
                                openSipDrawer: false
                              });
                              setIsVoiceCallOpen(true);
                            }}
                            className="crystal-tile px-2 py-1 rounded-lg text-emerald-200 hover:text-white border border-emerald-400/35 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title={t('voiceFollowUpBtn')}
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>{t('voiceFollowUpShortBtn')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const raw = followUps.find((item) => item.id === fu.id);
                              if (raw) setEditingFollowUp({ ...raw });
                            }}
                            className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                            className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                              isConfirmDel
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                            }`}
                            title={isConfirmDel ? t('confirmDeleteBtn') : t('deleteBtn')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isConfirmDel && <span>{t('confirmDeleteBtn')}</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedFollowUpId(fu.id)}
                            className="text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-0.5 cursor-pointer pl-1"
                          >
                            <span>{t('details')}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={t('addFollowUp')}
        onPrimaryAction={onOpenNewFollowUpModal}
      />

      {/* Follow-up Detail Modal */}
      {selectedFollowUp &&
        createPortal(
          <div
            onClick={() => setSelectedFollowUpId(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/35">
                    {selectedFollowUp.patientRefId}
                  </span>
                  <span className="text-xs text-slate-200">{selectedFollowUp.caseCategory}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFollowUpId(null)}
                  className="crystal-tile text-slate-200 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <AttachmentCell
                  variant="banner"
                  evidenceId={
                    selectedFollowUp.attachmentEvidenceId || selectedFollowUp.relatedEvidenceIds[0]
                  }
                  itemTitle={`${selectedFollowUp.patientRefId} · ${selectedFollowUp.caseCategory}`}
                  contextLabel={t('followups')}
                  relatedPatientId={selectedFollowUp.patientRefId}
                  onAttached={(evId) => handleAttachPhoto(selectedFollowUp.id, evId)}
                  onRemoved={(removedId) => handleRemovePhoto(selectedFollowUp.id, removedId)}
                />

                <div className="glass-subcard p-3 rounded-xl space-y-1">
                  <span className="text-slate-300/75 font-medium">{t('followUpReason')}</span>
                  <p className="text-slate-100 leading-relaxed">{selectedFollowUp.followUpReason}</p>
                </div>

                <div className="glass-subcard p-3 rounded-xl space-y-1">
                  <span className="text-slate-300/75 font-medium">{t('nextAction')}</span>
                  <p className="text-amber-200 font-semibold">{selectedFollowUp.nextAction}</p>
                </div>

                <div className="glass-subcard flex items-center justify-between p-3 rounded-xl">
                  <span className="text-slate-300/75">{t('dueDateLabel')}</span>
                  <span className="font-semibold text-slate-100 tabular-nums">
                    {formatDateByLanguage(selectedFollowUp.dueDate, language)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/15">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">{t('statusLabel')}:</span>
                  <select
                    value={selectedFollowUp.status}
                    onChange={(e) =>
                      handleStatusChange(
                        selectedFollowUp.id,
                        e.target.value as PatientFollowUpItem['status']
                      )
                    }
                    className="glass-input text-xs rounded-xl px-3 py-1.5"
                  >
                    <option value="Pending">{translateFollowUpStatus('Pending', language)}</option>
                    <option value="Contacted">{translateFollowUpStatus('Contacted', language)}</option>
                    <option value="Scheduled">{translateFollowUpStatus('Scheduled', language)}</option>
                    <option value="Completed">{translateFollowUpStatus('Completed', language)}</option>
                    <option value="Cancelled">{translateFollowUpStatus('Cancelled', language)}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFollowUpId(null)}
                  className="crystal-btn bg-amber-600 text-white text-xs font-medium px-4 py-2 rounded-xl cursor-pointer"
                >
                  {t('done')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Follow-Up Modal */}
      {editingFollowUp &&
        createPortal(
          <div
            onClick={() => setEditingFollowUp(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEdit}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingFollowUp.patientRefId}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingFollowUp(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('patientRef')}</label>
                  <input
                    type="text"
                    required
                    value={editingFollowUp.patientRefId}
                    onChange={(e) =>
                      setEditingFollowUp({ ...editingFollowUp, patientRefId: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('dueCol')}</label>
                  <input
                    type="date"
                    value={editingFollowUp.dueDate}
                    onChange={(e) =>
                      setEditingFollowUp({ ...editingFollowUp, dueDate: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium block">{t('patientRefAndCategory')}</label>
                  <input
                    type="text"
                    required
                    value={editingFollowUp.caseCategory}
                    onChange={(e) =>
                      setEditingFollowUp({ ...editingFollowUp, caseCategory: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium block">{t('followUpReason')}</label>
                  <textarea
                    rows={2}
                    value={editingFollowUp.followUpReason}
                    onChange={(e) =>
                      setEditingFollowUp({ ...editingFollowUp, followUpReason: e.target.value })
                    }
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium block">{t('nextAction')}</label>
                  <input
                    type="text"
                    value={editingFollowUp.nextAction}
                    onChange={(e) =>
                      setEditingFollowUp({ ...editingFollowUp, nextAction: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFollowUp(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Paste Sheet / CSV Import Modal */}
      {isPasteModalOpen &&
        createPortal(
          <div
            onClick={() => setIsPasteModalOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleConfirmPasteFollowUps}
              className="glass-modal border-cyan-400/35 rounded-2xl max-w-2xl w-full p-5 space-y-4 text-xs shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-slate-100">
                    {t('pasteFollowUpsModalTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                {t('pasteFollowUpsHint')}
              </p>

              <textarea
                rows={6}
                value={pasteRawText}
                onChange={(e) => {
                  setPasteRawText(e.target.value);
                  setPasteError(null);
                }}
                placeholder="PT-1088&#9;ตัดไหมหลังถอนฟันคุด&#9;นัดเช็กแผล 7 วัน&#9;โทรยืนยันวันนัด&#9;2026-11-28&#9;Pending"
                className="glass-input w-full rounded-xl p-3 font-mono text-xs"
              />

              {pasteError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[11px]">
                  {pasteError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-cyan-200 font-semibold">
                  {t('liveWsDetectedRowsCount').replace(
                    '{count}',
                    formatNumberByLanguage(parsedPasteFollowUps.length, language)
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-amber-500 text-white font-semibold cursor-pointer"
                  >
                    {t('liveWsImportConfirmBtn')}
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Built-in Voice Follow-up Call Modal (Lazy-loaded & Isolated) */}
      {isVoiceCallOpen && (
        <ModuleErrorBoundary
          moduleName={t('voiceFollowUpBtn')}
          onReturnOverview={() => setIsVoiceCallOpen(false)}
        >
          <Suspense fallback={null}>
            <VoiceFollowUpCallModal
              isOpen={isVoiceCallOpen}
              onClose={() => setIsVoiceCallOpen(false)}
              preset={voiceCallPreset}
              onOutcomeLogged={handleVoiceOutcomeLogged}
            />
          </Suspense>
        </ModuleErrorBoundary>
      )}
    </div>
  );
};
