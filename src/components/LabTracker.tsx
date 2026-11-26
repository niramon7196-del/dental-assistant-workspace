import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  FileText,
  Clock,
  ChevronRight,
  FlaskConical,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  ClipboardPaste
} from 'lucide-react';
import { ActiveTab, LabOrder, LabStatus, LabWorkType } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  locales,
  translateLabStatus,
  translateLabWorkType
} from '../utils/i18n';
import { resolveLocalizedLab, resolveLocalizedLabHistory } from '../data/initialData';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';

interface LabTrackerProps {
  labOrders: LabOrder[];
  setLabOrders: React.Dispatch<React.SetStateAction<LabOrder[]>>;
  onOpenNewLabModal: () => void;
  searchQuery: string;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const LabTracker: React.FC<LabTrackerProps> = ({
  labOrders,
  setLabOrders,
  onOpenNewLabModal,
  searchQuery,
  setActiveTab
}) => {
  const { t, language } = useLanguage();
  const { recordAudit, clearWorkspaceSlice } = useWorkspace();
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [editingLab, setEditingLab] = useState<LabOrder | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearLabs, setConfirmClearLabs] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const parsedPasteLabs = useMemo(() => {
    const lines = pasteRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const today = new Date().toISOString().split('T')[0];
    const normalizeWorkType = (raw: string): LabWorkType => {
      const s = raw.toLowerCase();
      if (s.includes('crown') || s.includes('ครอบ') || s.includes('สะพาน')) return 'Crown';
      if (s.includes('retainer') || s.includes('รีเทนเนอร์')) return 'Retainer';
      if (s.includes('guide') || s.includes('ไกด์')) return 'Surgical Guide';
      if (s.includes('denture') || s.includes('ฟันปลอม')) return 'Denture';
      return 'Other';
    };
    const normalizeLabStatus = (raw: string): LabStatus => {
      const s = raw.toLowerCase();
      if (s.includes('ship') || s.includes('จัดส่ง')) return 'Shipped';
      if (s.includes('deliv') || s.includes('รับแล้ว') || s.includes('ถึงแล้ว')) return 'Delivered';
      if (s.includes('qual') || s.includes('ตรวจ')) return 'Quality Checked';
      if (s.includes('remake') || s.includes('แก้ไข') || s.includes('ปัญหา')) return 'Issue / Remake';
      if (s.includes('cancel') || s.includes('ยกเลิก')) return 'Cancelled';
      if (s.includes('fab') || s.includes('ทำอยู่') || s.includes('ผลิต')) return 'In Fabrication';
      return 'Ordered';
    };

    const items: LabOrder[] = [];
    const now = Date.now();
    lines.forEach((line, idx) => {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
      if (
        idx === 0 &&
        cols.some((c) => /^(รหัส|order|เลข|hn|patient|แล็บ|lab|งาน)/i.test(c))
      ) {
        return;
      }
      const orderRef = cols[0] || `LAB-${String(idx + 1).padStart(3, '0')}`;
      const workType = normalizeWorkType(cols[1] || cols[0] || '');
      const labName = cols[2] || 'Lab';
      const dentist = cols[3] || '-';
      const patientRef = cols[4] || '-';
      const dueRaw = cols[5] && /^\d{4}-\d{2}-\d{2}$/.test(cols[5]) ? cols[5] : today;
      const status = normalizeLabStatus(cols[6] || '');
      const nowStamp = new Date(now + idx).toISOString().replace('T', ' ').slice(0, 16);
      items.push({
        id: `lab-imp-${now}-${idx}`,
        orderReference: orderRef,
        workType,
        laboratoryName: labName,
        dentistName: dentist,
        patientRefId: patientRef,
        dateSent: today,
        expectedReturnDate: dueRaw,
        status,
        supportingFiles: [],
        workHistory: [
          {
            id: `wh-imp-${now}-${idx}`,
            timestamp: nowStamp,
            status,
            notes: 'นำเข้าข้อมูลจริงจากชีต/ตาราง'
          }
        ]
      });
    });
    return items;
  }, [pasteRawText]);

