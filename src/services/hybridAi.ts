/**
 * Hybrid AI via Firebase AI Logic (Gemini Developer API backend).
 *
 * Mode: PREFER_ON_DEVICE -> Chrome built-in Gemini Nano when available, otherwise
 * automatic fallback to the cloud model. Requires Chrome Desktop 139+ and the flag
 * chrome://flags/#prompt-api-for-gemini-nano-multimodal-input. iPad Safari/Chrome
 * cannot run on-device; they always use the cloud path (the UI says so).
 *
 * Privacy: callers pass text that was already PII-masked (maskSensitivePii).
 * Any failure here returns null from `tryHybridText`, so callers fall back to /api/ai/*.
 */
import { getFirebaseApp, readFirebaseConfig } from './firebaseApp';

export type HybridSource = 'on-device' | 'cloud' | 'unknown';

export interface HybridStatus {
  /** User switched Hybrid mode on (persisted). */
  enabled: boolean;
  /** Firebase env vars are present. */
  configured: boolean;
  /** Browser exposes Chrome's built-in Prompt API. */
  deviceCapable: boolean;
  downloading: boolean;
  /** 0..1 */
  progress: number;
  deviceReady: boolean;
  lastSource: HybridSource | null;
  error: string | null;
}

const STORAGE_KEY = 'growthlab.hybridAi.enabled';
const REQUEST_TIMEOUT_MS = 25_000;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function detectDeviceCapable(): boolean {
  return typeof self !== 'undefined' && 'LanguageModel' in self;
}

let status: HybridStatus = {
  enabled: readEnabled(),
  configured: readFirebaseConfig() !== null,
  deviceCapable: detectDeviceCapable(),
  downloading: false,
  progress: 0,
  deviceReady: false,
  lastSource: null,
  error: null
};

const listeners = new Set<() => void>();

function setStatus(patch: Partial<HybridStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeHybridStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHybridStatus(): HybridStatus {
  return status;
}

export function setHybridEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* storage may be blocked; keep in-memory state */
  }
  setStatus({ enabled, error: null });
}

// Loosely typed on purpose: the firebase/ai types are only available after `npm install`.
let modelPromise: Promise<{
  model: any;
}> | null = null;

function getModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const app = await getFirebaseApp();
    const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } = await import(
      'firebase/ai'
    );
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
    return { model };
  })();
  modelPromise.catch(() => {
    modelPromise = null;
  });
  return modelPromise;
}

/**
 * Download / warm up Gemini Nano. MUST be called from a user gesture (button tap).
 * Safe to call on unsupported browsers: it just reports that cloud will be used.
 */
export async function enableOnDeviceModel(): Promise<void> {
  if (!status.configured) {
    setStatus({ error: 'firebase-not-configured' });
    return;
  }
  setHybridEnabled(true);
  if (!status.deviceCapable) {
    // Nothing to download: cloud path of Hybrid mode still works.
    return;
  }
  try {
    setStatus({ downloading: true, progress: 0, error: null });
    const { model } = await getModel();
    await model.initializeDeviceModel((val: number) => {
      setStatus({ progress: Math.max(0, Math.min(1, Number(val) || 0)) });
    });
    setStatus({ downloading: false, deviceReady: true, progress: 1 });
  } catch (err) {
    setStatus({
      downloading: false,
      deviceReady: false,
      error: err instanceof Error ? err.message : 'on-device-init-failed'
    });
  }
}

function readSource(result: unknown): HybridSource {
  // The SDK reports which path ran. The exact property name is documented at
  // firebase.google.com/docs/ai-logic/hybrid/web/configuration-options#determine-inference-mode
  // so we probe the likely shapes and report "unknown" instead of guessing.
  const r = result as { response?: Record<string, unknown> } | null;
  const raw = String(
    (r?.response && (r.response as any).inferenceSource) ?? (r as any)?.inferenceSource ?? ''
  ).toLowerCase();
  if (raw.includes('device')) return 'on-device';
  if (raw.includes('cloud')) return 'cloud';
  return 'unknown';
}

/**
 * Returns generated text, or null if Hybrid is off / unavailable / failed.
 * Callers must then use their existing server path.
 */
export async function tryHybridText(prompt: string): Promise<{
  text: string;
  source: HybridSource;
} | null> {
  if (!status.enabled || !status.configured) return null;
  try {
    const { model } = await getModel();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('hybrid-timeout')), REQUEST_TIMEOUT_MS)
    );
    const result = await Promise.race([model.generateContent(prompt), timeout]);
    const text: string = result.response.text();
    const source = readSource(result);
    setStatus({ lastSource: source, error: null });
    return text ? { text, source } : null;
  } catch (err) {
    setStatus({ error: err instanceof Error ? err.message : 'hybrid-failed' });
    return null;
  }
}
