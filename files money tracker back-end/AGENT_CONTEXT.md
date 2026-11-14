# Expense Planner: Agent Context

Read this fully before changing anything. This is the source of truth for architecture and backend contract.

## Product
Personal Android app (single user, Roy) that auto-tracks every M-Pesa and Co-op Bank transaction by reading SMS. No manual entry. Offline-first. Multiple phones (Oppo, Samsung, others) share one SIM by swapping it, so a Supabase backend is the single source of truth.

## Hard constraints
- Android only. SMS permissions: READ_SMS, RECEIVE_SMS. Distributed as a sideloaded APK (not Play Store).
- Offline-first: the app must work fully with no internet. SQLite on device is the working store.
- Only process SMS from allowed sender IDs (M-PESA and the Co-op Bank sender). Never read, store or upload any other SMS.
- Always store the raw SMS text.
- Money is stored as integers in cents. Never use floats.
- The Supabase service_role key must never appear in the app. Use only the anon key plus the signed-in user session.

## Stack
React Native (or Capacitor) + TypeScript, SQLite local, Supabase (Postgres, Auth, RLS).

## Architecture
SMS inbox -> sender filter -> parser -> local SQLite (synced=0) -> sync queue -> Supabase.
Each phone also pulls rows it lacks, so every device shows the full history.

## Backend contract (do not redesign without asking Roy)
Schema lives in `supabase/migrations/001_init.sql`. Tables: `transactions`, `categories`, `category_rules`. RLS is enabled on all three: users can only access rows where `user_id = auth.uid()`.

### Identity and deduplication
- The sync identity of a transaction is `(user_id, dedupe_key)`, NOT `id`.
- `dedupe_key` is namespaced: `mpesa:<TRANSACTION_CODE>` for M-Pesa and `coop:<BANK_REF>` for Co-op (the `Ref:AC...:` value in the message). Fallback for unrecognized messages: `<source>:raw:<hash of text>`.
- Two phones can see the same SMS and generate different local `id`s. Reconcile by `dedupe_key`. On pull, if a row with that dedupe_key exists locally, keep the local row and just mark it synced; never create a second one.

### Upload (push)
- Select local rows where `synced = 0`, batch (e.g. 100), upsert to Supabase with `onConflict: 'user_id,dedupe_key'`, set `user_id` from the session, then mark rows synced locally.
- Upload categories and category_rules the same way (`onConflict: 'user_id,name'` and `'user_id,match_field,match_value'`).

### Download (pull)
- Store `last_pull_at` in the local `sync_state` table.
- Query rows where `updated_at > last_pull_at`, ordered by `updated_at`, paginated. Insert unknown rows (by dedupe_key), update changed ones. Then advance `last_pull_at` to the max `updated_at` received.
- `updated_at` is set by a server trigger. Do not trust client clocks for it.

### Conflicts
Parsed fields never change after creation. Only `category_id` is user-editable, so last write (by server `updated_at`) wins.

### Recovery
On every app open: rescan the SMS inbox for allowed senders, parse, and insert any missing rows (dedupe makes this safe). This covers messages missed while the app was killed.

## Local SQLite schema
Mirror the `transactions` columns from the migration, plus `synced INTEGER DEFAULT 0`. Add `sync_state(key TEXT PRIMARY KEY, value TEXT)`. `dedupe_key` is UNIQUE locally too.

## Parser rules
- One regex pattern per transaction type, each with unit tests built from real (redacted) sample messages in `docs/samples/`.
- Unrecognized message from an allowed sender: store with `type = 'unknown'`, keep raw text, flag for review. Never drop.
- Transaction types: sent, received, paid (paybill/till), withdraw, deposit, airtime, transfer, fee, unknown.
- Do not invent message formats. Wait for real samples before finalizing patterns.

## Supabase setup tasks (for the VS Code AI)
1. Create/link the Supabase project; apply `001_init.sql`.
2. Enable email auth (single user is fine). Disable public sign-ups after Roy's account exists.
3. Put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in a local env file that is gitignored. Never commit keys.
4. Verify RLS: a second test account must not be able to read the first account's rows.
5. Implement the sync module exactly per the contract above and test: offline capture, reconnect sync, two-device dedupe.

