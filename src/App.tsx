import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { service } from './service.real';
import { store } from './store';
import type { Account, Budget, Category, Profile, Tx } from './types';
import { Avatar, Ctx, Ic, PinPad, Sheet } from './ui';
import { hashPin, verifyPin } from './pin';
import { Onboarding } from './extra';
import { spentByCat } from './stats';
import { Budgets, D, Insights, Overview, Page, ProfilePage, Sec, Spend, TxSheet, Txs } from './screens';

export default function App() {
  const [auth, setAuth] = useState<boolean | null>(null), [onb, setOnb] = useState(store.get('ep_onboarded') !== '1');
  const [theme, setTheme] = useState(() => store.get('ep_theme') || 'neon');
  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('ep_theme', theme); }, [theme]);
  useEffect(() => { service.hasSession().then(setAuth); }, []);
  if (auth === null) return null;
  if (!auth) return <Login onDone={() => setAuth(true)} />;
  if (onb) return <Onboarding onDone={() => { store.set('ep_onboarded', '1'); setOnb(false); }} />;
  return <Main theme={theme} setTheme={setTheme} onOut={async () => { await service.signOut(); setAuth(false); }} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false);
  const [st, setSt] = useState<'idle' | 'busy' | 'err'>('idle'), [msg, setMsg] = useState(''), [remember, setRemember] = useState(true), [info, setInfo] = useState('');
  const forgot = async () => {
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setMsg('Type your email above first, then tap Forgot password.'); setSt('err'); return; }
    try { await service.resetPassword(email.trim()); setInfo('If that email has an account, a reset link is on its way.'); } catch (x) { setMsg(x instanceof Error ? x.message : 'Could not send the reset link.'); setSt('err'); }
  };
  const run = async (fn: () => Promise<void>) => { setSt('busy'); try { await fn(); onDone(); } catch (x) { setMsg(x instanceof Error ? x.message : 'Sign in failed. Try again.'); setSt('err'); } };
  return (
    <main className="app login">
      <div className="logo rise"><Ic n="wallet" s={34} /></div>
      <div className="rise tc" style={{ animationDelay: '.05s' }}><h1>Welcome back</h1><p className="soft">Sign in to see every M-Pesa and Co-op transaction in one place.</p></div>
      <form className={`glass form rise ${st === 'err' ? 'shake' : ''}`} style={{ animationDelay: '.15s' }} onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => service.signIn(email.trim(), pw, remember)); }} noValidate>
        <label className="f"><span>Email</span><div className="fld"><Ic n="mail" s={20} /><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setSt('idle'); }} /></div></label>
        <label className="f"><span>Password</span><div className="fld"><Ic n="lock" s={20} /><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={pw} onChange={e => { setPw(e.target.value); setSt('idle'); }} />
          <button type="button" className="nm eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}><Ic n="eye" s={20} /></button></div></label>
        {st === 'err' && <p role="alert" className="err">{msg}</p>}{info && <p role="status" className="soft" style={{ margin: 0, fontWeight: 600 }}>{info}</p>}
        <div className="opts"><label className="chk"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Keep me signed in</label><button type="button" className="link" onClick={forgot}>Forgot password?</button></div>
        <button className="lq" disabled={st === 'busy'} aria-busy={st === 'busy'}>{st === 'busy' ? <span className="spin" aria-label="Signing in" /> : <><span>Sign in</span><Ic n="arrow" s={20} /></>}</button>
      </form>
      {service.biometric && <div className="bio rise" style={{ animationDelay: '.3s' }}><button className="nm round" aria-label="Sign in with fingerprint" onClick={() => run(service.biometric!)}><Ic n="fp" s={30} /></button>Use fingerprint</div>}
      <p className="foot"><Ic n="lock" s={14} /> Private to your account. Synced securely.</p>
    </main>
  );
}

const NAV: [string, [Page, string, string][]][] = [
  ['Your money', [['overview', 'Overview', 'home'], ['tx', 'Transactions', 'tx'], ['spend', 'Spending', 'spend']]],
  ['Plan ahead', [['budgets', 'Budgets', 'target']]],
  ['Preferences', [['profile', 'Profile & settings', 'user']]],
];
const TITLE: Record<Page, string> = { overview: 'Overview', tx: 'Transactions', spend: 'Spending', budgets: 'Budgets', insights: 'Insights', profile: 'Profile & settings' };

