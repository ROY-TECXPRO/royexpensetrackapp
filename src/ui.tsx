import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Category } from './types';
import { fmt } from './stats';

export const IC: Record<string, string> = {
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 14h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6A17 17 0 0 0 2 12s4 7 10 7c1.7 0 3.2-.4 4.4-1"/>',
  fp: '<path d="M12 11v5M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM5 13a7 7 0 0 1 14 0M3 10a9 9 0 0 1 18 0"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>', sync: '<path d="M20 11a8 8 0 0 0-14-4M4 13a8 8 0 0 0 14 4M18 3v4h-4M6 21v-4h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  tx: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', spend: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M7 7l-3 5 3 5M4 12h16"/>', bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>', check: '<path d="M5 12l5 5 9-10"/>', battery: '<rect x="2" y="8" width="17" height="9" rx="2"/><path d="M22 11v3M6 11v3M10 11v3"/>',
};
export const Ic = ({ n, s = 22 }: { n: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: IC[n] }} />
);

export const Ctx = createContext({ hide: false, cats: new Map<string, Category>() });
export const M = ({ c, sign = '' }: { c: number; sign?: string }) => { const { hide } = useContext(Ctx); return <>{hide ? 'Ksh ••••' : sign + fmt(c)}</>; };

export function Avatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  const ini = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'EP';
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{photo ? <img src={photo} alt="" /> : ini}</span>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), cb = useRef(onClose); cb.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; ref.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current();
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,a[href]')]; if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    addEventListener('keydown', k); return () => { removeEventListener('keydown', k); prev?.focus(); };
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="glass sheet" role="dialog" aria-modal="true" aria-label={title}>{children}</div>
    </>
  );
}

export function PinPad({ title, sub, error, disabled, onDone }: { title: string; sub?: string; error?: string; disabled?: boolean; onDone: (pin: string) => void }) {
  const [d, setD] = useState('');
  useEffect(() => { if (d.length === 4) { const t = setTimeout(() => { onDone(d); setD(''); }, 160); return () => clearTimeout(t); } }, [d, onDone]);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div className={`pin ${error ? 'shake' : ''}`}>
      <h2>{title}</h2>{sub && <p className="soft">{sub}</p>}
      <div className="dots" aria-label={`${d.length} of 4 digits entered`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < d.length ? 'f' : ''} />)}</div>
      <p role="alert" className="err" style={{ minHeight: 18 }}>{error}</p>
      <div className="keys">{keys.map((k, i) => k === '' ? <span key={i} /> : <button key={i} className="nm key" aria-label={k === '⌫' ? 'Delete' : k} disabled={disabled} onClick={() => setD(k === '⌫' ? d.slice(0, -1) : d.length < 4 ? d + k : d)}>{k}</button>)}</div>
    </div>
  );
}

export function Toggle({ on, set, label, desc }: { on: boolean; set: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="setrow"><div><b>{label}</b><br /><small className="soft">{desc}</small></div>
      <button role="switch" aria-checked={on} aria-label={label} className={`tog ${on ? 'on' : ''}`} onClick={() => set(!on)}><i /></button></div>
  );
}
