import { ClinicRole, PermissionAction, WorkspaceType } from '../types/platform';

export const CLINIC_ROLE_PERMISSIONS: Record<ClinicRole, readonly PermissionAction[]> = {
  owner: [
    'view_workspace',
    'manage_tasks',
    'assign_tasks',
    'manage_labs',
    'manage_followups',
    'manage_denture',
    'manage_evidence',
    'use_ai_assistant',
    'manage_modules',
    'manage_members',
    'manage_settings',
    'view_audit_logs'
  ],
  administrator: [
    'view_workspace',
    'manage_tasks',
    'assign_tasks',
    'manage_labs',
    'manage_followups',
    'manage_denture',
    'manage_evidence',
    'use_ai_assistant',
    'manage_modules',
    'manage_members',
    'manage_settings',
    'view_audit_logs'
  ],
  manager: [
    'view_workspace',
    'manage_tasks',
    'assign_tasks',
    'manage_labs',
    'manage_followups',
    'manage_denture',
    'manage_evidence',
    'use_ai_assistant',
    'view_audit_logs'
  ],
  assistant: [
    'view_workspace',
    'manage_tasks',
    'manage_labs',
    'manage_followups',
    'manage_denture',
    'manage_evidence',
    'use_ai_assistant'
  ]
};

export const PERSONAL_WORKSPACE_PERMISSIONS: readonly PermissionAction[] = [
  'view_workspace',
  'manage_tasks',
  'manage_labs',
  'manage_followups',
  'manage_denture',
  'manage_evidence',
  'use_ai_assistant',
  'manage_modules',
  'manage_settings',
  'view_audit_logs'
];

export const ALL_PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'view_workspace',
  'manage_tasks',
  'assign_tasks',
  'manage_labs',
  'manage_followups',
  'manage_denture',
  'manage_evidence',
  'use_ai_assistant',
  'manage_modules',
  'manage_members',
  'manage_settings',
  'view_audit_logs'
];

export function canPerform(
  role: ClinicRole,
  action: PermissionAction,
  workspaceType: WorkspaceType
): boolean {
  if (workspaceType === 'personal') {
    return PERSONAL_WORKSPACE_PERMISSIONS.includes(action);
  }
  return CLINIC_ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export const CLINIC_ROLES_ORDER: readonly ClinicRole[] = [
  'owner',
  'administrator',
  'manager',
  'assistant'
];
