import { deleteEvidenceFile } from './evidenceStorage';

export type CustomBuilderItemType = 'task_card' | 'checklist' | 'script';

export interface CustomChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

export interface CustomBuilderItem {
  id: string;
  type: CustomBuilderItemType;
  categoryName: string;
  title: string;
  description: string;
  scriptText: string;
  checklist: CustomChecklistEntry[];
  status: 'active' | 'completed';
  attachmentEvidenceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomBuilderStoreData {
  categories: string[];
  items: CustomBuilderItem[];
}

export const CUSTOM_BUILDER_KEY_PREFIX = 'dental_safe_custom_builder_v1::';

const DEFAULT_CUSTOM_CATEGORIES: string[] = [
  'เช็กลิสต์เปิด-ปิดห้องตรวจ',
  'สคริปต์แนะนำคนไข้หน้างาน',
  'งานเตรียมอุปกรณ์พิเศษ'
];

export function getCustomBuilderStorageKey(workspaceId: string): string {
  return `${CUSTOM_BUILDER_KEY_PREFIX}${workspaceId}`;
}

export function loadCustomBuilderData(workspaceId: string): CustomBuilderStoreData {
  try {
    const raw = localStorage.getItem(getCustomBuilderStorageKey(workspaceId));
    if (!raw) {
      return {
        categories: [...DEFAULT_CUSTOM_CATEGORIES],
        items: []
      };
    }
    const parsed = JSON.parse(raw) as Partial<CustomBuilderStoreData>;
    return {
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          : [...DEFAULT_CUSTOM_CATEGORIES],
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch {
    return {
      categories: [...DEFAULT_CUSTOM_CATEGORIES],
      items: []
    };
  }
}

export function saveCustomBuilderData(
  workspaceId: string,
  data: CustomBuilderStoreData
): boolean {
  try {
    localStorage.setItem(getCustomBuilderStorageKey(workspaceId), JSON.stringify(data));
    return true;
  } catch {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dental-storage-quota-warning', {
          detail: { key: getCustomBuilderStorageKey(workspaceId) }
        })
      );
    }
    return false;
  }
}

export async function clearCustomBuilderData(workspaceId: string): Promise<void> {
  const existing = loadCustomBuilderData(workspaceId);
  for (const item of existing.items) {
    if (item.attachmentEvidenceId) {
      await deleteEvidenceFile(item.attachmentEvidenceId).catch(() => undefined);
    }
  }
  try {
    localStorage.removeItem(getCustomBuilderStorageKey(workspaceId));
  } catch {
    // ignore
  }
}
