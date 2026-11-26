import { Workspace } from '../types/platform';
import type { WorkspaceScopedData } from '../services/workspaceStorage';

export const JUDGE_DEMO_PERSONAL_ID = 'ws-judge-demo-personal';
export const JUDGE_DEMO_CLINIC_ID = 'ws-judge-demo-clinic';

export function isJudgeDemoWorkspaceId(_workspaceId: string): boolean {
  return false;
}

export function createJudgeDemoWorkspaces(): Workspace[] {
  return [];
}

export function createJudgeDemoScopedData(workspaceId: string): WorkspaceScopedData {
  void workspaceId;
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
    satisfactionSettings: {
      monthlyGoal: 30,
      surveyUrl: '',
      rawSheetTabName: 'การตอบแบบฟอร์ม 1'
    },
    templates: [],
    workflows: [],
    customCategories: [],
    privateNotes: [],
    dailyGoals: [],
    liveBoards: [],
    auditLogs: [],
    chatState: {
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
    }
  };
}
