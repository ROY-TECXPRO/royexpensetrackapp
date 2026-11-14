import { ParsedTx, toCents, toIsoNairobi } from './common';

// Co-op messages start with a long fixed security warning. Never anchor on the start of the text.
// Date format here is DD-MM-YYYY hh:mm AM/PM.
const TRANSFER_TO_MOBILE =
  /MPESA\s+transfer\s+of\s+KES\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+your\s+mobile\s*(?:\S+\s+)?at\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s+was\s+successful/i;
const BANK_REF  = /\bRef:\s*([A-Z0-9]+)\s*:/;      // 'Ref:AC5601889F26:' (needs trailing colon)
const MPESA_REF = /MPESA\s+Ref:\s*([A-Z0-9]+)/i;

export function parseCoop(text: string): ParsedTx | null {
  const ref = text.match(BANK_REF)?.[1];
  if (!ref) return null;

  const t = text.match(TRANSFER_TO_MOBILE);
  if (t) {
    const [, amt, d, m, y, hh, mm, ap] = t;
    return {
      dedupeKey: `coop:${ref}`,
      source: 'coop',
      type: 'transfer',
      direction: 'out',                 // money leaves the bank account
      amount: toCents(amt),
      fee: 0,
      counterparty: 'Own M-Pesa',
      balanceAfter: null,               // not in this message
      occurredAt: toIsoNairobi(+y, +m, +d, +hh, +mm, ap),
      relatedRef: text.match(MPESA_REF)?.[1] ?? null,
      transferGroup: null,
      rawText: text,
    };
  }
  return null;
}
