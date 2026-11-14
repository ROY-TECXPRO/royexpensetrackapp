import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteDatabase } from 'better-sqlite3';
import { createSchema, insertIfNew, getUnsynced, markSynced, upsertFromRemote, applyTransferLinking } from './db';
import { parseSms, linkInternalTransfers } from '../index';

const NOW = '2026-11-11T09:00:00+03:00';

describe('Sync Module: upload', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('insertIfNew never creates duplicate rows for same dedupe_key', () => {
    const dedupeKey = 'mpesa:DUP123';
    // Insert same parsed tx 3 times
    const id1 = insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 1000, fee: 0, counterparty: 'A', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev1');
    const id2 = insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 1000, fee: 0, counterparty: 'A', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev1');
    const id3 = insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 1000, fee: 0, counterparty: 'A', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev1');
    assert.strictEqual(id1, id2);
    assert.strictEqual(id2, id3);
    const count = db.queryAll('SELECT * FROM transactions WHERE dedupe_key = ?', [dedupeKey]).length;
    assert.strictEqual(count, 1);
  });

  test('getUnsynced returns only unsynced rows', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'mpesa:X1', 'mpesa', 'sent', 'out', 1000, 0, 'A', null, null, null, null, NOW, 'raw', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('2', 'user-1', 'mpesa:X2', 'mpesa', 'sent', 'out', 2000, 0, 'A', null, null, null, null, NOW, 'raw', 'dev1', 1, datetime('now'))`);
    const unsynced = getUnsynced(db, 10);
    assert.strictEqual(unsynced.length, 1);
    assert.strictEqual(unsynced[0]?.dedupe_key, 'mpesa:X1');
  });

  test('markSynced updates synced flag', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'mpesa:X1', 'mpesa', 'sent', 'out', 1000, 0, 'A', null, null, null, null, NOW, 'raw', 'dev1', 0, datetime('now'))`);
    markSynced(db, ['mpesa:X1']).then(() => {
      const row = db.queryAll('SELECT synced FROM transactions WHERE dedupe_key = ?', ['mpesa:X1'])[0];
      assert.strictEqual(row[0]?.synced, 1);
    });
  });

  test('upsertFromRemote inserts new row', () => {
    const row = {
      id: 'remote-1', user_id: 'user-1', dedupe_key: 'mpesa:UR1',
      source: 'mpesa', type: 'received', direction: 'in', amount: 500, fee: 0,
      counterparty: 'BANK', category_id: null, balance_after: 500,
      related_ref: null, transfer_group: null, occurred_at: NOW, raw_text: 'raw', device_id: 'dev-r',,
    };
    upsertFromRemote(db, row).then(() => {
      const found = db.queryAll('SELECT * FROM transactions WHERE dedupe_key = ?', ['mpesa:UR1'])[0];
      assert.strictEqual(found[0]?.user_id, 'user-1');
      assert.strictEqual(found[0]?.amount, 500);
      assert.strictEqual(found[0]?.synced, 1);
    });
  });

  test('applyTransferLinking persists transfer_group', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'coop:AC5601889F26', 'coop', 'transfer', 'out', 7400, 0, 'Own M-Pesa', null, null, null, null, NOW, 'raw co-op', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('2', 'user-1', 'mpesa:UKAPB1FQZO', 'mpesa', 'received', 'in', 7400, 0, 'CO-OP BANK', null, null, null, null, NOW, 'raw mpesa', 'dev1', 0, datetime('now'))`);
    applyTransferLinking(db).then(() => {
      const r1 = db.queryAll('SELECT transfer_group FROM transactions WHERE dedupe_key = ?', ['coop:AC5601889F26'])[0];
      const r2 = db.queryAll('SELECT transfer_group FROM transactions WHERE dedupe_key = ?', ['mpesa:UKAPB1FQZO'])[0];
      assert.strictEqual(r1[0]?.transfer_group, r2[0]?.transfer_group);
      assert.ok(r1[0]?.transfer_group?.startsWith('tg:'));
    });
  });
});