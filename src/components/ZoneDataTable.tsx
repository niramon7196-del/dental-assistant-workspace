import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ImagePlus,
  ZoomIn,
  X,
  ArrowUpRight,
  Image as ImageIcon,
  CheckCircle2,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  ActiveTab,
  DentureCase,
  EvidenceItem,
  LabOrder,
  PatientFollowUpItem,
  QueueItem,
  TaskItem
} from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { deleteEvidenceFile, getEvidenceFile, saveEvidenceFile } from '../services/evidenceStorage';
import {
  formatFileSize,
  MAX_INBOX_FILE_BYTES,
  resolveNormalizedMimeType
} from '../services/aiService';
import {
  translateLabStatus,
  translateLabWorkType,
  translateTaskStatus
} from '../utils/i18n';
import {
  resolveLocalizedEvidence,
  resolveLocalizedFollowUp,
  resolveLocalizedLab,
  resolveLocalizedTask
} from '../data/initialData';

export type ZoneTableFilter = 'all' | 'queue' | 'lab' | 'followup' | 'evidence';

interface ZoneRow {
  rowKey: string;
  sourceKind: 'queue' | 'task' | 'lab' | 'followup' | 'denture' | 'evidence';
  sourceId: string;
  zone: Exclude<ZoneTableFilter, 'all'>;
  title: string;
  subtitle: string;
  zoneLabel: string;
  statusText: string;
  targetTab: ActiveTab;
  evidenceId?: string;
}

interface ZoneDataTableProps {
  setActiveTab: (tab: ActiveTab) => void;
  isPersonal: boolean;
}

