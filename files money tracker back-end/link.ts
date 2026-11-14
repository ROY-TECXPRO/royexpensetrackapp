import { ParsedTx } from './common';

/**
 * Bank -> M-Pesa transfers produce TWO messages: a Co-op "transfer to your mobile" (out)
 * and an M-Pesa "received from CO-OP BANK" (in). They must not count as spending or income.
 *
 * Their codes DO NOT match (bank quotes one M-Pesa ref, the wallet SMS shows another),
 * so link by amount + time window. The group id is deterministic (sorted keys),
 * so every phone computes the same value independently.
 */
export function linkInternalTransfers(rows: ParsedTx[], windowMs = 5 * 60 * 1000): void {
  const outs = rows.filter(r => r.source === 'coop' && r.type === 'transfer' && r.direction === 'out' && !r.transferGroup);
  const ins  = rows.filter(r => r.source === 'mpesa' && r.type === 'received' && /CO-?OP\s*BANK/i.test(r.counterparty ?? '') && !r.transferGroup);

  for (const o of outs) {
    const ot = Date.parse(o.occurredAt);
    const match = ins.find(i => !i.transferGroup && i.amount === o.amount && Math.abs(Date.parse(i.occurredAt) - ot) <= windowMs);
    if (match) {
      const group = 'tg:' + [o.dedupeKey, match.dedupeKey].sort().join('|');
      o.transferGroup = group;
      match.transferGroup = group;
    }
  }
}
