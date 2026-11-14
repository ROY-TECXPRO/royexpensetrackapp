import { ParsedTx, toCents, toIsoNairobi } from './common';

const CODE     = /^\s*([A-Z0-9]{10})\s+Confirmed/;
// M-Pesa dates are DAY/MONTH/YY. Verified: 10/11/26 matches the bank's 10-11-2026.
const WHEN     = /\bon\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const BALANCE  = /balance\s+is\s+Ksh\s*([\d,]+(?:\.\d{1,2})?)/i;
const COST     = /Transaction\s+cost,?\s*Ksh\s*([\d,]+(?:\.\d{1,2})?)/i;
const PAID     = /Ksh\s*([\d,]+(?:\.\d{1,2})?)\s+paid\s+to\s+(.+?)\.?\s+on\s+\d/i;
const RECEIVED = /received\s+Ksh\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+(.+?)\s+on\s+\d/i;

export function parseMpesa(text: string): ParsedTx | null {
  const code = text.match(CODE)?.[1];
  const when = text.match(WHEN);
  if (!code || !when) return null;

  const [, d, m, y, hh, mm, ap] = when;
  const occurredAt = toIsoNairobi(+y, +m, +d, +hh, +mm, ap);
  const bal = text.match(BALANCE)?.[1];
  const cost = text.match(COST)?.[1];

  const base = {
    dedupeKey: `mpesa:${code}`,
    source: 'mpesa' as const,
    fee: cost ? toCents(cost) : 0,
    balanceAfter: bal ? toCents(bal) : null,
    occurredAt,
    relatedRef: null,
    transferGroup: null,
    rawText: text,
  };

  const paid = text.match(PAID);
  if (paid) {
    return { ...base, type: 'paid', direction: 'out', amount: toCents(paid[1]), counterparty: paid[2].trim() };
  }
  const rec = text.match(RECEIVED);
  if (rec) {
    return { ...base, type: 'received', direction: 'in', amount: toCents(rec[1]), counterparty: rec[2].trim() };
  }
  return null; // known code + date but unrecognized wording -> caller stores as 'unknown'
}
