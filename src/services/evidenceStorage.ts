export const DENTAL_ATTACHMENTS_STORAGE_KEY = 'dental_workspace_attachments_v1';

export const DENTAL_EVIDENCE_IDB_NAME = 'dental_workspace_evidence_db';
export const DENTAL_EVIDENCE_IDB_STORE = 'evidence_files';

const DB_NAME = DENTAL_EVIDENCE_IDB_NAME;
const DB_VERSION = 1;
const STORE_NAME = DENTAL_EVIDENCE_IDB_STORE;

const MAX_LOCAL_RAW_FILE_BYTES = 220 * 1024;
const DEFAULT_IMAGE_MAX_DIM = 880;
const DEFAULT_IMAGE_QUALITY = 0.72;
const COMPACT_IMAGE_MAX_DIM = 600;
const COMPACT_IMAGE_QUALITY = 0.56;

export interface StoredEvidenceFile {
  id: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
  receivedAt: string;
  dataUrl?: string;
}

export interface LocalAttachmentRecord {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  compressedSize: number;
  dataUrl?: string;
  receivedAt: string;
  isThumbnailOnly?: boolean;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    Boolean(e.message && /quota/i.test(e.message))
  );
}

function readAllLocalAttachmentsMap(): Record<string, LocalAttachmentRecord> {
  try {
    const raw = localStorage.getItem(DENTAL_ATTACHMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, LocalAttachmentRecord>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeAllLocalAttachmentsMap(map: Record<string, LocalAttachmentRecord>): boolean {
  try {
    localStorage.setItem(DENTAL_ATTACHMENTS_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Failed to write attachments to localStorage:', err);
      return false;
    }

    // Attempt recovery: prune oldest records until it fits, keeping newest entry
    const entries = Object.entries(map).sort((a, b) =>
      (b[1].receivedAt || '').localeCompare(a[1].receivedAt || '')
    );
    const trimmed = { ...map };
    for (let i = entries.length - 1; i >= 1; i--) {
      const [oldId, oldRec] = entries[i];
      if (oldRec.dataUrl) {
        delete trimmed[oldId];
        try {
          localStorage.setItem(DENTAL_ATTACHMENTS_STORAGE_KEY, JSON.stringify(trimmed));
          return true;
        } catch {
          // continue pruning older attachments
        }
      }
    }
    return false;
  }
}

export function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) {
      return new Blob([], { type: fallbackMime });
    }
    const header = parts[0];
    const base64 = parts[1];
    const mimeMatch = header.match(/data:([^;]+);/i);
    const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return new Blob([], { type: fallbackMime });
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as DataURL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = async () => {
      URL.revokeObjectURL(objUrl);
      try {
        const dataUrl = await blobToDataUrl(blob);
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => reject(new Error('Unable to decode image'));
        fallbackImg.src = dataUrl;
      } catch (err) {
        reject(err);
      }
    };
    img.src = objUrl;
  });
}

