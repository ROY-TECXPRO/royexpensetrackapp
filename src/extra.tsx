import { useState } from 'react';
import { service } from './service.real';
import { Ic, Sheet } from './ui';

export function BatteryGuide({ onClose }: { onClose: () => void }) {
  const step = (h: string, items: string[]) => <section><h2>{h}</h2><ol className="guide">{items.map(i => <li key={i}>{i}</li>)}</ol></section>;
  return (
    <Sheet title="Keep tracking in the background" onClose={onClose}>
      <h2>Keep tracking in the background</h2>
      <p className="soft">Some phones stop apps to save battery. If that happens, messages that arrive while the app is closed can be missed live. The app rescans your inbox every time you open it, but these settings stop most gaps. Menu names vary by Android version.</p>
      {step('Samsung', ['Open Settings, then Apps, then Expense Planner, then Battery.', 'Choose Unrestricted.', 'Then open Battery and device care, Battery, Background usage limits, Never sleeping apps, and add Expense Planner.'])}
      {step('Oppo', ['Open Settings, then Battery, and find Expense Planner (or Settings, Apps, App management, Expense Planner, Battery usage).', 'Turn on Allow background activity.', 'Turn on Allow auto-launch (sometimes called Startup manager).'])}
      {step('Any phone', ['Lock the app in the recent apps list so the system keeps it (long-press or tap its card menu).', 'Avoid swiping the app away from recents; on some phones that stops it.'])}
      <button className="lq" style={{ marginTop: 16 }} onClick={onClose}>Got it</button>
    </Sheet>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0), [p, setP] = useState({ done: 0, total: 1 }), [res, setRes] = useState<{ imported: number; unknown: number } | null>(null), [err, setErr] = useState(''), [tips, setTips] = useState(false);
  const allow = async () => {
    setErr('');
    try {
      if (!(await service.requestSmsPermission())) { setErr('Permission was not granted. Without it the app cannot track anything. Tap Allow to try again, or open Android Settings, Apps, Expense Planner, Permissions.'); return; }
      setStep(1); setRes(await service.importHistory((done, total) => setP({ done, total }))); setStep(2);
    } catch (x) { setStep(0); setErr(x instanceof Error ? x.message : 'Something went wrong. Try again.'); }
  };
  return (
    <main className="app login">
      <div className="logo rise"><Ic n={step === 2 ? 'check' : 'shield'} s={34} /></div>
      {step === 0 && <>
        <div className="rise tc" style={{ animationDelay: '.05s' }}><h1>Let Expense Planner read your money messages</h1><p className="soft">This is how it tracks everything without you typing a thing.</p></div>
        <section className="glass rise" style={{ animationDelay: '.15s' }}>
          <ul className="guide plain"><li><Ic n="check" s={18} />Reads only M-Pesa and Co-op Bank messages.</li><li><Ic n="check" s={18} />Ignores every other message on your phone.</li><li><Ic n="check" s={18} />Stays on this phone and syncs only to your private account.</li></ul>
          {err && <p role="alert" className="err">{err}</p>}
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}><button className="lq" onClick={allow}><span>Allow SMS access</span><Ic n="arrow" s={20} /></button><button className="nm" onClick={onDone}>Not now</button></div>
        </section></>}
      {step === 1 && <>
        <div className="tc"><h1>Reading your messages</h1><p className="soft" aria-live="polite">{p.done} of {p.total} processed</p></div>
        <section className="glass"><div className="track"><span className="fill" style={{ width: `${(p.done / p.total) * 100}%`, background: 'linear-gradient(90deg,var(--l2),var(--a))', animation: 'none', transition: 'width .2s' }} /></div><p className="soft" style={{ margin: 0 }}>Keep this screen open until it finishes.</p></section></>}
      {step === 2 && res && <>
        <div className="tc"><h1>You are all set</h1><p className="soft">Imported {res.imported} transactions.{res.unknown > 0 && ` ${res.unknown} messages could not be read yet. You will find them under Needs review.`}</p></div>
        <section className="glass" style={{ display: 'grid', gap: 12 }}><button className="lq" onClick={onDone}><span>Open my overview</span><Ic n="arrow" s={20} /></button><button className="nm" onClick={() => setTips(true)}><Ic n="battery" s={20} />Set up background tracking</button></section></>}
      {tips && <BatteryGuide onClose={() => setTips(false)} />}
    </main>
  );
}
