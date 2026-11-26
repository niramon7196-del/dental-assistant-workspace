import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Clock,
  FileText,
  ChevronRight,
  CheckSquare,
  Square,
  Bell,
  GitBranch,
  BookmarkPlus,
  Lock,
  Building2,
  Trash2,
  ArrowRightLeft,
  Target,
  Sparkles,
  StickyNote,
  CheckCircle2,
  QrCode,
  Pencil,
  X,
  AlertTriangle,
  ClipboardPaste,
  Languages,
  LayoutGrid
} from 'lucide-react';
import { ActiveTab, TaskCategory, TaskItem, TaskKind, TaskPriority, TaskStatus } from '../types/dental';
import { CustomWorkflow, PrivateNote, TaskTemplate } from '../types/platform';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  formatDateByLanguage,
  formatNumberByLanguage,
  locales,
  translateCategory,
  translateTaskPriority,
  translateTaskStatus
} from '../utils/i18n';
import {
  resolveLocalizedTask,
  resolveLocalizedTaskActivity
} from '../data/initialData';
import { PostOpSurveyModal } from './PostOpSurveyModal';
import { AttachmentCell } from './AttachmentCell';
import {
  StandardAnalyticsAndActivity,
  StandardKpiGrid,
  StandardKpiItem,
  StandardQuickActionBar
} from './ModuleDashboardSections';
import mascotTasks from '../assets/images/mascot_tasks_1795242057251.jpg';

const TASKS_MASCOT_URL = 'https://i.postimg.cc/NjktjjyL/915124600-1800868747806524-2398384840772570514-n.webp';

