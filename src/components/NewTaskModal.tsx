import React, { useState } from 'react';
import {
  CheckSquare,
  X,
  Plus,
  Trash2,
  Paperclip,
  ListTodo,
  PhoneForwarded,
  ShieldCheck
} from 'lucide-react';
import { EvidenceItem, TaskItem, TaskCategory, TaskKind, TaskPriority } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { translateCategory, translateTaskPriority, locales } from '../utils/i18n';
import { formatFileSize } from '../services/aiService';
import { saveEvidenceFile } from '../services/evidenceStorage';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: TaskItem) => void;
  initialTemplateId?: string;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  initialTemplateId
}) => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    hasPermission,
    templates,
    workflows,
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
    setEvidenceList
  } = useWorkspace();

  const [taskKind, setTaskKind] = useState<TaskKind>('todo');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachedNote, setAttachedNote] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Lab Coordination');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [newCustomCatInput, setNewCustomCatInput] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [reminderAt, setReminderAt] = useState('');
  const [patientRefId, setPatientRefId] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const isClinic = activeWorkspace.type === 'clinic';
  const canAssignTeam = isClinic && hasPermission('assign_tasks');

  const applyTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find((item) => item.id === tmplId);
    if (!tmpl) return;
    setTitle(tmpl.name);
    setDescription(tmpl.description);
    setCategory(tmpl.category);
    setCustomCategory(tmpl.customCategory || '');
    setPriority(tmpl.priority);
    setSubtasks([...tmpl.defaultSubtasks]);
    if (tmpl.workflowId) setSelectedWorkflowId(tmpl.workflowId);
    if (typeof tmpl.reminderOffsetDays === 'number') {
      const targetDate = new Date(Date.now() + tmpl.reminderOffsetDays * 86_400_000)
        .toISOString()
        .split('T')[0];
      setDueDate(targetDate);
      setReminderAt(`${targetDate} 08:30`);
    }
  };

  const handleAddSubtask = () => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    setSubtasks((prev) => [...prev, clean]);
    setSubtaskInput('');
  };

  const handleAddCustomCategory = () => {
    const clean = newCustomCatInput.trim();
    if (!clean) return;
    addCustomCategory(clean);
    setCustomCategory(clean);
    setNewCustomCatInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setAttachedPreviewUrl(url);
    } else {
      setAttachedPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const workflow = workflows.find((w) => w.id === selectedWorkflowId);
    const assignee = activeWorkspace.members.find((m) => m.id === assigneeId);
    const taskId = `task-${Date.now()}`;
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const evidenceIds: string[] = [];
    const relatedDocuments: string[] = [];

    if (attachedFile) {
      const evId = `ev-${Date.now()}`;
      const isImg = attachedFile.type.startsWith('image/');
      const isPdf = attachedFile.type === 'application/pdf';
      try {
        await saveEvidenceFile(
          evId,
          attachedFile,
          attachedFile.name,
          attachedFile.type || 'application/octet-stream',
          nowStamp
        );
      } catch {
        // Fallback if IndexedDB unavailable
      }

      const evItem: EvidenceItem = {
        id: evId,
        originalFilename: attachedFile.name,
        fileType: isImg ? 'image' : isPdf ? 'pdf' : 'document',
        uploadDateTime: nowStamp,
        receivedTimestamp: nowStamp,
        relatedTaskId: taskId,
        relatedPatientId: patientRefId.trim() ? patientRefId.trim().toUpperCase() : undefined,
        description: `${title.trim()}${attachedNote.trim() ? ` — ${attachedNote.trim()}` : ''}`,
        fileSize: formatFileSize(attachedFile.size),
        mimeType: attachedFile.type || 'application/octet-stream',
        hasStoredFile: true
      };
      setEvidenceList((prev) => [evItem, ...prev]);
      evidenceIds.push(evId);
      relatedDocuments.push(attachedFile.name);
    }

    const newTask: TaskItem = {
      id: taskId,
      workspaceId: activeWorkspace.id,
      taskKind,
      title: title.trim(),
      description: description.trim(),
      attachedNote: attachedNote.trim() || undefined,
      category,
      customCategory: customCategory || undefined,
      priority,
      status: 'New',
      createdDate: new Date().toISOString().split('T')[0],
      dueDate,
      reminderAt: reminderAt.trim() || undefined,
      assigneeId: canAssignTeam && assignee ? assignee.id : undefined,
      assigneeName: canAssignTeam && assignee ? assignee.name : undefined,
      roomName: isClinic && roomName ? roomName : undefined,
      templateId: selectedTemplateId || undefined,
      workflowId: workflow?.id,
      workflowStages: workflow ? [...workflow.stages] : undefined,
      currentStageIndex: workflow ? 0 : undefined,
      subtasks:
        subtasks.length > 0
          ? subtasks.map((st, idx) => ({
              id: `sub-${Date.now()}-${idx}`,
              title: st,
              completed: false
            }))
          : undefined,
      relatedPatientId: patientRefId.trim() ? patientRefId.trim().toUpperCase() : undefined,
      relatedDocuments,
      evidenceIds,
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          timestamp: nowStamp,
          action: t('taskCreatedManually'),
          user: isClinic && assignee ? assignee.name : t('assistantSelf'),
          localized: {
            th: {
              action: locales.th.taskCreatedManually,
              user: isClinic && assignee ? assignee.name : locales.th.assistantSelf
            },
            en: {
              action: locales.en.taskCreatedManually,
              user: isClinic && assignee ? assignee.name : locales.en.assistantSelf
            }
          }
        }
      ]
    };

    onAddTask(newTask);
    onClose();
    setTaskKind('todo');
    setSelectedTemplateId('');
    setTitle('');
    setDescription('');
    setAttachedNote('');
    setCustomCategory('');
    setReminderAt('');
    setPatientRefId('');
    setSelectedWorkflowId('');
    setAssigneeId('');
    setRoomName('');
    setSubtasks([]);
    setAttachedFile(null);
    if (attachedPreviewUrl) {
      URL.revokeObjectURL(attachedPreviewUrl);
      setAttachedPreviewUrl(null);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[95] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
        className="glass-modal border border-violet-300/30 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto my-auto"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-violet-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
            >
              <span aria-hidden="true">↩️</span>
              <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
            </button>
            <CheckSquare className="w-4 h-4 text-violet-300 shrink-0" />
            <h3 className="text-sm font-bold text-slate-100 text-depth break-words">{t('createTaskTitle')}</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono crystal-tile text-violet-200 border border-white/20">
              {activeWorkspace.type === 'personal' ? t('personalSpaceLabel') : t('clinicSpaceLabel')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1.5 rounded-lg crystal-tile hover:bg-white/15 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* 3-Mode Quick Task Category Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold block">{t('taskKindLabel')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'todo' as TaskKind,
                    label: t('taskKindTodo'),
                    icon: ListTodo,
                    activeCls: 'bg-violet-600/25 border-violet-400/60 text-violet-100'
                  },
                  {
                    id: 'followup' as TaskKind,
                    label: t('taskKindFollowup'),
                    icon: PhoneForwarded,
                    activeCls: 'bg-amber-500/20 border-amber-400/60 text-amber-100'
                  },
                  {
                    id: 'check' as TaskKind,
                    label: t('taskKindCheck'),
                    icon: ShieldCheck,
                    activeCls: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100'
                  }
                ] as const
              ).map((kind) => {
                const Icon = kind.icon;
                const active = taskKind === kind.id;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => {
                      setTaskKind(kind.id);
                      if (kind.id === 'followup') setCategory('Patient Follow-up');
                      if (kind.id === 'check') setCategory('Sterilization & Prep');
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                      active
                        ? kind.activeCls
                        : 'glass-subcard text-slate-300 hover:text-white hover:border-white/30'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{kind.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('templateLabel')}</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-violet-100"
              >
                <option value="">{t('useTemplatePlaceholder')}</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('taskTitleLabel')}</label>
            <input
              type="text"
              required
              placeholder={t('taskTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="Lab Coordination">{translateCategory('Lab Coordination', language)}</option>
                <option value="Patient Follow-up">{translateCategory('Patient Follow-up', language)}</option>
                <option value="Sterilization & Prep">{translateCategory('Sterilization & Prep', language)}</option>
                <option value="Dentist Instruction">{translateCategory('Dentist Instruction', language)}</option>
                <option value="Inventory & Supplies">{translateCategory('Inventory & Supplies', language)}</option>
                <option value="Record Keeping">{translateCategory('Record Keeping', language)}</option>
                <option value="Other">{translateCategory('Other', language)}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('priorityLabel')}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="Low">{translateTaskPriority('Low', language)}</option>
                <option value="Medium">{translateTaskPriority('Medium', language)}</option>
                <option value="High">{translateTaskPriority('High', language)}</option>
                <option value="Urgent">{translateTaskPriority('Urgent', language)}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('dueDateLabel')}</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                {t('reminderLabel')} ({t('optionalLabel')})
              </label>
              <input
                type="text"
                placeholder="2026-11-22 08:30"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                {t('patientRef')} ({t('optionalLabel')})
              </label>
              <input
                type="text"
                placeholder={t('patientRefPlaceholder')}
                value={patientRefId}
                onChange={(e) => setPatientRefId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>
          </div>

          {/* Attached Field Note & Evidence Photo Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl glass-subcard">
            <div className="space-y-1.5">
              <label className="text-slate-200 font-medium">{t('attachedNoteLabel')}</label>
              <input
                type="text"
                value={attachedNote}
                onChange={(e) => setAttachedNote(e.target.value)}
                placeholder={t('attachedNotePlaceholder')}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-200 font-medium block">
                {t('attachPhotoEvidenceLabel')}
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl crystal-tile hover:bg-white/15 border border-dashed border-violet-300/50 text-violet-100 font-medium cursor-pointer">
                <Paperclip className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                <span className="truncate">
                  {attachedFile ? `${t('attachedFileReady')} ${attachedFile.name}` : t('attachPhotoBtn')}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,.xlsx,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {attachedPreviewUrl && (
                <img
                  src={attachedPreviewUrl}
                  alt={attachedFile?.name || 'preview'}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-lg object-cover border border-white/25 mt-1"
                />
              )}
            </div>
          </div>

          {/* Custom Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                {t('customCategoryLabel')} ({t('optionalLabel')})
              </label>
              <div className="flex gap-2">
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="">--</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {customCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteCustomCategory(customCategory);
                      setCustomCategory('');
                    }}
                    className="px-2.5 py-2 rounded-xl crystal-tile text-rose-300 hover:bg-rose-500/20 border border-rose-400/35 cursor-pointer"
                    title={t('deleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('addCustomCategoryBtn')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCustomCatInput}
                  onChange={(e) => setNewCustomCatInput(e.target.value)}
                  placeholder={t('customCategoryPlaceholder')}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="px-3 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-100 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Workflow & Clinic Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                {t('workflowLabel')} ({t('optionalLabel')})
              </label>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="">--</option>
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>
            </div>

            {canAssignTeam && (
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">{t('assigneeLabel')}</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="">{t('unassignedLabel')}</option>
                  {activeWorkspace.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isClinic && (
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">{t('roomLabel')}</label>
                <select
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="">{t('noRoomLabel')}</option>
                  {activeWorkspace.rooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('taskDescription')}</label>
            <textarea
              rows={2}
              placeholder={t('taskDescPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full glass-input rounded-xl p-3 text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Subtasks Builder */}
          <div className="space-y-2 p-3.5 rounded-xl glass-subcard">
            <label className="text-slate-200 font-medium block">{t('subtasksLabel')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder={t('addSubtaskPlaceholder')}
                className="flex-1 glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3.5 py-2 rounded-xl crystal-tile hover:bg-white/15 text-violet-200 font-medium cursor-pointer"
              >
                {t('addSubtaskBtn')}
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg glass-subcard text-slate-100"
                  >
                    <span>
                      {idx + 1}. {st}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
          >
            {t('cancelBtn')}
          </button>
          <button
            type="submit"
            className="crystal-btn bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-lg shadow-violet-600/30 cursor-pointer"
          >
            {t('createTaskBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};
