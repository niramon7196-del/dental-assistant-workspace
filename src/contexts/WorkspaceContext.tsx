import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DentureCase,
  EvidenceItem,
  InboxItem,
  InboxSourceType,
  LabOrder,
  PatientFollowUpItem,
  QueueItem,
  SatisfactionResponse,
  SatisfactionSettings,
  SheetConfig,
  TaskCategory,
  TaskItem,
  TaskKind,
  TaskPriority
} from '../types/dental';
import {
  AuditLogEntry,
  ClinicRole,
  CollaborationMode,
  CustomWorkflow,
  DailyGoalItem,
  LiveCategoryBoard,
  LiveCategoryKind,
  LiveCategoryRecord,
  ModuleId,
  PermissionAction,
  PrivateNote,
  SatisfactionCallbackRecommendation,
  TaskTemplate,
  Workspace,
  WorkspaceChatState,
  WorkspaceMember
} from '../types/platform';
import { PROCEDURE_LABELS_TH } from '../services/satisfactionService';
import { buildDefaultEnabledModules, getModuleDefinition } from '../modules/moduleRegistry';
import { canPerform } from '../utils/permissions';
import {
  buildSecondClinicWorkspace,
  clearJudgeDemoPartitions,
  CLINIC_REAL_SATISFACTION_STORAGE_KEY,
  CLINIC_WORKSPACE_ID,
  createDefaultWorkspaceChatState,
  deleteWorkspaceStoragePartition,
  exportWorkspaceBackupJson,
  importWorkspaceBackupJson,
  loadActiveWorkspaceId,
  loadWorkspaceData,
  loadWorkspacesRegistry,
  resetWorkspacePartitionToDemo,
  saveActiveWorkspaceId,
  saveWorkspaceDataSlice as persistWorkspaceDataSlice,
  saveWorkspacesRegistry,
  WorkspaceScopedData
} from '../services/workspaceStorage';
import { fetchDentureCases, resetDemoDentureCases, saveSheetConfig } from '../services/sheetService';
import {
  clearAllEvidenceFiles,
  deleteEvidenceFile,
  getEvidenceFile,
  saveEvidenceFile
} from '../services/evidenceStorage';
import type { PreparedInboxFile } from '../services/aiService';
import { locales, type Language } from '../utils/i18n';
import { clearChairsideSessionStorage } from '../services/chairsideCopilotService';
import { clearCustomBuilderData } from '../services/customBuilderService';
import { clearFollowUpCallStorage } from '../services/followUpCallService';
import {
  buildJudgeDemoWorkspaceData,
  clearJudgeDemoAuxStorage
} from '../services/judgeDemoService';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  activeWorkspaceId: string;
  currentRole: ClinicRole;
  hasPermission: (action: PermissionAction) => boolean;
  switchWorkspace: (workspaceId: string) => void;
  createClinicWorkspace: (input: { name: string; description: string }) => { ok: boolean; workspace?: Workspace; error?: string };
  joinClinicWorkspace: (inviteCode: string, role?: ClinicRole) => { ok: boolean; workspace?: Workspace; error?: string };
  updateWorkspaceMeta: (workspaceId: string, patch: { name?: string; description?: string }) => boolean;
  deleteWorkspace: (workspaceId: string) => { ok: boolean; error?: string };
  setCurrentUserRole: (role: ClinicRole) => void;
  toggleModule: (moduleId: ModuleId, enabled: boolean) => boolean;
  addClinicMember: (member: { name: string; email: string; role: ClinicRole; assignedRooms: string[] }) => boolean;
  updateClinicMemberRole: (memberId: string, role: ClinicRole) => boolean;
  updateClinicMember: (
    memberId: string,
    patch: { name?: string; email?: string; role?: ClinicRole; assignedRooms?: string[] }
  ) => boolean;
  deleteClinicMember: (memberId: string) => boolean;
  addClinicRoom: (roomName: string) => boolean;
  updateClinicRoom: (oldRoomName: string, newRoomName: string) => boolean;
  deleteClinicRoom: (roomName: string) => boolean;

  // Scoped workspace data (strictly bound to activeWorkspaceId)
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  queueItems: QueueItem[];
  setQueueItems: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  labOrders: LabOrder[];
  setLabOrders: React.Dispatch<React.SetStateAction<LabOrder[]>>;
  followUps: PatientFollowUpItem[];
  setFollowUps: React.Dispatch<React.SetStateAction<PatientFollowUpItem[]>>;
  evidenceList: EvidenceItem[];
  setEvidenceList: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  inboxItems: InboxItem[];
  setInboxItems: React.Dispatch<React.SetStateAction<InboxItem[]>>;
  sheetConfig: SheetConfig;
  updateSheetConfig: (cfg: SheetConfig) => void;
  dentureCases: DentureCase[];
  setDentureCases: React.Dispatch<React.SetStateAction<DentureCase[]>>;
  isDentureLoading: boolean;
  dentureLoadError: string | null;
  refreshDentureCases: (cfgOverride?: SheetConfig) => Promise<void>;

  // Satisfaction QR Pulse, Analytics, Callback Triage & Executive Report
  satisfactionResponses: SatisfactionResponse[];
  setSatisfactionResponses: React.Dispatch<React.SetStateAction<SatisfactionResponse[]>>;
  satisfactionSettings: SatisfactionSettings;
  updateSatisfactionSettings: (next: Partial<SatisfactionSettings>) => void;
  chatState: WorkspaceChatState;
  updateChatState: (
    patch: Partial<WorkspaceChatState> | ((prev: WorkspaceChatState) => WorkspaceChatState)
  ) => void;
  createFollowUpFromSatisfaction: (
    response: SatisfactionResponse,
    aiRec?: SatisfactionCallbackRecommendation
  ) => TaskItem;
  saveExecutiveReportToWorkspace: (
    reportText: string,
    responsesCount: number,
    monthKey: string
  ) => Promise<{ task: TaskItem; evidence: EvidenceItem }>;

  // Dynamic Task Engine & Private Vault
  templates: TaskTemplate[];
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => TaskTemplate;
  updateTemplate: (templateId: string, patch: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (templateId: string) => void;
  clearTemplates: () => void;
  workflows: CustomWorkflow[];
  addWorkflow: (workflow: Omit<CustomWorkflow, 'id' | 'createdAt'>) => CustomWorkflow;
  updateWorkflow: (workflowId: string, patch: { name?: string; stages?: string[] }) => void;
  deleteWorkflow: (workflowId: string) => void;
  clearWorkflows: () => void;
  customCategories: string[];
  addCustomCategory: (categoryName: string) => void;
  renameCustomCategory: (oldName: string, newName: string) => void;
  deleteCustomCategory: (categoryName: string) => void;
  privateNotes: PrivateNote[];
  addPrivateNote: (note: Omit<PrivateNote, 'id' | 'updatedAt'>) => void;
  updatePrivateNote: (noteId: string, patch: Partial<Omit<PrivateNote, 'id'>>) => void;
  deletePrivateNote: (noteId: string) => void;
  clearPrivateNotes: () => void;
  dailyGoals: DailyGoalItem[];
  addDailyGoal: (title: string) => void;
  updateDailyGoal: (goalId: string, title: string) => void;
  toggleDailyGoal: (goalId: string) => void;
  deleteDailyGoal: (goalId: string) => void;
  clearDailyGoals: () => void;

  // Standard Live Category Workspaces
  liveBoards: LiveCategoryBoard[];
  setLiveBoards: React.Dispatch<React.SetStateAction<LiveCategoryBoard[]>>;
  addLiveBoard: (input: {
    name: string;
    description?: string;
    kind: LiveCategoryKind;
    metricLabel?: string;
  }) => LiveCategoryBoard;
  updateLiveBoardMeta: (
    boardId: string,
    patch: Partial<Pick<LiveCategoryBoard, 'name' | 'description' | 'kind' | 'metricLabel' | 'readOnlySheetUrl' | 'readOnlySheetTab'>>
  ) => void;
  deleteLiveBoard: (boardId: string) => void;
  importLiveBoardRecords: (
    boardId: string,
    records: LiveCategoryRecord[],
    mode?: 'append' | 'replace'
  ) => void;
  upsertLiveBoardRecord: (boardId: string, record: LiveCategoryRecord) => void;
  deleteLiveBoardRecord: (boardId: string, recordId: string) => void;
  clearLiveBoardRecords: (boardId: string) => void;
  saveLiveBoardReportToWorkspace: (
    boardName: string,
    reportText: string,
    recordCount: number
  ) => Promise<{ task: TaskItem; evidence: EvidenceItem }>;

  // Dual-Workspace & Collaboration helpers
  setCollaborationMode: (mode: CollaborationMode) => void;
  transferTaskToWorkspace: (taskId: string, targetWorkspaceId: string) => boolean;
  transferEvidenceToWorkspace: (evidenceId: string, targetWorkspaceId: string) => boolean;
  transferNoteToWorkspace: (noteId: string, targetWorkspaceId: string) => boolean;
  saveManualFallbackTask: (input: {
    title: string;
    description: string;
    taskKind?: TaskKind;
    category?: TaskCategory;
    priority?: TaskPriority;
    dueDate?: string;
    attachedNote?: string;
    targetScope?: 'active' | 'personal';
    preparedFile?: PreparedInboxFile | null;
    inboxSourceType?: InboxSourceType;
  }) => Promise<{ ok: boolean; task: TaskItem; targetWorkspace: Workspace }>;
  isTvDisplayOpen: boolean;
  setIsTvDisplayOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Governance, Audit Logs, Confirmed Clear & Backup
  auditLogs: AuditLogEntry[];
  recordAudit: (actionType: AuditLogEntry['actionType'], summary: string) => void;
  clearAuditLogs: () => void;
  clearWorkspaceSlice: (
    slice:
      | 'tasks'
      | 'queueItems'
      | 'labOrders'
      | 'followUps'
      | 'evidenceList'
      | 'inboxItems'
      | 'dentureCases'
      | 'satisfactionResponses'
  ) => Promise<void>;
  resetActiveWorkspaceDemoData: () => void;
  isJudgeDemoActive: boolean;
  setJudgeDemoMode: (active: boolean) => void;
  toggleJudgeDemoMode: () => void;
  exportActiveWorkspaceBackup: () => string;
  importActiveWorkspaceBackup: (rawJson: string) => {
    ok: boolean;
    importedCount: number;
    error?: string;
  };
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export function getWorkspaceDisplayName(ws: Workspace, language: Language): string {
  return ws.localized?.[language]?.name || ws.name;
}

export function getWorkspaceDisplayDescription(ws: Workspace, language: Language): string {
  return ws.localized?.[language]?.description || ws.description;
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspacesRegistry());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() =>
    loadActiveWorkspaceId(loadWorkspacesRegistry())
  );

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  const [scopedData, setScopedData] = useState<WorkspaceScopedData>(() =>
    loadWorkspaceData(activeWorkspace.id, activeWorkspace.type)
  );
  const [isDentureLoading, setIsDentureLoading] = useState<boolean>(false);
  const [dentureLoadError, setDentureLoadError] = useState<string | null>(null);
  const [isTvDisplayOpen, setIsTvDisplayOpen] = useState<boolean>(false);
  const [isJudgeDemoActive, setIsJudgeDemoActive] = useState<boolean>(false);
  const isJudgeDemoRef = useRef<boolean>(false);
  const preDemoWorkspaceIdRef = useRef<string | null>(null);

  // Guarded slice saver: NEVER touches real user localStorage while Judge Demo Mode is active
  const saveWorkspaceDataSlice = useCallback(
    <K extends keyof WorkspaceScopedData>(
      workspaceId: string,
      slice: K,
      value: WorkspaceScopedData[K]
    ): void => {
      if (isJudgeDemoRef.current) return;
      persistWorkspaceDataSlice(workspaceId, slice, value);
    },
    []
  );

  // Persist workspace registry whenever it changes
  useEffect(() => {
    saveWorkspacesRegistry(workspaces);
  }, [workspaces]);

  // Reload strictly partitioned data whenever active workspace changes
  useEffect(() => {
    if (!isJudgeDemoRef.current) {
      saveActiveWorkspaceId(activeWorkspace.id);
    }
    if (isJudgeDemoRef.current) {
      setScopedData(buildJudgeDemoWorkspaceData(activeWorkspace.id, activeWorkspace.type));
      setDentureLoadError(null);
      return;
    }
    const loaded = loadWorkspaceData(activeWorkspace.id, activeWorkspace.type);
    setScopedData(loaded);
    setDentureLoadError(null);
  }, [activeWorkspace.id, activeWorkspace.type]);

  // Cross-tab persistence synchronization (never overwrites saved storage or active Judge Demo)
  useEffect(() => {
    const onStorageChange = (e: StorageEvent) => {
      if (!e.key || isJudgeDemoRef.current) return;
      if (e.key === 'dental_platform_workspaces_v2') {
        setWorkspaces(loadWorkspacesRegistry());
        return;
      }
      if (
        e.key.startsWith(`dental_platform_ws_data_v2::${activeWorkspace.id}::`) ||
        e.key === 'clinic_assistant_real_data_v1'
      ) {
        setScopedData(loadWorkspaceData(activeWorkspace.id, activeWorkspace.type));
      }
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [activeWorkspace.id, activeWorkspace.type]);

  const setJudgeDemoMode = useCallback(
    (nextActive: boolean) => {
      isJudgeDemoRef.current = nextActive;
      setIsJudgeDemoActive(nextActive);
      if (nextActive) {
        clearJudgeDemoAuxStorage();
        if (preDemoWorkspaceIdRef.current === null) {
          preDemoWorkspaceIdRef.current = activeWorkspace.id;
        }
        const clinicWs =
          activeWorkspace.type === 'clinic'
            ? activeWorkspace
            : workspaces.find((w) => w.type === 'clinic') || activeWorkspace;

        if (clinicWs.id !== activeWorkspace.id) {
          setActiveWorkspaceId(clinicWs.id);
        }

        const demoData = buildJudgeDemoWorkspaceData(clinicWs.id, clinicWs.type);
        setScopedData(demoData);
        setDentureLoadError(null);
        try {
          const ch = new BroadcastChannel('dental_assistant_queue_tv');
          ch.postMessage({
            type: 'queue_updated',
            workspaceId: clinicWs.id,
            items: demoData.queueItems
          });
          ch.close();
        } catch {
          // ignore
        }
      } else {
        clearJudgeDemoAuxStorage();
        clearJudgeDemoPartitions();
        const restoreId = preDemoWorkspaceIdRef.current || activeWorkspace.id;
        preDemoWorkspaceIdRef.current = null;
        const restoreWs = workspaces.find((w) => w.id === restoreId) || activeWorkspace;

        if (restoreWs.id !== activeWorkspace.id) {
          setActiveWorkspaceId(restoreWs.id);
        }

        const realData = loadWorkspaceData(restoreWs.id, restoreWs.type);
        setScopedData(realData);
        setDentureLoadError(null);
        try {
          const ch = new BroadcastChannel('dental_assistant_queue_tv');
          ch.postMessage({
            type: 'queue_updated',
            workspaceId: restoreWs.id,
            items: realData.queueItems
          });
          ch.close();
        } catch {
          // ignore
        }
      }
    },
    [activeWorkspace, workspaces]
  );

  const toggleJudgeDemoMode = useCallback(() => {
    setJudgeDemoMode(!isJudgeDemoRef.current);
  }, [setJudgeDemoMode]);

  const currentRole: ClinicRole =
    activeWorkspace.type === 'personal' ? 'owner' : activeWorkspace.currentUserRole;

  const hasPermission = useCallback(
    (action: PermissionAction) => canPerform(currentRole, action, activeWorkspace.type),
    [currentRole, activeWorkspace.type]
  );

  const appendAudit = useCallback(
    (
      prevLogs: AuditLogEntry[],
      workspaceId: string,
      role: ClinicRole,
      actionType: AuditLogEntry['actionType'],
      summary: string
    ): AuditLogEntry[] => {
      const entry: AuditLogEntry = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowTimestamp(),
        workspaceId,
        actorName:
          activeWorkspace.type === 'personal'
            ? 'Owner (Personal)'
            : activeWorkspace.members.find((m) => m.role === role)?.name || role,
        actorRole: role,
        actionType,
        summary
      };
      const next = [entry, ...prevLogs].slice(0, 100);
      saveWorkspaceDataSlice(workspaceId, 'auditLogs', next);
      return next;
    },
    [activeWorkspace.members, activeWorkspace.type]
  );

  const recordAudit = useCallback(
    (actionType: AuditLogEntry['actionType'], summary: string) => {
      setScopedData((prev) => ({
        ...prev,
        auditLogs: appendAudit(prev.auditLogs, activeWorkspace.id, currentRole, actionType, summary)
      }));
    },
    [activeWorkspace.id, appendAudit, currentRole]
  );

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const target = workspaces.find((w) => w.id === workspaceId);
      if (!target || target.id === activeWorkspace.id) return;
      setActiveWorkspaceId(target.id);
    },
    [workspaces, activeWorkspace.id]
  );

  const updateWorkspaceMeta = useCallback(
    (workspaceId: string, patch: { name?: string; description?: string }): boolean => {
      const cleanName = patch.name?.trim();
      const cleanDesc = patch.description?.trim();
      if (patch.name !== undefined && !cleanName) return false;
      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== workspaceId) return w;
          return {
            ...w,
            ...(cleanName !== undefined ? { name: cleanName } : {}),
            ...(cleanDesc !== undefined ? { description: cleanDesc } : {}),
            localized: undefined
          };
        })
      );
      return true;
    },
    []
  );

  const deleteWorkspace = useCallback(
    (workspaceId: string): { ok: boolean; error?: string } => {
      if (workspaces.length <= 1) {
        return { ok: false, error: 'Cannot delete the only remaining workspace.' };
      }
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      if (remaining.length === workspaces.length) {
        return { ok: false, error: 'Workspace not found.' };
      }
      const targetData = loadWorkspaceData(
        workspaceId,
        workspaces.find((w) => w.id === workspaceId)?.type || 'clinic'
      );
      void Promise.all(
        targetData.evidenceList.map((e) => deleteEvidenceFile(e.id).catch(() => undefined))
      );
      deleteWorkspaceStoragePartition(workspaceId);
      setWorkspaces(remaining);
      if (activeWorkspaceId === workspaceId) {
        const nextActive = remaining[0];
        setActiveWorkspaceId(nextActive.id);
      }
      return { ok: true };
    },
    [activeWorkspaceId, workspaces]
  );

  const createClinicWorkspace = useCallback(
    (input: { name: string; description: string }) => {
      const cleanName = input.name.trim();
      if (!cleanName) {
        return { ok: false, error: 'Clinic name is required.' };
      }

      const today = new Date().toISOString().split('T')[0];
      const randNum = Math.floor(1000 + Math.random() * 8999);
      const id = `ws-clinic-${Date.now()}`;
      const newWs: Workspace = {
        id,
        type: 'clinic',
        name: cleanName,
        description:
          input.description.trim() ||
          'Isolated multi-tenant clinic workspace for team tasks, labs, and follow-ups.',
        tenantCode: `CLN-${randNum}`,
        planTier: 'clinic_standard',
        ownerId: 'mem-owner-local',
        currentUserRole: 'owner',
        members: [
          {
            id: 'mem-owner-local',
            name: 'Clinic Owner (You)',
            email: 'owner@clinic.local',
            initials: 'CO',
            role: 'owner',
            assignedRooms: ['All Rooms'],
            joinedAt: today,
            status: 'active'
          }
        ],
        rooms: ['Room 1 - General', 'Sterilization Bay'],
        enabledModules: buildDefaultEnabledModules('clinic'),
        createdAt: today
      };

      setWorkspaces((prev) => [...prev, newWs]);
      setActiveWorkspaceId(newWs.id);
      return { ok: true, workspace: newWs };
    },
    []
  );

  const joinClinicWorkspace = useCallback(
    (inviteCode: string, role: ClinicRole = 'assistant') => {
      const cleanCode = inviteCode.trim().toUpperCase();
      if (!cleanCode || cleanCode.length < 4) {
        return { ok: false, error: 'Please enter a valid clinic invite/tenant code (min 4 chars).' };
      }

      const existing = workspaces.find(
        (w) => w.type === 'clinic' && w.tenantCode.toUpperCase() === cleanCode
      );
      if (existing) {
        setActiveWorkspaceId(existing.id);
        return { ok: true, workspace: existing };
      }

      const joinedWs = buildSecondClinicWorkspace(cleanCode, role);
      setWorkspaces((prev) => [...prev, joinedWs]);
      setActiveWorkspaceId(joinedWs.id);
      return { ok: true, workspace: joinedWs };
    },
    [workspaces]
  );

  const setCurrentUserRole = useCallback(
    (role: ClinicRole) => {
      if (activeWorkspace.type === 'personal') return;
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspace.id ? { ...w, currentUserRole: role } : w))
      );
      recordAudit('role_change', `Active clinic role switched to ${role}`);
    },
    [activeWorkspace.id, activeWorkspace.type, recordAudit]
  );

  const toggleModule = useCallback(
    (moduleId: ModuleId, enabled: boolean): boolean => {
      if (!hasPermission('manage_modules')) return false;
      const def = getModuleDefinition(moduleId);
      if (!def || (!def.canDisable && !enabled)) return false;

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? {
                ...w,
                enabledModules: {
                  ...w.enabledModules,
                  [moduleId]: enabled
                }
              }
            : w
        )
      );
      recordAudit(
        'module_toggle',
        `Module "${moduleId}" ${enabled ? 'enabled' : 'disabled'} in workspace ${activeWorkspace.tenantCode}`
      );
      return true;
    },
    [activeWorkspace.id, activeWorkspace.tenantCode, hasPermission, recordAudit]
  );

  const addClinicMember = useCallback(
    (member: { name: string; email: string; role: ClinicRole; assignedRooms: string[] }): boolean => {
      if (activeWorkspace.type !== 'clinic' || !hasPermission('manage_members')) return false;
      const cleanName = member.name.trim();
      const cleanEmail = member.email.trim();
      if (!cleanName || !cleanEmail) return false;

      const initials = cleanName
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const newMember: WorkspaceMember = {
        id: `mem-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        initials: initials || 'DA',
        role: member.role,
        assignedRooms: member.assignedRooms,
        joinedAt: new Date().toISOString().split('T')[0],
        status: 'active'
      };

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id ? { ...w, members: [...w.members, newMember] } : w
        )
      );
      recordAudit('member_add', `Added clinic member ${cleanName} (${member.role})`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.type, hasPermission, recordAudit]
  );

  const updateClinicMemberRole = useCallback(
    (memberId: string, role: ClinicRole): boolean => {
      if (activeWorkspace.type !== 'clinic' || !hasPermission('manage_members')) return false;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? {
                ...w,
                members: w.members.map((m) => (m.id === memberId ? { ...m, role } : m))
              }
            : w
        )
      );
      recordAudit('role_change', `Updated member ${memberId} role to ${role}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.type, hasPermission, recordAudit]
  );

  const updateClinicMember = useCallback(
    (
      memberId: string,
      patch: { name?: string; email?: string; role?: ClinicRole; assignedRooms?: string[] }
    ): boolean => {
      if (activeWorkspace.type !== 'clinic' || !hasPermission('manage_members')) return false;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? {
                ...w,
                members: w.members.map((m) => {
                  if (m.id !== memberId) return m;
                  const nextName = patch.name !== undefined ? patch.name.trim() || m.name : m.name;
                  const initials = nextName
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                  return {
                    ...m,
                    name: nextName,
                    initials: initials || m.initials,
                    email: patch.email !== undefined ? patch.email.trim() || m.email : m.email,
                    role: patch.role ?? m.role,
                    assignedRooms: patch.assignedRooms ?? m.assignedRooms
                  };
                })
              }
            : w
        )
      );
      recordAudit('settings_update', `Updated member ${memberId}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.type, hasPermission, recordAudit]
  );

  const deleteClinicMember = useCallback(
    (memberId: string): boolean => {
      if (activeWorkspace.type !== 'clinic' || !hasPermission('manage_members')) return false;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? { ...w, members: w.members.filter((m) => m.id !== memberId) }
            : w
        )
      );
      recordAudit('settings_update', `Removed member ${memberId}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.type, hasPermission, recordAudit]
  );

  const addClinicRoom = useCallback(
    (roomName: string): boolean => {
      const clean = roomName.trim();
      if (activeWorkspace.type !== 'clinic' || !clean || !hasPermission('manage_settings')) {
        return false;
      }
      if (activeWorkspace.rooms.includes(clean)) return false;
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id ? { ...w, rooms: [...w.rooms, clean] } : w
        )
      );
      recordAudit('settings_update', `Added clinical room: ${clean}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.rooms, activeWorkspace.type, hasPermission, recordAudit]
  );

  const updateClinicRoom = useCallback(
    (oldRoomName: string, newRoomName: string): boolean => {
      const clean = newRoomName.trim();
      if (
        activeWorkspace.type !== 'clinic' ||
        !clean ||
        !hasPermission('manage_settings') ||
        (oldRoomName !== clean && activeWorkspace.rooms.includes(clean))
      ) {
        return false;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? {
                ...w,
                rooms: w.rooms.map((r) => (r === oldRoomName ? clean : r)),
                members: w.members.map((m) => ({
                  ...m,
                  assignedRooms: m.assignedRooms.map((r) => (r === oldRoomName ? clean : r))
                }))
              }
            : w
        )
      );
      recordAudit('settings_update', `Renamed room "${oldRoomName}" to "${clean}"`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.rooms, activeWorkspace.type, hasPermission, recordAudit]
  );

  const deleteClinicRoom = useCallback(
    (roomName: string): boolean => {
      if (activeWorkspace.type !== 'clinic' || !hasPermission('manage_settings')) {
        return false;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id
            ? {
                ...w,
                rooms: w.rooms.filter((r) => r !== roomName),
                members: w.members.map((m) => ({
                  ...m,
                  assignedRooms: m.assignedRooms.filter((r) => r !== roomName)
                }))
              }
            : w
        )
      );
      recordAudit('settings_update', `Deleted clinical room: ${roomName}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.type, hasPermission, recordAudit]
  );

  // Scoped setters bound strictly to activeWorkspace.id
  const setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextTasks = typeof updater === 'function' ? updater(prev.tasks) : updater;
        const tagged = nextTasks.map((t) => ({ ...t, workspaceId: targetWsId }));
        saveWorkspaceDataSlice(targetWsId, 'tasks', tagged);
        return { ...prev, tasks: tagged };
      });
    },
    [activeWorkspace.id]
  );

  const setQueueItems: React.Dispatch<React.SetStateAction<QueueItem[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextQueue = typeof updater === 'function' ? updater(prev.queueItems) : updater;
        saveWorkspaceDataSlice(targetWsId, 'queueItems', nextQueue);
        try {
          const ch = new BroadcastChannel('dental_assistant_queue_tv');
          ch.postMessage({ type: 'queue_updated', workspaceId: targetWsId, items: nextQueue });
          ch.close();
        } catch {
          // BroadcastChannel optional on older WebViews
        }
        return { ...prev, queueItems: nextQueue };
      });
    },
    [activeWorkspace.id]
  );

  const setLabOrders: React.Dispatch<React.SetStateAction<LabOrder[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.labOrders) : updater;
        saveWorkspaceDataSlice(targetWsId, 'labOrders', next);
        return { ...prev, labOrders: next };
      });
    },
    [activeWorkspace.id]
  );

  const setFollowUps: React.Dispatch<React.SetStateAction<PatientFollowUpItem[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.followUps) : updater;
        saveWorkspaceDataSlice(targetWsId, 'followUps', next);
        return { ...prev, followUps: next };
      });
    },
    [activeWorkspace.id]
  );

  const setEvidenceList: React.Dispatch<React.SetStateAction<EvidenceItem[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.evidenceList) : updater;
        saveWorkspaceDataSlice(targetWsId, 'evidenceList', next);
        return { ...prev, evidenceList: next };
      });
    },
    [activeWorkspace.id]
  );

  const setInboxItems: React.Dispatch<React.SetStateAction<InboxItem[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.inboxItems) : updater;
        saveWorkspaceDataSlice(targetWsId, 'inboxItems', next);
        return { ...prev, inboxItems: next };
      });
    },
    [activeWorkspace.id]
  );

  const setDentureCases: React.Dispatch<React.SetStateAction<DentureCase[]>> = useCallback(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.dentureCases) : updater;
        saveWorkspaceDataSlice(targetWsId, 'dentureCases', next);
        return { ...prev, dentureCases: next };
      });
    },
    [activeWorkspace.id]
  );

  const updateSheetConfig = useCallback(
    (cfg: SheetConfig) => {
      const targetWsId = activeWorkspace.id;
      if (activeWorkspace.type === 'clinic' && !isJudgeDemoRef.current) {
        saveSheetConfig(cfg);
      }
      setScopedData((prev) => {
        saveWorkspaceDataSlice(targetWsId, 'sheetConfig', cfg);
        const syncedSettings: SatisfactionSettings = {
          ...prev.satisfactionSettings,
          surveyUrl:
            cfg.satisfactionFormUrl !== undefined
              ? cfg.satisfactionFormUrl
              : prev.satisfactionSettings.surveyUrl,
          rawSheetTabName:
            cfg.satisfactionRawTabName !== undefined && cfg.satisfactionRawTabName.trim()
              ? cfg.satisfactionRawTabName.trim()
              : prev.satisfactionSettings.rawSheetTabName
        };
        saveWorkspaceDataSlice(targetWsId, 'satisfactionSettings', syncedSettings);
        return { ...prev, sheetConfig: cfg, satisfactionSettings: syncedSettings };
      });
      recordAudit('settings_update', 'Updated workspace Google Sheet connection');
    },
    [activeWorkspace.id, activeWorkspace.type, recordAudit]
  );

  const setSatisfactionResponses: React.Dispatch<React.SetStateAction<SatisfactionResponse[]>> =
    useCallback(
      (updater) => {
        const targetWsId = activeWorkspace.id;
        setScopedData((prev) => {
          const next =
            typeof updater === 'function' ? updater(prev.satisfactionResponses) : updater;
          saveWorkspaceDataSlice(targetWsId, 'satisfactionResponses', next);
          return { ...prev, satisfactionResponses: next };
        });
      },
      [activeWorkspace.id]
    );

  const updateSatisfactionSettings = useCallback(
    (patch: Partial<SatisfactionSettings>) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextSettings: SatisfactionSettings = {
          ...prev.satisfactionSettings,
          ...patch
        };
        saveWorkspaceDataSlice(targetWsId, 'satisfactionSettings', nextSettings);
        const nextSheetCfg: SheetConfig = {
          ...prev.sheetConfig,
          satisfactionFormUrl: nextSettings.surveyUrl,
          satisfactionRawTabName: nextSettings.rawSheetTabName
        };
        saveWorkspaceDataSlice(targetWsId, 'sheetConfig', nextSheetCfg);
        if (activeWorkspace.type === 'clinic' && !isJudgeDemoRef.current) {
          saveSheetConfig(nextSheetCfg);
        }
        return {
          ...prev,
          satisfactionSettings: nextSettings,
          sheetConfig: nextSheetCfg
        };
      });
    },
    [activeWorkspace.id, activeWorkspace.type]
  );

  const updateChatState = useCallback(
    (
      patch: Partial<WorkspaceChatState> | ((prev: WorkspaceChatState) => WorkspaceChatState)
    ) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const base = prev.chatState || createDefaultWorkspaceChatState();
        const next = typeof patch === 'function' ? patch(base) : { ...base, ...patch };
        saveWorkspaceDataSlice(targetWsId, 'chatState', next);
        return { ...prev, chatState: next };
      });
    },
    [activeWorkspace.id]
  );

  const createFollowUpFromSatisfaction = useCallback(
    (
      response: SatisfactionResponse,
      aiRec?: SatisfactionCallbackRecommendation
    ): TaskItem => {
      const nowMs = Date.now();
      const today = new Date(nowMs).toISOString().split('T')[0];
      const tomorrow = new Date(nowMs + 86_400_000).toISOString().split('T')[0];
      const nowStamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 16);
      const serviceLabel = PROCEDURE_LABELS_TH[response.serviceType] || 'ทันตกรรมทั่วไป';
      const refCode = response.patientRef || `QR-${response.id.slice(-4).toUpperCase()}`;
      const taskId = `task-sat-cb-${nowMs}`;

      const title =
        aiRec?.suggestedTitle?.trim() ||
        `[ติดต่อกลับผลประเมิน] ${refCode} (${serviceLabel})`;
      const descParts = [
        aiRec?.suggestedAction?.trim() ||
          `คนไข้ระบุ "ต้องการให้คลินิกติดต่อกลับ" จากแบบประเมินบริการ ${serviceLabel}`,
        response.callbackTopic ? `ประเด็นติดต่อกลับ: ${response.callbackTopic}` : '',
        response.comment ? `ความคิดเห็นจากแบบประเมิน: "${response.comment}"` : '',
        `คะแนนรวม: ${response.scores.overallExperience}/5 (ส่งเมื่อ ${response.submittedAt})`
      ].filter(Boolean);

      const newTask: TaskItem = {
        id: taskId,
        workspaceId: activeWorkspace.id,
        taskKind: 'followup',
        title,
        description: descParts.join('\n'),
        attachedNote: `คัดกรองอัตโนมัติจากผลประเมิน QR (${serviceLabel})`,
        category: 'Patient Follow-up',
        priority: aiRec?.priority || (response.scores.overallExperience <= 3 ? 'Urgent' : 'High'),
        status: 'New',
        createdDate: today,
        dueDate: tomorrow,
        relatedPatientId: refCode,
        relatedDocuments: [],
        evidenceIds: [],
        activityHistory: [
          {
            id: `act-sat-${nowMs}`,
            timestamp: nowStamp,
            action: 'สร้างงานติดตามจากเคสขอติดต่อกลับ (แบบประเมิน QR)',
            user: locales.th.assistantSelf,
            localized: {
              th: {
                action: 'สร้างงานติดตามจากเคสขอติดต่อกลับ (แบบประเมิน QR)',
                user: locales.th.assistantSelf
              },
              en: {
                action: 'Created callback follow-up task from Satisfaction QR response',
                user: locales.en.assistantSelf
              }
            }
          }
        ],
        isDemo: response.isDemo
      };

      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextTasks = [newTask, ...prev.tasks];
        const nextResponses = prev.satisfactionResponses.map((r) =>
          r.id === response.id ? { ...r, triageStatus: 'followup_created' as const, linkedTaskId: taskId } : r
        );
        let nextFollowUps = prev.followUps;
        if (activeWorkspace.enabledModules.followups !== false) {
          const fuItem: PatientFollowUpItem = {
            id: `fu-sat-${nowMs}`,
            patientRefId: refCode,
            caseCategory: `Callback Survey (${serviceLabel})`,
            followUpReason:
              response.callbackTopic || response.comment || 'ต้องการให้คลินิกติดต่อกลับ',
            nextAction: aiRec?.suggestedAction || 'โทร/แชตติดต่อกลับคนไข้และบันทึกผล',
            dueDate: tomorrow,
            status: 'Pending',
            relatedEvidenceIds: [],
            isDemo: response.isDemo
          };
          nextFollowUps = [fuItem, ...prev.followUps];
          saveWorkspaceDataSlice(targetWsId, 'followUps', nextFollowUps);
        }
        saveWorkspaceDataSlice(targetWsId, 'tasks', nextTasks);
        saveWorkspaceDataSlice(targetWsId, 'satisfactionResponses', nextResponses);
        return {
          ...prev,
          tasks: nextTasks,
          followUps: nextFollowUps,
          satisfactionResponses: nextResponses
        };
      });

      recordAudit('task_create', `Created callback follow-up task for satisfaction ${refCode}`);
      return newTask;
    },
    [activeWorkspace.id, activeWorkspace.type, recordAudit]
  );

  const saveExecutiveReportToWorkspace = useCallback(
    async (
      reportText: string,
      responsesCount: number,
      monthKey: string
    ): Promise<{ task: TaskItem; evidence: EvidenceItem }> => {
      const nowMs = Date.now();
      const today = new Date(nowMs).toISOString().split('T')[0];
      const nowStamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
      const fileName = `executive-satisfaction-report-${monthKey}-${nowMs}.txt`;
      const evId = `ev-exec-${nowMs}`;
      const taskId = `task-exec-${nowMs}`;

      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      let storedOk = false;
      try {
        await saveEvidenceFile(evId, blob, fileName, 'text/plain', nowStamp);
        storedOk = true;
      } catch {
        storedOk = false;
      }

      const evidence: EvidenceItem = {
        id: evId,
        originalFilename: fileName,
        fileType: 'document',
        uploadDateTime: nowStamp.slice(0, 16),
        receivedTimestamp: nowStamp,
        relatedTaskId: taskId,
        description: `รายงานสรุปความพึงพอใจสำหรับผู้บริหาร (${monthKey}, ${responsesCount} ราย)`,
        fileSize: `${Math.max(1, Math.round(blob.size / 1024))} KB`,
        mimeType: 'text/plain',
        hasStoredFile: storedOk,
        isDemo: false
      };

      const task: TaskItem = {
        id: taskId,
        workspaceId: activeWorkspace.id,
        taskKind: 'todo',
        title: `[ส่งผู้บริหาร] สรุปรายงานความพึงพอใจเดือน ${monthKey} (${responsesCount} ราย)`,
        description: reportText,
        attachedNote: 'สร้างรายงานอัตโนมัติพร้อมไฟล์แนบในคลังหลักฐาน',
        category: 'Record Keeping',
        priority: 'Medium',
        status: 'New',
        createdDate: today,
        dueDate: today,
        relatedDocuments: [fileName],
        evidenceIds: [evId],
        attachmentEvidenceId: evId,
        activityHistory: [
          {
            id: `act-exec-${nowMs}`,
            timestamp: nowStamp.slice(0, 16),
            action: 'บันทึกรายงานสรุปส่งผู้บริหารลงงานและคลังหลักฐาน',
            user: locales.th.assistantSelf,
            localized: {
              th: {
                action: 'บันทึกรายงานสรุปส่งผู้บริหารลงงานและคลังหลักฐาน',
                user: locales.th.assistantSelf
              },
              en: {
                action: 'Saved Executive Satisfaction Brief to tasks & evidence vault',
                user: locales.en.assistantSelf
              }
            }
          }
        ],
        isDemo: false
      };

      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextTasks = [task, ...prev.tasks];
        const nextEv = [evidence, ...prev.evidenceList];
        saveWorkspaceDataSlice(targetWsId, 'tasks', nextTasks);
        saveWorkspaceDataSlice(targetWsId, 'evidenceList', nextEv);
        return {
          ...prev,
          tasks: nextTasks,
          evidenceList: nextEv
        };
      });

      recordAudit('task_create', `Saved executive satisfaction brief for ${monthKey}`);
      return { task, evidence };
    },
    [activeWorkspace.id, recordAudit]
  );

  const refreshDentureCases = useCallback(
    async (cfgOverride?: SheetConfig) => {
      if (isJudgeDemoRef.current) {
        return;
      }
      const activeCfg = cfgOverride || scopedData.sheetConfig;
      if (!activeCfg.webAppUrl.trim()) {
        // Standby mode: preserve local temporary browser cases without fetching external demo data
        return;
      }
      setIsDentureLoading(true);
      setDentureLoadError(null);
      const res = await fetchDentureCases(activeCfg);
      setIsDentureLoading(false);
      if (res.ok) {
        setDentureCases(res.rows);
      } else {
        setDentureLoadError(res.error || 'Failed to load Denture Recall cases');
      }
    },
    [scopedData.sheetConfig, setDentureCases]
  );

  // Sync live sheet cases ONLY when a real Web App URL is configured
  useEffect(() => {
    if (activeWorkspace.enabledModules.denture !== false) {
      if (scopedData.sheetConfig.webAppUrl.trim()) {
        void refreshDentureCases(scopedData.sheetConfig);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace.id, scopedData.sheetConfig.webAppUrl]);

  // Templates, Workflows, Custom Categories & Private Notes (Full CRUD + Clear)
  const addTemplate = useCallback(
    (input: Omit<TaskTemplate, 'id' | 'createdAt'>): TaskTemplate => {
      const created: TaskTemplate = {
        ...input,
        id: `tmpl-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = [created, ...prev.templates];
        saveWorkspaceDataSlice(targetWsId, 'templates', next);
        return { ...prev, templates: next };
      });
      recordAudit('template_create', `Created task template "${created.name}"`);
      return created;
    },
    [activeWorkspace.id, recordAudit]
  );

  const updateTemplate = useCallback(
    (templateId: string, patch: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.templates.map((t) => (t.id === templateId ? { ...t, ...patch } : t));
        saveWorkspaceDataSlice(targetWsId, 'templates', next);
        return { ...prev, templates: next };
      });
      recordAudit('task_update', `Updated template ${templateId}`);
    },
    [activeWorkspace.id, recordAudit]
  );

  const deleteTemplate = useCallback(
    (templateId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.templates.filter((t) => t.id !== templateId);
        saveWorkspaceDataSlice(targetWsId, 'templates', next);
        return { ...prev, templates: next };
      });
    },
    [activeWorkspace.id]
  );

  const clearTemplates = useCallback(() => {
    const targetWsId = activeWorkspace.id;
    setScopedData((prev) => {
      saveWorkspaceDataSlice(targetWsId, 'templates', []);
      return { ...prev, templates: [] };
    });
    recordAudit('settings_update', 'Cleared all templates in workspace');
  }, [activeWorkspace.id, recordAudit]);

  const addWorkflow = useCallback(
    (input: Omit<CustomWorkflow, 'id' | 'createdAt'>): CustomWorkflow => {
      const created: CustomWorkflow = {
        ...input,
        id: `wf-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = [created, ...prev.workflows];
        saveWorkspaceDataSlice(targetWsId, 'workflows', next);
        return { ...prev, workflows: next };
      });
      recordAudit('workflow_create', `Created custom workflow "${created.name}"`);
      return created;
    },
    [activeWorkspace.id, recordAudit]
  );

  const updateWorkflow = useCallback(
    (workflowId: string, patch: { name?: string; stages?: string[] }) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.workflows.map((wf) =>
          wf.id === workflowId
            ? {
                ...wf,
                name: patch.name !== undefined ? patch.name.trim() || wf.name : wf.name,
                stages: patch.stages !== undefined && patch.stages.length > 0 ? patch.stages : wf.stages
              }
            : wf
        );
        saveWorkspaceDataSlice(targetWsId, 'workflows', next);
        return { ...prev, workflows: next };
      });
      recordAudit('settings_update', `Updated workflow ${workflowId}`);
    },
    [activeWorkspace.id, recordAudit]
  );

  const deleteWorkflow = useCallback(
    (workflowId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.workflows.filter((wf) => wf.id !== workflowId);
        saveWorkspaceDataSlice(targetWsId, 'workflows', next);
        return { ...prev, workflows: next };
      });
    },
    [activeWorkspace.id]
  );

  const clearWorkflows = useCallback(() => {
    const targetWsId = activeWorkspace.id;
    setScopedData((prev) => {
      saveWorkspaceDataSlice(targetWsId, 'workflows', []);
      return { ...prev, workflows: [] };
    });
    recordAudit('settings_update', 'Cleared all workflows in workspace');
  }, [activeWorkspace.id, recordAudit]);

  const addCustomCategory = useCallback(
    (categoryName: string) => {
      const clean = categoryName.trim();
      if (!clean) return;
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        if (prev.customCategories.includes(clean)) return prev;
        const next = [...prev.customCategories, clean];
        saveWorkspaceDataSlice(targetWsId, 'customCategories', next);
        return { ...prev, customCategories: next };
      });
    },
    [activeWorkspace.id]
  );

  const renameCustomCategory = useCallback(
    (oldName: string, newName: string) => {
      const clean = newName.trim();
      if (!clean || oldName === clean) return;
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.customCategories.map((c) => (c === oldName ? clean : c));
        saveWorkspaceDataSlice(targetWsId, 'customCategories', next);
        return { ...prev, customCategories: next };
      });
    },
    [activeWorkspace.id]
  );

  const deleteCustomCategory = useCallback(
    (categoryName: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.customCategories.filter((c) => c !== categoryName);
        saveWorkspaceDataSlice(targetWsId, 'customCategories', next);
        return { ...prev, customCategories: next };
      });
    },
    [activeWorkspace.id]
  );

  const addPrivateNote = useCallback(
    (note: Omit<PrivateNote, 'id' | 'updatedAt'>) => {
      const created: PrivateNote = {
        ...note,
        id: `note-${Date.now()}`,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = [created, ...prev.privateNotes];
        saveWorkspaceDataSlice(targetWsId, 'privateNotes', next);
        return { ...prev, privateNotes: next };
      });
    },
    [activeWorkspace.id]
  );

  const updatePrivateNote = useCallback(
    (noteId: string, patch: Partial<Omit<PrivateNote, 'id'>>) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.privateNotes.map((n) =>
          n.id === noteId
            ? { ...n, ...patch, updatedAt: new Date().toISOString().split('T')[0] }
            : n
        );
        saveWorkspaceDataSlice(targetWsId, 'privateNotes', next);
        return { ...prev, privateNotes: next };
      });
    },
    [activeWorkspace.id]
  );

  const deletePrivateNote = useCallback(
    (noteId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.privateNotes.filter((n) => n.id !== noteId);
        saveWorkspaceDataSlice(targetWsId, 'privateNotes', next);
        return { ...prev, privateNotes: next };
      });
    },
    [activeWorkspace.id]
  );

  const clearPrivateNotes = useCallback(() => {
    const targetWsId = activeWorkspace.id;
    setScopedData((prev) => {
      saveWorkspaceDataSlice(targetWsId, 'privateNotes', []);
      return { ...prev, privateNotes: [] };
    });
  }, [activeWorkspace.id]);

  const addDailyGoal = useCallback(
    (title: string) => {
      const clean = title.trim();
      if (!clean) return;
      const created: DailyGoalItem = {
        id: `goal-${Date.now()}`,
        title: clean,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = [created, ...prev.dailyGoals];
        saveWorkspaceDataSlice(targetWsId, 'dailyGoals', next);
        return { ...prev, dailyGoals: next };
      });
    },
    [activeWorkspace.id]
  );

  const updateDailyGoal = useCallback(
    (goalId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.dailyGoals.map((g) => (g.id === goalId ? { ...g, title: clean } : g));
        saveWorkspaceDataSlice(targetWsId, 'dailyGoals', next);
        return { ...prev, dailyGoals: next };
      });
    },
    [activeWorkspace.id]
  );

  const toggleDailyGoal = useCallback(
    (goalId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.dailyGoals.map((g) =>
          g.id === goalId ? { ...g, completed: !g.completed } : g
        );
        saveWorkspaceDataSlice(targetWsId, 'dailyGoals', next);
        return { ...prev, dailyGoals: next };
      });
    },
    [activeWorkspace.id]
  );

  const deleteDailyGoal = useCallback(
    (goalId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.dailyGoals.filter((g) => g.id !== goalId);
        saveWorkspaceDataSlice(targetWsId, 'dailyGoals', next);
        return { ...prev, dailyGoals: next };
      });
    },
    [activeWorkspace.id]
  );

  const clearDailyGoals = useCallback(() => {
    const targetWsId = activeWorkspace.id;
    setScopedData((prev) => {
      saveWorkspaceDataSlice(targetWsId, 'dailyGoals', []);
      return { ...prev, dailyGoals: [] };
    });
  }, [activeWorkspace.id]);

  // Standard Live Category Workspaces (Stock, Extraction/Denture Follow-up, Custom Categories)
  const setLiveBoards = useCallback<React.Dispatch<React.SetStateAction<LiveCategoryBoard[]>>>(
    (updater) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = typeof updater === 'function' ? updater(prev.liveBoards) : updater;
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
    },
    [activeWorkspace.id]
  );

  const addLiveBoard = useCallback(
    (input: {
      name: string;
      description?: string;
      kind: LiveCategoryKind;
      metricLabel?: string;
    }): LiveCategoryBoard => {
      const cleanName = input.name.trim() || 'หมวดงานใหม่';
      const created: LiveCategoryBoard = {
        id: `board-${Date.now()}`,
        name: cleanName,
        description: input.description?.trim() || undefined,
        kind: input.kind,
        metricLabel: input.metricLabel?.trim() || undefined,
        createdAt: new Date().toISOString().split('T')[0],
        records: []
      };
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = [...prev.liveBoards, created];
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
      recordAudit('template_create', `Created live category board "${cleanName}"`);
      return created;
    },
    [activeWorkspace.id, recordAudit]
  );

  const updateLiveBoardMeta = useCallback(
    (
      boardId: string,
      patch: Partial<
        Pick<
          LiveCategoryBoard,
          'name' | 'description' | 'kind' | 'metricLabel' | 'readOnlySheetUrl' | 'readOnlySheetTab'
        >
      >
    ) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.map((b) => (b.id === boardId ? { ...b, ...patch } : b));
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
    },
    [activeWorkspace.id]
  );

  const deleteLiveBoard = useCallback(
    (boardId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.filter((b) => b.id !== boardId);
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
      recordAudit('settings_update', `Deleted live category board ${boardId}`);
    },
    [activeWorkspace.id, recordAudit]
  );

  const importLiveBoardRecords = useCallback(
    (boardId: string, records: LiveCategoryRecord[], mode: 'append' | 'replace' = 'append') => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.map((b) => {
          if (b.id !== boardId) return b;
          const normalized = records.map((r) => ({ ...r, boardId }));
          return {
            ...b,
            records: mode === 'replace' ? normalized : [...normalized, ...b.records]
          };
        });
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
      recordAudit('task_create', `Imported ${records.length} rows into live board ${boardId}`);
    },
    [activeWorkspace.id, recordAudit]
  );

  const upsertLiveBoardRecord = useCallback(
    (boardId: string, record: LiveCategoryRecord) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.map((b) => {
          if (b.id !== boardId) return b;
          const exists = b.records.some((r) => r.id === record.id);
          const nextRecords = exists
            ? b.records.map((r) => (r.id === record.id ? { ...record, boardId } : r))
            : [{ ...record, boardId }, ...b.records];
          return { ...b, records: nextRecords };
        });
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
    },
    [activeWorkspace.id]
  );

  const deleteLiveBoardRecord = useCallback(
    (boardId: string, recordId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.map((b) =>
          b.id === boardId ? { ...b, records: b.records.filter((r) => r.id !== recordId) } : b
        );
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
    },
    [activeWorkspace.id]
  );

  const clearLiveBoardRecords = useCallback(
    (boardId: string) => {
      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const next = prev.liveBoards.map((b) =>
          b.id === boardId ? { ...b, records: [] } : b
        );
        saveWorkspaceDataSlice(targetWsId, 'liveBoards', next);
        return { ...prev, liveBoards: next };
      });
      recordAudit('settings_update', `Cleared records in live board ${boardId}`);
    },
    [activeWorkspace.id, recordAudit]
  );

  const saveLiveBoardReportToWorkspace = useCallback(
    async (
      boardName: string,
      reportText: string,
      recordCount: number
    ): Promise<{ task: TaskItem; evidence: EvidenceItem }> => {
      const nowMs = Date.now();
      const today = new Date(nowMs).toISOString().split('T')[0];
      const nowStamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
      const evId = `ev-board-rep-${nowMs}`;
      const taskId = `task-board-rep-${nowMs}`;
      const safeName = boardName.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 32) || 'category';
      const fileName = `report_${safeName}_${today}.txt`;

      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      let storedOk = false;
      try {
        await saveEvidenceFile(evId, blob, fileName, 'text/plain', nowStamp);
        storedOk = true;
      } catch {
        storedOk = false;
      }

      const evidence: EvidenceItem = {
        id: evId,
        originalFilename: fileName,
        fileType: 'document',
        uploadDateTime: nowStamp.slice(0, 16),
        receivedTimestamp: nowStamp,
        relatedTaskId: taskId,
        description: `รายงานสรุปหมวดงาน: ${boardName} (${recordCount} รายการ)`,
        fileSize: `${Math.max(1, Math.round(blob.size / 1024))} KB`,
        mimeType: 'text/plain',
        hasStoredFile: storedOk,
        isDemo: false
      };

      const task: TaskItem = {
        id: taskId,
        workspaceId: activeWorkspace.id,
        taskKind: 'todo',
        title: `[สรุปหมวดงาน] ${boardName} (${recordCount} รายการ)`,
        description: reportText,
        attachedNote: 'สร้างรายงานอัตโนมัติจากหน้าหมวดงานมาตรฐาน',
        category: 'Record Keeping',
        priority: 'Medium',
        status: 'New',
        createdDate: today,
        dueDate: today,
        relatedDocuments: [fileName],
        evidenceIds: [evId],
        attachmentEvidenceId: evId,
        activityHistory: [
          {
            id: `act-brep-${nowMs}`,
            timestamp: nowStamp.slice(0, 16),
            action: `บันทึกรายงานสรุปหมวด "${boardName}" ลงงานและคลังหลักฐาน`,
            user: locales.th.assistantSelf,
            localized: {
              th: {
                action: `บันทึกรายงานสรุปหมวด "${boardName}" ลงงานและคลังหลักฐาน`,
                user: locales.th.assistantSelf
              },
              en: {
                action: `Saved category report "${boardName}" to tasks & evidence vault`,
                user: locales.en.assistantSelf
              }
            }
          }
        ],
        isDemo: false
      };

      const targetWsId = activeWorkspace.id;
      setScopedData((prev) => {
        const nextTasks = [task, ...prev.tasks];
        const nextEv = [evidence, ...prev.evidenceList];
        saveWorkspaceDataSlice(targetWsId, 'tasks', nextTasks);
        saveWorkspaceDataSlice(targetWsId, 'evidenceList', nextEv);
        return {
          ...prev,
          tasks: nextTasks,
          evidenceList: nextEv
        };
      });

      recordAudit('task_create', `Saved category report for "${boardName}"`);
      return { task, evidence };
    },
    [activeWorkspace.id, recordAudit]
  );

  const setCollaborationMode = useCallback(
    (mode: CollaborationMode) => {
      if (activeWorkspace.type !== 'clinic') return;
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspace.id ? { ...w, collaborationMode: mode } : w))
      );
      recordAudit('settings_update', `Switched Assistant Workspace mode to ${mode}`);
    },
    [activeWorkspace.id, activeWorkspace.type, recordAudit]
  );

  const transferTaskToWorkspace = useCallback(
    (taskId: string, targetWorkspaceId: string): boolean => {
      const targetWs = workspaces.find((w) => w.id === targetWorkspaceId);
      const sourceTask = scopedData.tasks.find((t) => t.id === taskId);
      if (!targetWs || !sourceTask || targetWs.id === activeWorkspace.id) return false;

      const targetData = loadWorkspaceData(targetWs.id, targetWs.type);
      const copiedTask: TaskItem = {
        ...sourceTask,
        id: `task-copy-${Date.now()}`,
        workspaceId: targetWs.id,
        isDemo: false,
        activityHistory: [
          ...sourceTask.activityHistory,
          {
            id: `act-tr-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            action: `คัดลอกจาก ${activeWorkspace.name}`,
            user: 'ผู้ช่วยทันตแพทย์',
            localized: {
              th: { action: `คัดลอกมาจาก ${activeWorkspace.localized?.th?.name || activeWorkspace.name}`, user: 'ผู้ช่วยทันตแพทย์' },
              en: { action: `Copied from ${activeWorkspace.localized?.en?.name || activeWorkspace.name}`, user: 'Dental Assistant' }
            }
          }
        ]
      };
      saveWorkspaceDataSlice(targetWs.id, 'tasks', [copiedTask, ...targetData.tasks]);
      recordAudit('task_create', `Transferred copy of "${sourceTask.title}" to ${targetWs.tenantCode}`);
      return true;
    },
    [activeWorkspace.id, activeWorkspace.localized, activeWorkspace.name, recordAudit, scopedData.tasks, workspaces]
  );

  const transferEvidenceToWorkspace = useCallback(
    (evidenceId: string, targetWorkspaceId: string): boolean => {
      const targetWs = workspaces.find((w) => w.id === targetWorkspaceId);
      const sourceEv = scopedData.evidenceList.find((e) => e.id === evidenceId);
      if (!targetWs || !sourceEv || targetWs.id === activeWorkspace.id) return false;

      const targetData = loadWorkspaceData(targetWs.id, targetWs.type);
      const copiedId = `ev-copy-${Date.now()}`;
      const copiedEv: EvidenceItem = {
        ...sourceEv,
        id: copiedId,
        isDemo: false
      };
      if (sourceEv.hasStoredFile) {
        void getEvidenceFile(sourceEv.id)
          .then((stored) => {
            if (!stored) return;
            return saveEvidenceFile(
              copiedId,
              stored.blob,
              stored.filename,
              stored.mimeType,
              stored.receivedAt
            );
          })
          .catch(() => {
            // Ignore IndexedDB copy failure if unavailable
          });
      }
      saveWorkspaceDataSlice(targetWs.id, 'evidenceList', [copiedEv, ...targetData.evidenceList]);
      recordAudit('settings_update', `Transferred evidence "${sourceEv.originalFilename}" to ${targetWs.tenantCode}`);
      return true;
    },
    [activeWorkspace.id, recordAudit, scopedData.evidenceList, workspaces]
  );

  const saveManualFallbackTask = useCallback(
    async (input: {
      title: string;
      description: string;
      taskKind?: TaskKind;
      category?: TaskCategory;
      priority?: TaskPriority;
      dueDate?: string;
      attachedNote?: string;
      targetScope?: 'active' | 'personal';
      preparedFile?: PreparedInboxFile | null;
      inboxSourceType?: InboxSourceType;
    }): Promise<{ ok: boolean; task: TaskItem; targetWorkspace: Workspace }> => {
      const targetWs =
        input.targetScope === 'personal'
          ? workspaces.find((w) => w.type === 'personal') || activeWorkspace
          : activeWorkspace;

      const isTargetActive = targetWs.id === activeWorkspace.id;
      const nowMs = Date.now();
      const today = new Date(nowMs).toISOString().split('T')[0];
      const nowStamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
      const taskId = `task-local-${nowMs}`;

      const linkedEvidenceIds: string[] = [];
      const linkedDocNames: string[] = [];
      let createdEvidence: EvidenceItem | null = null;

      if (input.preparedFile) {
        const evId = `ev-local-${nowMs}`;
        const fileObj = input.preparedFile.file;
        let storedOk = false;
        try {
          await saveEvidenceFile(
            evId,
            fileObj,
            fileObj.name,
            input.preparedFile.mimeType,
            nowStamp
          );
          storedOk = true;
        } catch {
          storedOk = false;
        }

        createdEvidence = {
          id: evId,
          originalFilename: fileObj.name,
          fileType: input.preparedFile.evidenceFileType,
          uploadDateTime: nowStamp.slice(0, 16),
          receivedTimestamp: nowStamp,
          relatedTaskId: taskId,
          description: input.title.trim(),
          fileSize: input.preparedFile.sizeFormatted,
          mimeType: input.preparedFile.mimeType,
          hasStoredFile: storedOk,
          isDemo: false
        };
        linkedEvidenceIds.push(evId);
        linkedDocNames.push(fileObj.name);
      }

      const newTask: TaskItem = {
        id: taskId,
        workspaceId: targetWs.id,
        taskKind: input.taskKind || 'todo',
        title: input.title.trim(),
        description: input.description.trim(),
        attachedNote: input.attachedNote?.trim() || undefined,
        category: input.category || 'Dentist Instruction',
        priority: input.priority || 'Medium',
        status: 'New',
        createdDate: today,
        receivedTimestamp: nowStamp,
        dueDate: input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : today,
        relatedDocuments: linkedDocNames,
        evidenceIds: linkedEvidenceIds,
        attachmentEvidenceId: linkedEvidenceIds[0],
        activityHistory: [
          {
            id: `act-local-${nowMs}`,
            timestamp: nowStamp.slice(0, 16),
            action: locales.th.aiFallbackActionHistory,
            user: locales.th.assistantSelf,
            localized: {
              th: {
                action: locales.th.aiFallbackActionHistory,
                user: locales.th.assistantSelf
              },
              en: {
                action: locales.en.aiFallbackActionHistory,
                user: locales.en.assistantSelf
              }
            }
          }
        ],
        isDemo: false
      };

      let createdInbox: InboxItem | null = null;
      if (input.inboxSourceType) {
        createdInbox = {
          id: `inbox-local-${nowMs}`,
          title: newTask.title,
          sourceType: input.inboxSourceType,
          rawContent: input.description.trim(),
          receivedTimestamp: nowStamp,
          dentistName: locales.th.assistantSelf,
          evidenceId: linkedEvidenceIds[0],
          extractedData: {
            title: newTask.title,
            category: newTask.category,
            description: newTask.description,
            importantDates: newTask.dueDate,
            dueDate: newTask.dueDate,
            missingInformation: 'Saved manually without AI',
            suggestedNextAction: locales.th.aiFallbackActionHistory
          },
          status: 'Converted to Task',
          isDemo: false
        };
      }

      if (isTargetActive) {
        setScopedData((prev) => {
          const nextTasks = [newTask, ...prev.tasks];
          const nextEv = createdEvidence ? [createdEvidence, ...prev.evidenceList] : prev.evidenceList;
          const nextInbox = createdInbox ? [createdInbox, ...prev.inboxItems] : prev.inboxItems;
          const nextLogs = appendAudit(
            prev.auditLogs,
            targetWs.id,
            targetWs.type === 'personal' ? 'owner' : currentRole,
            'task_create',
            `Saved offline task "${newTask.title}" without AI`
          );

          saveWorkspaceDataSlice(targetWs.id, 'tasks', nextTasks);
          if (createdEvidence) saveWorkspaceDataSlice(targetWs.id, 'evidenceList', nextEv);
          if (createdInbox) saveWorkspaceDataSlice(targetWs.id, 'inboxItems', nextInbox);

          return {
            ...prev,
            tasks: nextTasks,
            evidenceList: nextEv,
            inboxItems: nextInbox,
            auditLogs: nextLogs
          };
        });
      } else {
        const targetData = loadWorkspaceData(targetWs.id, targetWs.type);
        const nextTasks = [newTask, ...targetData.tasks];
        saveWorkspaceDataSlice(targetWs.id, 'tasks', nextTasks);
        if (createdEvidence) {
          saveWorkspaceDataSlice(targetWs.id, 'evidenceList', [
            createdEvidence,
            ...targetData.evidenceList
          ]);
        }
        if (createdInbox) {
          saveWorkspaceDataSlice(targetWs.id, 'inboxItems', [
            createdInbox,
            ...targetData.inboxItems
          ]);
        }
        appendAudit(
          targetData.auditLogs,
          targetWs.id,
          targetWs.type === 'personal' ? 'owner' : currentRole,
          'task_create',
          `Saved offline draft "${newTask.title}" from ${activeWorkspace.tenantCode}`
        );
      }

      return { ok: true, task: newTask, targetWorkspace: targetWs };
    },
    [activeWorkspace, appendAudit, currentRole, workspaces]
  );

  const transferNoteToWorkspace = useCallback(
    (noteId: string, targetWorkspaceId: string): boolean => {
      const targetWs = workspaces.find((w) => w.id === targetWorkspaceId);
      const sourceNote = scopedData.privateNotes.find((n) => n.id === noteId);
      if (!targetWs || !sourceNote || targetWs.id === activeWorkspace.id) return false;

      const targetData = loadWorkspaceData(targetWs.id, targetWs.type);
      const today = new Date().toISOString().split('T')[0];
      const convertedTask: TaskItem = {
        id: `task-note-${Date.now()}`,
        workspaceId: targetWs.id,
        taskKind: 'todo',
        title: sourceNote.title,
        description: sourceNote.content,
        category: 'Other',
        priority: 'Medium',
        status: 'New',
        createdDate: today,
        dueDate: today,
        reminderAt: sourceNote.reminderAt,
        relatedDocuments: [],
        evidenceIds: [],
        activityHistory: [
          {
            id: `act-n-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            action: 'ส่งต่อจากสมุดโน้ตส่วนตัว',
            user: 'ผู้ช่วยทันตแพทย์',
            localized: {
              th: { action: 'ส่งต่อจากสมุดโน้ตส่วนตัว', user: 'ผู้ช่วยทันตแพทย์' },
              en: { action: 'Sent from Personal Space note', user: 'Dental Assistant' }
            }
          }
        ]
      };
      saveWorkspaceDataSlice(targetWs.id, 'tasks', [convertedTask, ...targetData.tasks]);
      recordAudit('task_create', `Sent note "${sourceNote.title}" as task to ${targetWs.tenantCode}`);
      return true;
    },
    [activeWorkspace.id, recordAudit, scopedData.privateNotes, workspaces]
  );

  const clearAuditLogs = useCallback(() => {
    const targetWsId = activeWorkspace.id;
    setScopedData((prev) => {
      saveWorkspaceDataSlice(targetWsId, 'auditLogs', []);
      return { ...prev, auditLogs: [] };
    });
  }, [activeWorkspace.id]);

  const clearWorkspaceSlice = useCallback(
    async (
      slice:
        | 'tasks'
        | 'queueItems'
        | 'labOrders'
        | 'followUps'
        | 'evidenceList'
        | 'inboxItems'
        | 'dentureCases'
        | 'satisfactionResponses'
    ) => {
      const targetWsId = activeWorkspace.id;
      if (slice === 'evidenceList' && !isJudgeDemoRef.current) {
        const idsToRemove = scopedData.evidenceList.map((e) => e.id);
        await Promise.all(idsToRemove.map((id) => deleteEvidenceFile(id).catch(() => undefined)));
      }
      if (slice === 'dentureCases' && !isJudgeDemoRef.current) {
        resetDemoDentureCases();
      }
      setScopedData((prev) => {
        saveWorkspaceDataSlice(targetWsId, slice, []);
        return { ...prev, [slice]: [] };
      });
      if (slice === 'queueItems') {
        try {
          const ch = new BroadcastChannel('dental_assistant_queue_tv');
          ch.postMessage({ type: 'queue_updated', workspaceId: targetWsId, items: [] });
          ch.close();
        } catch {
          // ignore
        }
      }
      recordAudit('settings_update', `Cleared all ${slice} records in workspace`);
    },
    [activeWorkspace.id, recordAudit, scopedData.evidenceList]
  );

  const resetActiveWorkspaceDemoData = useCallback(() => {
    if (isJudgeDemoRef.current) {
      setJudgeDemoMode(false);
      return;
    }
    const idsToDelete = new Set<string>(scopedData.evidenceList.map((e) => e.id));
    scopedData.tasks.forEach((t) => {
      if (t.attachmentEvidenceId) idsToDelete.add(t.attachmentEvidenceId);
      t.evidenceIds.forEach((id) => idsToDelete.add(id));
    });
    scopedData.queueItems.forEach((q) => {
      if (q.attachmentEvidenceId) idsToDelete.add(q.attachmentEvidenceId);
    });
    scopedData.labOrders.forEach((l) => {
      if (l.attachmentEvidenceId) idsToDelete.add(l.attachmentEvidenceId);
      l.supportingFiles.forEach((id) => idsToDelete.add(id));
    });
    scopedData.followUps.forEach((f) => {
      if (f.attachmentEvidenceId) idsToDelete.add(f.attachmentEvidenceId);
      f.relatedEvidenceIds.forEach((id) => idsToDelete.add(id));
    });
    scopedData.inboxItems.forEach((i) => {
      if (i.evidenceId) idsToDelete.add(i.evidenceId);
    });
    scopedData.dentureCases.forEach((d) => {
      if (d.attachmentEvidenceId) idsToDelete.add(d.attachmentEvidenceId);
    });
    scopedData.satisfactionResponses.forEach((r) => {
      if (r.attachmentEvidenceId) idsToDelete.add(r.attachmentEvidenceId);
    });
    scopedData.liveBoards.forEach((b) => {
      b.records.forEach((r) => {
        if (r.attachmentEvidenceId) idsToDelete.add(r.attachmentEvidenceId);
      });
    });

    if (workspaces.length <= 2 && activeWorkspace.id === CLINIC_WORKSPACE_ID) {
      void clearAllEvidenceFiles();
    } else {
      void Promise.all(Array.from(idsToDelete).map((id) => deleteEvidenceFile(id).catch(() => undefined)));
    }

    const reset = resetWorkspacePartitionToDemo(activeWorkspace.id, activeWorkspace.type);
    setScopedData(reset);
    clearChairsideSessionStorage(activeWorkspace.id);
    void clearCustomBuilderData(activeWorkspace.id);
    clearFollowUpCallStorage(activeWorkspace.id);
    if (activeWorkspace.id === CLINIC_WORKSPACE_ID) {
      resetDemoDentureCases();
      try {
        localStorage.removeItem(CLINIC_REAL_SATISFACTION_STORAGE_KEY);
        localStorage.removeItem('dental_workspace_tasks');
        localStorage.removeItem('dental_workspace_labs');
        localStorage.removeItem('dental_workspace_followups');
        localStorage.removeItem('dental_workspace_evidence');
        localStorage.removeItem('dental_workspace_inbox');
      } catch {
        // ignore
      }
    }
    try {
      const ch = new BroadcastChannel('dental_assistant_queue_tv');
      ch.postMessage({ type: 'queue_updated', workspaceId: activeWorkspace.id, items: [] });
      ch.close();
    } catch {
      // ignore
    }
  }, [activeWorkspace.id, activeWorkspace.type, scopedData, workspaces.length]);

  const exportActiveWorkspaceBackup = useCallback(() => {
    recordAudit('backup_export', `Exported JSON backup for ${activeWorkspace.tenantCode}`);
    return exportWorkspaceBackupJson(activeWorkspace, scopedData);
  }, [activeWorkspace, recordAudit, scopedData]);

  const importActiveWorkspaceBackup = useCallback(
    (rawJson: string) => {
      const res = importWorkspaceBackupJson(activeWorkspace.id, rawJson, scopedData);
      if (res.ok && res.mergedData) {
        setScopedData(res.mergedData);
        recordAudit(
          'settings_update',
          `Imported JSON backup (${res.importedCount} records) into ${activeWorkspace.tenantCode}`
        );
      }
      return {
        ok: res.ok,
        importedCount: res.importedCount,
        error: res.error
      };
    },
    [activeWorkspace.id, activeWorkspace.tenantCode, recordAudit, scopedData]
  );

  const value: WorkspaceContextValue = {
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace.id,
    currentRole,
    hasPermission,
    switchWorkspace,
    createClinicWorkspace,
    joinClinicWorkspace,
    updateWorkspaceMeta,
    deleteWorkspace,
    setCurrentUserRole,
    toggleModule,
    addClinicMember,
    updateClinicMemberRole,
    updateClinicMember,
    deleteClinicMember,
    addClinicRoom,
    updateClinicRoom,
    deleteClinicRoom,

    tasks: scopedData.tasks,
    setTasks,
    queueItems: scopedData.queueItems,
    setQueueItems,
    labOrders: scopedData.labOrders,
    setLabOrders,
    followUps: scopedData.followUps,
    setFollowUps,
    evidenceList: scopedData.evidenceList,
    setEvidenceList,
    inboxItems: scopedData.inboxItems,
    setInboxItems,
    sheetConfig: scopedData.sheetConfig,
    updateSheetConfig,
    dentureCases: scopedData.dentureCases,
    setDentureCases,
    isDentureLoading,
    dentureLoadError,
    refreshDentureCases,

    satisfactionResponses: scopedData.satisfactionResponses,
    setSatisfactionResponses,
    satisfactionSettings: scopedData.satisfactionSettings,
    updateSatisfactionSettings,
    chatState: scopedData.chatState,
    updateChatState,
    createFollowUpFromSatisfaction,
    saveExecutiveReportToWorkspace,

    templates: scopedData.templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    clearTemplates,
    workflows: scopedData.workflows,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    clearWorkflows,
    customCategories: scopedData.customCategories,
    addCustomCategory,
    renameCustomCategory,
    deleteCustomCategory,
    privateNotes: scopedData.privateNotes,
    addPrivateNote,
    updatePrivateNote,
    deletePrivateNote,
    clearPrivateNotes,
    dailyGoals: scopedData.dailyGoals,
    addDailyGoal,
    updateDailyGoal,
    toggleDailyGoal,
    deleteDailyGoal,
    clearDailyGoals,

    liveBoards: scopedData.liveBoards,
    setLiveBoards,
    addLiveBoard,
    updateLiveBoardMeta,
    deleteLiveBoard,
    importLiveBoardRecords,
    upsertLiveBoardRecord,
    deleteLiveBoardRecord,
    clearLiveBoardRecords,
    saveLiveBoardReportToWorkspace,

    setCollaborationMode,
    transferTaskToWorkspace,
    transferEvidenceToWorkspace,
    transferNoteToWorkspace,
    saveManualFallbackTask,
    isTvDisplayOpen,
    setIsTvDisplayOpen,

    auditLogs: scopedData.auditLogs,
    recordAudit,
    clearAuditLogs,
    clearWorkspaceSlice,
    resetActiveWorkspaceDemoData,
    isJudgeDemoActive,
    setJudgeDemoMode,
    toggleJudgeDemoMode,
    exportActiveWorkspaceBackup,
    importActiveWorkspaceBackup
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
