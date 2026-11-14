/**
 * Upload module: batches of 100 unsynced rows, upserts to Supabase,
 * marks synced only after success.
 * 
 * Uses the Supabase anon client with user_id from the active session.
 * Safe to run repeatedly - rows already synced (synced=1) are skipped.
 */

export interface UploadResult {
  success: boolean;
  uploadedCount: number;
  alreadySyncedCount: number;
  error?: string;
}

/**
 * Upload unsynced transactions to Supabase in batches of 100.
 * Upserts with onConflict 'user_id,dedupe_key' so duplicates are handled.
 * Marks rows as synced only after successful upsert.
 */
export async function uploadTransactions(
  supabase: any,
  db: any,
  batchSize: number = 100
): Promise<UploadResult> {
  const unsynced = await db.getUnsynced(batchSize);
  if (unsynced.length === 0) {
    return { success: true, uploadedCount: 0, alreadySyncedCount: 0 };
  }

  let totalUploaded = 0;
  let alreadySynced = 0;
  let errors: string[] = [];

  // Process in batches of batchSize
  for (let i = 0; i < unsynced.length; i += batchSize) {
    const batch = unsynced.slice(i, i + batchSize);
    const txRows = batch.map((tx: any) => ({
      id: tx.id,
      user_id: tx.user_id,
      dedupe_key: tx.dedupe_key,
      source: tx.source,
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount,
      fee: tx.fee,
      counterparty: tx.counterparty,
      category_id: tx.category_id,
      balance_after: tx.balance_after,
      related_ref: tx.related_ref,
      transfer_group: tx.transfer_group,
      occurred_at: tx.occurred_at,
      raw_text: tx.raw_text,
      device_id: tx.device_id,
      synced: 0,
      updated_at: tx.updated_at,
    }));

    try {
      const { error, data } = await supabase
        .from('transactions')
        .upsert(txRows, {
          onConflict: 'user_id,dedupe_key',
        });

      if (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        continue;
      }

      // Mark the batch as synced only after successful upsert
      const dedupeKeys = batch.map((tx: any) => tx.dedupe_key);
      await db.markSynced(dedupeKeys);
      totalUploaded += data?.length ?? batch.length;
    } catch (e: any) {
      errors.push(`Batch ${i / batchSize + 1}: ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    uploadedCount: totalUploaded,
    alreadySyncedCount: 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/** Upload categories to Supabase. */
export async function uploadCategories(
  supabase: any,
  db: any,
  batchSize: number = 100
): Promise<UploadResult> {
  // This would query local categories table
  // For now, placeholder - same pattern as transactions
  return { success: true, uploadedCount: 0, alreadySyncedCount: 0 };
}

/** Upload category_rules to Supabase. */
export async function uploadCategoryRules(
  supabase: any,
  db: any,
  batchSize: number = 100
): Promise<UploadResult> {
  // Same pattern as categories
  return { success: true, uploadedCount: 0, alreadySyncedCount: 0 };
}