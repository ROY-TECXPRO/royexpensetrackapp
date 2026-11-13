import type { Bucket, Period, Tx } from './types';
const D = 864e5, OFF = 3 * 3600e3; // Africa/Nairobi = UTC+3, no DST
const N: Record<Period, number> = { day: 7, week: 6, month: 6, year: 4 };
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function floor(t: number, p: Period): number {
  const d = new Date(t), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (p === 'day') return day;
  if (p === 'week') return day - ((d.getUTCDay() + 6) % 7) * D;
  if (p === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
}
function prev(s: number, p: Period): number {
  const d = new Date(s);
  if (p === 'day') return s - D;
  if (p === 'week') return s - 7 * D;
  if (p === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  return Date.UTC(d.getUTCFullYear() - 1, 0, 1);
}
function label(s: number, p: Period): string {
  const d = new Date(s);
  if (p === 'day') return 'SMTWTFS'[d.getUTCDay()];
  if (p === 'week') return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  if (p === 'month') return MON[d.getUTCMonth()];
  return String(d.getUTCFullYear());
}
const at = (t: Tx, p: Period) => floor(Date.parse(t.occurredAt) + OFF, p);
export const byTime = (a: Tx, b: Tx) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt);

/** Internal transfers (transferGroup set) are never counted as spending or income. */
export function series(txs: Tx[], p: Period, now = Date.now()): Bucket[] {
  const cur = floor(now + OFF, p), starts = [cur];
  while (starts.length < N[p]) starts.unshift(prev(starts[0], p));
  const m = new Map(starts.map(s => [s, { out: 0, in: 0 }]));
  for (const t of txs) {
    if (t.transferGroup) continue;
    const b = m.get(at(t, p)); if (!b) continue;
    if (t.direction === 'out') b.out += t.amount + t.fee; else b.in += t.amount;
  }
  return starts.map(s => ({ label: label(s, p), out: m.get(s)!.out, in: m.get(s)!.in, current: s === cur }));
}
export function totals(txs: Tx[], p: Period, now = Date.now(), src?: string) {
  const cur = floor(now + OFF, p); let out = 0, inn = 0, transfers = 0;
  for (const t of txs) {
    if (at(t, p) !== cur || (src && t.source !== src)) continue;
    if (t.transferGroup) { if (t.direction === 'out') transfers += t.amount; }
    else if (t.direction === 'out') out += t.amount + t.fee; else inn += t.amount;
  }
  return { out, in: inn, transfers };
}
export function groupByDay(txs: Tx[], now = Date.now()): [string, Tx[]][] {
  const g = new Map<string, Tx[]>(), today = floor(now + OFF, 'day');
  for (const t of [...txs].sort(byTime)) {
    const s = at(t, 'day'), d = new Date(s);
    const k = s === today ? 'Today' : s === today - D ? 'Yesterday' : `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(t);
  }
  return [...g];
}
export const fmt = (c: number) => `Ksh ${(c / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function clock(ts: string) {
  const d = new Date(Date.parse(ts) + OFF); let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0'), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
export function dateLabel(ts: string) {
  const d = new Date(Date.parse(ts) + OFF);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function spentByCat(txs: Tx[], p: Period, now = Date.now()) {
  const cur = floor(now + OFF, p), m = new Map<string, number>();
  for (const t of txs) {
    if (t.transferGroup || t.direction !== 'out' || at(t, p) !== cur) continue;
    const k = t.categoryId ?? 'other'; m.set(k, (m.get(k) ?? 0) + t.amount + t.fee);
  }
  return m;
}
export function insights(txs: Tx[], now = Date.now()) {
  const sh = now + OFF, d = new Date(sh), dom = d.getUTCDate();
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const cs = floor(sh, 'month'), ps = prev(cs, 'month');
  let cur = 0, prevMtd = 0, big: Tx | null = null;
  for (const t of txs) {
    if (t.transferGroup || t.direction !== 'out') continue;
    const ts = Date.parse(t.occurredAt) + OFF, s = floor(ts, 'month'), v = t.amount + t.fee;
    if (s === cs) { cur += v; if (!big || v > big.amount + big.fee) big = t; }
    else if (s === ps && new Date(ts).getUTCDate() <= dom) prevMtd += v;
  }
  const avg = cur / dom;
  return { cur, prevMtd, change: prevMtd ? ((cur - prevMtd) / prevMtd) * 100 : null, avg, projected: avg * dim, big, dom, dim };
}
export function toCsv(txs: Tx[], names: Map<string, string>) {
  const q = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = [...txs].sort(byTime).map(t => [t.occurredAt, t.source, t.type, t.direction, (t.amount / 100).toFixed(2), (t.fee / 100).toFixed(2), t.counterparty ?? '', names.get(t.categoryId ?? '') ?? '', t.transferGroup ? 'internal transfer' : '', t.dedupeKey].map(q).join(','));
  return ['time,account,type,direction,amount,fee,counterparty,category,note,reference', ...rows].join('\n');
}

export function inRange(t: Tx, r: string, now = Date.now()) {
  if (r === '30') return now - Date.parse(t.occurredAt) <= 30 * D;
  if (r === 'm') return at(t, 'month') === floor(now + OFF, 'month');
  return true;
}
export interface Recur { name: string; amount: number; every: number; next: number; count: number }
/** Payments to the same payee, similar amount, in 3+ different months, roughly monthly or more spaced. */
export function recurring(txs: Tx[], now = Date.now()): Recur[] {
  const g = new Map<string, Tx[]>();
  for (const t of txs) {
    if (t.transferGroup || t.direction !== 'out' || !t.counterparty || t.amount <= 0) continue;
    (g.get(t.counterparty) ?? g.set(t.counterparty, []).get(t.counterparty)!).push(t);
  }
  const out: Recur[] = [];
  for (const [name, a] of g) {
    a.sort((x, y) => Date.parse(x.occurredAt) - Date.parse(y.occurredAt));
    const months = new Set(a.map(t => at(t, 'month')));
    if (a.length < 3 || months.size < 3 || a.length > months.size * 1.5) continue;
    const amts = a.map(t => t.amount).sort((x, y) => x - y), med = amts[Math.floor(amts.length / 2)];
    if (a.some(t => Math.abs(t.amount - med) > med * 0.15)) continue;
    const gaps = a.slice(1).map((t, i) => (Date.parse(t.occurredAt) - Date.parse(a[i].occurredAt)) / D).sort((x, y) => x - y);
    const every = gaps[Math.floor(gaps.length / 2)], last = Date.parse(a[a.length - 1].occurredAt);
    if (every < 5 || now - last > every * 2.2 * D) continue;
    out.push({ name, amount: med, every: Math.round(every), next: last + every * D, count: a.length });
  }
  return out.sort((x, y) => x.next - y.next);
}
