import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  Eye,
  X,
  Link2,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Pencil,
  Trash2,
  LayoutGrid,
  Table2
} from 'lucide-react';
import { ActiveTab, EvidenceItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  translateEvidenceFileType
} from '../utils/i18n';
import { resolveLocalizedEvidence } from '../data/initialData';
import { deleteEvidenceFile, getEvidenceFile, saveEvidenceFile } from '../services/evidenceStorage';
import {
  formatFileSize,
  MAX_INBOX_FILE_BYTES,
  resolveNormalizedMimeType
} from '../services/aiService';
import mascotEvidence from '../assets/images/mascot_evidence_1795242057050.jpg';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';

const EVIDENCE_MASCOT_URL =
  'https://i.postimg.cc/NjktjjyL/915124600-1800868747806524-2398384840772570514-n.webp';

interface WorkEvidenceProps {
  evidenceList: EvidenceItem[];
  setEvidenceList: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  searchQuery: string;
  setActiveTab?: (tab: ActiveTab) => void;
  onOpenNewTaskModal?: () => void;
}

export const WorkEvidence: React.FC<WorkEvidenceProps> = ({
  evidenceList,
  setEvidenceList,
  searchQuery,
  setActiveTab,
  onOpenNewTaskModal
}) => {
  const { t, language } = useLanguage();
  const { activeWorkspace, workspaces, transferEvidenceToWorkspace, recordAudit, clearWorkspaceSlice } = useWorkspace();
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newFilename, setNewFilename] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFileType, setNewFileType] = useState<EvidenceItem['fileType']>('image');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mascotSrc, setMascotSrc] = useState<string>(EVIDENCE_MASCOT_URL);
  const [transferredId, setTransferredId] = useState<string | null>(null);
  const [editingEv, setEditingEv] = useState<EvidenceItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearEvidence, setConfirmClearEvidence] = useState(false);

  const isPersonal = activeWorkspace.type === 'personal';
  const targetTransferWorkspace = workspaces.find((ws) =>
    isPersonal ? ws.type === 'clinic' : ws.type === 'personal'
  );
  const cardSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const [previewState, setPreviewState] = useState<{
    filename: string;
    mimeType: string;
    objectUrl: string;
    textContent?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewState?.objectUrl) {
        URL.revokeObjectURL(previewState.objectUrl);
      }
    };
  }, [previewState]);

  const handleModalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_INBOX_FILE_BYTES) {
      setUploadError(t('fileSizeExceeded').replace('{size}', formatFileSize(file.size)));
      return;
    }
    setSelectedFile(file);
    setNewFilename(file.name);
    const mime = resolveNormalizedMimeType(file);
    if (mime.startsWith('image/')) setNewFileType('image');
    else if (mime === 'application/pdf') setNewFileType('pdf');
    else if (
      mime.includes('spreadsheet') ||
      mime === 'text/csv' ||
      mime === 'application/vnd.ms-excel'
    ) {
      setNewFileType('spreadsheet');
    } else {
      setNewFileType('document');
    }
  };

  const handleUploadNewEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilename.trim()) return;
    setUploadError(null);

    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const evId = `ev-${Date.now()}`;
    let hasStoredFile = false;
    let mimeType: string | undefined;
    let fileSize = '1.8 MB';

    if (selectedFile) {
      mimeType = resolveNormalizedMimeType(selectedFile);
      fileSize = formatFileSize(selectedFile.size);
      try {
        await saveEvidenceFile(evId, selectedFile, newFilename.trim(), mimeType, nowTs);
        hasStoredFile = true;
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถบันทึกลง IndexedDB ได้ชั่วคราว (บันทึกเฉพาะรายการข้อมูล)'
        );
      }
    }

    const newItem: EvidenceItem = {
      id: evId,
      originalFilename: newFilename.trim(),
      fileType: newFileType,
      uploadDateTime: nowTs.slice(0, 16),
      receivedTimestamp: nowTs,
      description: newDescription || t('defaultEvidenceDesc'),
      fileSize,
      mimeType,
      hasStoredFile,
      isDemo: false
    };

    setEvidenceList((prev) => [newItem, ...prev]);
    setSelectedFile(null);
    setNewFilename('');
    setNewDescription('');
    setIsUploadModalOpen(false);
  };

  const handleAttachPhotoToRecord = (evId: string, newAttachmentEvId: string) => {
    setEvidenceList((prev) =>
      prev.map((item) =>
        item.id === evId ? { ...item, fileUrl: newAttachmentEvId } : item
      )
    );
  };

  const handleRemovePhotoFromRecord = (evId: string) => {
    setEvidenceList((prev) =>
      prev.map((item) =>
        item.id === evId ? { ...item, fileUrl: undefined, hasStoredFile: false } : item
      )
    );
  };

  const handleOpenEvidence = async (ev: EvidenceItem) => {
    const lookupId = ev.hasStoredFile ? ev.id : ev.fileUrl;
    if (!lookupId) return;
    const stored = await getEvidenceFile(lookupId);
    if (!stored) return;

    const url = URL.createObjectURL(stored.blob);
    let textContent: string | undefined;
    if (stored.mimeType.startsWith('text/')) {
      textContent = await stored.blob.text();
    }

    if (previewState?.objectUrl) {
      URL.revokeObjectURL(previewState.objectUrl);
    }
    setPreviewState({
      filename: stored.filename || ev.originalFilename,
      mimeType: stored.mimeType,
      objectUrl: url,
      textContent
    });
  };

  const handleDownloadEvidence = async (ev: EvidenceItem) => {
    const lookupId = ev.hasStoredFile ? ev.id : ev.fileUrl;
    if (!lookupId) return;
    const stored = await getEvidenceFile(lookupId);
    if (!stored) return;
    const url = URL.createObjectURL(stored.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = stored.filename || ev.originalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleTransferEvidence = (evId: string) => {
    if (!targetTransferWorkspace) return;
    const ok = transferEvidenceToWorkspace(evId, targetTransferWorkspace.id);
    if (ok) {
      setTransferredId(evId);
      setTimeout(() => setTransferredId((curr) => (curr === evId ? null : curr)), 2500);
    }
  };

  const handleDeleteEvidence = async (evId: string) => {
    if (confirmDeleteId !== evId) {
      setConfirmDeleteId(evId);
      return;
    }
    setConfirmDeleteId(null);
    setEvidenceList((prev) => prev.filter((item) => item.id !== evId));
    await deleteEvidenceFile(evId).catch(() => undefined);
    recordAudit('task_update', `Deleted local evidence ${evId}`);
  };

  const handleSaveEditEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEv) return;
    setEvidenceList((prev) =>
      prev.map((item) => (item.id === editingEv.id ? { ...editingEv, localized: undefined } : item))
    );
    recordAudit('task_update', `Edited evidence ${editingEv.originalFilename}`);
    setEditingEv(null);
  };

  const localizedEvidenceList = evidenceList.map((ev) => resolveLocalizedEvidence(ev, language));
  const imageCount = localizedEvidenceList.filter((e) => e.fileType === 'image').length;
  const pdfDocCount = localizedEvidenceList.filter(
    (e) => e.fileType === 'pdf' || e.fileType === 'document' || e.fileType === 'spreadsheet'
  ).length;
  const storedCount = localizedEvidenceList.filter((e) => e.hasStoredFile).length;

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'ev-total',
      label: t('workEvidenceTitle'),
      value: localizedEvidenceList.length,
      subLabel: t('allFileTypes'),
      tone: 'purple',
      icon: FileText,
      active: typeFilter === 'All',
      onClick: () => setTypeFilter('All')
    },
    {
      id: 'ev-images',
      label: t('fileTypeImage'),
      value: imageCount,
      subLabel: t('zoneColPhoto'),
      tone: 'rose',
      icon: ImageIcon,
      active: typeFilter === 'image',
      onClick: () => setTypeFilter(typeFilter === 'image' ? 'All' : 'image')
    },
    {
      id: 'ev-docs',
      label: `${t('fileTypePdf')} / Docs`,
      value: pdfDocCount,
      subLabel: t('fileTypeSpreadsheet'),
      tone: 'cyan',
      icon: FileSpreadsheet,
      active: typeFilter === 'pdf',
      onClick: () => setTypeFilter(typeFilter === 'pdf' ? 'All' : 'pdf')
    },
    {
      id: 'ev-indexed',
      label: t('indexedDbBadge'),
      value: storedCount,
      subLabel: t('uploadEvidence'),
      tone: 'amber',
      icon: Database,
      onClick: () => setIsUploadModalOpen(true)
    }
  ];

  const filteredEvidence = localizedEvidenceList.filter((ev) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      ev.originalFilename.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      (ev.relatedPatientId && ev.relatedPatientId.toLowerCase().includes(q)) ||
      (ev.relatedTaskId && ev.relatedTaskId.toLowerCase().includes(q));

    const matchesType = typeFilter === 'All' || ev.fileType === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Row 1: 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Line + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('evidence')}
        trendSeriesPrimaryData={[0, 0, 0, 0, imageCount, storedCount, localizedEvidenceList.length]}
        trendSeriesSecondaryLabel={t('indexedDbBadge')}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, 0, storedCount]}
        ratioSlices={[
          { label: t('fileTypeImage'), count: imageCount, dotClass: 'bg-pink-400', colorHex: '#ec4899' },
          {
            label: t('fileTypePdf'),
            count: localizedEvidenceList.filter((e) => e.fileType === 'pdf').length,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          },
          {
            label: t('fileTypeSpreadsheet'),
            count: localizedEvidenceList.filter((e) => e.fileType === 'spreadsheet').length,
            dotClass: 'bg-teal-400',
            colorHex: '#2dd4bf'
          },
          {
            label: t('fileTypeDocument'),
            count: localizedEvidenceList.filter((e) => e.fileType === 'document' || e.fileType === 'other').length,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          }
        ]}
        activities={localizedEvidenceList.slice(0, 5).map((ev) => ({
          id: ev.id,
          title: ev.originalFilename,
          meta: `${translateEvidenceFileType(ev.fileType, language)} · ${formatDateByLanguage(
            ev.uploadDateTime,
            language
          )}`,
          dotClass: ev.hasStoredFile ? 'bg-emerald-400' : 'bg-violet-400'
        }))}
      />

      {/* Top Banner + Filters */}
      <div className={`rounded-2xl p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src={mascotSrc}
              alt={t('workEvidenceTitle')}
              referrerPolicy="no-referrer"
              onError={() => {
                if (mascotSrc !== mascotEvidence) {
                  setMascotSrc(mascotEvidence);
                }
              }}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-violet-300/45 glass-subcard shrink-0"
            />
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                {t('workEvidenceTitle')} ({formatNumberByLanguage(evidenceList.length, language)})
              </h2>
              <p className="text-xs text-slate-300/80 mt-0.5">{t('workEvidenceSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="crystal-tile flex items-center p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                  viewMode === 'cards' ? 'bg-violet-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t('viewCardsLabel')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                  viewMode === 'table' ? 'bg-violet-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>{t('viewTableLabel')}</span>
              </button>
            </div>
            {evidenceList.length > 0 && (
              confirmClearEvidence ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void clearWorkspaceSlice('evidenceList');
                      setConfirmClearEvidence(false);
                    }}
                    className="crystal-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('confirmClearAllBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearEvidence(false)}
                    className="crystal-tile px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearEvidence(true)}
                  className="crystal-tile inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-200 hover:bg-rose-500/20 border-rose-400/30 text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('clearAllBtn')}</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="crystal-btn flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{t('uploadEvidence')}</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="w-64">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">{t('fileType')}</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="glass-input w-full text-xs rounded-xl px-3 py-2"
            >
              <option value="All">{t('allFileTypes')}</option>
              <option value="image">{t('fileTypeImage')}</option>
              <option value="pdf">{t('fileTypePdf')}</option>
              <option value="spreadsheet">{t('fileTypeSpreadsheet')}</option>
              <option value="document">{t('fileTypeDocument')}</option>
            </select>
          </div>
          <div className="crystal-tile flex items-center gap-2 text-xs text-slate-200 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-violet-300" />
            <span>{t('localStorageVerifiedHint')}</span>
          </div>
        </div>
      </div>

      {/* Cards or Table View */}
      {filteredEvidence.length === 0 ? (
        <div className="text-center py-12 px-4 crystal-tile rounded-2xl border-dashed space-y-2.5">
          <p className="text-xs font-semibold text-slate-200">{t('noEvidenceFound')}</p>
          <p className="text-[11px] text-slate-300/80 max-w-md mx-auto">{t('awaitingSheetSyncHint')}</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('uploadEvidence')}</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className={`${cardSurface} rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">{t('zoneColPhoto')}</th>
                  <th className="py-3 px-4">{t('originalFilename')}</th>
                  <th className="py-3 px-4">{t('fileType')}</th>
                  <th className="py-3 px-4">{t('date')}</th>
                  <th className="py-3 px-4 text-right">{t('actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredEvidence.map((ev) => {
                  const thumbId = ev.hasStoredFile ? ev.id : ev.fileUrl;
                  const isConfirmDel = confirmDeleteId === ev.id;
                  return (
                    <tr key={ev.id} className="hover:bg-white/[0.06] transition-colors">
                      <td className="py-3 px-4">
                        <AttachmentCell
                          evidenceId={thumbId}
                          itemTitle={ev.originalFilename}
                          contextLabel={t('evidence')}
                          onAttached={(newId) => handleAttachPhotoToRecord(ev.id, newId)}
                          onRemoved={() => handleRemovePhotoFromRecord(ev.id)}
                        />
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-mono font-semibold text-slate-100 truncate">
                          {ev.originalFilename}
                        </p>
                        <p className="text-[11px] text-slate-300/80 truncate">{ev.description}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {translateEvidenceFileType(ev.fileType, language)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        {formatDateByLanguage(ev.receivedTimestamp || ev.uploadDateTime, language)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {(ev.hasStoredFile || ev.fileUrl) && (
                            <button
                              type="button"
                              onClick={() => void handleOpenEvidence(ev)}
                              className="crystal-tile p-1.5 rounded-lg text-violet-200 hover:text-white cursor-pointer"
                              title={t('openPreviewBtn')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const raw = evidenceList.find((i) => i.id === ev.id);
                              if (raw) setEditingEv({ ...raw });
                            }}
                            className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteEvidence(ev.id)}
                            className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                              isConfirmDel
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                            }`}
                            title={t('deleteBtn')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isConfirmDel && <span>{t('confirmDeleteBtn')}</span>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvidence.map((ev) => {
            const thumbId = ev.hasStoredFile ? ev.id : ev.fileUrl;
            const isConfirmDel = confirmDeleteId === ev.id;
            return (
              <div
                key={ev.id}
                className={`hover:border-violet-300/45 rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between ${cardSurface}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {ev.fileType === 'image' ? (
                        <ImageIcon className="w-4 h-4 text-violet-300" />
                      ) : ev.fileType === 'pdf' ? (
                        <FileText className="w-4 h-4 text-cyan-300" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                      )}
                      <span className="text-[10px] font-semibold tracking-wider text-slate-300">
                        {translateEvidenceFileType(ev.fileType, language)}
                      </span>
                      {ev.hasStoredFile && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                          {t('indexedDbBadge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const raw = evidenceList.find((i) => i.id === ev.id);
                          if (raw) setEditingEv({ ...raw });
                        }}
                        className="crystal-tile p-1 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                        title={t('editBtn')}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteEvidence(ev.id)}
                        className={`p-1 rounded-lg border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-0.5 ${
                          isConfirmDel
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                        }`}
                        title={t('deleteBtn')}
                      >
                        <Trash2 className="w-3 h-3" />
                        {isConfirmDel && <span>{t('confirmDeleteBtn')}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Inline Image Preview or Attach Photo inside Card */}
                  <AttachmentCell
                    variant="banner"
                    evidenceId={thumbId}
                    itemTitle={ev.originalFilename}
                    contextLabel={t('evidence')}
                    onAttached={(newId) => handleAttachPhotoToRecord(ev.id, newId)}
                    onRemoved={() => handleRemovePhotoFromRecord(ev.id)}
                  />

                  <div>
                    <h3 className="text-xs font-semibold font-mono text-slate-100 truncate">
                      {ev.originalFilename}
                    </h3>
                    <p className="text-[11px] text-slate-300/85 mt-1 line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>
                    {ev.relatedTaskId && (
                      <p className="text-[10px] text-violet-200 mt-1.5 flex items-center gap-1 font-mono">
                        <Link2 className="w-3 h-3" />
                        <span>
                          {t('linkedTaskPrefix')}: {ev.relatedTaskId}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span className="truncate tabular-nums">
                      {formatDateByLanguage(ev.receivedTimestamp || ev.uploadDateTime, language)}
                    </span>
                    {ev.hasStoredFile || ev.fileUrl ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleOpenEvidence(ev)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/35 text-violet-100 border border-violet-300/35 text-[10px] font-medium cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{t('openPreviewBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadEvidence(ev)}
                          className="crystal-tile inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-100 text-[10px] font-medium cursor-pointer"
                          aria-label={t('downloadBtn')}
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-violet-300 font-medium shrink-0">
                        {t('verifiedRecordBadge')}
                      </span>
                    )}
                  </div>

                  {targetTransferWorkspace && (
                    <button
                      type="button"
                      onClick={() => handleTransferEvidence(ev.id)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer ${
                        transferredId === ev.id
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                          : 'glass-subcard hover:bg-violet-500/20 text-violet-100 border-white/15'
                      }`}
                    >
                      {transferredId === ev.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {t('transferredSuccessToast').replace(
                              '{target}',
                              targetTransferWorkspace.name
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>
                            {isPersonal ? t('transferToAssistantBtn') : t('transferToPersonalBtn')}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={onOpenNewTaskModal ? t('newTask') : t('uploadEvidence')}
        onPrimaryAction={onOpenNewTaskModal || (() => setIsUploadModalOpen(true))}
      />

      {/* Upload Modal */}
      {isUploadModalOpen &&
        createPortal(
          <div
            onClick={() => setIsUploadModalOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => void handleUploadNewEvidence(e)}
              className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <h3 className="text-sm font-bold text-slate-100">{t('uploadEvidenceModal')}</h3>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="crystal-tile text-slate-200 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">{t('pickLocalFileLabel')}</label>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,.xlsx,.xls,.csv,.txt"
                    onChange={handleModalFileSelect}
                    className="w-full text-xs text-slate-200 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-violet-500/30 file:text-violet-100 file:font-medium hover:file:bg-violet-500/45 cursor-pointer"
                  />
                  {uploadError && <p className="text-[11px] text-rose-300">{uploadError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">{t('originalFilename')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('evidenceFilenamePlaceholder')}
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">{t('fileType')}</label>
                  <select
                    value={newFileType}
                    onChange={(e) => setNewFileType(e.target.value as EvidenceItem['fileType'])}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    <option value="image">{t('fileTypeImage')}</option>
                    <option value="pdf">{t('fileTypePdf')}</option>
                    <option value="spreadsheet">{t('fileTypeSpreadsheet')}</option>
                    <option value="document">{t('fileTypeDocument')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">{t('evidenceDescription')}</label>
                  <textarea
                    rows={3}
                    placeholder={t('evidenceDescPlaceholder')}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn bg-violet-600 text-white text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer"
                >
                  {t('saveToLibrary')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Edit Evidence Modal */}
      {editingEv &&
        createPortal(
          <div
            onClick={() => setEditingEv(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditEvidence}
              className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">{t('editBtn')}</h3>
                <button
                  type="button"
                  onClick={() => setEditingEv(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('originalFilename')}</label>
                  <input
                    type="text"
                    required
                    value={editingEv.originalFilename}
                    onChange={(e) =>
                      setEditingEv({ ...editingEv, originalFilename: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('fileType')}</label>
                  <select
                    value={editingEv.fileType}
                    onChange={(e) =>
                      setEditingEv({
                        ...editingEv,
                        fileType: e.target.value as EvidenceItem['fileType']
                      })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    <option value="image">{t('fileTypeImage')}</option>
                    <option value="pdf">{t('fileTypePdf')}</option>
                    <option value="spreadsheet">{t('fileTypeSpreadsheet')}</option>
                    <option value="document">{t('fileTypeDocument')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">
                    {t('evidenceDescription')}
                  </label>
                  <textarea
                    rows={3}
                    value={editingEv.description}
                    onChange={(e) => setEditingEv({ ...editingEv, description: e.target.value })}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEv(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* In-App File Preview Modal (from IndexedDB) */}
      {previewState &&
        createPortal(
          <div
            onClick={() => {
              URL.revokeObjectURL(previewState.objectUrl);
              setPreviewState(null);
            }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/15">
                <span className="text-xs font-mono font-semibold text-slate-100 truncate">
                  {previewState.filename}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewState.objectUrl}
                    download={previewState.filename}
                    className="crystal-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('downloadBtn')}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(previewState.objectUrl);
                      setPreviewState(null);
                    }}
                    className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 glass-subcard flex items-center justify-center">
                {previewState.mimeType.startsWith('image/') ? (
                  <img
                    src={previewState.objectUrl}
                    alt={previewState.filename}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[70vh] rounded-xl object-contain"
                  />
                ) : previewState.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewState.objectUrl}
                    title={previewState.filename}
                    className="w-full h-[70vh] rounded-xl border border-white/15 bg-white"
                  />
                ) : previewState.textContent !== undefined ? (
                  <pre className="w-full text-xs text-slate-100 font-mono whitespace-pre-wrap p-3 glass-subcard rounded-xl">
                    {previewState.textContent}
                  </pre>
                ) : (
                  <div className="text-center space-y-3 py-10 text-xs text-slate-300">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-300 mx-auto" />
                    <p>{t('previewFileUnsupported')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