export const ZoneDataTable: React.FC<ZoneDataTableProps> = ({ setActiveTab, isPersonal }) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    tasks,
    setTasks,
    queueItems,
    setQueueItems,
    labOrders,
    setLabOrders,
    followUps,
    setFollowUps,
    dentureCases,
    setDentureCases,
    evidenceList,
    setEvidenceList,
    recordAudit
  } = useWorkspace();

  const [zoneFilter, setZoneFilter] = useState<ZoneTableFilter>('all');
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [lightboxState, setLightboxState] = useState<{ url: string; title: string } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    row: ZoneRow;
    primary: string;
    secondary: string;
    status: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingTargetRef = useRef<ZoneRow | null>(null);
  const thumbUrlsRef = useRef<Record<string, string>>({});

  const isClinic = activeWorkspace.type === 'clinic';
  const glassClass = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const rows: ZoneRow[] = useMemo(() => {
    const out: ZoneRow[] = [];

    if (isClinic) {
      queueItems.slice(0, 6).forEach((q) => {
        out.push({
          rowKey: `queue:${q.id}`,
          sourceKind: 'queue',
          sourceId: q.id,
          zone: 'queue',
          title: `${q.queueNumber} · ${q.patientName}`,
          subtitle: q.roomName ? `${q.procedure} · ${q.roomName}` : q.procedure,
          zoneLabel: t('zoneTabQueue'),
          statusText:
            q.status === 'called'
              ? t('queueStatusCalled')
              : q.status === 'completed'
              ? t('queueStatusCompleted')
              : q.status === 'claimed_other'
              ? t('queueStatusClaimedOther')
              : q.status === 'skipped'
              ? t('queueStatusSkipped')
              : t('queueStatusWaiting'),
          targetTab: 'queue',
          evidenceId: q.attachmentEvidenceId
        });
      });

      labOrders.slice(0, 6).forEach((rawLab: LabOrder) => {
        const lab = resolveLocalizedLab(rawLab, language);
        out.push({
          rowKey: `lab:${lab.id}`,
          sourceKind: 'lab',
          sourceId: lab.id,
          zone: 'lab',
          title: `${lab.orderReference} · ${translateLabWorkType(lab.workType, language)}`,
          subtitle: `${lab.laboratoryName} · ${lab.patientRefId}`,
          zoneLabel: t('zoneTabLab'),
          statusText: translateLabStatus(lab.status, language),
          targetTab: 'labs',
          evidenceId: lab.attachmentEvidenceId || lab.supportingFiles.find((f) => f.startsWith('ev-'))
        });
      });

      followUps.slice(0, 5).forEach((rawFu: PatientFollowUpItem) => {
        const fu = resolveLocalizedFollowUp(rawFu, language);
        out.push({
          rowKey: `followup:${fu.id}`,
          sourceKind: 'followup',
          sourceId: fu.id,
          zone: 'followup',
          title: `${fu.patientRefId} · ${fu.caseCategory}`,
          subtitle: fu.nextAction,
          zoneLabel: t('zoneTabFollowup'),
          statusText: fu.status,
          targetTab: 'followups',
          evidenceId: fu.attachmentEvidenceId || fu.relatedEvidenceIds[0]
        });
      });

      dentureCases.slice(0, 4).forEach((dc: DentureCase) => {
        out.push({
          rowKey: `denture:${dc.row}-${dc.hn}`,
          sourceKind: 'denture',
          sourceId: `${dc.row}`,
          zone: 'followup',
          title: `${dc.name} (${dc.hn})`,
          subtitle: dc.history || dc.dentist,
          zoneLabel: t('denture'),
          statusText: dc.status,
          targetTab: 'denture',
          evidenceId: dc.attachmentEvidenceId
        });
      });
    }

    tasks.slice(0, 8).forEach((rawTask: TaskItem) => {
      const task = resolveLocalizedTask(rawTask, language);
      const isCheckOrStock =
        task.taskKind === 'check' ||
        task.category === 'Inventory & Supplies' ||
        task.category === 'Sterilization & Prep';

      out.push({
        rowKey: `task:${task.id}`,
        sourceKind: 'task',
        sourceId: task.id,
        zone: isCheckOrStock
          ? 'evidence'
          : task.taskKind === 'followup'
          ? 'followup'
          : task.category === 'Lab Coordination'
          ? 'lab'
          : 'queue',
        title: task.title,
        subtitle: task.attachedNote || task.description,
        zoneLabel: isCheckOrStock
          ? t('zoneTabEvidence')
          : task.category === 'Lab Coordination'
          ? t('zoneTabLab')
          : task.taskKind === 'followup'
          ? t('zoneTabFollowup')
          : t('zoneTabQueue'),
        statusText: translateTaskStatus(task.status, language),
        targetTab: 'tasks',
        evidenceId: task.attachmentEvidenceId || task.evidenceIds[0]
      });
    });

    evidenceList.slice(0, 6).forEach((rawEv: EvidenceItem) => {
      const ev = resolveLocalizedEvidence(rawEv, language);
      out.push({
        rowKey: `evidence:${ev.id}`,
        sourceKind: 'evidence',
        sourceId: ev.id,
        zone: 'evidence',
        title: ev.originalFilename,
        subtitle: ev.description,
        zoneLabel: t('zoneTabEvidence'),
        statusText: ev.hasStoredFile ? t('indexedDbBadge') : t('verifiedRecordBadge'),
        targetTab: 'evidence',
        evidenceId: ev.hasStoredFile ? ev.id : undefined
      });
    });

    return out;
  }, [isClinic, queueItems, labOrders, followUps, dentureCases, tasks, evidenceList, language, t]);

  const filteredRows = useMemo(() => {
    if (zoneFilter === 'all') return rows.slice(0, 12);
    return rows.filter((r) => r.zone === zoneFilter);
  }, [rows, zoneFilter]);

  useEffect(() => {
    let active = true;
    const neededIds = Array.from(
      new Set(
        filteredRows
          .map((r) => r.evidenceId)
          .filter((id): id is string => Boolean(id) && !thumbUrlsRef.current[id as string])
      )
    );
    if (neededIds.length === 0) return;

    (async () => {
      const additions: Record<string, string> = {};
      for (const id of neededIds) {
        try {
          const stored = await getEvidenceFile(id);
          if (stored && stored.mimeType.startsWith('image/')) {
            additions[id] = stored.dataUrl || URL.createObjectURL(stored.blob);
          }
        } catch {
          // Ignore missing files
        }
      }
      if (!active) {
        Object.values(additions).forEach((u) => {
          if (u.startsWith('blob:')) URL.revokeObjectURL(u);
        });
        return;
      }
      if (Object.keys(additions).length > 0) {
        thumbUrlsRef.current = { ...thumbUrlsRef.current, ...additions };
        setThumbUrls((prev) => ({ ...prev, ...additions }));
      }
    })();

    return () => {
      active = false;
    };
  }, [filteredRows]);

  useEffect(() => {
    return () => {
      Object.values(thumbUrlsRef.current).forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    };
  }, []);

  const triggerRowPhotoPicker = (row: ZoneRow) => {
    setUploadError(null);
    pendingTargetRef.current = row;
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetRow = pendingTargetRef.current;
    pendingTargetRef.current = null;
    if (!file || !targetRow) return;

    if (file.size > MAX_INBOX_FILE_BYTES) {
      setUploadError(t('fileSizeExceeded').replace('{size}', formatFileSize(file.size)));
      return;
    }

    const mimeType = resolveNormalizedMimeType(file);
    if (!mimeType.startsWith('image/')) return;

    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const evId = `ev-row-${Date.now()}`;
    try {
      await saveEvidenceFile(evId, file, file.name, mimeType, nowTs);
      const saved = await getEvidenceFile(evId);
      const previewUrl = saved?.dataUrl || URL.createObjectURL(file);
      thumbUrlsRef.current = { ...thumbUrlsRef.current, [evId]: previewUrl };
      setThumbUrls((prev) => ({ ...prev, [evId]: previewUrl }));
    } catch {
      const fallbackUrl = URL.createObjectURL(file);
      thumbUrlsRef.current = { ...thumbUrlsRef.current, [evId]: fallbackUrl };
      setThumbUrls((prev) => ({ ...prev, [evId]: fallbackUrl }));
    }

    const newEv: EvidenceItem = {
      id: evId,
      originalFilename: file.name,
      fileType: 'image',
      uploadDateTime: nowTs.slice(0, 16),
      receivedTimestamp: nowTs,
      relatedTaskId: targetRow.sourceKind === 'task' ? targetRow.sourceId : undefined,
      relatedLabId: targetRow.sourceKind === 'lab' ? targetRow.sourceId : undefined,
      description: `${targetRow.zoneLabel}: ${targetRow.title}`,
      fileSize: formatFileSize(file.size),
      mimeType,
      hasStoredFile: true,
      isDemo: false
    };
    setEvidenceList((prev) => [newEv, ...prev]);

    if (targetRow.sourceKind === 'queue') {
      setQueueItems((prev) =>
        prev.map((q: QueueItem) =>
          q.id === targetRow.sourceId ? { ...q, attachmentEvidenceId: evId } : q
        )
      );
    } else if (targetRow.sourceKind === 'lab') {
      setLabOrders((prev) =>
        prev.map((l: LabOrder) =>
          l.id === targetRow.sourceId
            ? { ...l, attachmentEvidenceId: evId, supportingFiles: [evId, ...l.supportingFiles] }
            : l
        )
      );
    } else if (targetRow.sourceKind === 'followup') {
      setFollowUps((prev) =>
        prev.map((f: PatientFollowUpItem) =>
          f.id === targetRow.sourceId
            ? {
                ...f,
                attachmentEvidenceId: evId,
                relatedEvidenceIds: [evId, ...f.relatedEvidenceIds]
              }
            : f
        )
      );
    } else if (targetRow.sourceKind === 'denture') {
      const targetRowNum = Number(targetRow.sourceId);
      setDentureCases((prev) =>
        prev.map((dc) =>
          dc.row === targetRowNum ? { ...dc, attachmentEvidenceId: evId } : dc
        )
      );
    } else if (targetRow.sourceKind === 'task') {
      setTasks((prev) =>
        prev.map((tk: TaskItem) =>
          tk.id === targetRow.sourceId
            ? {
                ...tk,
                attachmentEvidenceId: evId,
                evidenceIds: [evId, ...tk.evidenceIds],
                relatedDocuments: [file.name, ...tk.relatedDocuments]
              }
            : tk
        )
      );
    }

    recordAudit('task_update', `Photo attached: ${targetRow.title} (${file.name})`);
    setUploadNotice(t('zonePhotoSavedMsg'));
    setTimeout(() => setUploadNotice(null), 2800);
  };

  const openEditForRow = (row: ZoneRow) => {
    if (row.sourceKind === 'queue') {
      const q = queueItems.find((i) => i.id === row.sourceId);
      if (q) {
        setEditModal({ row, primary: q.patientName, secondary: q.procedure, status: q.roomName || '' });
      }
    } else if (row.sourceKind === 'task') {
      const tk = tasks.find((i) => i.id === row.sourceId);
      if (tk) {
        setEditModal({ row, primary: tk.title, secondary: tk.description, status: tk.dueDate });
      }
    } else if (row.sourceKind === 'lab') {
      const lb = labOrders.find((i) => i.id === row.sourceId);
      if (lb) {
        setEditModal({ row, primary: lb.laboratoryName, secondary: lb.dentistName, status: lb.deliveryTrackingNumber || '' });
      }
    } else if (row.sourceKind === 'followup') {
      const fu = followUps.find((i) => i.id === row.sourceId);
      if (fu) {
        setEditModal({ row, primary: fu.caseCategory, secondary: fu.nextAction, status: fu.dueDate });
      }
    } else if (row.sourceKind === 'denture') {
      const dc = dentureCases.find((i) => String(i.row) === row.sourceId);
      if (dc) {
        setEditModal({ row, primary: dc.name, secondary: dc.note || dc.history, status: dc.appt });
      }
    } else if (row.sourceKind === 'evidence') {
      const ev = evidenceList.find((i) => i.id === row.sourceId);
      if (ev) {
        setEditModal({ row, primary: ev.originalFilename, secondary: ev.description, status: ev.fileType });
      }
    }
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const { row, primary, secondary, status } = editModal;

    if (row.sourceKind === 'queue') {
      setQueueItems((prev) =>
        prev.map((q) =>
          q.id === row.sourceId
            ? { ...q, patientName: primary, procedure: secondary, roomName: status || q.roomName }
            : q
        )
      );
    } else if (row.sourceKind === 'task') {
      setTasks((prev) =>
        prev.map((tk) =>
          tk.id === row.sourceId
            ? { ...tk, title: primary, description: secondary, dueDate: status || tk.dueDate, localized: undefined }
            : tk
        )
      );
    } else if (row.sourceKind === 'lab') {
      setLabOrders((prev) =>
        prev.map((lb) =>
          lb.id === row.sourceId
            ? { ...lb, laboratoryName: primary, dentistName: secondary, deliveryTrackingNumber: status, localized: undefined }
            : lb
        )
      );
    } else if (row.sourceKind === 'followup') {
      setFollowUps((prev) =>
        prev.map((fu) =>
          fu.id === row.sourceId
            ? { ...fu, caseCategory: primary, nextAction: secondary, dueDate: status || fu.dueDate, localized: undefined }
            : fu
        )
      );
    } else if (row.sourceKind === 'denture') {
      const targetRowNum = Number(row.sourceId);
      setDentureCases((prev) =>
        prev.map((dc) =>
          dc.row === targetRowNum ? { ...dc, name: primary, note: secondary, appt: status } : dc
        )
      );
    } else if (row.sourceKind === 'evidence') {
      setEvidenceList((prev) =>
        prev.map((ev) =>
          ev.id === row.sourceId
            ? { ...ev, originalFilename: primary, description: secondary, localized: undefined }
            : ev
        )
      );
    }

    recordAudit('task_update', `Edited ${row.sourceKind}: ${primary}`);
    setEditModal(null);
  };

  const handleDeleteRow = async (row: ZoneRow) => {
    if (confirmDeleteKey !== row.rowKey) {
      setConfirmDeleteKey(row.rowKey);
      return;
    }
    setConfirmDeleteKey(null);
    if (row.sourceKind === 'queue') {
      setQueueItems((prev) => prev.filter((q) => q.id !== row.sourceId));
    } else if (row.sourceKind === 'task') {
      setTasks((prev) => prev.filter((tk) => tk.id !== row.sourceId));
    } else if (row.sourceKind === 'lab') {
      setLabOrders((prev) => prev.filter((lb) => lb.id !== row.sourceId));
    } else if (row.sourceKind === 'followup') {
      setFollowUps((prev) => prev.filter((fu) => fu.id !== row.sourceId));
    } else if (row.sourceKind === 'denture') {
      const targetRowNum = Number(row.sourceId);
      setDentureCases((prev) => prev.filter((dc) => dc.row !== targetRowNum));
    } else if (row.sourceKind === 'evidence') {
      setEvidenceList((prev) => prev.filter((ev) => ev.id !== row.sourceId));
      await deleteEvidenceFile(row.sourceId).catch(() => undefined);
    }
    recordAudit('task_update', `Removed local item: ${row.title}`);
  };

  const tabs: Array<{ id: ZoneTableFilter; label: string }> = [
    { id: 'all', label: t('zoneTabAll') },
    ...(isClinic
      ? ([
          { id: 'queue', label: t('zoneTabQueue') },
          { id: 'lab', label: t('zoneTabLab') },
          { id: 'followup', label: t('zoneTabFollowup') }
        ] as const)
      : []),
    { id: 'evidence', label: t('zoneTabEvidence') }
  ];

  return (
    <div className={`${glassClass} rounded-2xl p-5 space-y-4`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handlePhotoSelected(e)}
        className="hidden"
      />

      {/* Header + Interactive Zone Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{t('zoneTableTitle')}</h3>

        <div className="crystal-tile flex flex-wrap items-center gap-1 p-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setZoneFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                zoneFilter === tab.id
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-600/90 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {uploadNotice && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/35 px-3.5 py-2 text-xs text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>{uploadNotice}</span>
        </div>
      )}
      {uploadError && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-400/35 px-3.5 py-2 text-xs text-rose-100">
          {uploadError}
        </div>
      )}

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-200">
          <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-3 w-20">{t('zoneColPhoto')}</th>
              <th className="py-2.5 px-3">{t('zoneColItem')}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('zoneColZone')}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('zoneColStatus')}</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">{t('zoneColAction')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 px-4 text-center space-y-1.5">
                  <p className="text-xs font-semibold text-slate-200">
                    {t('awaitingSheetSyncEmpty')}
                  </p>
                  <p className="text-[11px] text-slate-300/80">{t('awaitingSheetSyncHint')}</p>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const thumbUrl = row.evidenceId ? thumbUrls[row.evidenceId] : undefined;
                const isConfirmingDel = confirmDeleteKey === row.rowKey;
                return (
                  <tr key={row.rowKey} className="hover:bg-white/[0.06] transition-colors">
                    {/* Thumbnail Column */}
                    <td className="py-2.5 px-3">
                      {thumbUrl ? (
                        <button
                          type="button"
                          onClick={() => setLightboxState({ url: thumbUrl, title: row.title })}
                          title={t('zoneZoomPhotoHint')}
                          className="relative group w-11 h-11 rounded-xl overflow-hidden border border-violet-300/45 glass-subcard cursor-pointer shrink-0 block"
                        >
                          <img
                            src={thumbUrl}
                            alt={row.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-slate-950/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </span>
                        </button>
                      ) : (
                        <div className="w-11 h-11 rounded-xl crystal-tile flex items-center justify-center text-slate-300/70">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Item Title & Subtitle */}
                    <td className="py-2.5 px-3 max-w-xs">
                      <p className="font-semibold text-slate-100 truncate">{row.title}</p>
                      <p className="text-[11px] text-slate-300/80 truncate mt-0.5">{row.subtitle}</p>
                    </td>

                    {/* Zone Label */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-200 font-medium">
                      {row.zoneLabel}
                    </td>

                    {/* Status Text */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-cyan-200">
                      {row.statusText}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => triggerRowPhotoPicker(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/35 border border-violet-300/35 text-violet-100 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>{thumbUrl ? t('zoneChangePhotoBtn') : t('zoneAddPhotoBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForRow(row)}
                          className="crystal-tile p-1.5 rounded-lg hover:bg-white/15 text-cyan-200 hover:text-white cursor-pointer"
                          title={t('editBtn')}
                          aria-label={t('editBtn')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRow(row)}
                          className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors ${
                            isConfirmingDel
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                          }`}
                          title={isConfirmingDel ? t('confirmDeleteBtn') : t('deleteBtn')}
                          aria-label={t('deleteBtn')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isConfirmingDel && <span>{t('confirmDeleteBtn')}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab(row.targetTab)}
                          className="crystal-tile p-1.5 rounded-lg hover:bg-white/15 text-slate-200 hover:text-white cursor-pointer"
                          title={t('details')}
                          aria-label={t('details')}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
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

      {/* Image Lightbox Modal */}
      {lightboxState &&
        createPortal(
          <div
            onClick={() => setLightboxState(null)}
            className="fixed inset-0 z-[105] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-2xl w-full p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/15">
                <p className="text-xs font-semibold text-slate-100 truncate">{lightboxState.title}</p>
                <button
                  type="button"
                  onClick={() => setLightboxState(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                  aria-label={t('close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="glass-subcard rounded-xl p-2 flex items-center justify-center max-h-[72vh] overflow-hidden">
                <img
                  src={lightboxState.url}
                  alt={lightboxState.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[68vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Quick Inline Row Edit Modal */}
      {editModal &&
        createPortal(
          <div
            onClick={() => setEditModal(null)}
            className="fixed inset-0 z-[105] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditModal}
              className="glass-modal rounded-2xl max-w-md w-full p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h4 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editModal.row.zoneLabel}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('zoneColItem')}</label>
                  <input
                    type="text"
                    required
                    value={editModal.primary}
                    onChange={(e) => setEditModal({ ...editModal, primary: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('details')}</label>
                  <textarea
                    rows={3}
                    value={editModal.secondary}
                    onChange={(e) => setEditModal({ ...editModal, secondary: e.target.value })}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('zoneColStatus')}</label>
                  <input
                    type="text"
                    value={editModal.status}
                    onChange={(e) => setEditModal({ ...editModal, status: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
