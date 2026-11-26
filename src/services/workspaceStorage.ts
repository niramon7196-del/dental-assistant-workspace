import {
  DentureCase,
  EvidenceItem,
  InboxItem,
  LabOrder,
  PatientFollowUpItem,
  QueueItem,
  SatisfactionResponse,
  SatisfactionSettings,
  SheetConfig,
  TaskItem
} from '../types/dental';
import {
  AuditLogEntry,
  ClinicRole,
  CustomWorkflow,
  DailyGoalItem,
  LiveCategoryBoard,
  LiveCategoryRecord,
  PrivateNote,
  TaskTemplate,
  Workspace,
  WorkspaceChatState,
  WorkspaceMember,
  WorkspaceType
} from '../types/platform';
import { buildDefaultEnabledModules } from '../modules/moduleRegistry';
import { getDefaultDentalStockRecords } from '../data/defaultDentalStockData';
import {
  getAllLocalAttachments,
  importLocalAttachments,
  isQuotaExceededError,
  LocalAttachmentRecord,
  syncAttachmentsMapToIndexedDb
} from './evidenceStorage';
import {
  loadChairsideSession,
  saveChairsideSession,
  ChairsideSessionState
} from './chairsideCopilotService';
import {
  loadCustomBuilderData,
  saveCustomBuilderData,
  CustomBuilderStoreData
} from './customBuilderService';
import {
  loadFollowUpCallLogs,
  saveFollowUpCallLogs,
  loadFollowUpSipConfig,
  saveFollowUpSipConfig,
  FollowUpCallLog,
  FollowUpSipConfig
} from './followUpCallService';

const WORKSPACES_REGISTRY_KEY = 'dental_platform_workspaces_v2';
const ACTIVE_WORKSPACE_ID_KEY = 'dental_platform_active_workspace_v2';
const PERSONAL_QUEUE_MIGRATED_KEY = 'dental_platform_migrated_personal_queue_v1';
const SATISFACTION_MODULE_MIGRATED_KEY = 'dental_platform_migrated_satisfaction_v1';
const LIVE_WORKSPACES_MIGRATED_KEY = 'dental_platform_migrated_live_workspaces_v1';
const PERSONAL_ALL_REAL_MODULES_MIGRATED_KEY = 'dental_platform_migrated_personal_all_modules_v1';

export const PERSONAL_WORKSPACE_ID = 'ws-personal-primary';
export const CLINIC_WORKSPACE_ID = 'ws-clinic-primary';
export const DEMO_SECOND_CLINIC_INVITE_CODE = 'ASST-ROOM-2';

export interface WorkspaceScopedData {
  tasks: TaskItem[];
  queueItems: QueueItem[];
  labOrders: LabOrder[];
  followUps: PatientFollowUpItem[];
  evidenceList: EvidenceItem[];
  inboxItems: InboxItem[];
  sheetConfig: SheetConfig;
  dentureCases: DentureCase[];
  satisfactionResponses: SatisfactionResponse[];
  satisfactionSettings: SatisfactionSettings;
  templates: TaskTemplate[];
  workflows: CustomWorkflow[];
  customCategories: string[];
  privateNotes: PrivateNote[];
  dailyGoals: DailyGoalItem[];
  liveBoards: LiveCategoryBoard[];
  auditLogs: AuditLogEntry[];
  chatState: WorkspaceChatState;
}

export const MASTER_REAL_DATA_STORAGE_KEY = 'clinic_assistant_real_data_v1';
export const CLINIC_REAL_SATISFACTION_STORAGE_KEY = 'clinic_real_satisfaction_v1';
export const CLINIC_PROSTHO_RECALL_STORAGE_KEY = 'clinic_real_prostho_recall_v1';
export const DENTAL_STOCK_INVENTORY_STORAGE_KEY = 'dental_stock_inventory_v2_real';

export interface MasterRealDataStore {
  version: 1;
  updatedAt: string;
  workspaces: Record<string, Partial<WorkspaceScopedData>>;
  // Mirror of primary active data for quick external/direct inspection
  tasks?: TaskItem[];
  satisfactionResponses?: SatisfactionResponse[];
  followUps?: PatientFollowUpItem[];
  dentureCases?: DentureCase[];
  queueItems?: QueueItem[];
  labOrders?: LabOrder[];
  evidenceList?: EvidenceItem[];
  inboxItems?: InboxItem[];
  sheetConfig?: SheetConfig;
  satisfactionSettings?: SatisfactionSettings;
  privateNotes?: PrivateNote[];
  dailyGoals?: DailyGoalItem[];
  liveBoards?: LiveCategoryBoard[];
  templates?: TaskTemplate[];
  workflows?: CustomWorkflow[];
  chatState?: WorkspaceChatState;
}

