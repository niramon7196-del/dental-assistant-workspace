import {
  ClinicRole,
  FutureModuleBlueprint,
  ModuleDefinition,
  ModuleGroup,
  ModuleId,
  WorkspaceType
} from '../types/platform';
import { canPerform } from '../utils/permissions';

export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  // Zone 1: Assistant & Daily Work
  {
    id: 'overview',
    labelKey: 'overview',
    descriptionKey: 'modOverviewDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'view_workspace',
    canDisable: false,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_summary',
    submenus: [{ id: 'summary', labelKey: 'overview' }]
  },
  {
    id: 'ai_assistant',
    labelKey: 'aiAssistantHubTitle',
    descriptionKey: 'modAiAssistantDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'use_ai_assistant',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'authorized_workspace_context',
    submenus: [
      { id: 'chat', labelKey: 'aiAssistSubmenuChat' },
      { id: 'briefing', labelKey: 'aiAssistSubmenuBriefing' },
      { id: 'reminders', labelKey: 'aiAssistSubmenuReminders' }
    ]
  },
  {
    id: 'chat_copilot',
    labelKey: 'chatCopilotNav',
    descriptionKey: 'modChatCopilotDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'use_ai_assistant',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'page_line_chat_drafts',
    submenus: [
      { id: 'reply', labelKey: 'chatCopilotSubmenuReply' }
    ]
  },
  {
    id: 'inbox',
    labelKey: 'aiInbox',
    descriptionKey: 'modAiInboxDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'use_ai_assistant',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_inbox',
    submenus: [
      { id: 'extract', labelKey: 'inboxSubmenuExtract' },
      { id: 'history', labelKey: 'inboxHistoryTitle' }
    ]
  },
  {
    id: 'tasks',
    labelKey: 'myTasks',
    descriptionKey: 'modTasksDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_tasks',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_tasks',
    submenus: [
      { id: 'board', labelKey: 'tasksSubmenuList' },
      { id: 'templates', labelKey: 'tasksSubmenuTemplates' },
      { id: 'workflows', labelKey: 'tasksSubmenuWorkflows' },
      { id: 'reminders', labelKey: 'tasksSubmenuReminders' }
    ]
  },
  {
    id: 'live_workspaces',
    labelKey: 'liveWorkspacesNav',
    descriptionKey: 'modLiveWorkspacesDesc',
    group: 'daily_assistant',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_tasks',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_live_boards',
    submenus: [
      { id: 'stock', labelKey: 'liveWsSubmenuStock' },
      { id: 'recall', labelKey: 'liveWsSubmenuRecall' },
      { id: 'custom', labelKey: 'liveWsSubmenuCustom' }
    ]
  },

  // Zone 2: Chairside Queue, Cases & Dental Lab
  {
    id: 'queue',
    labelKey: 'queueNav',
    descriptionKey: 'modQueueDesc',
    group: 'clinical_cases',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'view_workspace',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'assistant_chairside_queue',
    submenus: [
      { id: 'board', labelKey: 'queueSubmenuBoard' },
      { id: 'tv', labelKey: 'queueTvModeBtn' }
    ]
  },
  {
    id: 'satisfaction',
    labelKey: 'satisfactionNav',
    descriptionKey: 'modSatisfactionDesc',
    group: 'clinical_cases',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'view_workspace',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'satisfaction_qr_analytics',
    submenus: [
      { id: 'pulse', labelKey: 'satSubmenuPulse' },
      { id: 'analytics', labelKey: 'satSubmenuAnalytics' },
      { id: 'report', labelKey: 'satSubmenuReport' }
    ]
  },
  {
    id: 'labs',
    labelKey: 'labTracker',
    descriptionKey: 'modLabsDesc',
    group: 'clinical_cases',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_labs',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'clinic_labs',
    submenus: [{ id: 'orders', labelKey: 'labTracker' }]
  },
  {
    id: 'followups',
    labelKey: 'followups',
    descriptionKey: 'modFollowUpsDesc',
    group: 'clinical_cases',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_followups',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'clinic_followups',
    submenus: [{ id: 'queue', labelKey: 'followups' }]
  },
  {
    id: 'denture',
    labelKey: 'denture',
    descriptionKey: 'modDentureDesc',
    group: 'clinical_cases',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_denture',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'clinic_denture_sheet',
    submenus: [{ id: 'recall', labelKey: 'denture' }]
  },

  // Zone 3: Evidence & Settings
  {
    id: 'evidence',
    labelKey: 'evidence',
    descriptionKey: 'modEvidenceDesc',
    group: 'vault_settings',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'manage_evidence',
    canDisable: true,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_evidence',
    submenus: [{ id: 'vault', labelKey: 'evidence' }]
  },
  {
    id: 'team',
    labelKey: 'teamWorkspaceNav',
    descriptionKey: 'modTeamDesc',
    group: 'vault_settings',
    supportedWorkspaceTypes: ['clinic'],
    requiredPermission: 'view_workspace',
    canDisable: true,
    defaultEnabled: { personal: false, clinic: true },
    dataScopeKey: 'clinic_members_roles',
    submenus: [
      { id: 'members', labelKey: 'teamSubmenuMembers' },
      { id: 'roles', labelKey: 'teamSubmenuRoles' },
      { id: 'audit', labelKey: 'teamSubmenuAudit' }
    ]
  },
  {
    id: 'modules_hub',
    labelKey: 'modulesHubNav',
    descriptionKey: 'modModulesHubDesc',
    group: 'vault_settings',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'view_workspace',
    canDisable: false,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_modules',
    submenus: [
      { id: 'installed', labelKey: 'modulesHubInstalled' },
      { id: 'roadmap', labelKey: 'modulesHubRoadmap' }
    ]
  },
  {
    id: 'settings',
    labelKey: 'settings',
    descriptionKey: 'modSettingsDesc',
    group: 'vault_settings',
    supportedWorkspaceTypes: ['personal', 'clinic'],
    requiredPermission: 'view_workspace',
    canDisable: false,
    defaultEnabled: { personal: true, clinic: true },
    dataScopeKey: 'workspace_settings',
    submenus: [{ id: 'general', labelKey: 'settings' }]
  }
];

