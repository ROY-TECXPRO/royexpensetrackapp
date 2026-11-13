export type Period = 'day' | 'week' | 'month' | 'year';

/** Same shape as the backend `transactions` row / parser ParsedTx (amounts in cents). */
export interface Tx {
  id: string; dedupeKey: string; source: 'mpesa' | 'coop';
  type: string; direction: 'in' | 'out';
  amount: number; fee: number; counterparty: string | null;
  categoryId: string | null; balanceAfter: number | null;
  occurredAt: string; relatedRef: string | null; transferGroup: string | null;
  rawText: string; synced: boolean;
}
export interface Bucket { label: string; out: number; in: number; current: boolean }

export interface Category { id: string; name: string; color: string }
export interface Budget { categoryId: string; limit: number }            // monthly limit, cents
export interface Account { id: string; source: 'mpesa' | 'coop'; name: string; sub: string; balance: number | null; manual?: boolean }
export interface Profile { name: string; email: string }

/** The ONLY thing the UI needs from the backend. See INTEGRATION.md. */
export interface DataService {
  demo: boolean;
  hasSession(): Promise<boolean>;
  signIn(email: string, password: string, remember: boolean): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  biometric?(): Promise<void>;            // omit if the device has no biometrics
  listTransactions(): Promise<Tx[]>;      // read from LOCAL SQLite so it works offline
  getProfile(): Promise<Profile>;
  listAccounts(): Promise<Account[]>;     // M-Pesa balance = latest balanceAfter; Co-op = manual or null
  listCategories(): Promise<Category[]>;
  setCategory(txId: string, categoryId: string | null): Promise<void>;
  listBudgets(): Promise<Budget[]>;       // needs supabase/migrations/003_budgets.sql
  saveBudget(b: Budget): Promise<void>;
  removeBudget(categoryId: string): Promise<void>;
  setManualBalance(accountId: string, balance: number | null): Promise<void>;   // Co-op SMS has no balance
  saveRule(counterparty: string, categoryId: string): Promise<void>;           // auto-categorize future messages
  requestSmsPermission(): Promise<boolean>;
  importHistory(onProgress: (done: number, total: number) => void): Promise<{ imported: number; unknown: number }>;
  syncNow(): Promise<{ pending: number }>;
  pendingCount(): Promise<number>;
}