export function createDefaultWorkspaceChatState(): WorkspaceChatState {
  return {
    channel: 'line_oa',
    tone: 'pricing_promo',
    patientMessage: '',
    clinicHint: '',
    replyResult: null,
    draftText: '',
    history: [],
    floatingMode: 'prioritize',
    floatingOutreachType: 'chat_reply',
    floatingInputText: '',
    aiCenterPrompt: '',
    aiCenterResult: null,
    aiCenterDraft: null
  };
}

export function createDefaultSatisfactionSettings(): SatisfactionSettings {
  return {
    monthlyGoal: 30,
    surveyUrl: '',
    rawSheetTabName: 'การตอบแบบฟอร์ม 1'
  };
}

export function createDefaultLiveCategoryBoards(): LiveCategoryBoard[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'board-stock-inventory',
      name: 'งานสต๊อก / วัสดุทันตกรรม',
      description: 'ติดตามจำนวนวัสดุ คงเหลือ ใกล้หมด และรอบสั่งซื้อจากการวางหรือดึงชีต',
      kind: 'inventory',
      metricLabel: 'จำนวนคงเหลือ',
      createdAt: today,
      records: getDefaultDentalStockRecords()
    },
    {
      id: 'board-extraction-denture',
      name: 'เคสติดตามถอนฟัน / ฟันปลอม',
      description: 'รวบรวมรายชื่อเคสติดตามอาการ นัดหมาย และสถานะการติดต่อกลับ',
      kind: 'followup_recall',
      metricLabel: 'จำนวนซี่ / คะแนน',
      createdAt: today,
      records: []
    }
  ];
}

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`LocalStorage quota exceeded for key "${key}".`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dental-storage-quota-warning', { detail: { key } })
        );
      }
    } else {
      console.warn(`Storage write failed for key "${key}":`, err);
    }
    return false;
  }
}

function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getPartitionKey(workspaceId: string, slice: string): string {
  return `dental_platform_ws_data_v2::${workspaceId}::${slice}`;
}

export function clearJudgeDemoPartitions(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dental_platform_judge_demo_v1::')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => safeRemoveStorage(k));
  } catch {
    // ignore
  }
}