function PinSetup({ onDone, onClose }: { onDone: (h: string) => void; onClose: () => void }) {
  const [first, setFirst] = useState<string | null>(null), [err, setErr] = useState('');
  const next = useCallback(async (p: string) => {
    if (first === null) { setFirst(p); setErr(''); }
    else if (first === p) onDone(await hashPin(p));
    else { setFirst(null); setErr('The PINs did not match. Start again.'); }
  }, [first, onDone]);
  return <Sheet title="Create PIN" onClose={onClose}><PinPad title={first === null ? 'Create a 4-digit PIN' : 'Confirm your PIN'} sub="You will use it to open the app." error={err} onDone={next} /></Sheet>;
}
function Lock({ hash, bio, name, photo, onUnlock }: { hash: string; bio: boolean; name: string; photo: string | null; onUnlock: () => void }) {
  const [err, setErr] = useState(''), [until, setUntil] = useState(Number(store.get('ep_until') || 0)), [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  const check = useCallback(async (p: string) => {
    if (Date.now() < until) return;
    if (await verifyPin(p, hash)) { store.set('ep_fail', '0'); onUnlock(); return; }
    const f = Number(store.get('ep_fail') || 0) + 1; store.set('ep_fail', String(f));
    if (f >= 5) { const u = Date.now() + Math.min(30 * 2 ** (f - 5), 900) * 1000; store.set('ep_until', String(u)); setUntil(u); setErr(''); }
    else setErr(`Wrong PIN. ${5 - f} ${5 - f === 1 ? 'try' : 'tries'} left.`);
  }, [hash, onUnlock, until]);
  return (
    <main className="app lockscr">
      <Avatar name={name} photo={photo} size={84} />
      <PinPad title="Unlock Expense Planner" sub={wait ? `Too many wrong attempts. Try again in ${wait}s.` : undefined} disabled={wait > 0} error={wait ? '' : err} onDone={check} />
      {bio && service.biometric && wait === 0 && <div className="bio"><button className="nm round" aria-label="Unlock with fingerprint" onClick={() => service.biometric!().then(onUnlock).catch(() => setErr('Fingerprint not recognized. Use your PIN.'))}><Ic n="fp" s={30} /></button>Use fingerprint</div>}
    </main>
  );
}

function Main({ theme, setTheme, onOut }: { theme: string; setTheme: (t: string) => void; onOut: () => void }) {
  const [page, setPage] = useState<Page>('overview'), [drawer, setDrawer] = useState(false), [menu, setMenu] = useState(false), [sel, setSel] = useState<string | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]), [accounts, setAccounts] = useState<Account[]>([]), [cats, setCats] = useState<Category[]>([]), [budgets, setBudgets] = useState<Budget[]>([]), [profile, setProfile] = useState<Profile>({ name: '', email: '' });
  const [hide, setHideS] = useState(store.get('ep_hide') === '1'), [pinh, setPinh] = useState(store.get('ep_pinh')), [bioOn, setBioS] = useState(store.get('ep_bio') === '1'), [photo, setPhotoS] = useState(store.get('ep_photo'));
  const [locked, setLocked] = useState(!!store.get('ep_pinh')), [pinSetup, setPinSetup] = useState(false), [bell, setBell] = useState(false);
  const reload = useCallback(async () => {
    const [a, b, c, e, f] = await Promise.all([service.listTransactions(), service.listAccounts(), service.listCategories(), service.listBudgets(), service.getProfile()]);
    setTxs(a); setAccounts(b); setCats(c); setBudgets(e); setProfile(f);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    let away = 0;
    const f = () => { if (document.hidden) away = Date.now(); else if (pinh && away && Date.now() - away > 30000) setLocked(true); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [pinh]);
  const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);
  const alerts = useMemo(() => {
    const out: { id: string; text: string; go: Page }[] = [], m = spentByCat(txs, 'month');
    for (const b of budgets) { const r = (m.get(b.categoryId) ?? 0) / b.limit, n = catMap.get(b.categoryId)?.name ?? 'A budget'; if (r >= 1) out.push({ id: 'o' + b.categoryId, text: `${n} is over its monthly budget`, go: 'budgets' }); else if (r >= 0.8) out.push({ id: 'w' + b.categoryId, text: `${n} is at ${Math.round(r * 100)}% of its budget`, go: 'budgets' }); }
    const u = txs.filter(t => t.type === 'unknown').length; if (u) out.push({ id: 'u', text: `${u} ${u === 1 ? 'message' : 'messages'} could not be read`, go: 'tx' });
    return out;
  }, [txs, budgets, catMap]);
  const go = (p: Page) => { setPage(p); setDrawer(false); setMenu(false); setBell(false); window.scrollTo(0, 0); };
  const sec: Sec = {
    hide, setHide: v => { store.set('ep_hide', v ? '1' : '0'); setHideS(v); },
    lockOn: !!pinh, setLock: v => { if (v) setPinSetup(true); else { store.del('ep_pinh'); store.del('ep_bio'); setPinh(null); setBioS(false); } },
    bioOn, setBio: v => { store.set('ep_bio', v ? '1' : '0'); setBioS(v); },
    photo, setPhoto: s => { if (s) store.set('ep_photo', s); else store.del('ep_photo'); setPhotoS(s); },
  };
  if (locked && pinh) return <Lock hash={pinh} bio={bioOn} name={profile.name} photo={photo} onUnlock={() => setLocked(false)} />;
  const d: D = { txs, accounts, cats, budgets, profile, reload, open: setSel, go };
  const selTx = txs.find(t => t.id === sel);
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });
  const bottom: [Page, string, string][] = [['overview', 'Overview', 'home'], ['tx', 'Transactions', 'tx'], ['spend', 'Spending', 'spend'], ['budgets', 'Budgets', 'target']];
  return (
    <Ctx.Provider value={{ hide, cats: catMap }}>
      <aside className={`side glass ${drawer ? 'open' : ''}`} aria-label="Sidebar">
        <div className="brand"><span className="logo sm"><Ic n="wallet" s={22} /></span><div><b>Expense Planner</b><small>Personal finance</small></div>
          <button className="nm eye closeside" aria-label="Close menu" onClick={() => setDrawer(false)}><Ic n="close" s={20} /></button></div>
        {NAV.map(([h, items]) => <div key={h}><div className="sh">{h}</div>{items.map(([k, l, i]) => <button key={k} className={`navi ${page === k ? 'on' : ''}`} aria-current={page === k ? 'page' : undefined} onClick={() => go(k)}><Ic n={i} s={20} />{l}</button>)}</div>)}
        <div className="insight"><Ic n="bulb" /><b>A little more clarity</b><p>Every small insight brings your bigger picture into focus.</p><button className="lq sm" onClick={() => go('insights')}>Explore insights</button></div>
        <button className="who" onClick={() => go('profile')}><Avatar name={profile.name} photo={photo} size={42} /><span><b>{profile.name}</b><small>{service.demo ? 'Preview account' : 'Personal workspace'}</small></span></button>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <div className="main">
        <header className="bar">
          <button className="nm eye menub" aria-label="Open menu" onClick={() => setDrawer(true)}><Ic n="menu" s={22} /></button>
          <div className="crumb"><small>Workspace / {TITLE[page]}</small><b>{today}</b></div>
          <div className="barr">
            <button className="nm eye" aria-label={hide ? 'Show balances' : 'Hide balances'} aria-pressed={hide} onClick={() => sec.setHide(!hide)}><Ic n={hide ? 'eyeoff' : 'eye'} s={20} /></button>
            <div className="acc"><button className="nm eye" aria-label={`Notifications${alerts.length ? `, ${alerts.length}` : ''}`} aria-haspopup="menu" aria-expanded={bell} onClick={() => { setBell(!bell); setMenu(false); }}><Ic n="bell" s={20} />{alerts.length > 0 && <span className="badge">{alerts.length}</span>}</button>
              {bell && <><div className="away" onClick={() => setBell(false)} /><div className="glass pop wide" role="menu">{alerts.length ? alerts.map(a => <button key={a.id} role="menuitem" onClick={() => go(a.go)}>{a.text}</button>) : <p className="soft" style={{ margin: 12 }}>You are all caught up.</p>}</div></>}</div>
            <div className="acc"><button className="nm accb" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Avatar name={profile.name} photo={photo} size={34} /><span className="accl">My account</span></button>
              {menu && <><div className="away" onClick={() => setMenu(false)} /><div className="glass pop" role="menu">
                <button role="menuitem" onClick={() => go('profile')}><Ic n="user" s={18} />Profile & settings</button>
                {pinh && <button role="menuitem" onClick={() => { setMenu(false); setLocked(true); }}><Ic n="lock" s={18} />Lock now</button>}
                <button role="menuitem" onClick={onOut}><Ic n="logout" s={18} />Sign out</button></div></>}</div>
          </div>
        </header>
        <main className="content page" key={page}>
          {page === 'overview' && <Overview d={d} />}{page === 'tx' && <Txs d={d} />}{page === 'spend' && <Spend d={d} />}
          {page === 'budgets' && <Budgets d={d} />}{page === 'insights' && <Insights d={d} />}
          {page === 'profile' && <ProfilePage d={d} sec={sec} theme={theme} setTheme={setTheme} onOut={onOut} />}
        </main>
      </div>
      {selTx && <TxSheet d={d} tx={selTx} onClose={() => setSel(null)} />}
      {pinSetup && <PinSetup onClose={() => setPinSetup(false)} onDone={h => { store.set('ep_pinh', h); setPinh(h); setPinSetup(false); }} />}
      <nav className="nav" aria-label="Main">{bottom.map(([k, l, i]) => <button key={k} className={page === k ? 'on' : ''} aria-label={l} aria-current={page === k ? 'page' : undefined} onClick={() => go(k)}><Ic n={i} /></button>)}</nav>
    </Ctx.Provider>
  );
}
