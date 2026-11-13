// localStorage can be blocked (private mode, embedded views). Fall back to memory instead of crashing.
const mem = new Map<string, string>();
export const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { mem.set(k, v); } },
  del(k: string) { try { localStorage.removeItem(k); } catch { mem.delete(k); } },
};
