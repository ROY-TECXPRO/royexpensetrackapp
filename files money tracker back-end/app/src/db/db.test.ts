import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteDatabase } from 'better-sqlite3';
import { createSchema, insertIfNew } from './db';

const NOW = '2026-11-11T09:00:00+03:00';

describe('SQLite DB: Schema', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('createSchema creates both tables', () => {
    const tables = db.exec('SELECT name FROM sqlite_master WHERE type="table"');
    const names = tables[0]?.results?.map((t: any) => t.name) || [];
    assert.ok(names.includes('transactions'));
    assert.ok(names.includes('sync_state'));
  });
});

describe('SQLite DB: insertIfNew', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('inserts new row when dedupe_key does not exist', () => {
    const dedupeKey = 'mpesa:ABC123';
    const id = insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 6000, fee: 0, counterparty: 'SHOP', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev-1');
    const rows = db.queryAll('SELECT * FROM transactions WHERE dedupe_key = ?', [dedupeKey]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]?.id, id);
    assert.strictEqual(rows[0]?.synced, 0);
  });

  test('updates existing row when dedupe_key already exists', () => {
    const dedupeKey = 'mpesa:ABC123';
    insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 6000, fee: 0, counterparty: 'SHOP', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev-1');
    const id2 = insertIfNew(db, { dedupeKey, source: 'mpesa', type: 'paid', direction: 'out', amount: 7000, fee: 0, counterparty: 'SHOP', balanceAfter: 0, occurredAt: NOW, relatedRef: null, transferGroup: null, rawText: 'test' } as any, 'user-1', 'dev-1');
    assert.strictEqual(id1, id2);
    const rows = db.queryAll('SELECT amount FROM transactions WHERE dedupe_key = ?', [dedupeKey]);
    assert.strictEqual(rows[0]?.amount, 7000);
  });
});

describe('SQLite DB: getUnsynced', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('returns unsynced rows ordered by updated_at', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'mpesa:X1', 'mpesa', 'sent', 'out', 1000, 0, 'C1', null, null, null, null, '2026-11-11T09:00:00+03:00', 'raw1', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('2', 'user-1', 'mpesa:X2', 'mpesa', 'sent', 'out', 2000, 0, 'C2', null, null, null, null, '2026-11-11T09:01:00+03:00', 'raw2', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('3', 'user-1', 'mpesa:X3', 'mpesa', 'sent', 'out', 3000, 0, 'C3', null, null, null, null, '2026-11-11T09:02:00+03:00', 'raw3', 'dev1', 1, datetime('now'))`);

    const unsynced = getUnsynced(db, 2);
    assert.strictEqual(unsynced.length, 2);
    assert.strictEqual(unsynced[0]?.dedupe_key, 'mpesa:X1');
    assert.strictEqual(unsynced[1]?.dedupe_key, 'mpesa:X2');
    assert.strictEqual(unsynced.some((r: any) => r.dedupe_key === 'mpesa:X3'), false);
  });
});

describe('SQLite DB: markSynced', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('marks rows as synced by dedupe_keys', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'mpesa:X1', 'mpesa', 'sent', 'out', 1000, 0, 'C1', null, null, null, null, '2026-11-11T09:00:00+03:00', 'raw1', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('2', 'user-1', 'mpesa:X2', 'mpesa', 'sent', 'out', 2000, 0, 'C2', null, null, null, null, '2026-11-11T09:01:00+03:00', 'raw2', 'dev1', 0, datetime('now'))`);

    markSynced(db, ['mpesa:X1']).then(() => {
      const row = db.queryAll('SELECT synced FROM transactions WHERE dedupe_key = ?', ['mpesa:X1'])[0];
      assert.strictEqual(row[0]?.synced, 1);
    });

    });

describe('SQLite DB: upsertFromRemote', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('inserts new row from remote', () => {
    const row = {
      id: 'remote-1', user_id: 'user-1', dedupe_key: 'mpesa:REMOTE1',
      source: 'mpesa', type: 'received', direction: 'in', amount: 7400, fee: 0,
      counterparty: 'CO-OP BANK 149444', category_id: null, balance_after: 7400,
      related_ref: null, transfer_group: null, occurred_at: '2026-11-10T19:07:00+03:00',
      raw_text: 'raw text', device_id: 'dev-remote',
    };
    upsertFromRemote(db, row).then(() => {
      const found = db.queryAll('SELECT * FROM transactions WHERE dedupe_key = ?', ['mpesa:REMOTE1'])[0];
      assert.strictEqual(found[0]?.user_id, 'user-1');
      assert.strictEqual(found[0]?.amount, 7400);
      assert.strictEqual(found[0]?.synced, 1);
    });
  });

  test('updates existing row from remote (last write wins)', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('local-1', 'user-1', 'mpesa:REMOTE1', 'mpesa', 'sent', 'out', 5000, 0, 'OLD', null, null, null, null, '2026-11-10T19:00:00+03:00', 'old raw', 'dev-local', 0, datetime('now'))`);
    const row = {
      id: 'remote-1', user_id: 'user-1', dedupe_key: 'mpesa:REMOTE1',
      source: 'mpesa', type: 'sent', direction: 'out', amount: 8000, fee: 100,
      counterparty: 'NEW SHOP', category_id: null, balance_after: 9000,
      related_ref: null, transfer_group: null, occurred_at: '2026-11-10T19:30:00+03:00',
      raw_text: 'new raw', device_id: 'dev-remote',
    };
    upsertFromRemote(db, row).then(() => {
      const found = db.queryAll('SELECT * FROM transactions WHERE dedupe_key = ?', ['mpesa:REMOTE1'])[0];
      assert.strictEqual(found[0]?.amount, 8000);
      assert.strictEqual(found[0]?.type, 'sent');
      assert.strictEqual(found[0]?.fee, 100);
      assert.strictEqual(found[0]?.balance_after, 9000);
      assert.strictEqual(found[0]?.synced, 1);
    });
  });
});

describe('SQLite DB: applyTransferLinking', () => {
  let db: SQLiteDatabase;

  before(() => {
    db = new SQLiteDatabase(':memory:');
    createSchema(db);
  });

  after(() => {
    db.close();
  });

  test('links internal transfers and persists transfer_group', () => {
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('1', 'user-1', 'coop:AC5601889F26', 'coop', 'transfer', 'out', 7400, 0, 'Own M-Pesa', null, null, null, null, '2026-11-10T19:07:00+03:00', 'raw co-op', 'dev1', 0, datetime('now'))`);
    db.exec(`INSERT INTO transactions (id, user_id, dedupe_key, source, type, direction, amount, fee, counterparty, category_id, balance_after, related_ref, transfer_group, occurred_at, raw_text, device_id, synced, updated_at) VALUES ('2', 'user-1', 'mpesa:UKAPB1FQZO', 'mpesa', 'received', 'in', 7400, 0, 'CO-OP BANK 149444', null, null, null, null, '2026-11-10T19:07:00+03:00', 'raw mpesa', 'dev1', 0, datetime('now'))`);

    applyTransferLinking(db).then(() => {
      const r1 = db.queryAll('SELECT transfer_group FROM transactions WHERE dedupe_key = ?', ['coop:AC5601889F26'])[0];
      const r2 = db.queryAll('SELECT transfer_group FROM transactions WHERE dedupe_key = ?', ['mpesa:UKAPB1FQZO'])[0];
      assert.strictEqual(r1[0]?.transfer_group, r2[0]?.transfer_group);
      assert.ok(r1[0]?.transfer_group?.startsWith('tg:'));
    });
  });
});