## Build phases
0 Setup, 1 SMS + M-Pesa parser + SQLite, 2 Core UI, 3 Co-op parser, 4 Backend + sync, 5 Breakdown + categories + CSV export, 6 Hardening (battery exemptions, rescan on open, SIM-swap test, signed APK).

## Screens
Onboarding (permission + first inbox import), Home, Transactions (filters), Breakdown (charts), Categories, Settings (devices, sync now, export CSV, battery help).

## Known risks
Oppo and Samsung kill background apps (need battery exemption and rescan on open). SMS wording can change (hence raw text). The SMS plugin must be verified as maintained before committing to it.


## Parser findings from real SMS samples (authoritative; supersedes earlier guesses)

Implemented in `app/src/parser/` with passing tests (`npx tsx --test src/parser/parser.test.ts`). Do not rewrite the regexes; extend them from new real samples.

### Formats confirmed
- **M-Pesa paid (till/merchant):** `<CODE> Confirmed. Ksh60.00 paid to <NAME>. on 11/11/26 at 8:53 AM.New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00. ...` Merchant name ends with a stray period. Note there may be no space after the period before "New M-PESA".
- **M-Pesa received:** `<CODE> Confirmed.You have received Ksh74.00 from CO-OP BANK 149444 on 10/11/26 at 7:07 PM New M-PESA balance is Ksh74.00.` Has NO "Transaction cost" line (fee = 0). No space after "Confirmed." in this variant.
- **Co-op transfer to own mobile:** starts with a long fixed security warning, then `Ref:<BANK_REF>: Dear <NAME>, MPESA transfer of KES 74 to your mobile <phone> at 10-11-2026 07:07 PM was successful.MPESA Ref:<MPESA_REF>.` Never anchor parsing on the start of a Co-op message.

### Facts that drive the design
1. **Date formats differ.** M-Pesa: `D/M/YY` + `h:mm AM/PM`. Co-op: `DD-MM-YYYY` + `hh:mm AM/PM`. Both are DAY first (verified: same event shows 10/11/26 and 10-11-2026). All times are Africa/Nairobi (+03:00). Store `occurred_at` with `+03:00`.
2. **Amounts** may contain commas and may omit decimals (`KES 74`). Always convert via string math to integer cents.
3. **One real-world event can produce two SMS.** A bank-to-M-Pesa transfer yields a Co-op "transfer to your mobile" (out) AND an M-Pesa "received from CO-OP BANK" (in).
4. **Their codes do NOT match.** The bank quotes one M-Pesa ref (`UKAPB1FQZO`), the wallet SMS shows another (`UKAPB1FR0C`). Never link them by code.
5. **Therefore link by amount + time window (5 min)** and set the same `transfer_group` on both rows (`linkInternalTransfers`). The group id is deterministic (`tg:` + sorted dedupe keys), so every phone computes the same value.
6. **Rows with `transfer_group IS NOT NULL` are internal transfers and must be EXCLUDED from income and spending totals.** Show them in the transactions list with a transfer badge. Otherwise totals are inflated.
7. An M-Pesa "received from CO-OP BANK" with no matching Co-op SMS is treated as real income (e.g. someone else paying via Co-op). Re-run linking after every sync pull, since the two messages may arrive on different phones.
8. Co-op messages carry the user's own phone number and name. Never log raw SMS to console or analytics. Redact before putting any sample in the repo.

### Still unknown (needs real samples; do not guess)
Sender IDs (see `SENDER_MAP` in `index.ts`, Co-op entry is a placeholder), M-Pesa sent-to-person, Paybill payments, withdrawals, deposits, airtime, Fuliza, reversals, M-Pesa to bank, Co-op deposits/withdrawals/charges/card transactions. Until a pattern exists, these are stored as `type = 'unknown'` with raw text intact and surfaced in a "Needs review" list.

### Schema additions in 001_init.sql
`related_ref` (extra reference quoted in a message) and `transfer_group` (internal transfer pairing, indexed). Mirror both in the local SQLite table.
