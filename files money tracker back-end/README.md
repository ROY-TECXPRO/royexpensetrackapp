# Expense Planner Backend

## Overview
Personal Android app that auto-tracks M-Pesa and Co-op Bank transactions from SMS,
works offline, and syncs across several phones through Supabase.

## Setup

### Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Supabase credentials in `.env`:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
   - Never commit real keys. The `.env` file is gitignored.
   - Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are needed in the app.
   - The `service_role` key must never appear in the app or any committed file.

### .gitignore
The `.gitignore` file is pre-configured to ignore:
- `node_modules/`
- `.env`
- `*.db`, `*.sqlite`
- `logs/`, `*.log`
- OS-specific files (`.DS_Store`, `Thumbs.db`)
- Editor directories (`.vscode/`, `.idea/`)

### Supabase Project Setup
1. Create a new Supabase project or link an existing one.
2. Run the initial migration:
   ```bash
   supabase db push --link-to-project
   ```
   Or manually apply `001_init.sql` via the Supabase SQL editor.
3. Enable email authentication in the Supabase dashboard.
4. Create your user account via email auth.
5. Disable public sign-ups (set "Site wide auth settings" -> "Enable signups" to off).
6. Run the reporting migration:
   ```bash
   supabase db push --link-to-project
   ```
   This applies `002_reporting.sql` which adds the `spending_by_period` function.

## Running Migrations
```bash
# Apply initial schema
supabase db push --link-to-project

# Apply new migrations (002, 003, etc.)
supabase db push --link-to-project
```

## Running Tests

### Parser Tests (existing)
```bash
npx tsx --test parser.test.ts
```
Verifies SMS parsing logic for M-Pesa and Co-op Bank messages.

### SQLite DB Tests (new)
```bash
npx tsx --test app/src/db/db.test.ts
```
Tests the local SQLite database layer:
- Schema creation
- insertIfNew (no duplicate rows)
- getUnsynced (filter by synced flag)
- markSynced (update sync flag)
- upsertFromRemote (last-write-wins)
- applyTransferLinking (persist transfer_group)

### Sync Module Tests (new)
```bash
npx tsx --test app/src/sync/sync.test.ts
```
Tests the upload/download sync module:
- Duplicate prevention
- Unsynced row retrieval
- Sync marking
- Remote upsert
- Transfer linking after pull

## License
Personal project - Expense Planner