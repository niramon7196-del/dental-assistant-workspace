import { getTvCode, buildCallSentence } from '../services/queueRelay';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone,
  MonitorPlay,
  Volume2,
  VolumeX,
  Plus,
  CheckCircle2,
  SkipForward,
  RotateCcw,
  Copy,
  Check,
  ListPlus,
  DoorOpen,
  Trash2,
  Clock,
  Pencil,
  X,
  Languages
} from 'lucide-react';
import { ActiveTab, QueueItem, QueueStatus } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatNumberByLanguage } from '../utils/i18n';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';

interface QueueManagerProps {
  setActiveTab?: (tab: ActiveTab) => void;
  onOpenNewTaskModal?: () => void;
  onOpenChairsideCopilot?: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  setActiveTab,
  onOpenNewTaskModal,
  onOpenChairsideCopilot
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    queueItems,
    setQueueItems,
    setIsTvDisplayOpen,
    clearWorkspaceSlice,
    recordAudit
  } = useWorkspace();

  const availableRooms =
    activeWorkspace.rooms.length > 0
      ? activeWorkspace.rooms
      : ['ห้อง 1 (Room 1)', 'ห้อง 2 (Room 2)'];

  const [myRoom, setMyRoom] = useState<string>(availableRooms[0]);

  useEffect(() => {
    if (!availableRooms.includes(myRoom)) {
      setMyRoom(availableRooms[0]);
    }
  }, [activeWorkspace.id, availableRooms, myRoom]);

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [queueNoInput, setQueueNoInput] = useState('');
  const [patientInput, setPatientInput] = useState('');
  const [procedureInput, setProcedureInput] = useState('');
  const [showBatch, setShowBatch] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [copiedTvLink, setCopiedTvLink] = useState(false);
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);
  const [editingQueue, setEditingQueue] = useState<QueueItem | null>(null);
  const [confirmDeleteQueueId, setConfirmDeleteQueueId] = useState<string | null>(null);
  const [confirmClearQueue, setConfirmClearQueue] = useState(false);

  const speakThaiCall = (item: QueueItem, room: string) => {
    const spokenSentence = buildCallSentence(item.patientName, room, language === 'en' ? 'en' : 'th');

    setLastSpoken(spokenSentence);
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenSentence);
      utterance.lang = language === 'en' ? 'en-US' : 'th-TH';
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find((v) => v.lang.toLowerCase().startsWith('th'));
      if (thaiVoice && language === 'th') {
        utterance.voice = thaiVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech API optional if restricted
    }
  };

  const handleAddSingleQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientInput.trim()) return;
    const autoNumber =
      queueNoInput.trim() || `A${String(queueItems.length + 1).padStart(2, '0')}`;

    const newItem: QueueItem = {
      id: `q-${Date.now()}`,
      queueNumber: autoNumber.toUpperCase(),
      patientName: patientInput.trim(),
      procedure:
        procedureInput.trim() || (language === 'en' ? 'Dental checkup' : 'ตรวจรักษาทางทันตกรรม'),
      roomName: myRoom,
      status: 'waiting',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    setQueueItems((prev) => [...prev, newItem]);
    setQueueNoInput('');
    setPatientInput('');
    setProcedureInput('');
    recordAudit(
      'task_create',
      `Added standalone queue ${newItem.queueNumber} (${newItem.patientName})`
    );
  };

  const handleBatchImport = () => {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const created: QueueItem[] = lines.map((line, idx) => {
      const parts = line.includes(',')
        ? line.split(',').map((p) => p.trim()).filter(Boolean)
        : line.split(/\s+/);

      const first = parts[0] || `Q${queueItems.length + idx + 1}`;
      const looksLikeCode = /^[A-Za-z]?\d{1,4}$/.test(first);
      const queueNumber = looksLikeCode
        ? first.toUpperCase()
        : `Q${String(queueItems.length + idx + 1).padStart(2, '0')}`;
      const patientName = looksLikeCode ? parts[1] || first : first;
      const procedure = looksLikeCode
        ? parts.slice(2).join(' ') || (language === 'en' ? 'Treatment' : 'ทำฟัน')
        : parts.slice(1).join(' ') || (language === 'en' ? 'Treatment' : 'ทำฟัน');

      return {
        id: `q-batch-${Date.now()}-${idx}`,
        queueNumber,
        patientName,
        procedure,
        roomName: myRoom,
        status: 'waiting',
        createdAt: nowStr
      };
    });

    setQueueItems((prev) => [...prev, ...created]);
    setBatchText('');
    setShowBatch(false);
  };

  const updateQueueStatus = (item: QueueItem, status: QueueStatus, speak = false) => {
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setQueueItems((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? {
              ...q,
              status,
              roomName: status === 'called' ? myRoom : q.roomName,
              calledAt: status === 'called' ? nowTime : q.calledAt
            }
          : q
      )
    );
    if (speak && status === 'called') {
      speakThaiCall(item, myRoom);
    }
  };

  const handleAttachPhoto = (id: string, evidenceId: string) => {
    setQueueItems((prev) =>
      prev.map((q) => (q.id === id ? { ...q, attachmentEvidenceId: evidenceId } : q))
    );
  };

  const handleRemovePhoto = (id: string) => {
    setQueueItems((prev) =>
      prev.map((q) => (q.id === id ? { ...q, attachmentEvidenceId: undefined } : q))
    );
  };

  const handleRemoveQueue = (id: string) => {
    if (confirmDeleteQueueId !== id) {
      setConfirmDeleteQueueId(id);
      return;
    }
    setConfirmDeleteQueueId(null);
    setQueueItems((prev) => prev.filter((q) => q.id !== id));
    recordAudit('task_update', `Deleted queue item ${id}`);
  };

  const handleSaveEditQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQueue) return;
    setQueueItems((prev) => prev.map((q) => (q.id === editingQueue.id ? editingQueue : q)));
    recordAudit('task_update', `Updated queue ${editingQueue.queueNumber}`);
    setEditingQueue(null);
  };

  const handleCopyTvLink = async () => {
    const url = `${window.location.origin}/?tv=1&code=${encodeURIComponent(getTvCode())}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback ignored if clipboard blocked
    }
    setCopiedTvLink(true);
    setTimeout(() => setCopiedTvLink(false), 2500);
  };

  const calledList = queueItems.filter((q) => q.status === 'called');
  const waitingList = queueItems.filter((q) => q.status === 'waiting');
  const completedList = queueItems.filter((q) => q.status === 'completed');
  const resolvedList = queueItems.filter(
    (q) => q.status === 'claimed_other' || q.status === 'completed' || q.status === 'skipped'
  );

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'q-total',
      label: t('queueNav'),
      value: queueItems.length,
      subLabel: t('allStatuses'),
      tone: 'purple',
      icon: Megaphone
    },
    {
      id: 'q-called',
      label: t('queueStatusCalled'),
      value: calledList.length,
      subLabel: myRoom,
      tone: 'rose',
      icon: Volume2
    },
    {
      id: 'q-waiting',
      label: t('queueStatusWaiting'),
      value: waitingList.length,
      subLabel: t('queueCallMyRoomBtn'),
      tone: 'amber',
      icon: Clock
    },
    {
      id: 'q-completed',
      label: t('queueStatusCompleted'),
      value: completedList.length,
      subLabel: t('queueTvModeBtn'),
      tone: 'cyan',
      icon: CheckCircle2,
      onClick: () => setIsTvDisplayOpen(true)
    }
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-24 space-y-5 max-w-7xl mx-auto">
      {/* Row 1: 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Line + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('queueNav')}
        trendSeriesPrimaryData={[0, 0, 0, 0, waitingList.length, calledList.length, queueItems.length]}
        trendSeriesSecondaryLabel={t('queueStatusCompleted')}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, 0, completedList.length]}
        ratioSlices={[
          {
            label: t('queueStatusCalled'),
            count: calledList.length,
            dotClass: 'bg-pink-400',
            colorHex: '#ec4899'
          },
          {
            label: t('queueStatusWaiting'),
            count: waitingList.length,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          },
          {
            label: t('queueStatusCompleted'),
            count: completedList.length,
            dotClass: 'bg-teal-400',
            colorHex: '#2dd4bf'
          },
          {
            label: t('queueStatusClaimedOther'),
            count: resolvedList.length - completedList.length,
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          }
        ]}
        activities={queueItems.slice(0, 5).map((q) => ({
          id: q.id,
          title: `${q.queueNumber} · ${q.patientName}`,
          meta: `${q.procedure} · ${q.roomName || t('queueStatusWaiting')}`,
          dotClass:
            q.status === 'called'
              ? 'bg-pink-400'
              : q.status === 'completed'
              ? 'bg-emerald-400'
              : 'bg-amber-400'
        }))}
      />

      {/* Room Station & TV Display Bar */}
      <div className="crystal-tile rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
            <DoorOpen className="w-4 h-4 text-violet-300 shrink-0" />
            <span>{t('queueMyRoomLabel')}</span>
          </div>
          <select
            value={myRoom}
            onChange={(e) => setMyRoom(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs font-semibold text-violet-100"
          >
            {availableRooms.map((rm) => (
              <option key={rm} value={rm}>
                {rm}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setVoiceEnabled((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-colors ${
              voiceEnabled
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : 'crystal-tile text-slate-300 border-white/15'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{voiceEnabled ? t('queueVoiceLabel') : t('queueVoiceMuted')}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenChairsideCopilot && (
            <button
              type="button"
              onClick={onOpenChairsideCopilot}
              className="crystal-btn flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 text-white text-xs font-semibold cursor-pointer"
            >
              <Languages className="w-4 h-4" />
              <span>{t('chairsideCopilotShortBtn')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleCopyTvLink()}
            className="crystal-tile flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-100 text-xs font-medium cursor-pointer"
          >
            {copiedTvLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-violet-300" />
            )}
            <span>{copiedTvLink ? t('queueTvCopiedMsg') : t('queueTvCopyLinkBtn')}</span>
          </button>
          <span className="text-[11px] text-slate-300 font-mono">รหัสจอ: {getTvCode()}</span>

          <button
            type="button"
            onClick={() => setIsTvDisplayOpen(true)}
            className="crystal-btn flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            <MonitorPlay className="w-4 h-4" />
            <span>{t('queueTvModeBtn')}</span>
          </button>

          {queueItems.length > 0 && (
            !confirmClearQueue ? (
              <button
                type="button"
                onClick={() => setConfirmClearQueue(true)}
                className="crystal-tile flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-400/35 text-rose-200 hover:bg-rose-500/20 text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('clearAllBtn')}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void clearWorkspaceSlice('queueItems');
                    setConfirmClearQueue(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                >
                  {t('confirmClearAllBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearQueue(false)}
                  className="crystal-tile px-2.5 py-2 rounded-xl text-slate-200 text-xs cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {lastSpoken && (
        <div className="px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-400/35 text-xs text-violet-100 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-violet-300 shrink-0" />
          <span className="truncate">{lastSpoken}</span>
        </div>
      )}

      {/* Quick Add Queue + Batch Paste */}
      <div className="neon-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-300" />
            <span>{t('queueAddTitle')}</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowBatch((prev) => !prev)}
            className="crystal-tile flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-violet-200 cursor-pointer"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>{t('queueBatchToggleBtn')}</span>
          </button>
        </div>

        <form onSubmit={handleAddSingleQueue} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          <input
            type="text"
            value={queueNoInput}
            onChange={(e) => setQueueNoInput(e.target.value)}
            placeholder={t('queueNumberPlaceholder')}
            className="glass-input sm:col-span-2 rounded-xl px-3 py-2.5 font-mono uppercase"
          />
          <input
            type="text"
            required
            value={patientInput}
            onChange={(e) => setPatientInput(e.target.value)}
            placeholder={t('queuePatientPlaceholder')}
            className="glass-input sm:col-span-4 rounded-xl px-3 py-2.5"
          />
          <input
            type="text"
            value={procedureInput}
            onChange={(e) => setProcedureInput(e.target.value)}
            placeholder={t('queueProcedurePlaceholder')}
            className="glass-input sm:col-span-4 rounded-xl px-3 py-2.5"
          />
          <button
            type="submit"
            className="crystal-btn sm:col-span-2 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('queueAddBtn')}</span>
          </button>
        </form>

        {showBatch && (
          <div className="pt-3 border-t border-white/15 space-y-2.5 text-xs">
            <textarea
              rows={3}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={t('queueBatchPlaceholder')}
              className="glass-input w-full rounded-xl p-3"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBatchImport}
                className="crystal-btn px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer"
              >
                {t('queueBatchImportBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Currently Called into Rooms */}
      {calledList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            <span>
              {t('queueStatusCalled')} ({formatNumberByLanguage(calledList.length, language)})
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calledList.map((item) => (
              <div
                key={item.id}
                className="neon-glass border-violet-300/45 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-mono font-bold text-lg shrink-0">
                    {item.queueNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.patientName}</p>
                    <p className="text-xs text-slate-200 truncate">{item.procedure}</p>
                    <p className="text-[11px] font-semibold text-amber-300 mt-0.5 truncate">
                      {item.roomName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <AttachmentCell
                    variant="card"
                    evidenceId={item.attachmentEvidenceId}
                    itemTitle={`${item.queueNumber} · ${item.patientName}`}
                    contextLabel={t('queueNav')}
                    onAttached={(evId) => handleAttachPhoto(item.id, evId)}
                    onRemoved={() => handleRemovePhoto(item.id)}
                  />
                  <button
                    type="button"
                    onClick={() => updateQueueStatus(item, 'called', true)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-300/40 text-violet-100 text-xs font-semibold cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{t('queueRecallBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQueueStatus(item, 'completed')}
                    className="crystal-btn flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('queueCompleteBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingQueue({ ...item })}
                    className="crystal-tile p-2 rounded-xl text-cyan-200 hover:text-white cursor-pointer"
                    title={t('editBtn')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueue(item.id)}
                    className={`p-2 rounded-xl border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                      confirmDeleteQueueId === item.id
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                    }`}
                    title={t('deleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteQueueId === item.id && <span>{t('confirmDeleteBtn')}</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Queue List with Photo Attach, Edit, Delete */}
      <div className="neon-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            {t('queueStatusWaiting')} ({formatNumberByLanguage(waitingList.length, language)})
          </h3>
        </div>

        {waitingList.length === 0 ? (
          <p className="text-xs text-slate-300 py-8 text-center">{t('queueEmptyMsg')}</p>
        ) : (
          <div className="space-y-3">
            {waitingList.map((item) => (
              <div
                key={item.id}
                className="glass-subcard p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <AttachmentCell
                    evidenceId={item.attachmentEvidenceId}
                    itemTitle={`${item.queueNumber} · ${item.patientName}`}
                    contextLabel={t('queueNav')}
                    onAttached={(evId) => handleAttachPhoto(item.id, evId)}
                    onRemoved={() => handleRemovePhoto(item.id)}
                  />
                  <span className="crystal-tile px-3 py-1.5 rounded-xl text-violet-200 font-mono font-bold text-sm shrink-0">
                    {item.queueNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">{item.patientName}</p>
                    <p className="text-xs text-slate-300 truncate">{item.procedure}</p>
                    {item.notes && (
                      <p className="text-[11px] text-amber-200 mt-0.5 truncate">{item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQueueStatus(item, 'called', true)}
                    className="crystal-btn flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>{t('queueCallMyRoomBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQueueStatus(item, 'claimed_other')}
                    className="crystal-tile flex items-center gap-1.5 px-3 py-2 rounded-xl text-amber-200 text-xs font-medium cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>{t('queueClaimedOtherBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingQueue({ ...item })}
                    className="crystal-tile p-2 rounded-xl text-cyan-200 hover:text-white cursor-pointer"
                    title={t('editBtn')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueue(item.id)}
                    className={`p-2 rounded-xl border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                      confirmDeleteQueueId === item.id
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                    }`}
                    aria-label={t('deleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteQueueId === item.id && <span>{t('confirmDeleteBtn')}</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claimed / Completed List */}
      {resolvedList.length > 0 && (
        <div className="crystal-tile rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-200">
            {t('queueStatusClaimedOther')} / {t('queueStatusCompleted')} (
            {formatNumberByLanguage(resolvedList.length, language)})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {resolvedList.map((item) => (
              <div
                key={item.id}
                className="glass-subcard px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono font-bold text-slate-300 shrink-0">
                    {item.queueNumber}
                  </span>
                  <span className="font-medium text-slate-100 truncate">{item.patientName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                      item.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {item.status === 'completed'
                      ? t('queueStatusCompleted')
                      : t('queueStatusClaimedOther')}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQueueStatus(item, 'waiting')}
                    className="crystal-tile flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-slate-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('queueRestoreBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingQueue({ ...item })}
                    className="p-1 text-cyan-300 hover:text-white cursor-pointer"
                    title={t('editBtn')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveQueue(item.id)}
                    className={`p-1 rounded-md text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                      confirmDeleteQueueId === item.id
                        ? 'bg-rose-600 text-white px-2'
                        : 'text-rose-300 hover:text-rose-200'
                    }`}
                    aria-label={t('deleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteQueueId === item.id && <span>{t('confirmDeleteBtn')}</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={onOpenNewTaskModal ? t('newTask') : undefined}
        onPrimaryAction={onOpenNewTaskModal}
      />

      {/* Edit Queue Modal */}
      {editingQueue &&
        createPortal(
          <div
            onClick={() => setEditingQueue(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditQueue}
              className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingQueue.queueNumber}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingQueue(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">Queue #</label>
                    <input
                      type="text"
                      required
                      value={editingQueue.queueNumber}
                      onChange={(e) =>
                        setEditingQueue({ ...editingQueue, queueNumber: e.target.value })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2 font-mono uppercase"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-slate-300 font-medium block">
                      {t('queuePatientPlaceholder')}
                    </label>
                    <input
                      type="text"
                      required
                      value={editingQueue.patientName}
                      onChange={(e) =>
                        setEditingQueue({ ...editingQueue, patientName: e.target.value })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">
                    {t('queueProcedurePlaceholder')}
                  </label>
                  <input
                    type="text"
                    value={editingQueue.procedure}
                    onChange={(e) =>
                      setEditingQueue({ ...editingQueue, procedure: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('queueMyRoomLabel')}</label>
                  <select
                    value={editingQueue.roomName || myRoom}
                    onChange={(e) =>
                      setEditingQueue({ ...editingQueue, roomName: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  >
                    {availableRooms.map((rm) => (
                      <option key={rm} value={rm}>
                        {rm}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('notes')}</label>
                  <input
                    type="text"
                    value={editingQueue.notes || ''}
                    onChange={(e) => setEditingQueue({ ...editingQueue, notes: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingQueue(null)}
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
    </div>
  );
};