export async function compressImageToDataUrl(
  file: Blob,
  maxDim = DEFAULT_IMAGE_MAX_DIM,
  quality = DEFAULT_IMAGE_QUALITY
): Promise<{ dataUrl: string; mimeType: string; compressedSize: number }> {
  if (typeof document === 'undefined') {
    const rawDataUrl = await blobToDataUrl(file);
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || 'image/jpeg',
      compressedSize: file.size
    };
  }

  try {
    const img = await loadImageElement(file);
    const srcW = img.naturalWidth || img.width || maxDim;
    const srcH = img.naturalHeight || img.height || maxDim;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const rawDataUrl = await blobToDataUrl(file);
      return {
        dataUrl: rawDataUrl,
        mimeType: file.type || 'image/jpeg',
        compressedSize: file.size
      };
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let outMime = 'image/jpeg';
    let dataUrl = canvas.toDataURL(outMime, quality);

    // Adaptive second pass if still > 260 KB base64 length
    if (dataUrl.length > 350_000 && (maxDim > COMPACT_IMAGE_MAX_DIM || quality > COMPACT_IMAGE_QUALITY)) {
      const compactScale = Math.min(1, COMPACT_IMAGE_MAX_DIM / Math.max(srcW, srcH));
      const cW = Math.max(1, Math.round(srcW * compactScale));
      const cH = Math.max(1, Math.round(srcH * compactScale));
      canvas.width = cW;
      canvas.height = cH;
      const cCtx = canvas.getContext('2d');
      if (cCtx) {
        cCtx.fillStyle = '#ffffff';
        cCtx.fillRect(0, 0, cW, cH);
        cCtx.drawImage(img, 0, 0, cW, cH);
        dataUrl = canvas.toDataURL('image/jpeg', COMPACT_IMAGE_QUALITY);
      }
    }

    const approxBytes = Math.round((dataUrl.length * 3) / 4);
    return {
      dataUrl,
      mimeType: outMime,
      compressedSize: approxBytes
    };
  } catch {
    const rawDataUrl = await blobToDataUrl(file);
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || 'image/jpeg',
      compressedSize: file.size
    };
  }
}

function openEvidenceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('เบราว์เซอร์ไม่รองรับ IndexedDB สำหรับจัดเก็บไฟล์'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('ไม่สามารถเปิด IndexedDB ได้'));
  });
}

export async function saveEvidenceFile(
  id: string,
  file: Blob,
  filename: string,
  mimeType: string,
  receivedAt: string
): Promise<void> {
  const effectiveMime = mimeType || file.type || 'application/octet-stream';
  let blobToStore: Blob = file;
  let effectiveStoredMime = effectiveMime;
  let localRecord: LocalAttachmentRecord = {
    id,
    filename,
    mimeType: effectiveMime,
    size: file.size,
    compressedSize: file.size,
    receivedAt
  };

  if (effectiveMime.startsWith('image/')) {
    const compressed = await compressImageToDataUrl(file);
    localRecord = {
      id,
      filename,
      mimeType: compressed.mimeType,
      size: file.size,
      compressedSize: compressed.compressedSize,
      dataUrl: compressed.dataUrl,
      receivedAt,
      isThumbnailOnly: true
    };
    blobToStore = dataUrlToBlob(compressed.dataUrl, compressed.mimeType);
    effectiveStoredMime = compressed.mimeType;
  } else if (file.size <= MAX_LOCAL_RAW_FILE_BYTES) {
    try {
      const dataUrl = await blobToDataUrl(file);
      localRecord = {
        id,
        filename,
        mimeType: effectiveMime,
        size: file.size,
        compressedSize: file.size,
        dataUrl,
        receivedAt
      };
    } catch {
      // Keep metadata only if DataURL read fails
    }
  }

  // Persist compressed attachment / metadata to localStorage immediately
  const existingMap = readAllLocalAttachmentsMap();
  existingMap[id] = localRecord;
  const savedToLocal = writeAllLocalAttachmentsMap(existingMap);
  if (!savedToLocal && localRecord.dataUrl && effectiveMime.startsWith('image/')) {
    // Ultra-compact fallback retry on iPad storage pressure
    const ultraCompact = await compressImageToDataUrl(file, 420, 0.45);
    existingMap[id] = {
      ...localRecord,
      compressedSize: ultraCompact.compressedSize,
      dataUrl: ultraCompact.dataUrl
    };
    writeAllLocalAttachmentsMap(existingMap);
  }

  // Also persist best-effort to IndexedDB for offline binary retrieval
  try {
    const db = await openEvidenceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredEvidenceFile = {
        id,
        blob: blobToStore,
        filename,
        mimeType: effectiveStoredMime,
        size: blobToStore.size,
        receivedAt
      };
      store.put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('บันทึกไฟล์ลง IndexedDB ไม่สำเร็จ'));
      };
    });
  } catch {
    // LocalStorage persistence already succeeded; IndexedDB optional
  }
}

