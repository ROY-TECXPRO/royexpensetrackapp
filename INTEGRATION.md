# Front-end integration guide

Stack: React 18 + TypeScript + Vite. Runs in a Capacitor Android webview (needed so CSS `backdrop-filter` glass works natively).
The backend (Supabase, SQLite, sync, SMS) is built separately. This UI talks to it through ONE interface: `DataService` in `src/types.ts`.

## Run it now (demo data)
npm install
npm run dev      # open on phone or desktop, any email + 6+ char password signs in
npm test         # aggregation tests (spending math, Nairobi day boundaries, transfer exclusion)
npm run build

## Wire the real backend (3 steps)
1. Open `src/service.real.ts`. Implement every method:
   - hasSession / signIn(email, password, remember) / signOut / resetPassword -> Supabase auth. `remember=false` should use a session-only token.
   - listTransactions -> read the LOCAL SQLite `transactions` table (not Supabase), map each row to `Tx` (camelCase, amounts in cents, `synced` as boolean). Offline must work.
   - getProfile -> name + email from the Supabase user.
   - listAccounts -> M-Pesa balance = latest `balanceAfter` of an M-Pesa row. Co-op SMS contain NO balance, so return the user's manual balance or null (UI shows "Not in SMS").
   - listCategories / setCategory -> categories table, and update transactions.category_id locally (mark unsynced).
   - listBudgets / saveBudget / removeBudget -> budgets table. Apply `supabase/migrations/003_budgets.sql` first.
   - requestSmsPermission -> Capacitor SMS plugin permission prompt (READ_SMS, RECEIVE_SMS).
   - importHistory(onProgress) -> read the inbox, filter allowed senders, parse, insert, call onProgress(done,total), return { imported, unknown }. Also used by the "Rescan messages" button.
   - setManualBalance -> Co-op SMS has no balance; store the user's entered figure (null clears it).
   - saveRule(counterparty, categoryId) -> insert into category_rules so the parser categorizes future messages. The UI already applies it to existing uncategorized rows.
   - syncNow -> run sync upload then download, then return the pending count.
   - pendingCount -> count of rows with synced = 0.
   - biometric -> Capacitor biometric plugin, or delete the property to hide the fingerprint button.
2. In `src/App.tsx` change `import { service } from './service'` to `'./service.real'`.
3. Delete the demo data once the real data shows.

## Rules the UI relies on (do not change)
- Money is integer cents. Times are ISO 8601 with +03:00 (Africa/Nairobi).
- Rows with `transferGroup` set are internal transfers: never counted as spending or income (`src/stats.ts`).
- Spending = amount + fee for direction 'out'. Income = amount for direction 'in'.
- `listTransactions` should return all rows; the UI aggregates locally so charts work offline.

## Capacitor (Android) quick start
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Expense Planner" com.roytecxpro.expenseplanner --web-dir dist
npm run build && npx cap add android && npx cap sync
Safe areas are already handled with env(safe-area-inset-*).

## Security notes
- App lock: PIN is salted + PBKDF2 hashed with a 5-wrong-tries lockout that grows (30s, 60s, ... max 15 min). That only stops casual access. For production keep the hash in Android Keystore (secure-storage plugin).
- `service.biometric` is a DEMO STUB that signs in with no check. Replace it with a real Capacitor biometric plugin before using real data, or delete the property to hide the buttons.
- Android recent-apps preview can still show balances: set FLAG_SECURE in the Capacitor Android activity.
- CSV export uses a browser download. In Capacitor, write with the Filesystem plugin and open the Share sheet. Cells starting with = + - @ are prefixed with an apostrophe to block spreadsheet formula injection.
- Fonts (Inter, Space Grotesk) are bundled, so the app looks right offline.

## Decisions baked in
- Cash withdrawals and deposits count as spending / income like any other row. Change `series`, `totals`, `spentByCat` in `src/stats.ts` if you want them treated as cash movement.
- Unreadable messages (type 'unknown') are never counted; they show as "Needs review" with a Copy button.
- Notifications are in-app only (bell). Real push/local notifications need a Capacitor plugin.

## Depends on the parser (needs real sample messages)
Sends to people, Paybill, withdrawals, deposits, airtime, Fuliza, reversals, and M-Pesa to Co-op transfers. Until then they appear under Needs review, and an M-Pesa to Co-op transfer would count as spending.

## Not built
Savings goals, per-transaction notes and receipt photos, PDF statements, tablet-specific layout.
