import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSms, linkInternalTransfers } from './index';

// Real messages, personal details redacted.
const PAID = 'UKBPB1HHTJ Confirmed. Ksh60.00 paid to SUPER GEN SHOP. on 11/11/26 at 8:53 AM.New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00. Amount you can transact within the day is 499,940.00. See all your balances now https://saf.cx/kWQpy';
const RECEIVED = 'UKAPB1FR0C Confirmed.You have received Ksh74.00 from CO-OP BANK 149444 on 10/11/26 at 7:07 PM New M-PESA balance is Ksh74.00.  See all your balances now https://saf.cx/kWQpy.';
const COOP = 'Please NEVER share your PIN, PASSWORD, any codes or CARD details with ANYONE! not even people who may claim to be bank staff. Ref:AC5601889F26: Dear XXXX, MPESA transfer of KES 74 to your mobile -254XXXXXXXXX at 10-11-2026 07:07 PM was successful.MPESA Ref:UKAPB1FQZO.';
const NOW = '2026-11-11T09:00:00+03:00';

test('mpesa paid to till/merchant', () => {
  const t = parseSms('MPESA', PAID, NOW)!;
  assert.equal(t.dedupeKey, 'mpesa:UKBPB1HHTJ');
  assert.equal(t.type, 'paid');
  assert.equal(t.direction, 'out');
  assert.equal(t.amount, 6000);
  assert.equal(t.fee, 0);
  assert.equal(t.counterparty, 'SUPER GEN SHOP');
  assert.equal(t.balanceAfter, 0);
  assert.equal(t.occurredAt, '2026-11-11T08:53:00+03:00');
});

test('mpesa received from bank (no cost line)', () => {
  const t = parseSms('MPESA', RECEIVED, NOW)!;
  assert.equal(t.dedupeKey, 'mpesa:UKAPB1FR0C');
  assert.equal(t.type, 'received');
  assert.equal(t.direction, 'in');
  assert.equal(t.amount, 7400);
  assert.equal(t.fee, 0);
  assert.equal(t.counterparty, 'CO-OP BANK 149444');
  assert.equal(t.balanceAfter, 7400);
  assert.equal(t.occurredAt, '2026-11-10T19:07:00+03:00');
});

test('coop transfer to own mobile', () => {
  const t = parseSms('CoopBank', COOP, NOW)!;
  assert.equal(t.dedupeKey, 'coop:AC5601889F26');
  assert.equal(t.type, 'transfer');
  assert.equal(t.direction, 'out');
  assert.equal(t.amount, 7400);
  assert.equal(t.relatedRef, 'UKAPB1FQZO');
  assert.equal(t.occurredAt, '2026-11-10T19:07:00+03:00');
});

test('bank->mpesa pair is linked despite different codes; unrelated payment is not', () => {
  const rows = [PAID, RECEIVED].map(b => parseSms('MPESA', b, NOW)!);
  rows.push(parseSms('CoopBank', COOP, NOW)!);
  linkInternalTransfers(rows);
  const [paid, rec, coop] = rows;
  assert.ok(rec.transferGroup);
  assert.equal(rec.transferGroup, coop.transferGroup);
  assert.equal(paid.transferGroup, null);
  // proves why code-matching can't be used: the two M-Pesa refs differ
  assert.notEqual('mpesa:' + coop.relatedRef, rec.dedupeKey);
});

test('unknown wording from allowed sender is kept, not dropped', () => {
  const t = parseSms('MPESA', 'ABCDE12345 Confirmed. something new happened', NOW)!;
  assert.equal(t.type, 'unknown');
  assert.equal(t.dedupeKey, 'mpesa:ABCDE12345');
});

test('non-financial sender is ignored', () => {
  assert.equal(parseSms('Mum', 'hello', NOW), null);
});
