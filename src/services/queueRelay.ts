import { QueueItem } from '../types/dental';

const CODE_KEY = 'growthlab.tvCode';

/** Private pairing code shared by the iPad (publisher) and the counter PC (TV display). */
export function getTvCode(): string {
  try {
    let c = localStorage.getItem(CODE_KEY);
    if (!c) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      c = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      localStorage.setItem(CODE_KEY, c);
    }
    return c;
  } catch {
    return 'LOCAL0';
  }
}

export function setTvCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40));
  } catch {
    // ignore
  }
}

let lastSent = '';

/** Fire-and-forget: never blocks or breaks the local queue. */
export function publishQueue(items: QueueItem[]): void {
  try {
    const code = getTvCode();
    const body = JSON.stringify({ items });
    if (body === lastSent) return;
    lastSent = body;
    void fetch(`/api/queue/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export async function fetchRemoteQueue(code: string): Promise<QueueItem[] | null> {
  try {
    const r = await fetch(`/api/queue/${encodeURIComponent(code)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.items) ? (j.items as QueueItem[]) : null;
  } catch {
    return null;
  }
}
