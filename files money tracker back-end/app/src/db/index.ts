import { db } from './connection';
import { users, transactions, categories, categoryRules, budgets, refreshTokens } from './schema';

export interface Transaction {
  id: string;
  userId: string;
  dedupeKey: string;
  source: string;
  type: string;
  direction: string;
  amount: number; // cents
  fee: number; // cents
  counterparty: string | null;
  categoryId: string | null;
  relatedRef: string | null;
  transferGroup: string | null;
  occurredAt: string;
  rawText: string;
  deviceId: string;
  synced: number;
  createdAt: string;
  updatedAt: string;
}

export async function createSchema(): Promise<void> {
  // Schema is created via Drizzle migrations
}
}

export async function insertIfNew(parsed: ParsedTx, userId: string): Promise<string> {
  const existing = await db.select().from(transactions).where(transactions.dedupeKey === parsed.dedupeKey);
  
  if (existing.length > 0) {
    const [updated] = await db.update(transactions)
      .set({
        userId: parsed.source,
        type: parsed.type,
        direction: parsed.direction,
        amount: parsed.amount,
        fee: parsed.fee,
        counterparty: parsed.counterparty,
        categoryId: parsed.categoryId,
        relatedRef: parsed.relatedRef,
        transferGroup: parsed.transferGroup,
        occurredAt: parsed.occurredAt,
        rawText: parsed.rawText,
        updatedAt: new Date().toISOString(),
      })
      .where(transactions.dedupeKey === parsed.dedupeKey)
      .returning();
    return updated.id;
  }
  
  const [inserted] = await db.insert(transactions).values({
    userId,
    dedupeKey: parsed.dedupeKey,
    source: parsed.source,
    type: parsed.type,
    direction: parsed.direction,
    amount: parsed.amount,
    fee: parsed.fee,
    counterparty: parsed.counterparty,
    categoryId: parsed.categoryId,
    relatedRef: parsed.relatedRef,
    transferGroup: parsed.transferGroup,
    occurredAt: parsed.occurredAt,
    rawText: parsed.rawText,
    deviceId: parsed.deviceId || '',
    synced: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning();
  
  return inserted.id;
}

/** Get unsynced rows, limited by count, ordered by updated_at. */
export async function getUnsynced(limit: number = 100): Promise<Transaction[]> {
  const rows = await db.select().from(transactions).where(transactions.synced === 0)
    .orderBy(transactions.updatedAt.asc())
    .limit(limit);
  
  return rows as Transaction[];
}

/** Mark rows as synced by dedupe_keys. */
export async function markSynced(dedupeKeys: string[]): Promise<void> {
  if (dedupeKeys.length === 0) return;
  
  await db.update(transactions)
    .set({ synced: 1, updatedAt: new Date().toISOString() })
    .where(transactions.dedupeKey.anyOf(dedupeKeys));
}

/** Upsert a row from remote (last write wins by updated_at) */
export async function upsertFromRemote(row: any): Promise<void> {
  const [existing] = await db.select().from(transactions).where(transactions.dedupeKey === row.dedupe_key);
  
  if (existing) {
    // Last write wins - update if remote has newer updated_at
    if (new Date(row.updated_at) > new Date(existing.updated_at)) {
      await db.update(transactions)
        .set({
          userId: row.user_id,
          source: row.source,
          type: row.type,
          direction: row.direction,
          amount: row.amount,
          fee: row.fee,
          counterparty: row.counterparty,
          categoryId: row.category_id,
          relatedRef: row.related_ref,
          transferGroup: row.transfer_group,
          occurredAt: row.occurred_at,
          rawText: row.raw_text,
          deviceId: row.device_id,
          synced: 1,
          updatedAt: row.updated_at,
        })
        .where(transactions.dedupeKey === row.dedupe_key);
    }
  } else {
    await db.insert(transactions).values({
      id: row.id,
      userId: row.user_id,
      dedupeKey: row.dedupe_key,
      source: row.source,
      type: row.type,
      direction: row.direction,
      amount: row.amount,
      fee: row.fee,
      counterparty: row.counterparty,
      categoryId: row.category_id,
      relatedRef: row.related_ref,
      transferGroup: row.transfer_group,
      occurredAt: row.occurred_at,
      rawText: row.raw_text,
      deviceId: row.device_id,
      synced: 1,
      createdAt: row.updated_at,
      updatedAt: row.updated_at,
    });
  }
}

/** Apply transfer linking over local rows and persist transfer_group */
export async function applyTransferLinking(): Promise<void> {
  const rows = await getUnsynced(1000);
  
  // Link internal transfers (Co-op -> M-Pesa)
  linkInternalTransfers(rows as ParsedTx[]);
  
  // Persist transfer_group values back to the database
  for (const row of rows) {
    if (row.transfer_group) {
      await db.update(transactions)
        .set({ transferGroup: row.transferGroup })
        .where(transactions.dedupeKey === row.dedupe_key);
    }
  }
}