  const handleConfirmPasteLabs = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPasteLabs.length === 0) {
      setPasteError(
        language === 'en'
          ? 'Please paste at least 1 valid row from Google Sheets or Excel.'
          : 'กรุณาวางข้อมูลอย่างน้อย 1 แถวจากชีต หรือ Excel'
      );
      return;
    }
    setLabOrders((prev) => [...parsedPasteLabs, ...prev]);
    recordAudit('task_create', `Imported ${parsedPasteLabs.length} lab orders from pasted sheet`);
    setPasteRawText('');
    setPasteError(null);
    setIsPasteModalOpen(false);
  };

  const handleLabStatusChange = (labId: string, newStatus: LabStatus) => {
    setLabOrders((prev) =>
      prev.map((l) => {
        if (l.id === labId) {
          const noteTh = locales.th.labStatusUpdatedTo.replace(
            '{status}',
            translateLabStatus(newStatus, 'th')
          );
          const noteEn = locales.en.labStatusUpdatedTo.replace(
            '{status}',
            translateLabStatus(newStatus, 'en')
          );
          const newHistoryItem = {
            id: `wh-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            status: newStatus,
            notes: language === 'th' ? noteTh : noteEn,
            localized: { th: { notes: noteTh }, en: { notes: noteEn } }
          };
          return { ...l, status: newStatus, workHistory: [newHistoryItem, ...l.workHistory] };
        }
        return l;
      })
    );
  };

  const handleAttachPhoto = (labId: string, evidenceId: string) => {
    setLabOrders((prev) =>
      prev.map((l) =>
        l.id === labId
          ? { ...l, attachmentEvidenceId: evidenceId, supportingFiles: [evidenceId, ...l.supportingFiles] }
          : l
      )
    );
  };

  const handleRemovePhoto = (labId: string, removedEvId?: string) => {
    setLabOrders((prev) =>
      prev.map((l) =>
        l.id === labId
          ? {
              ...l,
              attachmentEvidenceId: undefined,
              supportingFiles: removedEvId
                ? l.supportingFiles.filter((f) => f !== removedEvId)
                : l.supportingFiles.filter((f) => !f.startsWith('ev-att-'))
            }
          : l
      )
    );
  };

  const handleDeleteLab = (labId: string) => {
    if (confirmDeleteId !== labId) {
      setConfirmDeleteId(labId);
      return;
    }
    setConfirmDeleteId(null);
    setLabOrders((prev) => prev.filter((l) => l.id !== labId));
    if (selectedLabId === labId) setSelectedLabId(null);
    recordAudit('task_update', `Deleted local lab order ${labId}`);
  };

  const handleSaveEditLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLab) return;
    setLabOrders((prev) =>
      prev.map((l) => (l.id === editingLab.id ? { ...editingLab, localized: undefined } : l))
    );
    recordAudit('task_update', `Updated lab order ${editingLab.orderReference}`);
    setEditingLab(null);
  };

  const localizedLabs = useMemo(
    () => labOrders.map((lab) => resolveLocalizedLab(lab, language)),
    [labOrders, language]
  );

  const selectedLab = useMemo(() => {
    if (!selectedLabId) return null;
    return localizedLabs.find((lab) => lab.id === selectedLabId) || null;
  }, [localizedLabs, selectedLabId]);

  const inFabricationCount = localizedLabs.filter(
    (l) => l.status === 'Ordered' || l.status === 'In Fabrication'
  ).length;
  const shippedCount = localizedLabs.filter((l) => l.status === 'Shipped').length;
  const deliveredCount = localizedLabs.filter(
    (l) => l.status === 'Delivered' || l.status === 'Quality Checked'
  ).length;
  const issueCount = localizedLabs.filter((l) => l.status === 'Issue / Remake').length;

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'lab-total',
      label: t('labOrdersTitle'),
      value: localizedLabs.length,
      subLabel: t('allStatuses'),
      tone: 'purple',
      icon: FlaskConical,
      active: statusFilter === 'All',
      onClick: () => setStatusFilter('All')
    },
    {
      id: 'lab-fab',
      label: translateLabStatus('In Fabrication', language),
      value: inFabricationCount,
      subLabel: translateLabStatus('Ordered', language),
      tone: 'cyan',
      icon: Clock,
      active: statusFilter === 'In Fabrication',
      onClick: () => setStatusFilter(statusFilter === 'In Fabrication' ? 'All' : 'In Fabrication')
    },
    {
      id: 'lab-shipped',
      label: translateLabStatus('Shipped', language),
      value: shippedCount,
      subLabel: translateLabStatus('Delivered', language),
      tone: 'amber',
      icon: Truck,
      active: statusFilter === 'Shipped',
      onClick: () => setStatusFilter(statusFilter === 'Shipped' ? 'All' : 'Shipped')
    },
    {
      id: 'lab-done',
      label:
        issueCount > 0
          ? translateLabStatus('Issue / Remake', language)
          : translateLabStatus('Delivered', language),
      value: issueCount > 0 ? issueCount : deliveredCount,
      subLabel: issueCount > 0 ? t('kpiLabsActiveSub') : translateLabStatus('Quality Checked', language),
      tone: 'rose',
      icon: issueCount > 0 ? AlertTriangle : CheckCircle2,
      active: statusFilter === (issueCount > 0 ? 'Issue / Remake' : 'Delivered'),
      onClick: () => {
        const target = issueCount > 0 ? 'Issue / Remake' : 'Delivered';
        setStatusFilter(statusFilter === target ? 'All' : target);
      }
    }
  ];

  const filteredLabs = localizedLabs.filter((lab) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      lab.orderReference.toLowerCase().includes(q) ||
      lab.laboratoryName.toLowerCase().includes(q) ||
      lab.patientRefId.toLowerCase().includes(q) ||
      lab.dentistName.toLowerCase().includes(q);

    const matchesWorkType = workTypeFilter === 'All' || lab.workType === workTypeFilter;
    const matchesStatus = statusFilter === 'All' || lab.status === statusFilter;

    return matchesSearch && matchesWorkType && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Row 1: Standardized 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Standardized Line + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('labTracker')}
        trendSeriesPrimaryData={[0, 0, 0, 0, inFabricationCount, shippedCount, localizedLabs.length]}
        trendSeriesSecondaryLabel={translateLabStatus('Delivered', language)}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, 0, deliveredCount]}
        ratioSlices={[
          {
            label: translateLabStatus('In Fabrication', language),
            count: inFabricationCount,
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          },
          {
            label: translateLabStatus('Shipped', language),
            count: shippedCount,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          },
          {
            label: translateLabStatus('Delivered', language),
            count: deliveredCount,
            dotClass: 'bg-emerald-400',
            colorHex: '#2dd4bf'
          },
          {
            label: translateLabStatus('Issue / Remake', language),
            count: issueCount,
            dotClass: 'bg-rose-400',
            colorHex: '#ec4899'
          }
        ]}
        activities={localizedLabs.slice(0, 5).map((l) => ({
          id: l.id,
          title: `${l.orderReference} · ${translateLabWorkType(l.workType, language)}`,
          meta: `${l.laboratoryName} · ${translateLabStatus(l.status, language)}`,
          dotClass:
            l.status === 'Delivered' || l.status === 'Quality Checked'
              ? 'bg-emerald-400'
              : l.status === 'Issue / Remake'
              ? 'bg-rose-400'
              : 'bg-cyan-400'
        }))}
      />

      {/* Top Action & Filters */}
      <div className="neon-glass rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {t('labOrdersTitle')} ({formatNumberByLanguage(labOrders.length, language)})
            </h2>
            <p className="text-xs text-slate-300/80 mt-0.5">{t('labOrdersSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {labOrders.length > 0 && (
              !confirmClearLabs ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearLabs(true)}
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
                      void clearWorkspaceSlice('labOrders');
                      setConfirmClearLabs(false);
                      setSelectedLabId(null);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t('confirmClearAllBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearLabs(false)}
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
              onClick={onOpenNewLabModal}
              className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createLabOrder')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              {t('filterWorkType')}
            </label>
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="glass-input w-full text-xs rounded-xl px-3 py-2"
            >
              <option value="All">{t('allWorkTypes')}</option>
              <option value="Denture">{translateLabWorkType('Denture', language)}</option>
              <option value="Crown">{translateLabWorkType('Crown', language)}</option>
              <option value="Retainer">{translateLabWorkType('Retainer', language)}</option>
              <option value="Surgical Guide">{translateLabWorkType('Surgical Guide', language)}</option>
              <option value="Other">{translateLabWorkType('Other', language)}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              {t('filterStatus')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input w-full text-xs rounded-xl px-3 py-2"
            >
              <option value="All">{t('allStatuses')}</option>
              <option value="Ordered">{translateLabStatus('Ordered', language)}</option>
              <option value="In Fabrication">{translateLabStatus('In Fabrication', language)}</option>
              <option value="Shipped">{translateLabStatus('Shipped', language)}</option>
              <option value="Delivered">{translateLabStatus('Delivered', language)}</option>
              <option value="Quality Checked">{translateLabStatus('Quality Checked', language)}</option>
              <option value="Issue / Remake">{translateLabStatus('Issue / Remake', language)}</option>
              <option value="Cancelled">{translateLabStatus('Cancelled', language)}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lab Table with Photo Attachment, Edit, and Delete */}
      <div className="neon-glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4">{t('zoneColPhoto')}</th>
                <th className="py-3.5 px-4">{t('orderRefWorkType')}</th>
                <th className="py-3.5 px-4">{t('laboratoryDentist')}</th>
                <th className="py-3.5 px-4">{t('patientRef')}</th>
                <th className="py-3.5 px-4">{t('sentExpected')}</th>
                <th className="py-3.5 px-4">{t('status')}</th>
                <th className="py-3.5 px-5 text-right">{t('actionsCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredLabs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 px-4 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-200">{t('noLabsFound')}</p>
                    <p className="text-[11px] text-slate-300/80 max-w-md mx-auto">
                      {t('awaitingSheetSyncHint')}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenNewLabModal}
                        className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('createLabOrder')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLabs.map((lab) => {
                  const evId =
                    lab.attachmentEvidenceId ||
                    lab.supportingFiles.find((f) => f.startsWith('ev-'));
                  const isConfirmDel = confirmDeleteId === lab.id;
                  return (
                    <tr
                      key={lab.id}
                      onClick={() => setSelectedLabId(lab.id)}
                      className="hover:bg-white/[0.06] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <AttachmentCell
                          evidenceId={evId}
                          itemTitle={`${lab.orderReference} · ${lab.laboratoryName}`}
                          contextLabel={t('labTracker')}
                          relatedLabId={lab.id}
                          relatedPatientId={lab.patientRefId}
                          onAttached={(newEvId) => handleAttachPhoto(lab.id, newEvId)}
                          onRemoved={(removedId) => handleRemovePhoto(lab.id, removedId)}
                        />
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <span className="font-mono text-emerald-300 font-semibold group-hover:underline">
                          {lab.orderReference}
                        </span>
                        <p className="text-xs font-semibold text-slate-100">
                          {translateLabWorkType(lab.workType, language)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <p className="font-medium text-slate-100">{lab.laboratoryName}</p>
                        <p className="text-[11px] text-slate-300/80">{lab.dentistName}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="crystal-tile px-2 py-0.5 rounded text-[10px] font-mono text-slate-200">
                          {lab.patientRefId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5 tabular-nums">
                        <p className="text-slate-200">
                          {t('sentPrefix')}: {formatDateByLanguage(lab.dateSent, language)}
                        </p>
                        <p className="text-[11px] text-slate-300/80">
                          {t('expPrefix')}: {formatDateByLanguage(lab.expectedReturnDate, language)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lab.status}
                          onChange={(e) => handleLabStatusChange(lab.id, e.target.value as LabStatus)}
                          className={`glass-input px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${
                            lab.status === 'Delivered' || lab.status === 'Quality Checked'
                              ? 'text-emerald-200 border-emerald-400/40'
                              : lab.status === 'Shipped'
                              ? 'text-cyan-200 border-cyan-400/40'
                              : lab.status === 'Issue / Remake'
                              ? 'text-rose-200 border-rose-400/40'
                              : 'text-amber-200 border-amber-400/40'
                          }`}
                        >
                          <option value="Ordered">{translateLabStatus('Ordered', language)}</option>
                          <option value="In Fabrication">{translateLabStatus('In Fabrication', language)}</option>
                          <option value="Shipped">{translateLabStatus('Shipped', language)}</option>
                          <option value="Delivered">{translateLabStatus('Delivered', language)}</option>
                          <option value="Quality Checked">{translateLabStatus('Quality Checked', language)}</option>
                          <option value="Issue / Remake">{translateLabStatus('Issue / Remake', language)}</option>
                          <option value="Cancelled">{translateLabStatus('Cancelled', language)}</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const raw = labOrders.find((o) => o.id === lab.id);
                              if (raw) setEditingLab({ ...raw });
                            }}
                            className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                            aria-label={t('editBtn')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLab(lab.id)}
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
                            onClick={() => setSelectedLabId(lab.id)}
                            className="text-emerald-300 hover:text-emerald-200 font-medium inline-flex items-center gap-0.5 cursor-pointer pl-1"
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
        primaryActionLabel={t('createLabOrder')}
        onPrimaryAction={onOpenNewLabModal}
      />

      {/* Lab Detail Modal */}
      {selectedLab &&
        createPortal(
          <div
            onClick={() => setSelectedLabId(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                    {selectedLab.orderReference}
                  </span>
                  <span className="text-xs text-slate-300">
                    {t('patientRef')}: {selectedLab.patientRefId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLabId(null)}
                  className="crystal-tile text-slate-200 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="glass-subcard p-3 rounded-xl space-y-1">
                    <span className="text-slate-300/75">{t('laboratoryDentist')}</span>
                    <p className="font-semibold text-slate-100">{selectedLab.laboratoryName}</p>
                    <p className="text-slate-300">{selectedLab.dentistName}</p>
                  </div>
                  <div className="glass-subcard p-3 rounded-xl space-y-1">
                    <span className="text-slate-300/75">{t('deliveryTracking')}</span>
                    <p className="font-mono text-violet-200">
                      {selectedLab.deliveryTrackingNumber || t('noTrackingAssigned')}
                    </p>
                    <p className="text-slate-300">
                      {t('expPrefix')}: {formatDateByLanguage(selectedLab.expectedReturnDate, language)}
                    </p>
                  </div>
                </div>

                {/* Photo Preview / Attach Banner */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200">{t('zoneColPhoto')}</label>
                  <AttachmentCell
                    variant="banner"
                    evidenceId={
                      selectedLab.attachmentEvidenceId ||
                      selectedLab.supportingFiles.find((f) => f.startsWith('ev-'))
                    }
                    itemTitle={`${selectedLab.orderReference} · ${selectedLab.laboratoryName}`}
                    contextLabel={t('labTracker')}
                    relatedLabId={selectedLab.id}
                    onAttached={(evId) => handleAttachPhoto(selectedLab.id, evId)}
                    onRemoved={(removedId) => handleRemovePhoto(selectedLab.id, removedId)}
                  />
                </div>

                {/* Supporting Files */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{t('supportingLabFiles')}</span>
                  </label>
                  <div className="space-y-1.5">
                    {selectedLab.supportingFiles.map((file, i) => (
                      <div
                        key={i}
                        className="glass-subcard flex items-center justify-between p-2.5 rounded-xl text-xs"
                      >
                        <span className="font-mono text-emerald-200">{file}</span>
                        <span className="text-[10px] text-slate-300">{t('attachedFileBadge')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Work History Timeline */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{t('orderShipmentHistory')}</span>
                  </label>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {selectedLab.workHistory.map((rawWh) => {
                      const wh = resolveLocalizedLabHistory(rawWh, selectedLab.id, language);
                      return (
                        <div key={wh.id} className="glass-subcard p-2.5 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-300">
                              {translateLabStatus(wh.status, language)}
                            </span>
                            <span className="text-[10px] text-slate-300/75">
                              {formatDateByLanguage(wh.timestamp, language)}
                            </span>
                          </div>
                          <p className="text-slate-200">{wh.notes}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/15">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">{t('changeStatus')}</span>
                  <select
                    value={selectedLab.status}
                    onChange={(e) =>
                      handleLabStatusChange(selectedLab.id, e.target.value as LabStatus)
                    }
                    className="glass-input text-xs rounded-xl px-3 py-1.5"
                  >
                    <option value="Ordered">{translateLabStatus('Ordered', language)}</option>
                    <option value="In Fabrication">{translateLabStatus('In Fabrication', language)}</option>
                    <option value="Shipped">{translateLabStatus('Shipped', language)}</option>
                    <option value="Delivered">{translateLabStatus('Delivered', language)}</option>
                    <option value="Quality Checked">{translateLabStatus('Quality Checked', language)}</option>
                    <option value="Issue / Remake">{translateLabStatus('Issue / Remake', language)}</option>
                    <option value="Cancelled">{translateLabStatus('Cancelled', language)}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLabId(null)}
                  className="crystal-btn bg-emerald-600 text-white text-xs font-medium px-4 py-2 rounded-xl cursor-pointer"
                >
                  {t('done')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Lab Modal */}
      {editingLab &&
        createPortal(
          <div
            onClick={() => setEditingLab(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditLab}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingLab.orderReference}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingLab(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('orderRefWorkType')}</label>
                  <input
                    type="text"
                    required
                    value={editingLab.orderReference}
                    onChange={(e) => setEditingLab({ ...editingLab, orderReference: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('filterWorkType')}</label>
                  <select
                    value={editingLab.workType}
                    onChange={(e) =>
                      setEditingLab({ ...editingLab, workType: e.target.value as LabWorkType })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    <option value="Denture">{translateLabWorkType('Denture', language)}</option>
                    <option value="Crown">{translateLabWorkType('Crown', language)}</option>
                    <option value="Retainer">{translateLabWorkType('Retainer', language)}</option>
                    <option value="Surgical Guide">{translateLabWorkType('Surgical Guide', language)}</option>
                    <option value="Other">{translateLabWorkType('Other', language)}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('laboratoryDentist')}</label>
                  <input
                    type="text"
                    required
                    value={editingLab.laboratoryName}
                    onChange={(e) => setEditingLab({ ...editingLab, laboratoryName: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('patientRef')}</label>
                  <input
                    type="text"
                    required
                    value={editingLab.patientRefId}
                    onChange={(e) => setEditingLab({ ...editingLab, patientRefId: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('sentExpected')}</label>
                  <input
                    type="date"
                    value={editingLab.expectedReturnDate}
                    onChange={(e) =>
                      setEditingLab({ ...editingLab, expectedReturnDate: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('trackingNumber')}</label>
                  <input
                    type="text"
                    value={editingLab.deliveryTrackingNumber || ''}
                    onChange={(e) =>
                      setEditingLab({ ...editingLab, deliveryTrackingNumber: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLab(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold cursor-pointer"
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
              onSubmit={handleConfirmPasteLabs}
              className="glass-modal border-cyan-400/35 rounded-2xl max-w-2xl w-full p-5 space-y-4 text-xs shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-slate-100">{t('pasteLabsModalTitle')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">{t('pasteLabsHint')}</p>

              <textarea
                rows={6}
                value={pasteRawText}
                onChange={(e) => {
                  setPasteRawText(e.target.value);
                  setPasteError(null);
                }}
                placeholder="LAB-204&#9;Crown&#9;Bangkok Lab&#9;ทพ.สมชาย&#9;HN-1029&#9;2026-11-28&#9;In Fabrication"
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
                    formatNumberByLanguage(parsedPasteLabs.length, language)
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
                    className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    {t('liveWsImportConfirmBtn')}
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