interface TaskListProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  onOpenNewTaskModal: () => void;
  onOpenChairsideCopilot?: () => void;
  onOpenCustomBuilder?: () => void;
  searchQuery: string;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  setTasks,
  onOpenNewTaskModal,
  onOpenChairsideCopilot,
  onOpenCustomBuilder,
  searchQuery,
  setActiveTab
}) => {
  const { t, language } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    hasPermission,
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    clearTemplates,
    workflows,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    clearWorkflows,
    privateNotes,
    addPrivateNote,
    updatePrivateNote,
    deletePrivateNote,
    clearPrivateNotes,
    dailyGoals,
    addDailyGoal,
    updateDailyGoal,
    toggleDailyGoal,
    deleteDailyGoal,
    clearDailyGoals,
    transferTaskToWorkspace,
    transferNoteToWorkspace,
    clearWorkspaceSlice,
    recordAudit
  } = useWorkspace();

  const [subTab, setSubTab] = useState<'list' | 'templates' | 'workflows' | 'reminders'>('list');
  const [taskKindFilter, setTaskKindFilter] = useState<'All' | TaskKind>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearTasks, setConfirmClearTasks] = useState(false);
  const [mascotSrc, setMascotSrc] = useState<string>(TASKS_MASCOT_URL);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [templateSavedId, setTemplateSavedId] = useState<string | null>(null);
  const [transferToast, setTransferToast] = useState<string | null>(null);
  const [isPostOpModalOpen, setIsPostOpModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const parsedPasteTasks = useMemo(() => {
    const lines = pasteRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const todayDate = new Date().toISOString().split('T')[0];
    const normalizeCategory = (raw: string): TaskCategory => {
      const s = raw.toLowerCase();
      if (s.includes('stock') || s.includes('สต๊อก') || s.includes('วัสดุ') || s.includes('inventory'))
        return 'Inventory & Supplies';
      if (s.includes('lab') || s.includes('แล็บ')) return 'Lab Coordination';
      if (s.includes('follow') || s.includes('ติดตาม')) return 'Patient Follow-up';
      if (s.includes('steril') || s.includes('ปลอดเชื้อ')) return 'Sterilization & Prep';
      if (s.includes('dentist') || s.includes('หมอ') || s.includes('สั่ง')) return 'Dentist Instruction';
      if (s.includes('record') || s.includes('เอกสาร')) return 'Record Keeping';
      return 'Other';
    };
    const normalizePriority = (raw: string): TaskPriority => {
      const s = raw.toLowerCase();
      if (s.includes('urgent') || s.includes('ด่วนมาก')) return 'Urgent';
      if (s.includes('high') || s.includes('สูง') || s.includes('ด่วน')) return 'High';
      if (s.includes('low') || s.includes('ต่ำ')) return 'Low';
      return 'Medium';
    };
    const normalizeKind = (raw: string, cat: TaskCategory): TaskKind => {
      const s = raw.toLowerCase();
      if (s.includes('check') || s.includes('สต๊อก') || s.includes('ตรวจ') || cat === 'Inventory & Supplies')
        return 'check';
      if (s.includes('follow') || s.includes('ติดตาม') || cat === 'Patient Follow-up')
        return 'followup';
      return 'todo';
    };

    const items: TaskItem[] = [];
    const now = Date.now();
    lines.forEach((line, idx) => {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
      if (
        idx === 0 &&
        cols.some((c) => /^(ชื่องาน|title|รายการ|task|หมวด|category)/i.test(c))
      ) {
        return;
      }
      const title = cols[0];
      if (!title) return;
      const cat = normalizeCategory(cols[1] || '');
      const priority = normalizePriority(cols[2] || '');
      const dueDate = cols[3] && /^\d{4}-\d{2}-\d{2}$/.test(cols[3]) ? cols[3] : todayDate;
      const notes = cols[4] || '';
      const kind = normalizeKind(cols[5] || '', cat);
      const nowStamp = new Date(now + idx).toISOString().replace('T', ' ').slice(0, 16);

      items.push({
        id: `task-imp-${now}-${idx}`,
        workspaceId: activeWorkspace.id,
        taskKind: kind,
        title,
        description: notes || title,
        attachedNote: notes || undefined,
        category: cat,
        priority,
        status: 'New',
        createdDate: todayDate,
        dueDate,
        relatedDocuments: [],
        evidenceIds: [],
        activityHistory: [
          {
            id: `act-imp-${now}-${idx}`,
            timestamp: nowStamp,
            action: 'นำเข้างานจริงจากชีต/ตาราง',
            user: t('assistantSelf')
          }
        ]
      });
    });
    return items;
  }, [pasteRawText, activeWorkspace.id, t]);

  const handleConfirmPasteTasks = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPasteTasks.length === 0) {
      setPasteError(
        language === 'en'
          ? 'Please paste at least 1 valid row from Google Sheets or Excel.'
          : 'กรุณาวางข้อมูลอย่างน้อย 1 แถวจากชีต หรือ Excel'
      );
      return;
    }
    setTasks((prev) => [...parsedPasteTasks, ...prev]);
    recordAudit('task_create', `Imported ${parsedPasteTasks.length} tasks from pasted sheet`);
    setPasteRawText('');
    setPasteError(null);
    setIsPasteModalOpen(false);
  };

  // Templates CRUD states
  const [isCreateTmplOpen, setIsCreateTmplOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplDesc, setNewTmplDesc] = useState('');
  const [newTmplCategory, setNewTmplCategory] = useState<TaskCategory>('Lab Coordination');
  const [newTmplPriority, setNewTmplPriority] = useState<TaskPriority>('Medium');
  const [newTmplSubtasksInput, setNewTmplSubtasksInput] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [editingTmplSubtasksInput, setEditingTmplSubtasksInput] = useState('');
  const [confirmDeleteTmplId, setConfirmDeleteTmplId] = useState<string | null>(null);
  const [confirmClearTemplates, setConfirmClearTemplates] = useState(false);

  // Workflow creator & CRUD states
  const [wfName, setWfName] = useState('');
  const [wfStagesInput, setWfStagesInput] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState<CustomWorkflow | null>(null);
  const [editingWfStagesInput, setEditingWfStagesInput] = useState('');
  const [confirmDeleteWfId, setConfirmDeleteWfId] = useState<string | null>(null);
  const [confirmClearWorkflows, setConfirmClearWorkflows] = useState(false);

  // Private note & formula + Daily goal CRUD states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteReminder, setNoteReminder] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'formula'>('note');
  const [editingNote, setEditingNote] = useState<PrivateNote | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmClearNotes, setConfirmClearNotes] = useState(false);

  const [goalInput, setGoalInput] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState('');
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null);
  const [confirmClearGoals, setConfirmClearGoals] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isClinic = activeWorkspace.type === 'clinic';
  const isPersonal = !isClinic;
  const canAssignTeam = isClinic && hasPermission('assign_tasks');
  const targetTransferWorkspace = workspaces.find((ws) =>
    isPersonal ? ws.type === 'clinic' : ws.type === 'personal'
  );
  const clinicTargetWorkspace = workspaces.find((ws) => ws.type === 'clinic');
  const cardSurface = isPersonal ? 'neon-glass-personal' : 'neon-glass';

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks(
      tasks.map((item) => {
        if (item.id === taskId) {
          const actionTh = locales.th.taskStatusChangedTo.replace(
            '{status}',
            translateTaskStatus(newStatus, 'th')
          );
          const actionEn = locales.en.taskStatusChangedTo.replace(
            '{status}',
            translateTaskStatus(newStatus, 'en')
          );
          const updatedHistory = [
            ...item.activityHistory,
            {
              id: `act-${Date.now()}`,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
              action: language === 'th' ? actionTh : actionEn,
              user: t('assistantSelf'),
              localized: {
                th: { action: actionTh, user: locales.th.assistantSelf },
                en: { action: actionEn, user: locales.en.assistantSelf }
              }
            }
          ];
          return { ...item, status: newStatus, activityHistory: updatedHistory };
        }
        return item;
      })
    );
    recordAudit('task_update', `Updated task ${taskId} status to ${newStatus}`);
  };

  const handleAttachTaskPhoto = (taskId: string, evidenceId: string, filename: string) => {
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              attachmentEvidenceId: evidenceId,
              evidenceIds: [evidenceId, ...item.evidenceIds.filter((id) => id !== evidenceId)],
              relatedDocuments: [
                filename,
                ...item.relatedDocuments.filter((doc) => doc !== filename)
              ]
            }
          : item
      )
    );
  };

  const handleRemoveTaskPhoto = (taskId: string, removedEvId?: string) => {
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              attachmentEvidenceId: undefined,
              evidenceIds: removedEvId
                ? item.evidenceIds.filter((id) => id !== removedEvId)
                : []
            }
          : item
      )
    );
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirmDeleteId !== taskId) {
      setConfirmDeleteId(taskId);
      return;
    }
    setConfirmDeleteId(null);
    setTasks((prev) => prev.filter((item) => item.id !== taskId));
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    recordAudit('task_update', `Deleted task ${taskId}`);
  };

  const handleSaveEditTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setTasks((prev) =>
      prev.map((item) =>
        item.id === editingTask.id ? { ...editingTask, localized: undefined } : item
      )
    );
    recordAudit('task_update', `Updated task ${editingTask.title}`);
    setEditingTask(null);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(
      tasks.map((item) => {
        if (item.id !== taskId || !item.subtasks) return item;
        return {
          ...item,
          subtasks: item.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          )
        };
      })
    );
  };

  const handleAddSubtaskInDetail = (taskId: string) => {
    const clean = newSubtaskInput.trim();
    if (!clean) return;
    setTasks(
      tasks.map((item) => {
        if (item.id !== taskId) return item;
        return {
          ...item,
          subtasks: [
            ...(item.subtasks || []),
            { id: `sub-${Date.now()}`, title: clean, completed: false }
          ]
        };
      })
    );
    setNewSubtaskInput('');
  };

  const handleAdvanceWorkflowStage = (taskId: string) => {
    setTasks(
      tasks.map((item) => {
        if (item.id !== taskId || !item.workflowStages || item.workflowStages.length === 0) {
          return item;
        }
        const curr = item.currentStageIndex ?? 0;
        const next = Math.min(curr + 1, item.workflowStages.length - 1);
        return { ...item, currentStageIndex: next };
      })
    );
  };

  const handleAssigneeChange = (taskId: string, memberId: string) => {
    if (!canAssignTeam) return;
    const member = activeWorkspace.members.find((m) => m.id === memberId);
    setTasks(
      tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              assigneeId: member ? member.id : undefined,
              assigneeName: member ? member.name : undefined
            }
          : item
      )
    );
  };

  const handleSaveTaskAsTemplate = (task: TaskItem) => {
    addTemplate({
      name: task.title,
      description: task.description,
      category: task.category,
      customCategory: task.customCategory,
      priority: task.priority,
      defaultSubtasks: (task.subtasks || []).map((s) => s.title),
      workflowId: task.workflowId
    });
    setTemplateSavedId(task.id);
    setTimeout(() => setTemplateSavedId(null), 2500);
  };

  const handleUseTemplateDirect = (tmplId: string) => {
    const tmpl = templates.find((tp) => tp.id === tmplId);
    if (!tmpl) return;
    const workflow = workflows.find((w) => w.id === tmpl.workflowId);
    const due = new Date(Date.now() + (tmpl.reminderOffsetDays ?? 1) * 86_400_000)
      .toISOString()
      .split('T')[0];

    const created: TaskItem = {
      id: `task-tmpl-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      title: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      customCategory: tmpl.customCategory,
      priority: tmpl.priority,
      status: 'New',
      createdDate: today,
      dueDate: due,
      reminderAt: `${due} 08:30`,
      templateId: tmpl.id,
      workflowId: workflow?.id,
      workflowStages: workflow ? [...workflow.stages] : undefined,
      currentStageIndex: workflow ? 0 : undefined,
      subtasks: tmpl.defaultSubtasks.map((st, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: st,
        completed: false
      })),
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: t('taskCreatedManually'),
          user: t('assistantSelf'),
          localized: {
            th: { action: locales.th.taskCreatedManually, user: locales.th.assistantSelf },
            en: { action: locales.en.taskCreatedManually, user: locales.en.assistantSelf }
          }
        }
      ]
    };

    setTasks([created, ...tasks]);
    setSubTab('list');
  };

  const handleCreateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    const stages = wfStagesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!wfName.trim() || stages.length < 2) return;
    addWorkflow({ name: wfName.trim(), stages });
    setWfName('');
    setWfStagesInput('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addPrivateNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      noteType,
      reminderAt: noteReminder.trim() || undefined
    });
    setNoteTitle('');
    setNoteContent('');
    setNoteReminder('');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    addDailyGoal(goalInput.trim());
    setGoalInput('');
  };

  const handleCreateTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTmplName.trim()) return;
    const defaultSubtasks = newTmplSubtasksInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    addTemplate({
      name: newTmplName.trim(),
      description: newTmplDesc.trim(),
      category: newTmplCategory,
      priority: newTmplPriority,
      defaultSubtasks
    });
    setNewTmplName('');
    setNewTmplDesc('');
    setNewTmplSubtasksInput('');
    setIsCreateTmplOpen(false);
  };

  const handleSaveEditTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    const defaultSubtasks = editingTmplSubtasksInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateTemplate(editingTemplate.id, {
      name: editingTemplate.name.trim(),
      description: editingTemplate.description.trim(),
      category: editingTemplate.category,
      priority: editingTemplate.priority,
      defaultSubtasks
    });
    setEditingTemplate(null);
  };

  const handleSaveEditWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkflow || !editingWorkflow.name.trim()) return;
    const stages = editingWfStagesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (stages.length < 2) return;
    updateWorkflow(editingWorkflow.id, { name: editingWorkflow.name.trim(), stages });
    setEditingWorkflow(null);
  };

  const handleSaveEditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editingNote.title.trim() || !editingNote.content.trim()) return;
    updatePrivateNote(editingNote.id, {
      title: editingNote.title.trim(),
      content: editingNote.content.trim(),
      noteType: editingNote.noteType,
      reminderAt: editingNote.reminderAt?.trim() || undefined
    });
    setEditingNote(null);
  };

  const showTransferNotice = (targetName: string) => {
    setTransferToast(t('transferredSuccessToast').replace('{target}', targetName));
    setTimeout(() => setTransferToast(null), 2800);
  };

  const handleTransferTask = (taskId: string) => {
    if (!targetTransferWorkspace) return;
    if (transferTaskToWorkspace(taskId, targetTransferWorkspace.id)) {
      showTransferNotice(targetTransferWorkspace.name);
    }
  };

  const handleTransferNoteToAssistant = (noteId: string) => {
    if (!clinicTargetWorkspace) return;
    if (transferNoteToWorkspace(noteId, clinicTargetWorkspace.id)) {
      showTransferNotice(clinicTargetWorkspace.name);
    }
  };

  const getTaskKindMeta = (kind?: TaskKind) => {
    if (kind === 'followup') {
      return {
        label: t('taskKindFollowup'),
        cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      };
    }
    if (kind === 'check') {
      return {
        label: t('taskKindCheck'),
        cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      };
    }
    return {
      label: t('taskKindTodo'),
      cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
    };
  };

  const localizedTasks = useMemo(
    () => tasks.map((task) => resolveLocalizedTask(task, language)),
    [tasks, language]
  );

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return localizedTasks.find((task) => task.id === selectedTaskId) || null;
  }, [localizedTasks, selectedTaskId]);

  const filteredTasks = localizedTasks.filter((task) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(q) ||
      task.description.toLowerCase().includes(q) ||
      (task.attachedNote && task.attachedNote.toLowerCase().includes(q)) ||
      (task.relatedPatientId && task.relatedPatientId.toLowerCase().includes(q)) ||
      (task.assigneeName && task.assigneeName.toLowerCase().includes(q));

    const matchesKind =
      taskKindFilter === 'All' || (task.taskKind || 'todo') === taskKindFilter;
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;

    return matchesSearch && matchesKind && matchesStatus && matchesCategory && matchesPriority;
  });

  const tasksWithReminders = localizedTasks.filter((item) => Boolean(item.reminderAt));

  const urgentOrOverdueCount = localizedTasks.filter(
    (item) =>
      (item.priority === 'Urgent' || item.dueDate < today) &&
      item.status !== 'Completed' &&
      item.status !== 'Cancelled'
  ).length;
  const inProgressCount = localizedTasks.filter(
    (item) => item.status === 'In Progress' || item.status === 'Waiting'
  ).length;
  const completedTasksCount = localizedTasks.filter((item) => item.status === 'Completed').length;
  const todoKindCount = localizedTasks.filter((item) => (item.taskKind || 'todo') === 'todo').length;
  const followupKindCount = localizedTasks.filter((item) => item.taskKind === 'followup').length;
  const checkKindCount = localizedTasks.filter((item) => item.taskKind === 'check').length;

  const kpiItems: StandardKpiItem[] = [
    {
      id: 'tasks-total',
      label: t('myClinicalTasks'),
      value: localizedTasks.length,
      subLabel: t('allStatuses'),
      tone: 'purple',
      icon: CheckSquare,
      active: statusFilter === 'All' && priorityFilter === 'All',
      onClick: () => {
        setStatusFilter('All');
        setPriorityFilter('All');
        setSubTab('list');
      }
    },
    {
      id: 'tasks-active',
      label: translateTaskStatus('In Progress', language),
      value: inProgressCount,
      subLabel: translateTaskStatus('Waiting', language),
      tone: 'cyan',
      icon: Clock,
      active: statusFilter === 'In Progress',
      onClick: () => {
        setSubTab('list');
        setStatusFilter(statusFilter === 'In Progress' ? 'All' : 'In Progress');
      }
    },
    {
      id: 'tasks-urgent',
      label: translateTaskPriority('Urgent', language),
      value: urgentOrOverdueCount,
      subLabel: t('overdueBadge'),
      tone: 'amber',
      icon: AlertTriangle,
      active: priorityFilter === 'Urgent',
      onClick: () => {
        setSubTab('list');
        setPriorityFilter(priorityFilter === 'Urgent' ? 'All' : 'Urgent');
      }
    },
    {
      id: 'tasks-done',
      label: translateTaskStatus('Completed', language),
      value: completedTasksCount,
      subLabel: t('done'),
      tone: 'rose',
      icon: CheckCircle2,
      active: statusFilter === 'Completed',
      onClick: () => {
        setSubTab('list');
        setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed');
      }
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {transferToast && (
        <div className="glass-subcard rounded-xl bg-emerald-500/15 border-emerald-400/35 px-4 py-2.5 text-xs text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>{transferToast}</span>
        </div>
      )}

      {/* Row 1: 4 Gradient KPI Cards */}
      <StandardKpiGrid items={kpiItems} />

      {/* Row 2: Gradient Line Chart + Doughnut + Recent Activity */}
      <StandardAnalyticsAndActivity
        trendSeriesPrimaryLabel={t('myTasks')}
        trendSeriesPrimaryData={[0, 0, 0, 0, inProgressCount + urgentOrOverdueCount, localizedTasks.length, localizedTasks.length]}
        trendSeriesSecondaryLabel={translateTaskStatus('Completed', language)}
        trendSeriesSecondaryData={[0, 0, 0, 0, 0, completedTasksCount, completedTasksCount]}
        ratioSlices={[
          {
            label: t('taskKindTodo'),
            count: todoKindCount,
            dotClass: 'bg-purple-400',
            colorHex: '#a855f7'
          },
          {
            label: t('taskKindFollowup'),
            count: followupKindCount,
            dotClass: 'bg-amber-400',
            colorHex: '#fb923c'
          },
          {
            label: t('taskKindCheck'),
            count: checkKindCount,
            dotClass: 'bg-cyan-400',
            colorHex: '#22d3ee'
          },
          {
            label: translateTaskStatus('Completed', language),
            count: completedTasksCount,
            dotClass: 'bg-emerald-400',
            colorHex: '#2dd4bf'
          }
        ]}
        activities={localizedTasks.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${translateCategory(item.category, language)} · ${translateTaskStatus(item.status, language)}`,
          dotClass:
            item.status === 'Completed'
              ? 'bg-emerald-400'
              : item.priority === 'Urgent'
              ? 'bg-rose-400'
              : 'bg-violet-400'
        }))}
      />

      {/* Top Action Bar & Module Submenus */}
      <div className={`rounded-2xl p-5 shadow-lg space-y-4 ${cardSurface}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                {t('myClinicalTasks')} ({formatNumberByLanguage(tasks.length, language)})
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isClinic
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-400/35'
                    : 'bg-violet-500/15 text-violet-300 border-violet-400/35'
                }`}
              >
                {isClinic ? <Building2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {isClinic ? t('teamAssignedBadge') : t('privateVaultBadge')}
              </span>
            </div>
            <p className="text-xs text-slate-300/80 mt-0.5">{t('tasksSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {tasks.length > 0 && (
              !confirmClearTasks ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearTasks(true)}
                  className="crystal-tile flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-400/35 text-rose-200 hover:bg-rose-500/20 text-xs font-medium cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('clearAllBtn')}</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void clearWorkspaceSlice('tasks');
                      setConfirmClearTasks(false);
                      setSelectedTaskId(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t('confirmClearAllBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearTasks(false)}
                    className="crystal-tile px-2.5 py-2 rounded-xl text-slate-200 text-xs cursor-pointer"
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
              className="crystal-btn flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t('pasteSheetImportBtn')}</span>
            </button>
            {onOpenChairsideCopilot && (
              <button
                type="button"
                onClick={onOpenChairsideCopilot}
                className="crystal-btn flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-violet-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
              >
                <Languages className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{t('chairsideCopilotShortBtn')}</span>
              </button>
            )}
            {onOpenCustomBuilder && (
              <button
                type="button"
                onClick={onOpenCustomBuilder}
                className="crystal-btn flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-cyan-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{t('customBuilderShortBtn')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPostOpModalOpen(true)}
              className="crystal-btn flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t('satPostOpShortcutBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewTaskModal}
              className="crystal-btn flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t('newTask').replace(/^\+\s*/, '')}</span>
            </button>
          </div>
        </div>

        {/* Submenus */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap no-scrollbar pt-3 border-t border-white/10">
          {(
            [
              { id: 'list', label: t('tasksSubmenuList') },
              { id: 'templates', label: `${t('tasksSubmenuTemplates')} (${templates.length})` },
              { id: 'workflows', label: `${t('tasksSubmenuWorkflows')} (${workflows.length})` },
              { id: 'reminders', label: t('tasksSubmenuReminders') }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                subTab === tab.id
                  ? 'bg-violet-600/85 text-white border-violet-300/40 shadow-sm'
                  : 'crystal-tile text-slate-300 hover:text-white border-white/15'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'list' && (
        <>
          {/* Unified Compact Filter Bar */}
          <div className="crystal-tile p-3.5 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap no-scrollbar">
              {(
                [
                  { id: 'All', label: t('taskKindAll') },
                  { id: 'todo', label: t('taskKindTodo') },
                  { id: 'followup', label: t('taskKindFollowup') },
                  { id: 'check', label: t('taskKindCheck') }
                ] as const
              ).map((kindOption) => (
                <button
                  key={kindOption.id}
                  type="button"
                  onClick={() => setTaskKindFilter(kindOption.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    taskKindFilter === kindOption.id
                      ? 'bg-violet-500/35 text-violet-100 border-violet-300/50'
                      : 'glass-subcard text-slate-300 hover:text-white border-white/15'
                  }`}
                >
                  {kindOption.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-white/10">
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
                  <option value="New">{translateTaskStatus('New', language)}</option>
                  <option value="Awaiting Review">
                    {translateTaskStatus('Awaiting Review', language)}
                  </option>
                  <option value="Accepted">{translateTaskStatus('Accepted', language)}</option>
                  <option value="In Progress">{translateTaskStatus('In Progress', language)}</option>
                  <option value="Waiting">{translateTaskStatus('Waiting', language)}</option>
                  <option value="Completed">{translateTaskStatus('Completed', language)}</option>
                  <option value="Cancelled">{translateTaskStatus('Cancelled', language)}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {t('filterCategory')}
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="glass-input w-full text-xs rounded-xl px-3 py-2"
                >
                  <option value="All">{t('allCategories')}</option>
                  <option value="Lab Coordination">
                    {translateCategory('Lab Coordination', language)}
                  </option>
                  <option value="Patient Follow-up">
                    {translateCategory('Patient Follow-up', language)}
                  </option>
                  <option value="Sterilization & Prep">
                    {translateCategory('Sterilization & Prep', language)}
                  </option>
                  <option value="Dentist Instruction">
                    {translateCategory('Dentist Instruction', language)}
                  </option>
                  <option value="Inventory & Supplies">
                    {translateCategory('Inventory & Supplies', language)}
                  </option>
                  <option value="Record Keeping">{translateCategory('Record Keeping', language)}</option>
                  <option value="Other">{translateCategory('Other', language)}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {t('filterPriority')}
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="glass-input w-full text-xs rounded-xl px-3 py-2"
                >
                  <option value="All">{t('allPriorities')}</option>
                  <option value="Urgent">{translateTaskPriority('Urgent', language)}</option>
                  <option value="High">{translateTaskPriority('High', language)}</option>
                  <option value="Medium">{translateTaskPriority('Medium', language)}</option>
                  <option value="Low">{translateTaskPriority('Low', language)}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tasks Table with Photo Attachment, Edit & Delete */}
          <div className={`${cardSurface} rounded-2xl overflow-hidden shadow-xl`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="glass-table-head border-b border-white/15 text-slate-300 font-semibold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">{t('zoneColPhoto')}</th>
                    <th className="py-3.5 px-5">{t('taskTitleDetails')}</th>
                    <th className="py-3.5 px-4">{t('category')}</th>
                    <th className="py-3.5 px-4">{t('priorityCol')}</th>
                    <th className="py-3.5 px-4">{t('dueCol')}</th>
                    <th className="py-3.5 px-4">{t('status')}</th>
                    <th className="py-3.5 px-5 text-right">{t('actionsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 px-4 text-slate-300">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <img
                            src={mascotSrc}
                            alt={t('assistantReady')}
                            referrerPolicy="no-referrer"
                            onError={() => {
                              if (mascotSrc !== mascotTasks) {
                                setMascotSrc(mascotTasks);
                              }
                            }}
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-violet-400/50 shadow-lg bg-white/10"
                          />
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-100">
                              {t('awaitingSheetSyncEmpty')}
                            </p>
                            <p className="text-[11px] text-slate-300/85 max-w-md">
                              {t('awaitingSheetSyncHint')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={onOpenNewTaskModal}
                            className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('newTask').replace(/^\+\s*/, '')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const evId =
                        task.attachmentEvidenceId ||
                        task.evidenceIds.find((id) => id.startsWith('ev-'));
                      const isConfirmDel = confirmDeleteId === task.id;
                      const kindMeta = getTaskKindMeta(task.taskKind);
                      const totalSubs = task.subtasks?.length || 0;
                      const doneSubs = task.subtasks?.filter((s) => s.completed).length || 0;
                      const isOverdue =
                        task.dueDate < today &&
                        task.status !== 'Completed' &&
                        task.status !== 'Cancelled';

                      return (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="hover:bg-white/[0.06] transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <AttachmentCell
                              evidenceId={evId}
                              itemTitle={task.title}
                              contextLabel={t('myTasks')}
                              relatedTaskId={task.id}
                              relatedPatientId={task.relatedPatientId}
                              onAttached={(newEvId, fname) =>
                                handleAttachTaskPhoto(task.id, newEvId, fname)
                              }
                              onRemoved={(removedId) => handleRemoveTaskPhoto(task.id, removedId)}
                            />
                          </td>
                          <td className="py-4 px-5 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${kindMeta.cls}`}>
                                {kindMeta.label}
                              </span>
                              <span className="font-semibold text-slate-100 group-hover:text-violet-300 transition-colors">
                                {task.title}
                              </span>
                              {task.relatedPatientId && (
                                <span className="crystal-tile px-2 py-0.5 rounded text-[10px] font-mono text-slate-200">
                                  {task.relatedPatientId}
                                </span>
                              )}
                              {totalSubs > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-200 border border-violet-400/35 tabular-nums">
                                  {doneSubs}/{totalSubs}
                                </span>
                              )}
                              {isClinic && task.assigneeName && (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-200 border border-indigo-400/35">
                                  {task.assigneeName}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300/80 line-clamp-1">
                              {task.description}
                            </p>
                            {task.attachedNote && (
                              <p className="text-[10px] text-amber-300/90 flex items-center gap-1 line-clamp-1">
                                <StickyNote className="w-3 h-3 shrink-0" />
                                <span>{task.attachedNote}</span>
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-4 font-medium text-slate-200">
                            <div>{translateCategory(task.category, language)}</div>
                            {task.customCategory && (
                              <span className="text-[10px] text-violet-300">{task.customCategory}</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.priority === 'Urgent'
                                  ? 'bg-rose-500/20 text-rose-200 border border-rose-400/35'
                                  : task.priority === 'High'
                                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
                                  : 'bg-blue-500/20 text-blue-200 border border-blue-400/35'
                              }`}
                            >
                              {translateTaskPriority(task.priority, language)}
                            </span>
                          </td>
                          <td className="py-4 px-4 tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  isOverdue ? 'text-rose-300 font-semibold' : 'text-slate-200'
                                }
                              >
                                {formatDateByLanguage(task.dueDate, language)}
                              </span>
                              {isOverdue && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-200 font-semibold border border-rose-400/35">
                                  {t('overdueBadge')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleStatusChange(task.id, e.target.value as TaskStatus)
                              }
                              className={`glass-input px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${
                                task.status === 'Completed'
                                  ? 'text-emerald-200 border-emerald-400/40'
                                  : task.status === 'In Progress'
                                  ? 'text-blue-200 border-blue-400/40'
                                  : task.status === 'Awaiting Review'
                                  ? 'text-amber-200 border-amber-400/40'
                                  : 'text-slate-200 border-white/20'
                              }`}
                            >
                              <option value="New">{translateTaskStatus('New', language)}</option>
                              <option value="Awaiting Review">
                                {translateTaskStatus('Awaiting Review', language)}
                              </option>
                              <option value="Accepted">{translateTaskStatus('Accepted', language)}</option>
                              <option value="In Progress">
                                {translateTaskStatus('In Progress', language)}
                              </option>
                              <option value="Waiting">{translateTaskStatus('Waiting', language)}</option>
                              <option value="Completed">{translateTaskStatus('Completed', language)}</option>
                              <option value="Cancelled">{translateTaskStatus('Cancelled', language)}</option>
                            </select>
                          </td>
                          <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = tasks.find((tk) => tk.id === task.id);
                                  if (raw) setEditingTask({ ...raw });
                                }}
                                className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                                title={t('editBtn')}
                                aria-label={t('editBtn')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
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
                                onClick={() => setSelectedTaskId(task.id)}
                                className="text-violet-300 hover:text-violet-200 font-medium inline-flex items-center gap-0.5 cursor-pointer pl-1"
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
        </>
      )}

      {subTab === 'templates' && (
        <div className={`${cardSurface} rounded-2xl p-6 shadow-xl space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-100">{t('tasksSubmenuTemplates')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {templates.length > 0 && (
                !confirmClearTemplates ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearTemplates(true)}
                    className="crystal-tile flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-400/35 text-rose-200 hover:bg-rose-500/20 text-xs font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('clearAllBtn')}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        clearTemplates();
                        setConfirmClearTemplates(false);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      {t('confirmClearAllBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearTemplates(false)}
                      className="crystal-tile px-2.5 py-2 rounded-xl text-slate-200 text-xs cursor-pointer"
                    >
                      {t('cancelBtn')}
                    </button>
                  </div>
                )
              )}
              <button
                type="button"
                onClick={() => setIsCreateTmplOpen((prev) => !prev)}
                className="crystal-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('addTemplateBtn')}</span>
              </button>
            </div>
          </div>

          {isCreateTmplOpen && (
            <form onSubmit={handleCreateTemplateSubmit} className="glass-subcard p-4 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  placeholder={t('templateNamePrompt')}
                  className="glass-input rounded-xl px-3 py-2 sm:col-span-1"
                />
                <select
                  value={newTmplCategory}
                  onChange={(e) => setNewTmplCategory(e.target.value as TaskCategory)}
                  className="glass-input rounded-xl px-3 py-2"
                >
                  <option value="Lab Coordination">{translateCategory('Lab Coordination', language)}</option>
                  <option value="Patient Follow-up">{translateCategory('Patient Follow-up', language)}</option>
                  <option value="Sterilization & Prep">{translateCategory('Sterilization & Prep', language)}</option>
                  <option value="Dentist Instruction">{translateCategory('Dentist Instruction', language)}</option>
                  <option value="Inventory & Supplies">{translateCategory('Inventory & Supplies', language)}</option>
                  <option value="Record Keeping">{translateCategory('Record Keeping', language)}</option>
                  <option value="Other">{translateCategory('Other', language)}</option>
                </select>
                <select
                  value={newTmplPriority}
                  onChange={(e) => setNewTmplPriority(e.target.value as TaskPriority)}
                  className="glass-input rounded-xl px-3 py-2"
                >
                  <option value="Urgent">{translateTaskPriority('Urgent', language)}</option>
                  <option value="High">{translateTaskPriority('High', language)}</option>
                  <option value="Medium">{translateTaskPriority('Medium', language)}</option>
                  <option value="Low">{translateTaskPriority('Low', language)}</option>
                </select>
              </div>
              <input
                type="text"
                value={newTmplDesc}
                onChange={(e) => setNewTmplDesc(e.target.value)}
                placeholder={t('taskDescPlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <input
                type="text"
                value={newTmplSubtasksInput}
                onChange={(e) => setNewTmplSubtasksInput(e.target.value)}
                placeholder={t('workflowStagesPlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTmplOpen(false)}
                  className="crystal-tile px-3 py-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          )}

          {templates.length === 0 ? (
            <p className="text-xs text-slate-300/80">{t('noTemplatesYet')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => {
                const isConfirmDelTmpl = confirmDeleteTmplId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    className="glass-subcard p-4 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-100">{tmpl.name}</h4>
                        <p className="text-[11px] text-slate-300/80 mt-0.5">{tmpl.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate({ ...tmpl });
                            setEditingTmplSubtasksInput(tmpl.defaultSubtasks.join(', '));
                          }}
                          className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                          title={t('editBtn')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isConfirmDelTmpl) {
                              deleteTemplate(tmpl.id);
                              setConfirmDeleteTmplId(null);
                            } else {
                              setConfirmDeleteTmplId(tmpl.id);
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                            isConfirmDelTmpl
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                          }`}
                          title={t('deleteBtn')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isConfirmDelTmpl && <span>{t('confirmDeleteBtn')}</span>}
                        </button>
                      </div>
                    </div>
                    {tmpl.defaultSubtasks.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-slate-200">
                        {tmpl.defaultSubtasks.map((st, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <CheckSquare className="w-3 h-3 text-violet-300 shrink-0" />
                            <span>{st}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-[10px] text-slate-300/80">
                        {translateCategory(tmpl.category, language)} •{' '}
                        {translateTaskPriority(tmpl.priority, language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUseTemplateDirect(tmpl.id)}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/25 hover:bg-violet-500/35 border border-violet-400/40 text-violet-100 text-[11px] font-medium cursor-pointer"
                      >
                        {t('useThisTemplateBtn')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'workflows' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardSurface} rounded-2xl p-6 shadow-xl space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet-300" />
                <span>{t('tasksSubmenuWorkflows')}</span>
              </h3>
              {workflows.length > 0 && (
                !confirmClearWorkflows ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearWorkflows(true)}
                    className="crystal-tile flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-400/35 text-rose-200 hover:bg-rose-500/20 text-[11px] font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('clearAllBtn')}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        clearWorkflows();
                        setConfirmClearWorkflows(false);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      {t('confirmClearAllBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearWorkflows(false)}
                      className="crystal-tile px-2 py-1.5 rounded-xl text-slate-200 text-[11px] cursor-pointer"
                    >
                      {t('cancelBtn')}
                    </button>
                  </div>
                )
              )}
            </div>
            {workflows.length === 0 ? (
              <p className="text-xs text-slate-300/80">{t('noWorkflowsYet')}</p>
            ) : (
              <div className="space-y-3">
                {workflows.map((wf) => {
                  const isConfirmDelWf = confirmDeleteWfId === wf.id;
                  return (
                    <div
                      key={wf.id}
                      className="glass-subcard p-4 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-100">{wf.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkflow({ ...wf });
                              setEditingWfStagesInput(wf.stages.join(', '));
                            }}
                            className="crystal-tile p-1.5 rounded-lg text-cyan-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isConfirmDelWf) {
                                deleteWorkflow(wf.id);
                                setConfirmDeleteWfId(null);
                              } else {
                                setConfirmDeleteWfId(wf.id);
                              }
                            }}
                            className={`p-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                              isConfirmDelWf
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'crystal-tile text-rose-300 hover:bg-rose-500/25 border-white/15'
                            }`}
                            title={t('deleteBtn')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isConfirmDelWf && <span>{t('confirmDeleteBtn')}</span>}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {wf.stages.map((st, idx) => (
                          <React.Fragment key={idx}>
                            <span className="px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-400/35 text-[11px] text-violet-100">
                              {st}
                            </span>
                            {idx < wf.stages.length - 1 && (
                              <span className="text-slate-400 text-xs">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={handleCreateWorkflow}
            className={`${cardSurface} rounded-2xl p-6 shadow-xl space-y-4 text-xs`}
          >
            <h3 className="text-sm font-bold text-slate-100">{t('createWorkflowBtn')}</h3>
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('workflowLabel')}</label>
              <input
                type="text"
                required
                value={wfName}
                onChange={(e) => setWfName(e.target.value)}
                placeholder={t('workflowNamePlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('workflowStageLabel')}</label>
              <input
                type="text"
                required
                value={wfStagesInput}
                onChange={(e) => setWfStagesInput(e.target.value)}
                placeholder={t('workflowStagesPlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="crystal-btn px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium cursor-pointer"
            >
              {t('createWorkflowBtn')}
            </button>
          </form>
        </div>
      )}

      {subTab === 'reminders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Personal Daily Goals Checklist */}
            <div className={`rounded-2xl p-6 shadow-xl space-y-4 ${cardSurface}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-300" />
                  <span>{t('personalGoalsTitle')}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-violet-200 font-medium tabular-nums">
                    {dailyGoals.filter((g) => g.completed).length}/{dailyGoals.length}
                  </span>
                  {dailyGoals.length > 0 && (
                    !confirmClearGoals ? (
                      <button
                        type="button"
                        onClick={() => setConfirmClearGoals(true)}
                        className="crystal-tile px-2 py-1 rounded-lg border border-rose-400/35 text-rose-200 text-[10px] font-medium cursor-pointer"
                      >
                        {t('clearAllBtn')}
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            clearDailyGoals();
                            setConfirmClearGoals(false);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold cursor-pointer"
                        >
                          {t('confirmClearAllBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearGoals(false)}
                          className="crystal-tile px-2 py-1 rounded-lg text-slate-200 text-[10px] cursor-pointer"
                        >
                          {t('cancelBtn')}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              <form onSubmit={handleAddGoal} className="flex gap-2">
                <input
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder={t('personalGoalPlaceholder')}
                  className="glass-input flex-1 min-w-0 rounded-xl px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="crystal-btn px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer shrink-0"
                >
                  {t('addGoalBtn')}
                </button>
              </form>

              <div className="space-y-2">
                {dailyGoals.map((goal) => {
                  const isEditingThis = editingGoalId === goal.id;
                  const isConfirmDelGoal = confirmDeleteGoalId === goal.id;
                  return (
                    <div
                      key={goal.id}
                      className="glass-subcard flex items-center justify-between gap-2 p-3 rounded-xl text-xs"
                    >
                      {isEditingThis ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editingGoalTitle.trim()) {
                              updateDailyGoal(goal.id, editingGoalTitle.trim());
                            }
                            setEditingGoalId(null);
                          }}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingGoalTitle}
                            onChange={(e) => setEditingGoalTitle(e.target.value)}
                            className="glass-input flex-1 min-w-0 rounded-lg px-2.5 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            {t('saveChangesBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGoalId(null)}
                            className="crystal-tile px-2 py-1 rounded-lg text-slate-300 text-[11px] cursor-pointer shrink-0"
                          >
                            {t('cancelBtn')}
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleDailyGoal(goal.id)}
                            className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                          >
                            {goal.completed ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                goal.completed ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {goal.title}
                            </span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGoalId(goal.id);
                                setEditingGoalTitle(goal.title);
                              }}
                              className="p-1 text-cyan-300 hover:text-white cursor-pointer"
                              title={t('editGoalTitle')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isConfirmDelGoal) {
                                  deleteDailyGoal(goal.id);
                                  setConfirmDeleteGoalId(null);
                                } else {
                                  setConfirmDeleteGoalId(goal.id);
                                }
                              }}
                              className={`p-1 rounded-md text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                isConfirmDelGoal
                                  ? 'bg-rose-600 text-white px-2'
                                  : 'text-slate-400 hover:text-rose-300'
                              }`}
                              title={t('deleteBtn')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isConfirmDelGoal && <span>{t('confirmDeleteBtn')}</span>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reminders Due */}
            <div className={`rounded-2xl p-6 shadow-xl space-y-4 ${cardSurface}`}>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-300" />
                <span>{t('remindersDueTitle')}</span>
              </h3>
              {tasksWithReminders.length === 0 ? (
                <p className="text-xs text-slate-300/80">{t('noRemindersYet')}</p>
              ) : (
                <div className="space-y-2.5">
                  {tasksWithReminders.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSubTab('list');
                        setSelectedTaskId(task.id);
                      }}
                      className="glass-subcard p-3.5 rounded-xl hover:border-violet-400/50 cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">{task.title}</p>
                        <p className="text-[11px] text-amber-300 font-mono mt-0.5">{task.reminderAt}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-xl space-y-4 text-xs ${cardSurface}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-violet-300" />
                <span>{t('privateNotesTabTitle')}</span>
              </h3>
              {privateNotes.length > 0 && (
                !confirmClearNotes ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearNotes(true)}
                    className="crystal-tile px-2.5 py-1 rounded-lg border border-rose-400/35 text-rose-200 text-[10px] font-medium cursor-pointer"
                  >
                    {t('clearAllBtn')}
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        clearPrivateNotes();
                        setConfirmClearNotes(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold cursor-pointer"
                    >
                      {t('confirmClearAllBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearNotes(false)}
                      className="crystal-tile px-2 py-1 rounded-lg text-slate-200 text-[10px] cursor-pointer"
                    >
                      {t('cancelBtn')}
                    </button>
                  </div>
                )
              )}
            </div>

            <form onSubmit={handleAddNote} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNoteType('note')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-medium border cursor-pointer ${
                    noteType === 'note'
                      ? 'bg-violet-500/30 text-violet-100 border-violet-300/50'
                      : 'glass-subcard text-slate-300 border-white/15'
                  }`}
                >
                  {t('noteTypePrivate')}
                </button>
                <button
                  type="button"
                  onClick={() => setNoteType('formula')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1 cursor-pointer ${
                    noteType === 'formula'
                      ? 'bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-300/50'
                      : 'glass-subcard text-slate-300 border-white/15'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('noteTypeFormula')}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={t('noteTitlePlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <textarea
                rows={2}
                required
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={t('noteContentPlaceholder')}
                className="glass-input w-full rounded-xl p-3"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteReminder}
                  onChange={(e) => setNoteReminder(e.target.value)}
                  placeholder={`${t('reminderLabel')} (${t('optionalLabel')})`}
                  className="glass-input flex-1 rounded-xl px-3 py-2 font-mono"
                />
                <button
                  type="submit"
                  className="crystal-btn px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium cursor-pointer"
                >
                  {t('addPrivateNoteBtn')}
                </button>
              </div>
            </form>

            <div className="space-y-2.5 pt-2">
              {privateNotes.map((n) => {
                const isConfirmDelNote = confirmDeleteNoteId === n.id;
                return (
                  <div
                    key={n.id}
                    className="glass-subcard p-3.5 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            n.noteType === 'formula'
                              ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/35'
                              : 'bg-violet-500/20 text-violet-200 border border-violet-400/35'
                          }`}
                        >
                          {n.noteType === 'formula' ? t('memoryFormulaBadge') : t('personalNoteBadge')}
                        </span>
                        <span className="font-semibold text-slate-100 truncate">{n.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingNote({ ...n })}
                          className="p-1 text-cyan-300 hover:text-white cursor-pointer"
                          title={t('editNoteTitle')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isConfirmDelNote) {
                              deletePrivateNote(n.id);
                              setConfirmDeleteNoteId(null);
                            } else {
                              setConfirmDeleteNoteId(n.id);
                            }
                          }}
                          className={`p-1 rounded-md text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                            isConfirmDelNote
                              ? 'bg-rose-600 text-white px-2'
                              : 'text-slate-400 hover:text-rose-300'
                          }`}
                          title={t('deleteBtn')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isConfirmDelNote && <span>{t('confirmDeleteBtn')}</span>}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-200/90 leading-relaxed">{n.content}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {n.reminderAt ? (
                        <p className="text-[10px] font-mono text-amber-300">{n.reminderAt}</p>
                      ) : (
                        <span />
                      )}
                      {clinicTargetWorkspace && (
                        <button
                          type="button"
                          onClick={() => handleTransferNoteToAssistant(n.id)}
                          className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:border-violet-400/45 text-[10px] text-violet-200 font-medium cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>{t('sendNoteToTasksBtn')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Quick Action Bar */}
      <StandardQuickActionBar
        setActiveTab={setActiveTab}
        primaryActionLabel={t('newTask')}
        onPrimaryAction={onOpenNewTaskModal}
      />

      {/* Task Detail Modal (with Photo Attachment, Subtasks Checklist, Workflow, Assignment) */}
      {selectedTask &&
        createPortal(
          <div
            onClick={() => setSelectedTaskId(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/15">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getTaskKindMeta(selectedTask.taskKind).cls}`}>
                    {getTaskKindMeta(selectedTask.taskKind).label}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-400/35">
                    {translateCategory(selectedTask.category, language)}
                  </span>
                  {selectedTask.customCategory && (
                    <span className="crystal-tile px-2 py-0.5 rounded text-[10px] text-slate-200">
                      {selectedTask.customCategory}
                    </span>
                  )}
                  <span className="text-xs text-slate-300">
                    {t('createdDate')}: {formatDateByLanguage(selectedTask.createdDate, language)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {targetTransferWorkspace && (
                    <button
                      type="button"
                      onClick={() => handleTransferTask(selectedTask.id)}
                      className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-200 text-[11px] font-medium cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>
                        {isPersonal ? t('transferToAssistantBtn') : t('transferToPersonalBtn')}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveTaskAsTemplate(selectedTask)}
                    className="crystal-tile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-violet-200 text-[11px] font-medium cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>
                      {templateSavedId === selectedTask.id
                        ? t('sheetSavedMsg')
                        : t('saveAsTemplateBtn')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(null)}
                    className="crystal-tile text-slate-200 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100">{selectedTask.title}</h3>
                  <p className="glass-subcard text-xs text-slate-200 mt-2 p-3.5 rounded-xl leading-relaxed">
                    {selectedTask.description}
                  </p>
                  {selectedTask.attachedNote && (
                    <div className="mt-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-start gap-2">
                      <StickyNote className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-[11px] text-amber-200">
                          {t('attachedNoteLabel')}
                        </span>
                        <p className="mt-0.5 leading-relaxed">{selectedTask.attachedNote}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Attachment Banner */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200">{t('zoneColPhoto')}</label>
                  <AttachmentCell
                    variant="banner"
                    evidenceId={
                      selectedTask.attachmentEvidenceId ||
                      selectedTask.evidenceIds.find((id) => id.startsWith('ev-'))
                    }
                    itemTitle={selectedTask.title}
                    contextLabel={t('myTasks')}
                    relatedTaskId={selectedTask.id}
                    relatedPatientId={selectedTask.relatedPatientId}
                    onAttached={(evId, fname) =>
                      handleAttachTaskPhoto(selectedTask.id, evId, fname)
                    }
                    onRemoved={(removedId) => handleRemoveTaskPhoto(selectedTask.id, removedId)}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="glass-subcard p-3 rounded-xl">
                    <span className="text-slate-300/75 block">{t('dueDateLabel')}</span>
                    <span className="font-semibold text-slate-100 mt-0.5 block">
                      {formatDateByLanguage(selectedTask.dueDate, language)}
                    </span>
                  </div>
                  <div className="glass-subcard p-3 rounded-xl">
                    <span className="text-slate-300/75 block">{t('priorityCol')}</span>
                    <span className="font-semibold text-slate-100 mt-0.5 block">
                      {translateTaskPriority(selectedTask.priority, language)}
                    </span>
                  </div>
                  {selectedTask.reminderAt && (
                    <div className="glass-subcard p-3 rounded-xl">
                      <span className="text-slate-300/75 block">{t('reminderLabel')}</span>
                      <span className="font-mono text-amber-300 mt-0.5 block">
                        {selectedTask.reminderAt}
                      </span>
                    </div>
                  )}
                </div>

                {/* Clinic Team Assignment */}
                {isClinic && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="glass-subcard p-3 rounded-xl">
                      <span className="text-slate-300/75 block mb-1">{t('assigneeLabel')}</span>
                      {canAssignTeam ? (
                        <select
                          value={selectedTask.assigneeId || ''}
                          onChange={(e) => handleAssigneeChange(selectedTask.id, e.target.value)}
                          className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="">{t('unassignedLabel')}</option>
                          {activeWorkspace.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-slate-100">
                          {selectedTask.assigneeName || t('unassignedLabel')}
                        </span>
                      )}
                    </div>
                    <div className="glass-subcard p-3 rounded-xl">
                      <span className="text-slate-300/75 block mb-1">{t('roomLabel')}</span>
                      <span className="font-medium text-slate-100">
                        {selectedTask.roomName || t('noRoomLabel')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Workflow Stages */}
                {selectedTask.workflowStages && selectedTask.workflowStages.length > 0 && (
                  <div className="glass-subcard p-3.5 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-violet-300" />
                        {t('workflowStageLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdvanceWorkflowStage(selectedTask.id)}
                        className="px-2.5 py-1 rounded-lg bg-violet-500/25 hover:bg-violet-500/35 border border-violet-400/40 text-violet-100 text-[11px] font-medium cursor-pointer"
                      >
                        {t('advanceStageBtn')}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedTask.workflowStages.map((stage, idx) => {
                        const activeIdx = selectedTask.currentStageIndex ?? 0;
                        return (
                          <span
                            key={idx}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                              idx === activeIdx
                                ? 'bg-violet-600 text-white border-violet-400 font-semibold'
                                : idx < activeIdx
                                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35'
                                : 'crystal-tile text-slate-300 border-white/15'
                            }`}
                          >
                            {stage}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subtasks Checklist */}
                <div className="glass-subcard p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{t('subtasksLabel')}</span>
                    {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                      <span className="text-[11px] text-violet-200 tabular-nums">
                        {t('subtasksProgress')
                          .replace(
                            '{done}',
                            String(selectedTask.subtasks.filter((s) => s.completed).length)
                          )
                          .replace('{total}', String(selectedTask.subtasks.length))}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {(selectedTask.subtasks || []).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleToggleSubtask(selectedTask.id, st.id)}
                        className="crystal-tile w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs cursor-pointer"
                      >
                        {st.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={
                            st.completed ? 'line-through text-slate-400' : 'text-slate-100'
                          }
                        >
                          {st.title}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1 text-xs">
                    <input
                      type="text"
                      value={newSubtaskInput}
                      onChange={(e) => setNewSubtaskInput(e.target.value)}
                      placeholder={t('addSubtaskPlaceholder')}
                      className="glass-input flex-1 rounded-lg px-3 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSubtaskInDetail(selectedTask.id)}
                      className="crystal-tile px-3 py-1.5 rounded-lg text-violet-200 font-medium cursor-pointer"
                    >
                      {t('addSubtaskBtn')}
                    </button>
                  </div>
                </div>

                {selectedTask.relatedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-violet-300" />
                      <span>{t('relatedDocuments')}</span>
                    </label>
                    <div className="space-y-1.5">
                      {selectedTask.relatedDocuments.map((doc, i) => (
                        <div
                          key={i}
                          className="glass-subcard flex items-center justify-between p-2.5 rounded-xl text-xs"
                        >
                          <span className="font-mono text-violet-200">{doc}</span>
                          <span className="text-[10px] text-slate-300">{t('linkedEvidence')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity History */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{t('activityHistory')}</span>
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTask.activityHistory.map((rawAct) => {
                      const act = resolveLocalizedTaskActivity(rawAct, selectedTask.id, language);
                      return (
                        <div
                          key={act.id}
                          className="glass-subcard p-2.5 rounded-xl text-xs flex items-center justify-between gap-3"
                        >
                          <span className="text-slate-100 font-medium">{act.action}</span>
                          <span className="text-[10px] text-slate-300/75 shrink-0">
                            {formatDateByLanguage(act.timestamp, language)}
                          </span>
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
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value as TaskStatus)}
                    className="glass-input text-xs rounded-xl px-3 py-1.5"
                  >
                    <option value="New">{translateTaskStatus('New', language)}</option>
                    <option value="Awaiting Review">
                      {translateTaskStatus('Awaiting Review', language)}
                    </option>
                    <option value="Accepted">{translateTaskStatus('Accepted', language)}</option>
                    <option value="In Progress">{translateTaskStatus('In Progress', language)}</option>
                    <option value="Waiting">{translateTaskStatus('Waiting', language)}</option>
                    <option value="Completed">{translateTaskStatus('Completed', language)}</option>
                    <option value="Cancelled">{translateTaskStatus('Cancelled', language)}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="crystal-btn bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-2 rounded-xl cursor-pointer"
                >
                  {t('done')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Task Modal */}
      {editingTask &&
        createPortal(
          <div
            onClick={() => setEditingTask(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditTask}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('editBtn')} · {editingTask.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('taskTitleDetails')}</label>
                  <input
                    type="text"
                    required
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">{t('category')}</label>
                    <select
                      value={editingTask.category}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, category: e.target.value as TaskCategory })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2"
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
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">{t('priorityCol')}</label>
                    <select
                      value={editingTask.priority}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, priority: e.target.value as TaskPriority })
                      }
                      className="glass-input w-full rounded-xl px-3 py-2"
                    >
                      <option value="Urgent">{translateTaskPriority('Urgent', language)}</option>
                      <option value="High">{translateTaskPriority('High', language)}</option>
                      <option value="Medium">{translateTaskPriority('Medium', language)}</option>
                      <option value="Low">{translateTaskPriority('Low', language)}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium block">{t('dueCol')}</label>
                    <input
                      type="date"
                      value={editingTask.dueDate}
                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                      className="glass-input w-full rounded-xl px-3 py-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('taskDescription')}</label>
                  <textarea
                    rows={3}
                    value={editingTask.description}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="glass-input w-full rounded-xl p-3"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">{t('attachedNoteLabel')}</label>
                  <input
                    type="text"
                    value={editingTask.attachedNote || ''}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, attachedNote: e.target.value })
                    }
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Edit Template Modal */}
      {editingTemplate &&
        createPortal(
          <div
            onClick={() => setEditingTemplate(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditTemplate}
              className="glass-modal rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">{t('editTemplateTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                required
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <textarea
                rows={2}
                value={editingTemplate.description}
                onChange={(e) =>
                  setEditingTemplate({ ...editingTemplate, description: e.target.value })
                }
                className="glass-input w-full rounded-xl p-3"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editingTemplate.category}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      category: e.target.value as TaskCategory
                    })
                  }
                  className="glass-input rounded-xl px-3 py-2"
                >
                  <option value="Lab Coordination">{translateCategory('Lab Coordination', language)}</option>
                  <option value="Patient Follow-up">{translateCategory('Patient Follow-up', language)}</option>
                  <option value="Sterilization & Prep">{translateCategory('Sterilization & Prep', language)}</option>
                  <option value="Dentist Instruction">{translateCategory('Dentist Instruction', language)}</option>
                  <option value="Inventory & Supplies">{translateCategory('Inventory & Supplies', language)}</option>
                  <option value="Record Keeping">{translateCategory('Record Keeping', language)}</option>
                  <option value="Other">{translateCategory('Other', language)}</option>
                </select>
                <select
                  value={editingTemplate.priority}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      priority: e.target.value as TaskPriority
                    })
                  }
                  className="glass-input rounded-xl px-3 py-2"
                >
                  <option value="Urgent">{translateTaskPriority('Urgent', language)}</option>
                  <option value="High">{translateTaskPriority('High', language)}</option>
                  <option value="Medium">{translateTaskPriority('Medium', language)}</option>
                  <option value="Low">{translateTaskPriority('Low', language)}</option>
                </select>
              </div>
              <input
                type="text"
                value={editingTmplSubtasksInput}
                onChange={(e) => setEditingTmplSubtasksInput(e.target.value)}
                placeholder={t('workflowStagesPlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Edit Workflow Modal */}
      {editingWorkflow &&
        createPortal(
          <div
            onClick={() => setEditingWorkflow(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditWorkflow}
              className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">{t('editWorkflowTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                required
                value={editingWorkflow.name}
                onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <input
                type="text"
                required
                value={editingWfStagesInput}
                onChange={(e) => setEditingWfStagesInput(e.target.value)}
                placeholder={t('workflowStagesPlaceholder')}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingWorkflow(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Edit Private Note Modal */}
      {editingNote &&
        createPortal(
          <div
            onClick={() => setEditingNote(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditNote}
              className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-slate-100">{t('editNoteTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="crystal-tile p-1.5 rounded-lg text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                required
                value={editingNote.title}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                className="glass-input w-full rounded-xl px-3 py-2"
              />
              <textarea
                rows={3}
                required
                value={editingNote.content}
                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                className="glass-input w-full rounded-xl p-3"
              />
              <input
                type="text"
                value={editingNote.reminderAt || ''}
                onChange={(e) => setEditingNote({ ...editingNote, reminderAt: e.target.value })}
                placeholder={`${t('reminderLabel')} (${t('optionalLabel')})`}
                className="glass-input w-full rounded-xl px-3 py-2 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="crystal-tile px-4 py-2 rounded-xl text-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      <PostOpSurveyModal
        isOpen={isPostOpModalOpen}
        onClose={() => setIsPostOpModalOpen(false)}
      />

      {/* Paste Sheet / CSV Import Modal */}
      {isPasteModalOpen &&
        createPortal(
          <div
            onClick={() => setIsPasteModalOpen(false)}
            className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleConfirmPasteTasks}
              className="glass-modal border-cyan-400/35 rounded-2xl max-w-2xl w-full p-5 space-y-4 text-xs shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-slate-100">
                    {t('pasteTasksModalTitle')}
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

              <p className="text-[11px] text-slate-300 leading-relaxed">{t('pasteTasksHint')}</p>

              <textarea
                rows={6}
                value={pasteRawText}
                onChange={(e) => {
                  setPasteRawText(e.target.value);
                  setPasteError(null);
                }}
                placeholder="ตรวจนับสต๊อกถุงมือ&#9;Inventory & Supplies&#9;High&#9;2026-11-28&#9;เหลือ 2 กล่อง"
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
                    formatNumberByLanguage(parsedPasteTasks.length, language)
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
                    className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-violet-600 text-white font-semibold cursor-pointer"
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
