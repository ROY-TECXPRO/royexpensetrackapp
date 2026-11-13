// PIN hashing: random salt + PBKDF2. Still only protects against casual access:
// for production keep the hash in Android Keystore (secure storage plugin).
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, k, 256));
}
export async function hashPin(pin: string): Promise<string> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `${salt}:${await derive(pin, salt)}`;
}
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, h] = stored.split(':');
  return !!salt && !!h && (await derive(pin, salt)) === h;
}
