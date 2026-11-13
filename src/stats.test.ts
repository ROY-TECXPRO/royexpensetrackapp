import { test } from 'node:test';
import assert from 'node:assert/strict';
import { series, totals } from './stats';
import type { Tx } from './types';
const mk = (o: Partial<Tx>): Tx => ({ id: 'x', dedupeKey: 'x', source: 'mpesa', type: 'paid', direction: 'out', amount: 0, fee: 0, counterparty: null, categoryId: null, balanceAfter: null, occurredAt: '2026-11-11T08:53:00+03:00', relatedRef: null, transferGroup: null, rawText: '', synced: true, ...o });
const NOW = Date.parse('2026-11-11T12:00:00+03:00');
test('spending counts fees, excludes internal transfers', () => {
  const txs = [mk({ amount: 6000, fee: 700 }), mk({ amount: 7400, direction: 'in', source: 'mpesa', transferGroup: 'tg' }), mk({ amount: 7400, source: 'coop', transferGroup: 'tg' })];
  const t = totals(txs, 'month', NOW);
  assert.equal(t.out, 6700); assert.equal(t.in, 0); assert.equal(t.transfers, 7400);
});
test('series has fixed length, current bucket last, Nairobi day boundary', () => {
  const late = mk({ amount: 1000, occurredAt: '2026-11-10T23:30:00+03:00' }); // still Nov 10 in Nairobi
  const s = series([late], 'day', NOW);
  assert.equal(s.length, 7); assert.equal(s[6].current, true);
  assert.equal(s[5].out, 1000); assert.equal(s[6].out, 0);
});

import { inRange, insights, recurring, spentByCat, toCsv } from './stats';
import { hashPin, verifyPin } from './pin';
const at = (iso: string, o: Partial<Tx> = {}) => mk({ occurredAt: iso, ...o });
test('recurring finds a fixed monthly payment, ignores erratic shops', () => {
  const rent = ['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map(d => at(d + 'T09:00:00+03:00', { counterparty: 'LANDLORD', amount: 1200000 }));
  const shop = [100, 900, 300, 1500].map((a, i) => at(`2026-0${8 + i}-05T09:00:00+03:00`, { counterparty: 'NAIVAS', amount: a * 100 }));
  const r = recurring([...rent, ...shop], NOW);
  assert.equal(r.length, 1); assert.equal(r[0].name, 'LANDLORD'); assert.equal(r[0].amount, 1200000);
});
test('insights excludes transfers and compares same days of last month', () => {
  const txs = [at('2026-11-05T10:00:00+03:00', { amount: 3000 }), at('2026-10-05T10:00:00+03:00', { amount: 2000 }), at('2026-10-25T10:00:00+03:00', { amount: 9000 }), at('2026-11-06T10:00:00+03:00', { amount: 5000, transferGroup: 'tg' })];
  const i = insights(txs, NOW);
  assert.equal(i.cur, 3000); assert.equal(i.prevMtd, 2000); assert.equal(Math.round(i.change!), 50);
});
test('category totals, date ranges and CSV safety', () => {
  const txs = [at('2026-11-05T10:00:00+03:00', { amount: 1000, categoryId: 'food', counterparty: '=HYPERLINK("x")' }), at('2026-11-06T10:00:00+03:00', { amount: 500 })];
  const m = spentByCat(txs, 'month', NOW); assert.equal(m.get('food'), 1000); assert.equal(m.get('other'), 500);
  assert.equal(inRange(txs[0], 'm', NOW), true); assert.equal(inRange(at('2026-09-01T10:00:00+03:00'), '30', NOW), false);
  const csv = toCsv(txs, new Map()); assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\""));
});
test('PIN hashing is salted and verifies', async () => {
  const a = await hashPin('1234'), b = await hashPin('1234');
  assert.notEqual(a, b); assert.equal(await verifyPin('1234', a), true); assert.equal(await verifyPin('4321', a), false);
});
