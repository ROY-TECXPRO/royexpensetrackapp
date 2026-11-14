import { ParsedTx, fallbackHash } from './common';
import { parseMpesa } from './mpesa';
import { parseCoop } from './coop';

/**
 * UNCONFIRMED: sender IDs must be read from the actual SMS threads on Roy's phone.
 * Anything not matched here is ignored and never stored.
 */
export const SENDER_MAP: Array<{ source: 'mpesa' | 'coop'; match: RegExp }> = [
  { source: 'mpesa', match: /^m-?pesa$/i },
  { source: 'coop',  match: /co-?op/i },   // TODO confirm exact sender ID
];

export function sourceFromSender(sender: string): 'mpesa' | 'coop' | null {
  return SENDER_MAP.find(s => s.match.test(sender.trim()))?.source ?? null;
}

export function parseSms(sender: string, body: string, receivedAtIso: string): ParsedTx | null {
  const source = sourceFromSender(sender);
  if (!source) return null;                       // not a financial sender: ignore completely

  const parsed = source === 'mpesa' ? parseMpesa(body) : parseCoop(body);
  if (parsed) return parsed;

  // Allowed sender, unrecognized wording: keep it, flag it, never drop it.
  const code = body.match(/^\s*([A-Z0-9]{10})\s+Confirmed/)?.[1] ?? body.match(/\bRef:\s*([A-Z0-9]+)\s*:/)?.[1];
  return {
    dedupeKey: code ? `${source}:${code}` : `${source}:raw:${fallbackHash(body)}`,
    source,
    type: 'unknown',
    direction: 'out',
    amount: 0,
    fee: 0,
    counterparty: null,
    balanceAfter: null,
    occurredAt: receivedAtIso,
    relatedRef: null,
    transferGroup: null,
    rawText: body,
  };
}

export { parseMpesa, parseCoop };
export { linkInternalTransfers } from './link';
export * from './common';