export const MODULE_GROUP_ORDER: readonly ModuleGroup[] = [
  'daily_assistant',
  'clinical_cases',
  'vault_settings'
];

export const MODULE_GROUP_LABEL_KEYS: Record<ModuleGroup, string> = {
  daily_assistant: 'navZoneDaily',
  clinical_cases: 'navZoneClinical',
  vault_settings: 'navZoneVault'
};

export const FUTURE_MODULE_BLUEPRINTS: readonly FutureModuleBlueprint[] = [
  {
    id: 'future-ai-comm',
    titleKey: 'futureModAiCommTitle',
    descriptionKey: 'futureModAiCommDesc',
    targetWorkspaceTypes: ['clinic'],
    categoryKey: 'navZoneDaily',
    requiredBackendCapabilities: ['LINE / SMS Webhook', 'Tenant Messaging Policy']
  },
  {
    id: 'future-queue-assist',
    titleKey: 'futureModQueueTitle',
    descriptionKey: 'futureModQueueDesc',
    targetWorkspaceTypes: ['clinic'],
    categoryKey: 'navZoneClinical',
    requiredBackendCapabilities: ['Realtime WebSocket / Room Board', 'Queue Events']
  },
  {
    id: 'future-lab-pro',
    titleKey: 'futureModLabProTitle',
    descriptionKey: 'futureModLabProDesc',
    targetWorkspaceTypes: ['clinic'],
    categoryKey: 'navZoneClinical',
    requiredBackendCapabilities: ['Vendor Portal API', 'Barcode / Slip Sync']
  },
  {
    id: 'future-extraction-track',
    titleKey: 'futureModExtractionTitle',
    descriptionKey: 'futureModExtractionDesc',
    targetWorkspaceTypes: ['clinic'],
    categoryKey: 'navZoneClinical',
    requiredBackendCapabilities: ['Post-Op Protocol Rules', 'Recall Scheduler']
  },
  {
    id: 'future-workflow-builder',
    titleKey: 'futureModWorkflowTitle',
    descriptionKey: 'futureModWorkflowDesc',
    targetWorkspaceTypes: ['personal', 'clinic'],
    categoryKey: 'navZoneDaily',
    requiredBackendCapabilities: ['Event Triggers', 'Rule Engine']
  },
  {
    id: 'future-team-collab',
    titleKey: 'futureModCollabTitle',
    descriptionKey: 'futureModCollabDesc',
    targetWorkspaceTypes: ['clinic'],
    categoryKey: 'navZoneVault',
    requiredBackendCapabilities: ['Live Presence', 'Threaded Mentions']
  },
  {
    id: 'future-analytics',
    titleKey: 'futureModAnalyticsTitle',
    descriptionKey: 'futureModAnalyticsDesc',
    targetWorkspaceTypes: ['personal', 'clinic'],
    categoryKey: 'navZoneVault',
    requiredBackendCapabilities: ['Tenant Aggregations', 'SLA Telemetry']
  },
  {
    id: 'future-integrations',
    titleKey: 'futureModIntegrationsTitle',
    descriptionKey: 'futureModIntegrationsDesc',
    targetWorkspaceTypes: ['personal', 'clinic'],
    categoryKey: 'navZoneVault',
    requiredBackendCapabilities: ['OAuth2 / Calendar API', 'Webhook Signing']
  }
];

export function buildDefaultEnabledModules(type: WorkspaceType): Record<ModuleId, boolean> {
  const result = {} as Record<ModuleId, boolean>;
  for (const mod of MODULE_REGISTRY) {
    result[mod.id] = mod.defaultEnabled[type];
  }
  return result;
}

export function getModuleDefinition(id: ModuleId): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

export function isModuleAccessible(
  mod: ModuleDefinition,
  workspaceType: WorkspaceType,
  enabledModules: Record<ModuleId, boolean>,
  role: ClinicRole
): boolean {
  if (!mod.supportedWorkspaceTypes.includes(workspaceType)) return false;
  if (mod.canDisable && enabledModules[mod.id] === false) return false;
  return canPerform(role, mod.requiredPermission, workspaceType);
}