export function readQueueItemsDirect(workspaceId: string): QueueItem[] {
  return safeParse<QueueItem[]>(safeGetStorage(getPartitionKey(workspaceId, 'queue')), []);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createInitialPersonalData(_workspaceId: string): WorkspaceScopedData {
  return {
    tasks: [],
    queueItems: [],
    labOrders: [],
    followUps: [],
    evidenceList: [],
    inboxItems: [],
    sheetConfig: {
      webAppUrl: '',
      inventorySheetUrl: '',
      satisfactionSheetUrl: '',
      satisfactionFormUrl: '',
      satisfactionRawTabName: 'การตอบแบบฟอร์ม 1',
      token: '',
      operatorName: ''
    },
    dentureCases: [],
    satisfactionResponses: [],
    satisfactionSettings: createDefaultSatisfactionSettings(),
    templates: [],
    workflows: [],
    customCategories: [],
    privateNotes: [],
    dailyGoals: [],
    liveBoards: createDefaultLiveCategoryBoards(),
    auditLogs: [],
    chatState: createDefaultWorkspaceChatState()
  };
}

export function createInitialClinicData(
  _workspaceId: string,
  _useLegacyMigration: boolean
): WorkspaceScopedData {
  return {
    tasks: [],
    queueItems: [],
    labOrders: [],
    followUps: [],
    evidenceList: [],
    inboxItems: [],
    sheetConfig: {
      webAppUrl: '',
      inventorySheetUrl: '',
      satisfactionSheetUrl: '',
      satisfactionFormUrl: '',
      satisfactionRawTabName: 'การตอบแบบฟอร์ม 1',
      token: '',
      operatorName: ''
    },
    dentureCases: [],
    satisfactionResponses: [],
    satisfactionSettings: createDefaultSatisfactionSettings(),
    templates: [],
    workflows: [],
    customCategories: [],
    privateNotes: [],
    dailyGoals: [],
    liveBoards: createDefaultLiveCategoryBoards(),
    auditLogs: [],
    chatState: createDefaultWorkspaceChatState()
  };
}

export function createDefaultWorkspaces(): Workspace[] {
  const today = new Date().toISOString().split('T')[0];

  const defaultClinicMembers: WorkspaceMember[] = [
    {
      id: 'mem-owner-1',
      name: 'หัวหน้าผู้ช่วย (Owner)',
      email: 'owner@assistant.local',
      initials: 'OW',
      role: 'owner',
      assignedRooms: ['ห้อง 1', 'ห้อง 2', 'ห้อง 3'],
      joinedAt: today,
      status: 'active'
    }
  ];

  return [
    {
      id: PERSONAL_WORKSPACE_ID,
      type: 'personal',
      name: 'Personal Assistant Space',
      description:
        'Private tasks, study notes, templates, and reminders strictly isolated from clinic data.',
      tenantCode: 'PER-001',
      planTier: 'personal_free',
      ownerId: 'user-self',
      currentUserRole: 'owner',
      members: [
        {
          id: 'user-self',
          name: 'Personal Owner',
          email: 'me@personal.local',
          initials: 'ME',
          role: 'owner',
          assignedRooms: [],
          joinedAt: today,
          status: 'active'
        }
      ],
      rooms: ['ห้อง 1 (Room 1)', 'ห้อง 2 (Room 2)'],
      enabledModules: buildDefaultEnabledModules('personal'),
      createdAt: today,
      localized: {
        th: {
          name: 'พื้นที่ส่วนตัว (Personal Space)',
          description: 'สมุดโน้ตส่วนตัว สูตรจำงาน เป้าหมายประจำวัน และหลักฐานส่วนบุคคล แยกขาด 100%'
        },
        en: {
          name: 'Personal Space',
          description:
            'Private notebook, memory formulas, daily goals, and personal work evidence (100% isolated).'
        }
      }
    },
    {
      id: CLINIC_WORKSPACE_ID,
      type: 'clinic',
      collaborationMode: 'team',
      name: 'Assistant Workspace',
      description: 'Standalone dental assistant hub for solo chairside work or assistant team sync.',
      tenantCode: 'ASST-001',
      planTier: 'clinic_standard',
      ownerId: 'mem-owner-1',
      currentUserRole: 'owner',
      members: defaultClinicMembers,
      rooms: ['ห้อง 1 (Room 1)', 'ห้อง 2 (Room 2)', 'ห้อง 3 (Room 3)', 'ห้องปลอดเชื้อ (Sterile)'],
      enabledModules: buildDefaultEnabledModules('clinic'),
      createdAt: today,
      localized: {
        th: {
          name: 'พื้นที่บริหารงานผู้ช่วย (Assistant)',
          description: 'บริหารงานหน้างานผู้ช่วยครบชุด แยกอิสระจากระบบเคาน์เตอร์คลินิก พร้อมรอเชื่อมต่อชีตจริง'
        },
        en: {
          name: 'Assistant Workspace',
          description:
            'Full dental assistant operations: Solo chairside mode or Team Sync without touching front-desk counter.'
        }
      }
    }
  ];
}

export function loadWorkspacesRegistry(): Workspace[] {
  const saved = safeParse<Workspace[] | null>(safeGetStorage(WORKSPACES_REGISTRY_KEY), null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    const needsPersonalQueueUnlock =
      safeGetStorage(PERSONAL_QUEUE_MIGRATED_KEY) !== '1';
    const needsSatisfactionUnlock =
      safeGetStorage(SATISFACTION_MODULE_MIGRATED_KEY) !== '1';
    const needsLiveWorkspacesUnlock =
      safeGetStorage(LIVE_WORKSPACES_MIGRATED_KEY) !== '1';
    const needsPersonalAllModulesUnlock =
      safeGetStorage(PERSONAL_ALL_REAL_MODULES_MIGRATED_KEY) !== '1';
    const normalized = saved.map((ws) => {
      const defaults = buildDefaultEnabledModules(ws.type);
      const nextRooms =
        ws.type === 'personal' && (!Array.isArray(ws.rooms) || ws.rooms.length === 0)
          ? ['ห้อง 1 (Room 1)', 'ห้อง 2 (Room 2)']
          : ws.rooms;
      const mergedModules = {
        ...defaults,
        ...ws.enabledModules
      };
      if (ws.type === 'personal' && needsPersonalQueueUnlock) {
        mergedModules.queue = true;
      }
      if (ws.type === 'personal' && needsPersonalAllModulesUnlock) {
        mergedModules.labs = true;
        mergedModules.followups = true;
        mergedModules.denture = true;
      }
      if (needsSatisfactionUnlock) {
        mergedModules.satisfaction = true;
      }
      if (needsLiveWorkspacesUnlock) {
        mergedModules.live_workspaces = true;
      }
      return {
        ...ws,
        rooms: nextRooms,
        collaborationMode: ws.collaborationMode || (ws.type === 'clinic' ? 'team' : 'solo'),
        enabledModules: mergedModules
      };
    });
    if (
      needsPersonalQueueUnlock ||
      needsSatisfactionUnlock ||
      needsLiveWorkspacesUnlock ||
      needsPersonalAllModulesUnlock
    ) {
      safeSetStorage(PERSONAL_QUEUE_MIGRATED_KEY, '1');
      safeSetStorage(SATISFACTION_MODULE_MIGRATED_KEY, '1');
      safeSetStorage(LIVE_WORKSPACES_MIGRATED_KEY, '1');
      safeSetStorage(PERSONAL_ALL_REAL_MODULES_MIGRATED_KEY, '1');
      safeSetStorage(WORKSPACES_REGISTRY_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }
  const defaults = createDefaultWorkspaces();
  safeSetStorage(PERSONAL_QUEUE_MIGRATED_KEY, '1');
  safeSetStorage(SATISFACTION_MODULE_MIGRATED_KEY, '1');
  safeSetStorage(LIVE_WORKSPACES_MIGRATED_KEY, '1');
  safeSetStorage(PERSONAL_ALL_REAL_MODULES_MIGRATED_KEY, '1');
  safeSetStorage(WORKSPACES_REGISTRY_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveWorkspacesRegistry(workspaces: Workspace[]): void {
  safeSetStorage(WORKSPACES_REGISTRY_KEY, JSON.stringify(workspaces));
}

export function loadActiveWorkspaceId(workspaces: Workspace[]): string {
  const saved = safeGetStorage(ACTIVE_WORKSPACE_ID_KEY);
  if (saved && workspaces.some((w) => w.id === saved)) {
    return saved;
  }
  const clinic = workspaces.find((w) => w.type === 'clinic');
  const fallbackId = clinic?.id || workspaces[0]?.id || PERSONAL_WORKSPACE_ID;
  safeSetStorage(ACTIVE_WORKSPACE_ID_KEY, fallbackId);
  return fallbackId;
}

export function saveActiveWorkspaceId(workspaceId: string): void {
  safeSetStorage(ACTIVE_WORKSPACE_ID_KEY, workspaceId);
}

export function syncSliceToMasterRealStorage<K extends keyof WorkspaceScopedData>(
  workspaceId: string,
  slice: K,
  value: WorkspaceScopedData[K]
): void {
  try {
    const raw = safeGetStorage(MASTER_REAL_DATA_STORAGE_KEY);
    const store: MasterRealDataStore = raw
      ? safeParse<MasterRealDataStore>(raw, { version: 1, updatedAt: '', workspaces: {} })
      : { version: 1, updatedAt: '', workspaces: {} };

    if (!store.workspaces) store.workspaces = {};
    if (!store.workspaces[workspaceId]) store.workspaces[workspaceId] = {};
    store.workspaces[workspaceId][slice] = value;
    store.updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(MASTER_REAL_DATA_STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      if (isQuotaExceededError(err)) {
        // Primary per-partition keys already hold liveBoards & auditLogs; compact mirror store so iPad never hits quota
        for (const wsKey of Object.keys(store.workspaces)) {
          delete store.workspaces[wsKey].liveBoards;
          delete store.workspaces[wsKey].auditLogs;
        }
        safeSetStorage(MASTER_REAL_DATA_STORAGE_KEY, JSON.stringify(store));
      }
    }
  } catch (err) {
    console.warn('Failed to sync slice to master real storage:', err);
  }
}

export function loadWorkspaceData(workspaceId: string, _type: WorkspaceType): WorkspaceScopedData {
  const defaultSheetConfig: SheetConfig = {
    webAppUrl: '',
    inventorySheetUrl: '',
    satisfactionSheetUrl: '',
    satisfactionFormUrl: '',
    satisfactionRawTabName: 'การตอบแบบฟอร์ม 1',
    token: '',
    operatorName: ''
  };

  const defaultSatSettings: SatisfactionSettings = {
    monthlyGoal: 30,
    surveyUrl: '',
    rawSheetTabName: 'การตอบแบบฟอร์ม 1'
  };

  // Strict per-workspace isolation: NEVER fall back to top-level masterStore slices across workspaces
  const rawMaster = safeGetStorage(MASTER_REAL_DATA_STORAGE_KEY);
  const masterStore = rawMaster ? safeParse<MasterRealDataStore | null>(rawMaster, null) : null;
  const masterWsData = masterStore?.workspaces?.[workspaceId];

  const resolveSlice = <K extends keyof WorkspaceScopedData>(
    slice: K,
    partitionSuffix: string,
    defaultVal: WorkspaceScopedData[K]
  ): WorkspaceScopedData[K] => {
    if (slice === 'satisfactionResponses') {
      const realSat = safeParse<WorkspaceScopedData['satisfactionResponses'] | null>(
        safeGetStorage(CLINIC_REAL_SATISFACTION_STORAGE_KEY),
        null
      );
      if (realSat !== null && Array.isArray(realSat)) {
        return realSat as WorkspaceScopedData[K];
      }
    }
    const fromPart = safeParse<WorkspaceScopedData[K] | null>(
      safeGetStorage(getPartitionKey(workspaceId, partitionSuffix)),
      null
    );
    if (fromPart !== null && fromPart !== undefined) {
      return fromPart;
    }
    if (masterWsData && masterWsData[slice] !== undefined) {
      return masterWsData[slice] as WorkspaceScopedData[K];
    }
    if (slice === 'dentureCases' && workspaceId === CLINIC_WORKSPACE_ID) {
      const legacyDenture = safeParse<WorkspaceScopedData['dentureCases'] | null>(
        safeGetStorage(CLINIC_PROSTHO_RECALL_STORAGE_KEY),
        null
      );
      if (legacyDenture !== null && Array.isArray(legacyDenture)) {
        return legacyDenture as WorkspaceScopedData[K];
      }
    }
    return defaultVal;
  };

  const partSheetCfg = safeParse<Partial<SheetConfig> | null>(
    safeGetStorage(getPartitionKey(workspaceId, 'sheet_config')),
    null
  );
  const resolvedSheetConfig: SheetConfig = {
    ...defaultSheetConfig,
    ...(partSheetCfg || masterWsData?.sheetConfig || {})
  };

  const partSatSettings = safeParse<Partial<SatisfactionSettings> | null>(
    safeGetStorage(getPartitionKey(workspaceId, 'satisfaction_settings')),
    null
  );
  const resolvedSatSettings: SatisfactionSettings = {
    ...defaultSatSettings,
    ...(partSatSettings || masterWsData?.satisfactionSettings || {})
  };

  const rawLiveBoards = resolveSlice('liveBoards', 'live_boards', createDefaultLiveCategoryBoards());
  const realStockRecords = safeParse<LiveCategoryRecord[] | null>(
    safeGetStorage(DENTAL_STOCK_INVENTORY_STORAGE_KEY),
    null
  );
  let resolvedLiveBoards: LiveCategoryBoard[];
  if (realStockRecords !== null && Array.isArray(realStockRecords)) {
    resolvedLiveBoards = rawLiveBoards.map((b) =>
      b.id === 'board-stock-inventory' ? { ...b, records: realStockRecords } : b
    );
  } else {
    const defaultStock = getDefaultDentalStockRecords();
    safeSetStorage(DENTAL_STOCK_INVENTORY_STORAGE_KEY, JSON.stringify(defaultStock));
    resolvedLiveBoards = rawLiveBoards.map((b) =>
      b.id === 'board-stock-inventory'
        ? { ...b, records: b.records && b.records.length > 0 ? b.records : defaultStock }
        : b
    );
  }

  const partChatState = safeParse<Partial<WorkspaceChatState> | null>(
    safeGetStorage(getPartitionKey(workspaceId, 'chat_drafts')),
    null
  );
  const resolvedChatState: WorkspaceChatState = {
    ...createDefaultWorkspaceChatState(),
    ...(masterWsData?.chatState || {}),
    ...(partChatState || {})
  };

  const resolvedData: WorkspaceScopedData = {
    tasks: resolveSlice('tasks', 'tasks', []),
    queueItems: resolveSlice('queueItems', 'queue', []),
    labOrders: resolveSlice('labOrders', 'labs', []),
    followUps: resolveSlice('followUps', 'followups', []),
    evidenceList: resolveSlice('evidenceList', 'evidence', []),
    inboxItems: resolveSlice('inboxItems', 'inbox', []),
    sheetConfig: resolvedSheetConfig,
    dentureCases: resolveSlice('dentureCases', 'denture_cases', []),
    satisfactionResponses: resolveSlice('satisfactionResponses', 'satisfaction_responses', []),
    satisfactionSettings: resolvedSatSettings,
    templates: resolveSlice('templates', 'templates', []),
    workflows: resolveSlice('workflows', 'workflows', []),
    customCategories: resolveSlice('customCategories', 'custom_categories', []),
    privateNotes: resolveSlice('privateNotes', 'private_notes', []),
    dailyGoals: resolveSlice('dailyGoals', 'daily_goals', []),
    liveBoards: resolvedLiveBoards,
    auditLogs: resolveSlice('auditLogs', 'audit_logs', []),
    chatState: resolvedChatState
  };

  if (!masterWsData) {
    (Object.keys(resolvedData) as Array<keyof WorkspaceScopedData>).forEach((k) => {
      syncSliceToMasterRealStorage(workspaceId, k, resolvedData[k]);
    });
  }

  return resolvedData;
}

export function saveWorkspaceDataSlice<K extends keyof WorkspaceScopedData>(
  workspaceId: string,
  slice: K,
  value: WorkspaceScopedData[K]
): void {
  const sliceMap: Record<keyof WorkspaceScopedData, string> = {
    tasks: 'tasks',
    queueItems: 'queue',
    labOrders: 'labs',
    followUps: 'followups',
    evidenceList: 'evidence',
    inboxItems: 'inbox',
    sheetConfig: 'sheet_config',
    dentureCases: 'denture_cases',
    satisfactionResponses: 'satisfaction_responses',
    satisfactionSettings: 'satisfaction_settings',
    templates: 'templates',
    workflows: 'workflows',
    customCategories: 'custom_categories',
    privateNotes: 'private_notes',
    dailyGoals: 'daily_goals',
    liveBoards: 'live_boards',
    auditLogs: 'audit_logs',
    chatState: 'chat_drafts'
  };
  safeSetStorage(getPartitionKey(workspaceId, sliceMap[slice]), JSON.stringify(value));
  if (slice === 'satisfactionResponses') {
    safeSetStorage(CLINIC_REAL_SATISFACTION_STORAGE_KEY, JSON.stringify(value));
  }
  if (slice === 'dentureCases' && workspaceId === CLINIC_WORKSPACE_ID) {
    safeSetStorage(CLINIC_PROSTHO_RECALL_STORAGE_KEY, JSON.stringify(value));
  }
  if (slice === 'liveBoards') {
    const boards = value as LiveCategoryBoard[];
    const stockBoard = boards.find((b) => b.id === 'board-stock-inventory');
    if (stockBoard && Array.isArray(stockBoard.records)) {
      safeSetStorage(DENTAL_STOCK_INVENTORY_STORAGE_KEY, JSON.stringify(stockBoard.records));
    }
  }
  syncSliceToMasterRealStorage(workspaceId, slice, value);
}

export function saveWorkspaceData(workspaceId: string, data: WorkspaceScopedData): void {
  (Object.keys(data) as Array<keyof WorkspaceScopedData>).forEach((key) => {
    saveWorkspaceDataSlice(workspaceId, key, data[key]);
  });
}

export function deleteWorkspaceStoragePartition(workspaceId: string): void {
  const suffixes = [
    'tasks',
    'queue',
    'labs',
    'followups',
    'evidence',
    'inbox',
    'sheet_config',
    'denture_cases',
    'satisfaction_responses',
    'satisfaction_settings',
    'templates',
    'workflows',
    'custom_categories',
    'private_notes',
    'daily_goals',
    'live_boards',
    'audit_logs',
    'chat_drafts',
    'initialized'
  ];
  suffixes.forEach((suffix) => safeRemoveStorage(getPartitionKey(workspaceId, suffix)));
  try {
    const raw = safeGetStorage(MASTER_REAL_DATA_STORAGE_KEY);
    if (raw) {
      const store = safeParse<MasterRealDataStore | null>(raw, null);
      if (store?.workspaces && store.workspaces[workspaceId]) {
        delete store.workspaces[workspaceId];
        store.updatedAt = new Date().toISOString();
        safeSetStorage(MASTER_REAL_DATA_STORAGE_KEY, JSON.stringify(store));
      }
    }
  } catch {
    // ignore
  }
}

export function resetWorkspacePartitionToDemo(
  workspaceId: string,
  type: WorkspaceType
): WorkspaceScopedData {
  const cleared =
    type === 'personal'
      ? createInitialPersonalData(workspaceId)
      : createInitialClinicData(workspaceId, false);
  saveWorkspaceData(workspaceId, cleared);
  safeSetStorage(getPartitionKey(workspaceId, 'initialized'), '1');
  return cleared;
}

export function buildSecondClinicWorkspace(
  inviteCode: string,
  role: ClinicRole = 'assistant'
): Workspace {
  const today = new Date().toISOString().split('T')[0];
  const cleanCode = inviteCode.trim().toUpperCase() || DEMO_SECOND_CLINIC_INVITE_CODE;
  const id = `ws-clinic-joined-${cleanCode.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  return {
    id,
    type: 'clinic',
    name: `Assistant Team (${cleanCode})`,
    description: 'Joined assistant workspace with isolated lab, task, and recall records.',
    tenantCode: cleanCode,
    planTier: 'clinic_enterprise',
    ownerId: 'mem-branch-owner',
    currentUserRole: role,
    members: [
      {
        id: 'mem-branch-owner',
        name: 'Team Owner',
        email: 'owner@assistant.local',
        initials: 'TO',
        role: 'owner',
        assignedRooms: ['All Rooms'],
        joinedAt: today,
        status: 'active'
      },
      {
        id: 'mem-self-joined',
        name: 'Current User (Joined Member)',
        email: 'me@assistant.local',
        initials: 'ME',
        role,
        assignedRooms: ['ห้อง 1 (Room 1)'],
        joinedAt: today,
        status: 'active'
      }
    ],
    rooms: ['ห้อง 1 (Room 1)', 'ห้อง 2 (Room 2)'],
    enabledModules: buildDefaultEnabledModules('clinic'),
    createdAt: today,
    localized: {
      th: {
        name: `ทีมผู้ช่วย (${cleanCode})`,
        description: 'พื้นที่ทีมผู้ช่วยที่เข้าร่วมใหม่ แยกข้อมูลและสิทธิ์การใช้งานจากพื้นที่อื่น'
      },
      en: {
        name: `Assistant Team (${cleanCode})`,
        description: 'Joined assistant workspace with isolated lab, task, and recall records.'
      }
    }
  };
}

export function exportWorkspaceBackupJson(workspace: Workspace, data: WorkspaceScopedData): string {
  const stockInventory = safeParse<LiveCategoryRecord[]>(
    safeGetStorage(DENTAL_STOCK_INVENTORY_STORAGE_KEY),
    []
  );
  const attachments = getAllLocalAttachments();
  const chairsideCopilot = loadChairsideSession(workspace.id);
  const customBuilder = loadCustomBuilderData(workspace.id);
  const followUpCalls = loadFollowUpCallLogs(workspace.id);
  const followUpSipConfig = loadFollowUpSipConfig(workspace.id);

  const payload = {
    schemaVersion: 'dental-platform-backup-v2',
    exportedAt: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      type: workspace.type,
      name: workspace.name,
      tenantCode: workspace.tenantCode,
      planTier: workspace.planTier,
      enabledModules: workspace.enabledModules
    },
    data: {
      ...data,
      sheetConfig: {
        ...data.sheetConfig,
        token: data.sheetConfig.token ? '[REDACTED_TOKEN]' : ''
      }
    },
    attachments,
    dentalStockInventory: stockInventory,
    isolatedModules: {
      chairsideCopilot,
      customBuilder,
      followUpCalls,
      followUpSipConfig
    }
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportBackupResult {
  ok: boolean;
  importedCount: number;
  mergedData?: WorkspaceScopedData;
  error?: string;
}

export function importWorkspaceBackupJson(
  workspaceId: string,
  rawJson: string,
  existingData: WorkspaceScopedData
): ImportBackupResult {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, importedCount: 0, error: 'Invalid JSON backup object' };
    }

    const source =
      parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as Record<string, unknown>)
        : parsed;

    const pickArray = <T,>(key: keyof WorkspaceScopedData, fallback: T[]): T[] => {
      const val = source[key as string];
      return Array.isArray(val) ? (val as T[]) : fallback;
    };

    const incomingSheet =
      source.sheetConfig && typeof source.sheetConfig === 'object'
        ? (source.sheetConfig as Partial<SheetConfig>)
        : {};
    const incomingToken =
      typeof incomingSheet.token === 'string' && incomingSheet.token !== '[REDACTED_TOKEN]'
        ? incomingSheet.token
        : existingData.sheetConfig.token;

    const mergedSheetConfig: SheetConfig = {
      ...existingData.sheetConfig,
      ...incomingSheet,
      token: incomingToken || ''
    };

    const incomingSatSettings =
      source.satisfactionSettings && typeof source.satisfactionSettings === 'object'
        ? (source.satisfactionSettings as Partial<SatisfactionSettings>)
        : {};

    const mergedSatSettings: SatisfactionSettings = {
      ...existingData.satisfactionSettings,
      ...incomingSatSettings
    };

    const incomingChat =
      source.chatState && typeof source.chatState === 'object'
        ? (source.chatState as Partial<WorkspaceChatState>)
        : {};

    const mergedChatState: WorkspaceChatState = {
      ...createDefaultWorkspaceChatState(),
      ...existingData.chatState,
      ...incomingChat,
      history: Array.isArray(incomingChat.history)
        ? incomingChat.history
        : existingData.chatState?.history || []
    };

    const mergedData: WorkspaceScopedData = {
      tasks: pickArray('tasks', existingData.tasks),
      queueItems: pickArray('queueItems', existingData.queueItems),
      labOrders: pickArray('labOrders', existingData.labOrders),
      followUps: pickArray('followUps', existingData.followUps),
      evidenceList: pickArray('evidenceList', existingData.evidenceList),
      inboxItems: pickArray('inboxItems', existingData.inboxItems),
      sheetConfig: mergedSheetConfig,
      dentureCases: pickArray('dentureCases', existingData.dentureCases),
      satisfactionResponses: pickArray(
        'satisfactionResponses',
        existingData.satisfactionResponses
      ),
      satisfactionSettings: mergedSatSettings,
      templates: pickArray('templates', existingData.templates),
      workflows: pickArray('workflows', existingData.workflows),
      customCategories: pickArray('customCategories', existingData.customCategories),
      privateNotes: pickArray('privateNotes', existingData.privateNotes),
      dailyGoals: pickArray('dailyGoals', existingData.dailyGoals),
      liveBoards: pickArray('liveBoards', existingData.liveBoards),
      auditLogs: pickArray('auditLogs', existingData.auditLogs),
      chatState: mergedChatState
    };

    const hasRecognizedSlice = (
      Object.keys(mergedData) as Array<keyof WorkspaceScopedData>
    ).some((k) => source[k as string] !== undefined);

    if (!hasRecognizedSlice) {
      return {
        ok: false,
        importedCount: 0,
        error: 'ไม่พบชุดข้อมูลงานในไฟล์ JSON นี้ (Unrecognized backup format)'
      };
    }

    // Restore compressed attachments into localStorage if present
    let importedAttachmentsCount = 0;
    const incomingAttachments =
      parsed.attachments && typeof parsed.attachments === 'object'
        ? (parsed.attachments as Record<string, LocalAttachmentRecord>)
        : source.attachments && typeof source.attachments === 'object'
        ? (source.attachments as Record<string, LocalAttachmentRecord>)
        : null;
    if (incomingAttachments) {
      importedAttachmentsCount = importLocalAttachments(incomingAttachments, 'merge');
      void syncAttachmentsMapToIndexedDb(incomingAttachments);
    }

    // Restore stock inventory snapshot if present (including empty cleared arrays)
    const incomingStock = parsed.dentalStockInventory;
    if (Array.isArray(incomingStock)) {
      safeSetStorage(DENTAL_STOCK_INVENTORY_STORAGE_KEY, JSON.stringify(incomingStock));
      mergedData.liveBoards = mergedData.liveBoards.map((b) =>
        b.id === 'board-stock-inventory' ? { ...b, records: incomingStock as LiveCategoryRecord[] } : b
      );
    }

    // Restore isolated modules (Chairside Copilot, Safe Custom Builder, Voice Follow-up & Optional SIP)
    let isolatedImportedCount = 0;
    const incomingIsolated =
      parsed.isolatedModules && typeof parsed.isolatedModules === 'object'
        ? (parsed.isolatedModules as Record<string, unknown>)
        : null;
    if (incomingIsolated) {
      if (incomingIsolated.chairsideCopilot && typeof incomingIsolated.chairsideCopilot === 'object') {
        const cs = incomingIsolated.chairsideCopilot as ChairsideSessionState;
        saveChairsideSession(workspaceId, cs);
        isolatedImportedCount += Array.isArray(cs.messages) ? cs.messages.length : 0;
      }
      if (incomingIsolated.customBuilder && typeof incomingIsolated.customBuilder === 'object') {
        const cb = incomingIsolated.customBuilder as CustomBuilderStoreData;
        saveCustomBuilderData(workspaceId, cb);
        isolatedImportedCount += Array.isArray(cb.items) ? cb.items.length : 0;
      }
      if (Array.isArray(incomingIsolated.followUpCalls)) {
        const logs = incomingIsolated.followUpCalls as FollowUpCallLog[];
        saveFollowUpCallLogs(workspaceId, logs);
        isolatedImportedCount += logs.length;
      }
      if (incomingIsolated.followUpSipConfig && typeof incomingIsolated.followUpSipConfig === 'object') {
        saveFollowUpSipConfig(workspaceId, incomingIsolated.followUpSipConfig as FollowUpSipConfig);
      }
    }

    saveWorkspaceData(workspaceId, mergedData);
    safeSetStorage(getPartitionKey(workspaceId, 'initialized'), '1');

    const importedCount =
      mergedData.tasks.length +
      mergedData.queueItems.length +
      mergedData.labOrders.length +
      mergedData.followUps.length +
      mergedData.dentureCases.length +
      mergedData.satisfactionResponses.length +
      mergedData.privateNotes.length +
      mergedData.evidenceList.length +
      mergedData.chatState.history.length +
      importedAttachmentsCount +
      isolatedImportedCount +
      mergedData.liveBoards.reduce((sum, b) => sum + (Array.isArray(b.records) ? b.records.length : 0), 0);

    return { ok: true, importedCount, mergedData };
  } catch (err) {
    return {
      ok: false,
      importedCount: 0,
      error: err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ JSON สำรองข้อมูลได้'
    };
  }
}
