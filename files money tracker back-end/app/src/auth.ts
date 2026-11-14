import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

// Server-side Supabase client (uses service_role key - NEVER expose to frontend)
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

/** Verify a Supabase JWT access token and return the user ID. */
export async function verifySupabaseToken(token: string): Promise<{ userId: string; email?: string } | null> {
  try {
    const secret = process.env.SUPABASE_JWT_SECRET!;
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { issuer: 'supabase' }
    );
    const userId = payload.sub as string;
    const email = payload.email as string | undefined;
    if (!userId) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

/** Look up a user by Supabase auth UUID and return their profile. */
export async function getUserProfile(userId: string): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    const { data, error } = await adminClient()
      .from('profiles')
      .select('id, email, name')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return { id: data.id, email: data.email, name: data.name };
  } catch {
    return null;
  }
}

/** Legacy password helpers - no longer used for auth (Supabase Auth handles passwords). */
export async function hashPassword(_password: string): Promise<string> {
  throw new Error('Password hashing is handled by Supabase Auth, not the backend.');
}

export async function comparePassword(_password: string, _hashedPassword: string): Promise<boolean> {
  throw new Error('Password comparison is handled by Supabase Auth, not the backend.');
}

export function generateAuthTokens(_userId: string) {
  throw new Error('Auth tokens are issued by Supabase Auth, not the backend.');
}

export function verifyAuthToken(_token: string) {
  throw new Error('Use verifySupabaseToken() instead.');
}