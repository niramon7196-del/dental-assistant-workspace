import {
  TaskItem,
  LabOrder,
  PatientFollowUpItem,
  EvidenceItem,
  InboxItem,
  TaskActivity,
  LabHistoryItem
} from '../types/dental';
import type { Language } from '../utils/i18n';

// Clean initial workspace arrays (zero pre-seeded fake/demo records)
export const INITIAL_TASKS: TaskItem[] = [];

export const INITIAL_LAB_ORDERS: LabOrder[] = [];

export const INITIAL_FOLLOW_UPS: PatientFollowUpItem[] = [];

export const INITIAL_EVIDENCE: EvidenceItem[] = [];

export const INITIAL_INBOX_ITEMS: InboxItem[] = [];

export function resolveLocalizedTask(task: TaskItem, language: Language): TaskItem {
  const fromItem = task.localized?.[language];
  if (fromItem) {
    return { ...task, title: fromItem.title, description: fromItem.description };
  }
  return task;
}

export function resolveLocalizedTaskActivity(
  act: TaskActivity,
  _taskId: string,
  language: Language
): TaskActivity {
  const fromItem = act.localized?.[language];
  if (fromItem) {
    return { ...act, action: fromItem.action, user: fromItem.user };
  }
  return act;
}

export function resolveLocalizedLab(lab: LabOrder, language: Language): LabOrder {
  const fromItem = lab.localized?.[language];
  if (fromItem) {
    return {
      ...lab,
      laboratoryName: fromItem.laboratoryName,
      dentistName: fromItem.dentistName
    };
  }
  return lab;
}

export function resolveLocalizedLabHistory(
  wh: LabHistoryItem,
  _labId: string,
  language: Language
): LabHistoryItem {
  const fromItem = wh.localized?.[language];
  if (fromItem) {
    return { ...wh, notes: fromItem.notes };
  }
  return wh;
}

export function resolveLocalizedFollowUp(
  fu: PatientFollowUpItem,
  language: Language
): PatientFollowUpItem {
  const fromItem = fu.localized?.[language];
  if (fromItem) {
    return {
      ...fu,
      caseCategory: fromItem.caseCategory,
      followUpReason: fromItem.followUpReason,
      nextAction: fromItem.nextAction
    };
  }
  return fu;
}

export function resolveLocalizedEvidence(ev: EvidenceItem, language: Language): EvidenceItem {
  const fromItem = ev.localized?.[language];
  if (fromItem) {
    return { ...ev, description: fromItem.description };
  }
  return ev;
}

export function resolveLocalizedInboxItem(item: InboxItem, language: Language): InboxItem {
  const fromItem = item.localized?.[language];
  if (fromItem) {
    return {
      ...item,
      title: fromItem.title,
      rawContent: fromItem.rawContent,
      dentistName: fromItem.dentistName
    };
  }
  return item;
}