export async function getEvidenceFile(id: string): Promise<StoredEvidenceFile | null> {
  // 1. Check localStorage first (instant and immune to IndexedDB eviction / JSON restore)
  const localMap = readAllLocalAttachmentsMap();
  const localRec = localMap[id];
  if (localRec?.dataUrl) {
    const blob = dataUrlToBlob(localRec.dataUrl, localRec.mimeType);
    return {
      id: localRec.id,
      blob,
      filename: localRec.filename,
      mimeType: localRec.mimeType,
      size: localRec.compressedSize || blob.size,
      receivedAt: localRec.receivedAt,
      dataUrl: localRec.dataUrl
    };
  }

  // 2. Fallback to IndexedDB (for large PDFs / spreadsheets > 220 KB)
  try {
    const db = await openEvidenceDb();
    return await new Promise<StoredEvidenceFile | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredEvidenceFile) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('อ่านไฟล์จาก IndexedDB ไม่สำเร็จ'));
      };
    });
  } catch {
    return null;
  }
}

export async function deleteEvidenceFile(id: string): Promise<void> {
  const existingMap = readAllLocalAttachmentsMap();
  if (id in existingMap) {
    delete existingMap[id];
    writeAllLocalAttachmentsMap(existingMap);
  }

  try {
    const db = await openEvidenceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('ลบไฟล์จาก IndexedDB ไม่สำเร็จ'));
      };
    });
  } catch {
    // Ignore IDB errors if not available
  }
}

export async function clearAllEvidenceFiles(): Promise<void> {
  try {
    localStorage.removeItem(DENTAL_ATTACHMENTS_STORAGE_KEY);
  } catch {
    // ignore
  }

  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openEvidenceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('ล้างไฟล์ใน IndexedDB ไม่สำเร็จ'));
      };
    });
  } catch {
    // ignore
  }
}

export function getAllLocalAttachments(): Record<string, LocalAttachmentRecord> {
  return readAllLocalAttachmentsMap();
}

export function importLocalAttachments(
  incoming: Record<string, LocalAttachmentRecord> | undefined | null,
  mode: 'merge' | 'replace' = 'merge'
): number {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return 0;
  }
  const base = mode === 'replace' ? {} : readAllLocalAttachmentsMap();
  let count = 0;
  for (const [key, rec] of Object.entries(incoming)) {
    if (rec && typeof rec === 'object' && typeof rec.id === 'string') {
      base[key] = rec;
      count += 1;
    }
  }
  writeAllLocalAttachmentsMap(base);
  return count;
}

export async function syncAttachmentsMapToIndexedDb(
  incoming: Record<string, LocalAttachmentRecord> | undefined | null
): Promise<number> {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return 0;
  }
  if (typeof indexedDB === 'undefined') {
    return 0;
  }
  const entries = Object.values(incoming).filter(
    (rec): rec is LocalAttachmentRecord =>
      Boolean(rec && typeof rec === 'object' && typeof rec.id === 'string' && rec.dataUrl)
  );
  if (entries.length === 0) return 0;

  try {
    const db = await openEvidenceDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let written = 0;
      for (const rec of entries) {
        if (!rec.dataUrl) continue;
        const blob = dataUrlToBlob(rec.dataUrl, rec.mimeType || 'application/octet-stream');
        const record: StoredEvidenceFile = {
          id: rec.id,
          blob,
          filename: rec.filename || rec.id,
          mimeType: rec.mimeType || blob.type || 'application/octet-stream',
          size: blob.size || rec.compressedSize || rec.size || 0,
          receivedAt: rec.receivedAt || new Date().toISOString()
        };
        store.put(record);
        written += 1;
      }
      tx.oncomplete = () => {
        db.close();
        resolve(written);
      };
      tx.onerror = () => {
        db.close();
        resolve(written);
      };
    });
  } catch {
    return 0;
  }
}
