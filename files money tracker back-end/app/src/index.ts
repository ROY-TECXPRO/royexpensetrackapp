import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifySupabaseToken, getUserProfile } from './auth';
import express from 'express';
import { parseSms } from '../../index';
import type { ParsedTx } from '../../common';

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed front-end origins (add your Netlify URL here)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

/** Simple CORS middleware */
app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');
  if (_req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// Server-side Supabase client (service_role key - NEVER expose to frontend)
let sbAdmin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!sbAdmin) {
    sbAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return sbAdmin;
}

/** Auth middleware: verify Supabase JWT from Authorization header. */
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  const payload = await verifySupabaseToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  (req as any).user = payload;
  next();
}

// ============================================================
// Auth routes
// Frontend calls Supabase Auth directly via @supabase/supabase-js.
// These backend endpoints are provided for server-side auth flows.
// ============================================================

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    // 1. Create the Supabase Auth user
    const { data, error: authError } = await adminClient().auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (authError) return res.status(400).json({ error: authError.message });
    if (!data.user) return res.status(400).json({ error: 'Failed to create user' });

    // 2. Create user profile in own DB tables
    try {
      await adminClient()
        .from('profiles')
        .insert({ id: data.user.id, name, email });
    } catch (profileError) {
      // Profile creation failed but auth user was created - still return success
      console.error('Profile creation error:', profileError);
    }

    // 3. Return success - front-end will then auto-sign-in
    res.status(200).json({ success: true, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (_req, res) => {
  res.status(405).json({ error: 'Login is handled by Supabase Auth on the frontend.' });
});

app.post('/api/auth/refresh', (_req, res) => {
  res.status(405).json({ error: 'Token refresh is handled by Supabase client on the frontend.' });
});

app.post('/api/auth/logout', authenticate, (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const profile = await getUserProfile((req as any).user.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

// ============================================================
// SMS parsing endpoint
// Parses a raw SMS and returns the structured transaction.
// ============================================================

app.post('/api/sms/parse', authenticate, async (req, res) => {
  const { sender, body, receivedAt } = req.body;
  if (!sender || !body) {
    return res.status(400).json({ error: 'sender and body are required.' });
  }
  const parsed = parseSms(sender, body, receivedAt || new Date().toISOString());
  if (!parsed) return res.json({ parsed: null });
  res.json({ parsed });
});

// ============================================================
// SMS import endpoint
// Inserts parsed transactions into Supabase (server-side).
// ============================================================

app.post('/api/sms/import', authenticate, async (req, res) => {
  const { transactions } = req.body;
  const userId = (req as any).user.userId;
  const deviceId = (req.headers['x-device-id'] as string) || 'unknown';

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'transactions array is required.' });
  }

  const rows = (transactions as ParsedTx[]).map((tx) => ({
    user_id: userId,
    dedupe_key: tx.dedupeKey,
    source: tx.source,
    type: tx.type,
    direction: tx.direction,
    amount: tx.amount,
    fee: tx.fee,
    counterparty: tx.counterparty,
    category_id: tx.categoryId,
    balance_after: tx.balanceAfter,
    related_ref: tx.relatedRef,
    transfer_group: tx.transferGroup,
    occurred_at: tx.occurredAt,
    raw_text: tx.rawText,
    device_id: deviceId,
  }));

  const { error } = await adminClient()
    .from('transactions')
    .upsert(rows, { onConflict: 'user_id,dedupe_key' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ imported: rows.length });
});

// ============================================================
// Sync endpoints
// Frontend calls Supabase directly via @supabase/supabase-js.
// These are provided for backend-initiated sync if needed.
// ============================================================

app.post('/api/sync/upload', authenticate, (_req, res) => {
  res.json({ ok: true, message: 'Use Supabase client directly for sync upload.' });
});

app.post('/api/sync/download', authenticate, (_req, res) => {
  res.json({ ok: true, message: 'Use Supabase client directly for sync download.' });
});

// ============================================================
// Health check
// ============================================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is healthy', database: 'supabase' });
});

// Only start listening when run directly (not under serverless-http)
if (process.env.NETLIFY !== 'true' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`Expense Planner Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;