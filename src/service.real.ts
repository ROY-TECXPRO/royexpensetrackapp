import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Budget, Category, DataService, Tx, Account, Profile } from './types';
import { store } from './store';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zfmwtexiyxjdmwybecfv.supabase.com';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_1SeNDrQMEddymPbqozZ9EQ_kAZ-vvUP';

let sb: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!sb) {
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return sb;
}

function mapTx(row: any): Tx {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    source: row.source,
    type: row.type,
    direction: row.direction,
    amount: row.amount,
    fee: row.fee ?? 0,
    counterparty: row.counterparty ?? null,
    categoryId: row.category_id ?? null,
    balanceAfter: row.balance_after ?? null,
    occurredAt: row.occurred_at,
    relatedRef: row.related_ref ?? null,
    transferGroup: row.transfer_group ?? null,
    rawText: row.raw_text,
    synced: row.synced !== false,
  };
}
export const service: DataService = {
  demo: false,

  async hasSession(): Promise<boolean> {
    try {
      const { data: { session } } = await client().auth.getSession();
      return !!session;
    } catch {
      return false;
    }
  },

  async signIn(email: string, password: string, remember: boolean): Promise<void> {
    const { error } = await client().auth.signInWithPassword({ email, password });
    if (error) throw error;
    store.set('ep_email', email);
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    await client().auth.signOut();
    store.del('ep_session');
    store.del('ep_email');
  },

  async biometric(): Promise<void> {
    try {
      // @ts-ignore - Capacitor runtime plugin
      const { Plugins } = await import('@capacitor/core');
      const { LocalAuthentication } = (Plugins as any) ?? {};
      if (LocalAuthentication) {
        const isAvail = await LocalAuthentication.isAvailable();
        if (isAvail.isAvailable) {
          await LocalAuthentication.authenticate({
            reason: 'Authenticate to access your expense data',
          });
          return;
        }
      }
    } catch {
      // Capacitor not available in browser / plugin not installed
    }
    throw new Error('Biometric authentication is not available on this device.');
  },

  async listTransactions(): Promise<Tx[]> {
    const { data, error } = await client()
      .from('transactions')
      .select('*')
      .order('occurred_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTx);
  },

  async getProfile(): Promise<Profile> {
    const { data: { user }, error } = await client().auth.getUser();
    if (error || !user) throw new Error('No authenticated user');
    const { data: profile } = await client()
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();
    if (profile) return { name: profile.name, email: profile.email };
    const name = user.email
      ? user.email.split('@')[0].replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : 'User';
    return { name, email: user.email || '' };
  },

  async listAccounts(): Promise<Account[]> {
    const { data: mpesaRows } = await client()
      .from('transactions')
      .select('balance_after')
      .eq('source', 'mpesa')
      .not('balance_after', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1);
    const mpesaBalance = mpesaRows?.[0]?.balance_after ?? null;
    const coopManual = store.get('ep_coop_balance');
    const coopBalance = coopManual ? parseInt(coopManual, 10) : null;
    return [
      { id: 'mpesa', source: 'mpesa', name: 'M-Pesa', sub: 'Personal wallet', balance: mpesaBalance, manual: false },
      { id: 'coop', source: 'coop', name: 'Co-op Bank', sub: 'Everyday account', balance: coopBalance, manual: true },
    ];
  },

  async listCategories(): Promise<Category[]> {
    const { data, error } = await client()
      .from('categories')
      .select('*')
      .order('name');
    if (error) throw error;
    const defaults: Category[] = [
      { id: 'groceries', name: 'Food & groceries', color: '#8FD400' },
      { id: 'eating', name: 'Eating out', color: '#F59E0B' },
      { id: 'transport', name: 'Transport & fuel', color: '#7C3AED' },
      { id: 'utilities', name: 'Utilities', color: '#0EA5A0' },
      { id: 'airtime', name: 'Airtime & data', color: '#E879F9' },
      { id: 'rent', name: 'Rent & housing', color: '#60A5FA' },
      { id: 'people', name: 'Sent to people', color: '#FB7185' },
      { id: 'income', name: 'Income', color: '#65A30D' },
    ];
    if (data && data.length > 0) {
      return data.map((c: any) => ({ id: c.id, name: c.name, color: c.color || '#6366f1' }));
    }
    return defaults;
  },
  async setCategory(txId: string, categoryId: string | null): Promise<void> {
    const { error } = await client()
      .from('transactions')
      .update({ category_id: categoryId, synced: false })
      .eq('id', txId);
    if (error) throw error;
  },

  async listBudgets(): Promise<Budget[]> {
    const { data, error } = await client()
      .from('budgets')
      .select('*');
    if (error) throw error;
    return (data || []).map((b: any) => ({ categoryId: b.category_id, limit: b.amount_cents }));
  },

  async saveBudget(b: Budget): Promise<void> {
    const { error } = await client()
      .from('budgets')
      .upsert({ category_id: b.categoryId, amount_cents: b.limit }, { onConflict: 'category_id' });
    if (error) throw error;
  },

  async removeBudget(categoryId: string): Promise<void> {
    const { error } = await client()
      .from('budgets')
      .delete()
      .eq('category_id', categoryId);
    if (error) throw error;
  },

  async setManualBalance(accountId: string, balance: number | null): Promise<void> {
    if (accountId !== 'coop') return;
    if (balance !== null) {
      store.set('ep_coop_balance', String(balance));
    } else {
      store.del('ep_coop_balance');
    }
  },

  async saveRule(counterparty: string, categoryId: string): Promise<void> {
    const { error } = await client()
      .from('category_rules')
      .upsert(
        { match_field: 'counterparty', match_value: counterparty, category_id: categoryId },
        { onConflict: 'match_field,match_value' },
      );
    if (error) throw error;
  },

  async requestSmsPermission(): Promise<boolean> {
    try {
      // @ts-ignore - Capacitor runtime plugin
      const { Plugins } = await import('@capacitor/core');
      const { SMS } = (Plugins as any) ?? {};
      if (SMS && SMS.requestPermissions) {
        const result = await SMS.requestPermissions();
        return result.granted === true;
      }
    } catch {
      // Capacitor not available in browser
    }
    return true;
  },

  async importHistory(_onProgress: (done: number, total: number) => void): Promise<{ imported: number; unknown: number }> {
    // Real implementation requires the Capacitor SMS plugin to read the inbox.
    // Install @capacitor-community/sms and wire it here for production.
    _onProgress(0, 0);
    return { imported: 0, unknown: 0 };
  },

  async syncNow(): Promise<{ pending: number }> {
    const pending = await this.pendingCount();
    return { pending };
  },

  async pendingCount(): Promise<number> {
    const { count, error } = await client()
      .from('transactions')
      .select('*', { head: true })
      .eq('synced', false);
    if (error) throw error;
    return count || 0;
  },
};