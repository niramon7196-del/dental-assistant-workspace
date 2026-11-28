import React, { useEffect, useState } from 'react';
import { QueueItem } from '../types/dental';
import {
  addPendingRemote,
  fetchRelayState,
  PendingQueueEntry
} from '../services/queueRelay';

interface CounterQueuePageProps {
  code: string;
}

/** Counter PC page: type patient names; the assistant's iPad imports them into the queue. */
export const CounterQueuePage: React.FC<CounterQueuePageProps> = ({ code }) => {
  const [name, setName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState<PendingQueueEntry[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; at: string; msg?: string }>({ ok: true, at: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const st = await fetchRelayState(code);
      if (stop) return;
      if (st) {
        setItems(st.items);
        setPending(st.pending);
        setStatus({ ok: true, at: new Date().toLocaleTimeString('th-TH') });
      } else {
        setStatus((s) => ({ ...s, ok: false }));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const ok = await addPendingRemote(code, { patientName: n, procedure: procedure.trim() });
    setBusy(false);
    if (ok) {
      setName('');
      setProcedure('');
      setStatus((s) => ({ ...s, msg: `ส่ง "${n}" ให้ผู้ช่วยแล้ว` }));
    } else {
      setStatus((s) => ({ ...s, msg: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง' }));
    }
  };

  const waiting = items.filter((q) => q.status === 'waiting');
  const called = items.filter((q) => q.status === 'called');

  return (
    <div className="cosmic-bg min-h-screen text-slate-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="glass-card rounded-2xl p-5">
          <h1 className="text-2xl font-bold">ลงคิวคนไข้ (เคาน์เตอร์)</h1>
          <p className="text-sm text-slate-300 mt-1">
            พิมพ์ชื่อแล้วกดส่ง ชื่อจะไปปรากฏในคิวของผู้ช่วยภายในไม่กี่วินาที · รหัสจอ{' '}
            <span className="font-mono font-bold text-cyan-200">{code}</span>
          </p>
          <p className={`text-xs mt-1 ${status.ok ? 'text-emerald-200' : 'text-rose-200'}`}>
            {status.ok ? `เชื่อมต่อแล้ว · ซิงก์ล่าสุด ${status.at}` : 'ติดต่อเซิร์ฟเวอร์ไม่ได้'}
          </p>
        </div>

        <form onSubmit={submit} className="glass-card rounded-2xl p-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อคนไข้ เช่น คุณกัลยา"
            className="glass-input min-h-[48px] px-3 rounded-xl text-base"
            autoFocus
          />
          <input
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            placeholder="หัตถการ (ไม่บังคับ)"
            className="glass-input min-h-[48px] px-3 rounded-xl text-base"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'กำลังส่ง…' : 'ส่งเข้าคิว'}
          </button>
          {status.msg && <p className="sm:col-span-3 text-sm text-emerald-200">{status.msg}</p>}
        </form>

        {pending.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-2">รอ iPad รับเข้าคิว ({pending.length})</h2>
            <ul className="space-y-1 text-sm">
              {pending.map((p) => (
                <li key={p.id}>{p.patientName}{p.procedure ? ` · ${p.procedure}` : ''}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-200 mt-2">
              ถ้ารายการค้างนาน ให้เช็กว่า iPad เปิดหน้าเว็บอยู่และใช้รหัสจอเดียวกัน
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-2">กำลังเรียก ({called.length})</h2>
            <ul className="space-y-1 text-sm">
              {called.map((q) => (
                <li key={q.id}>{q.queueNumber} · {q.patientName} → {q.roomName || '-'}</li>
              ))}
              {called.length === 0 && <li className="text-slate-400">ไม่มี</li>}
            </ul>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-2">รอเรียก ({waiting.length})</h2>
            <ul className="space-y-1 text-sm">
              {waiting.map((q) => (
                <li key={q.id}>{q.queueNumber} · {q.patientName}</li>
              ))}
              {waiting.length === 0 && <li className="text-slate-400">ไม่มี</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
