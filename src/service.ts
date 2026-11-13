// DEMO data service. Replace with the real one (see INTEGRATION.md).
import type { Budget, Category, DataService, Tx } from './types';
import { store } from './store';
const CATS: Category[] = [
  { id: 'groceries', name: 'Food & groceries', color: '#8FD400' }, { id: 'eating', name: 'Eating out', color: '#F59E0B' },
  { id: 'transport', name: 'Transport & fuel', color: '#7C3AED' }, { id: 'utilities', name: 'Utilities', color: '#0EA5A0' },
  { id: 'airtime', name: 'Airtime & data', color: '#E879F9' }, { id: 'rent', name: 'Rent & housing', color: '#60A5FA' },
  { id: 'people', name: 'Sent to people', color: '#FB7185' }, { id: 'income', name: 'Income', color: '#65A30D' },
];
const SHOPS: [string, string][] = [['SUPER GEN SHOP', 'groceries'], ['NAIVAS', 'groceries'], ['MAMA MBOGA', 'groceries'], ['JAVA HOUSE', 'eating'], ['TOTAL ENERGIES', 'transport'], ['UBER', 'transport'], ['KPLC PREPAID', 'utilities'], ['SAFARICOM AIRTIME', 'airtime'], ['JOHN M', 'people'], ['LANDLORD', 'rent']];
const MAN = new Map<string, number | null>();
let BUDGETS: Budget[] = [{ categoryId: 'groceries', limit: 1500000 }, { categoryId: 'transport', limit: 600000 }, { categoryId: 'eating', limit: 500000 }, { categoryId: 'utilities', limit: 400000 }];
const KEY = 'ep_session', delay = (ms: number) => new Promise(r => setTimeout(r, ms));
function rng(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mk = (o: Partial<Tx>): Tx => ({ id: o.dedupeKey!, dedupeKey: '', source: 'mpesa', type: 'paid', direction: 'out', amount: 0, fee: 0, counterparty: null, categoryId: null, balanceAfter: null, occurredAt: '', relatedRef: null, transferGroup: null, rawText: '', synced: true, ...o });
function seed(): Tx[] {
  const r = rng(7), now = Date.now(), out: Tx[] = [];
  for (let d = 2; d < 430; d++) for (let k = Math.floor(r() * 3); k > 0; k--) {
    const inc = r() < 0.12, sh = SHOPS[Math.floor(r() * SHOPS.length)], amt = (60 + Math.floor(r() * (inc ? 2500 : 1100))) * 100;
    out.push(mk({ dedupeKey: `demo:${d}:${k}`, type: inc ? 'received' : 'paid', direction: inc ? 'in' : 'out', amount: amt, fee: inc ? 0 : 700, counterparty: inc ? 'EMPLOYER LTD' : sh[0], categoryId: inc ? 'income' : sh[1], occurredAt: new Date(now - d * 864e5 - Math.floor(r() * 7e7)).toISOString(), rawText: 'Demo transaction' }));
  }
  const base = new Date(now), nowMs = now;
  for (let m = 0; m < 7; m++) for (const [name, cat, day, amt] of [['KPLC PREPAID', 'utilities', 5, 2000], ['LANDLORD', 'rent', 1, 12000], ['SAFARICOM AIRTIME', 'airtime', 12, 500]] as [string, string, number, number][]) {
    const t = Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - m, day, 6);
    if (t < nowMs - 864e5) out.push(mk({ dedupeKey: `demo:rec:${name}:${m}`, counterparty: name, categoryId: cat, amount: amt * 100, fee: 700, occurredAt: new Date(t).toISOString(), rawText: 'Demo transaction' }));
  }
  const tg = 'tg:coop:AC5601889F26|mpesa:UKAPB1FR0C';
  out.push(
    mk({ dedupeKey: 'mpesa:UKBPB1HHTJ', amount: 6000, counterparty: 'SUPER GEN SHOP', categoryId: 'groceries', balanceAfter: 0, occurredAt: '2026-11-11T08:53:00+03:00', rawText: 'UKBPB1HHTJ Confirmed. Ksh60.00 paid to SUPER GEN SHOP. on 11/11/26 at 8:53 AM.New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.' }),
    mk({ dedupeKey: 'mpesa:UKAPB1FR0C', type: 'received', direction: 'in', amount: 7400, counterparty: 'CO-OP BANK 149444', balanceAfter: 7400, occurredAt: '2026-11-10T19:07:00+03:00', transferGroup: tg, rawText: 'UKAPB1FR0C Confirmed.You have received Ksh74.00 from CO-OP BANK 149444 on 10/11/26 at 7:07 PM New M-PESA balance is Ksh74.00.' }),
    mk({ dedupeKey: 'coop:AC5601889F26', source: 'coop', type: 'transfer', amount: 7400, counterparty: 'Own M-Pesa', relatedRef: 'UKAPB1FQZO', occurredAt: '2026-11-10T19:07:00+03:00', transferGroup: tg, rawText: 'Ref:AC5601889F26: Dear XXXX, MPESA transfer of KES 74 to your mobile at 10-11-2026 07:07 PM was successful.MPESA Ref:UKAPB1FQZO.' }),
  );
  return out;
}
const DATA = seed();
export const service: DataService = {
  demo: true,
  async hasSession() { return store.get(KEY) === '1'; },
  async signIn(email, pw, _remember) {
    await delay(900);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
    store.set(KEY, '1'); store.set('ep_email', email);
  },
  async signUp(email, pw, name) {
    await delay(900);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!name.trim()) throw new Error('Please enter your name.');
    store.set(KEY, '1'); store.set('ep_email', email);
  },
  async resetPassword(email) { await delay(700); if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.'); },
  async setManualBalance(id, b) { MAN.set(id, b); },
  async saveRule(_c, _cat) {},
  async requestSmsPermission() { await delay(500); return true; },
  async importHistory(onProgress) {
    const total = DATA.length;
    for (let i = 1; i <= 20; i++) { await delay(110); onProgress(Math.round((total * i) / 20), total); }
    return { imported: total, unknown: 0 };
  },
  async biometric() { await delay(600); store.set(KEY, '1'); },
  async signOut() { store.del(KEY); },
  async listTransactions() { return [...DATA]; },
  async getProfile() { return { name: 'Roy Nyamawi', email: store.get('ep_email') ?? 'roy@example.com' }; },
  async listAccounts() { return [
    { id: 'mpesa', source: 'mpesa', name: 'M-Pesa', sub: 'Personal wallet', balance: 3845000 },
    { id: 'coop', source: 'coop', name: 'Co-op Bank', sub: 'Everyday account', balance: MAN.has('coop') ? MAN.get('coop')! : 9000000, manual: MAN.has('coop') }]; },
  async listCategories() { return CATS; },
  async setCategory(id, c) { const t = DATA.find(x => x.id === id); if (t) t.categoryId = c; },
  async listBudgets() { return [...BUDGETS]; },
  async saveBudget(b) { BUDGETS = [...BUDGETS.filter(x => x.categoryId !== b.categoryId), b]; },
  async removeBudget(c) { BUDGETS = BUDGETS.filter(x => x.categoryId !== c); },
  async syncNow() { await delay(900); return { pending: 0 }; },
  async pendingCount() { return 0; },
};
