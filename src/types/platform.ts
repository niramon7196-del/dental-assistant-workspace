import type { LocaleCode, TaskCategory, TaskKind, TaskPriority } from './dental';

export type WorkspaceType = 'personal' | 'clinic';

export type ClinicRole = 'owner' | 'administrator' | 'manager' | 'assistant';

export type CollaborationMode = 'solo' | 'team';

export type PermissionAction =
  | 'view_workspace'
  | 'manage_tasks'
  | 'assign_tasks'
  | 'manage_labs'
  | 'manage_followups'
  | 'manage_denture'
  | 'manage_evidence'
  | 'use_ai_assistant'
  | 'manage_modules'
  | 'manage_members'
  | 'manage_settings'
  | 'view_audit_logs';

export type ModuleId =
  | 'overview'
  | 'ai_assistant'
  | 'chat_copilot'
  | 'inbox'
  | 'tasks'
  | 'live_workspaces'
  | 'queue'
  | 'labs'
  | 'followups'
  | 'denture'
  | 'satisfaction'
  | 'evidence'
  | 'team'
  | 'modules_hub'
  | 'settings';

export type ModuleGroup = 'daily_assistant' | 'clinical_cases' | 'vault_settings';

export interface ModuleSubmenuItem {
  id: string;
  labelKey: string;
  requiredPermission?: PermissionAction;
}

export interface ModuleDefinition {
  id: ModuleId;
  labelKey: string;
  descriptionKey: string;
  group: ModuleGroup;
  supportedWorkspaceTypes: WorkspaceType[];
  requiredPermission: PermissionAction;
  canDisable: boolean;
  defaultEnabled: Record<WorkspaceType, boolean>;
  dataScopeKey: string;
  submenus: ModuleSubmenuItem[];
}

export interface FutureModuleBlueprint {
  id: string;
  titleKey: string;
  descriptionKey: string;
  targetWorkspaceTypes: WorkspaceType[];
  categoryKey: string;
  requiredBackendCapabilities: string[];
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: ClinicRole;
  assignedRooms: string[];
  joinedAt: string;
  status: 'active' | 'invited';
}

export type PlanTier = 'personal_free' | 'clinic_standard' | 'clinic_enterprise';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  collaborationMode?: CollaborationMode;
  name: string;
  description: string;
  tenantCode: string;
  planTier: PlanTier;
  ownerId: string;
  currentUserRole: ClinicRole;
  members: WorkspaceMember[];
  rooms: string[];
  enabledModules: Record<ModuleId, boolean>;
  createdAt: string;
  localized?: Partial<Record<LocaleCode, { name: string; description: string }>>;
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  customCategory?: string;
  priority: TaskPriority;
  defaultSubtasks: string[];
  workflowId?: string;
  reminderOffsetDays?: number;
  createdAt: string;
}

export interface CustomWorkflow {
  id: string;
  name: string;
  stages: string[];
  createdAt: string;
}

export interface PrivateNote {
  id: string;
  title: string;
  content: string;
  noteType?: 'note' | 'formula';
  reminderAt?: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface DailyGoalItem {
  id: string;
  title: string;
  completed: boolean;
  date: string;
}

export type ChatToneCategory = 'general' | 'pricing_promo' | 'appointment' | 'post_op';
export type ChatChannelType = 'facebook' | 'line_oa';

export interface ChatCopilotReply {
  replyDraft: string;
  shortReply: string;
  suggestedTaskTitle: string;
  suggestedTaskKind: TaskKind;
  suggestedCategory: TaskCategory;
  suggestedPriority: TaskPriority;
  suggestedFollowUpNote: string;
  model: string;
}

export interface ChatDraftHistoryEntry {
  id: string;
  createdAt: string;
  channel: ChatChannelType;
  tone: ChatToneCategory;
  patientMessage: string;
  clinicHint: string;
  replyDraft: string;
  shortReply: string;
}

export interface WorkspaceChatState {
  channel: ChatChannelType;
  tone: ChatToneCategory;
  patientMessage: string;
  clinicHint: string;
  replyResult: ChatCopilotReply | null;
  draftText: string;
  history: ChatDraftHistoryEntry[];
  floatingMode: 'prioritize' | 'intake' | 'outreach';
  floatingOutreachType: 'chat_reply' | 'call_script' | 'team_handoff';
  floatingInputText: string;
  aiCenterPrompt: string;
  aiCenterResult: AiAssistResponse | null;
  aiCenterDraft: AiProposedTaskDraft | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  workspaceId: string;
  actorName: string;
  actorRole: ClinicRole;
  actionType:
    | 'workspace_switch'
    | 'workspace_create'
    | 'workspace_join'
    | 'module_toggle'
    | 'role_change'
    | 'member_add'
    | 'task_create'
    | 'task_update'
    | 'template_create'
    | 'workflow_create'
    | 'ai_assist'
    | 'settings_update'
    | 'backup_export';
  summary: string;
}

export interface AiAssistActionRecommendation {
  title: string;
  moduleTarget: ModuleId | 'tasks';
  priority: TaskPriority;
  reason: string;
}

export interface AiAssistOverdueAlert {
  taskId: string;
  title: string;
  dueDate: string;
  urgencyNote: string;
}

export interface AiAssistReminderSuggestion {
  title: string;
  suggestedDueDate: string;
  reason: string;
}

export interface AiProposedTaskDraft {
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string | null;
  description: string;
  subtasks: string[];
}

export interface AiAssistResponse {
  answer: string;
  overdueAlerts: AiAssistOverdueAlert[];
  recommendedActions: AiAssistActionRecommendation[];
  suggestedReminders: AiAssistReminderSuggestion[];
  proposedTaskDraft: AiProposedTaskDraft | null;
  model: string;
  scopedModules: ModuleId[];
}

export interface SatisfactionCallbackRecommendation {
  responseId: string;
  patientRef: string;
  serviceType: string;
  suggestedTitle: string;
  suggestedAction: string;
  priority: TaskPriority;
}

export interface SatisfactionAiAnalysisResult {
  summaryOverview: string;
  strengths: string[];
  improvements: string[];
  callbackRecommendations: SatisfactionCallbackRecommendation[];
  executiveReportText: string;
  model: string;
}

export type LiveCategoryKind = 'inventory' | 'followup_recall' | 'custom';

export type LiveRecordStatus = 'pending' | 'in_progress' | 'followup' | 'completed';

export interface LiveCategoryRecord {
  id: string;
  boardId: string;
  title: string;
  referenceCode: string;
  groupLabel: string;
  status: LiveRecordStatus;
  quantityOrMetric: number;
  unitLabel: string;
  recordDate: string; // YYYY-MM-DD
  notes?: string;
  source: 'sheet_paste' | 'sheet_pull' | 'manual_entry';
  attachmentEvidenceId?: string;
  updatedAt: string;
  openingBalance?: number;
  receivedQty?: number;
  dispensedQty?: number;
  minThreshold?: number;
}

export interface LiveCategoryBoard {
  id: string;
  name: string;
  description?: string;
  kind: LiveCategoryKind;
  metricLabel?: string;
  readOnlySheetUrl?: string;
  readOnlySheetTab?: string;
  createdAt: string;
  records: LiveCategoryRecord[];
}
