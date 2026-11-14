export type TxType =
  | 'sent' | 'received' | 'paid' | 'withdraw' | 'deposit'
  | 'airtime' | 'transfer' | 'fee' | 'unknown';

export interface ParsedTx {
  dedupeKey: string;            // 'mpesa:<CODE>' or 'coop:<REF>'
  source: 'mpesa' | 'coop';
  type: TxType;
  direction: 'in' | 'out';
  amount: number;               // cents
  fee: number;                  // cents
  counterparty: string | null;
  balanceAfter: number | null;  // cents
  occurredAt: string;           // ISO 8601, Africa/Nairobi (+03:00)
  relatedRef: string | null;    // e.g. M-Pesa ref quoted inside a bank SMS
  transferGroup: string | null; // set by linkInternalTransfers()
  rawText: string;
}

/** "1,200.50" -> 120050. String math only, no floats. */
export function toCents(s: string): number {
  const [whole, frac = ''] = s.replace(/,/g, '').split('.');
  return parseInt(whole || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
}

/** 12-hour clock parts -> ISO string in Nairobi time (UTC+3, no DST). */
export function toIsoNairobi(
  year: number, month: number, day: number,
  hour12: number, minute: number, ampm: string,
): string {
  const y = year < 100 ? 2000 + year : year;
  let h = hour12 % 12;
  if (/pm/i.test(ampm)) h += 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(month)}-${p(day)}T${p(h)}:${p(minute)}:00+03:00`;
}

/** Tiny non-crypto hash for fallback keys. Swap for a real digest in the app. */
export function fallbackHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
