/**
 * RLS Test Script
 * 
 * Verifies that Row Level Security is working correctly:
 * - A second account must read zero rows of the first account's transactions.
 * - This is critical for multi-tenant data privacy.
 * 
 * Run this via the Supabase SQL editor with two different user sessions.
 */

-- ============================================================
-- RLS Test: Account A should see only its own rows
-- ============================================================

-- Step 1: As account A (user_id = '00000000-0000-0000-0000-000000000001'),
-- insert a transaction and verify it's visible only to account A.

-- Step 2: As account B (user_id = '11111111-1111-1111-1111-111111111111'),
-- query transactions and verify zero rows are returned.

-- SQL commands to run (replace user IDs with real supabase auth user IDs):

-- ===== As Account A =====
-- First, get your account ID: select auth.uid();
-- Then insert a test transaction:
INSERT INTO public.transactions (user_id, dedupe_key, source, type, direction, amount, counterparty, occurred_at, raw_text, device_id)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,  -- replace with actual auth.uid()
  'mpesa:RLS_TEST_001',
  'mpesa',
  'paid',
  'out',
  1000,
  'Test Counterparty',
  '2026-11-11T09:00:00+03:00',
  'SMS test row for A',
  'dev-001'
);

-- ===== As Account B =====
-- Verify account B sees ZERO rows from account A's insert:
SELECT count(*) AS row_count FROM public.transactions WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;
-- Expected result: row_count = 0

-- ===== Verify Account A can see their own rows =====
SELECT count(*) AS my_rows FROM public.transactions WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;
-- Expected result: my_rows = 1

-- ===== Cleanup =====
-- DELETE FROM public.transactions WHERE counterparty = 'Test Counterparty';