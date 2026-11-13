import { ChangeEvent, useContext, useMemo, useRef, useState } from 'react';
import { service } from './service.real';
import { byTime, clock, dateLabel, fmt, groupByDay, inRange, insights, recurring, series, spentByCat, toCsv, totals } from './stats';
import { BatteryGuide } from './extra';
import type { Account, Budget, Category, Period, Profile, Tx } from './types';
import { Avatar, Ctx, Ic, M, Sheet, Toggle } from './ui';

export type Page = 'overview' | 'tx' | 'spend' | 'budgets' | 'insights' | 'profile';
export interface D { txs: Tx[]; accounts: Account[]; cats: Category[]; budgets: Budget[]; profile: Profile; reload: () => Promise<void>; open: (id: string) => void; go: (p: Page) => void }
export const TYPE: Record<string, string> = { paid: 'Paid', sent: 'Sent', received: 'Received', withdraw: 'Withdrawal', deposit: 'Deposit', airtime: 'Airtime', transfer: 'Transfer', fee: 'Fee', unknown: 'Needs review' };
const PER: [Period, string][] = [['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year']];

function Tabs({ v, set }: { v: Period; set: (p: Period) => void }) {
  return <div className="seg" role="group" aria-label="Period">{PER.map(([p, l]) => <button key={p} className={v === p ? 'lq' : 'nm'} aria-pressed={v === p} onClick={() => set(p)}>{l}</button>)}</div>;
}
function Row({ t, open }: { t: Tx; open: (id: string) => void }) {
  const cats = useContext(Ctx).cats, c = t.categoryId ? cats.get(t.categoryId) : null;
  return (
    <button className="row" onClick={() => open(t.id)}>
      <span className="ric"><Ic n={t.transferGroup ? 'swap' : 'bag'} /></span>
      <span className="rm"><b>{t.counterparty ?? TYPE[t.type] ?? t.type}</b><small>{c ? c.name : TYPE[t.type] ?? t.type} · {t.source === 'mpesa' ? 'M-Pesa' : 'Co-op'} · {clock(t.occurredAt)}</small></span>
      <span className="ra"><b className="num">{t.type === 'unknown' ? '—' : <M c={t.amount} sign={t.transferGroup ? '' : t.direction === 'out' ? '−' : '+'} />}</b>{t.transferGroup && <em>Linked pair</em>}{t.type === 'unknown' && <em>Needs review</em>}</span>
    </button>
  );
}
function CatBars({ txs, p }: { txs: Tx[]; p: Period }) {
  const cats = useContext(Ctx).cats;
  const rows = useMemo(() => [...spentByCat(txs, p)].sort((a, b) => b[1] - a[1]).slice(0, 6), [txs, p]), max = rows[0]?.[1] ?? 1;
  if (!rows.length) return <p className="soft">No spending in this period yet.</p>;
  return <div className="cb">{rows.map(([k, v]) => { const c = cats.get(k); return (
    <div key={k} className="cbr"><div className="cbh"><span><i className="dot" style={{ background: c?.color ?? '#9CA3AF' }} />{c?.name ?? 'Uncategorized'}</span><b><M c={v} /></b></div>
      <div className="track"><span className="fill" style={{ width: `${Math.max((v / max) * 100, 4)}%`, background: c?.color ?? '#9CA3AF' }} /></div></div>); })}</div>;
}

function BalanceSheet({ d, a, onClose }: { d: D; a: Account; onClose: () => void }) {
  const [v, setV] = useState(a.balance === null ? '' : String(a.balance / 100));
  const save = async (n: number | null) => { await service.setManualBalance(a.id, n); await d.reload(); onClose(); };
  return (
    <Sheet title={`${a.name} balance`} onClose={onClose}>
      <h2>{a.name} balance</h2><p className="soft">Bank messages do not include your balance, so enter it yourself and update it when you like.</p>
      <label className="f"><span>Balance (Ksh)</span><div className="fld"><input inputMode="decimal" placeholder="e.g. 25000" value={v} onChange={e => setV(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>
      <button className="lq" style={{ marginTop: 16 }} disabled={v === '' || isNaN(Number(v))} onClick={() => save(Math.round(Number(v) * 100))}>Save balance</button>
      {a.manual && <button className="nm" style={{ marginTop: 12, width: '100%' }} onClick={() => save(null)}>Clear balance</button>}
    </Sheet>
  );
}

export function Overview({ d }: { d: D }) {
  const [p, setP] = useState<Period>('month'), [bal, setBal] = useState<Account | null>(null), t = useMemo(() => totals(d.txs, p), [d.txs, p]);
  const review = d.txs.filter(x => x.type === 'unknown').length;
  const known = d.accounts.filter(a => a.balance !== null), total = known.reduce((s, a) => s + (a.balance ?? 0), 0);
  const month = useMemo(() => spentByCat(d.txs, 'month'), [d.txs]);
  const warn = d.budgets.map(b => ({ b, r: (month.get(b.categoryId) ?? 0) / b.limit })).filter(x => x.r >= 0.8).sort((a, b) => b.r - a.r)[0];
  const cats = useContext(Ctx).cats;
  return (
    <>
      <section className="glass hero">
        <span className="eyebrow">Your financial overview</span>
        <h1>A clearer view of your money.</h1>
        <p className="soft">Every M-Pesa and Co-op transaction, sorted and counted for you.</p>
        {service.demo && <span className="demo">Sample preview · not live data</span>}
      </section>
      <section className="glass balance"><div><small className="soft">Total available balance · {known.length} of {d.accounts.length} accounts</small><div className="num big2"><M c={total} /></div></div><span className="pill">KES</span></section>
      <div className="grid2">{d.accounts.map(a => { const x = totals(d.txs, p, undefined, a.source); return (
        <section key={a.id} className="glass acct"><div className="ahead"><span className="ric"><Ic n={a.source === 'mpesa' ? 'wallet' : 'bank'} /></span><div><b>{a.name}</b><br /><small className="soft">{a.sub}</small></div></div>
          <div className="num abal">{a.balance === null ? 'Not set' : <M c={a.balance} />}</div>
          <small className="soft">In <M c={x.in} /> · Out <M c={x.out} />{a.manual && ' · Entered by you'}</small>
          {a.source === 'coop' && <button className="nm sm" style={{ marginTop: 12 }} onClick={() => setBal(a)}>{a.balance === null ? 'Set balance' : 'Edit balance'}</button>}</section>); })}</div>
      {bal && <BalanceSheet d={d} a={bal} onClose={() => setBal(null)} />}
      {review > 0 && <button className="glass alert" onClick={() => d.go('tx')}><Ic n="search" /><span><b>{review} {review === 1 ? 'message' : 'messages'} could not be read</b><br /><small className="soft">Open Transactions, then Needs review</small></span></button>}
      <Tabs v={p} set={setP} />
      <div className="grid3">
        <div className="glass stat"><small>Money received</small><div className="num"><M c={t.in} /></div></div>
        <div className="glass stat"><small>Money spent</small><div className="num"><M c={t.out} /></div></div>
        <div className="glass stat"><small>Net movement</small><div className="num"><M c={Math.abs(t.in - t.out)} sign={t.in >= t.out ? '+' : '−'} /></div><small className="soft">Transfers · <M c={t.transfers} /></small></div>
      </div>
      {warn && <button className="glass alert" onClick={() => d.go('budgets')}><Ic n="target" /><span><b>{cats.get(warn.b.categoryId)?.name ?? 'A budget'} is at {Math.round(warn.r * 100)}% of its monthly budget</b><br /><small className="soft">Tap to review your budgets</small></span></button>}
      <div className="grid2 top">
        <section className="glass"><h2>Where it went</h2><CatBars txs={d.txs} p={p} /></section>
        <section className="glass list2"><div className="chead"><h2>Recent transactions</h2><button className="nm sm" onClick={() => d.go('tx')}>All transactions</button></div>
          {[...d.txs].sort(byTime).slice(0, 6).map(x => <Row key={x.id} t={x} open={d.open} />)}</section>
      </div>
    </>
  );
}

export function Txs({ d }: { d: D }) {
  const [f, setF] = useState('all'), [q, setQ] = useState(''), [r, setR] = useState('any'), review = d.txs.filter(x => x.type === 'unknown').length;
  const list = useMemo(() => d.txs.filter(t => inRange(t, r) && (f === 'all' || (f === 'review' ? t.type === 'unknown' : f === 'transfers' ? !!t.transferGroup : t.source === f)) && (!q || `${t.counterparty ?? ''} ${t.dedupeKey} ${t.amount / 100}`.toLowerCase().includes(q.toLowerCase()))), [d.txs, f, q, r]);
  const groups = useMemo(() => groupByDay(list), [list]);
  return (
    <>
      <h1>Transactions</h1>
      <label className="glass search"><Ic n="search" s={20} /><input aria-label="Search transactions" placeholder="Search name, code or amount" value={q} onChange={e => setQ(e.target.value)} /></label>
      <div className="chips" role="group" aria-label="Filter">{[['all', 'All'], ['mpesa', 'M-Pesa'], ['coop', 'Co-op'], ['transfers', 'Transfers'], ...(review ? [['review', `Needs review (${review})`]] : [])].map(([k, l]) => <button key={k} className={`nm ${f === k ? 'on' : ''}`} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
      <div className="chips" role="group" aria-label="Date range">{[['any', 'Any time'], ['m', 'This month'], ['30', 'Last 30 days']].map(([k, l]) => <button key={k} className={`nm ${r === k ? 'on' : ''}`} aria-pressed={r === k} onClick={() => setR(k)}>{l}</button>)}</div>
      {!groups.length && <p className="soft">No transactions match. Clear the search or pick another filter.</p>}
      {groups.slice(0, 40).map(([day, rows]) => <section key={day}><div className="day">{day}</div><div className="glass list">{rows.map(r => <Row key={r.id} t={r} open={d.open} />)}</div></section>)}
    </>
  );
}

function Chart({ title, sub, p, txs, c }: { title: string; sub: string; p: Period; txs: Tx[]; c: string }) {
  const data = useMemo(() => series(txs, p), [txs, p]), [i, setI] = useState(data.length - 1), max = Math.max(...data.map(x => x.out), 1);
  return (
    <section className={`glass chart ${c}`}>
      <div className="chead"><h2>{title}</h2><span className="soft">{sub}</span></div>
      <div className="num total2" aria-live="polite"><M c={data[i].out} /><small>{data[i].current ? 'now' : data[i].label}</small></div>
      <div className="bars">{data.map((x, k) => <button key={k} className={`col ${k === i ? 'on' : ''}`} aria-label={`${x.label}: ${fmt(x.out)}`} aria-pressed={k === i} onClick={() => setI(k)}><span className="bar" style={{ height: `${Math.max((x.out / max) * 100, x.out ? 6 : 2)}%`, animationDelay: `${k * 70}ms` }} /></button>)}</div>
      <div className="labs">{data.map((x, k) => <span key={k}>{x.label}</span>)}</div>
    </section>
  );
}
export function Spend({ d }: { d: D }) {
  const [p, setP] = useState<Period>('month');
  return (
    <>
      <h1>Spending</h1><p className="soft" style={{ margin: 0 }}>Tap a bar to see that period. Internal transfers are not counted.</p>
      <section className="glass"><div className="chead"><h2>By category</h2></div><div style={{ margin: '12px 0' }}><Tabs v={p} set={setP} /></div><CatBars txs={d.txs} p={p} /></section>
      <div className="grid2">
        <Chart title="Daily" sub="Last 7 days" p="day" txs={d.txs} c="c-lime" /><Chart title="Weekly" sub="Last 6 weeks" p="week" txs={d.txs} c="c-violet" />
        <Chart title="Monthly" sub="Last 6 months" p="month" txs={d.txs} c="c-amber" /><Chart title="Yearly" sub="Last 4 years" p="year" txs={d.txs} c="c-teal" />
      </div>
    </>
  );
}

function BudgetSheet({ d, edit, onClose }: { d: D; edit: Budget | null; onClose: () => void }) {
  const free = d.cats.filter(c => c.id !== 'income' && (edit?.categoryId === c.id || !d.budgets.some(b => b.categoryId === c.id)));
  const [cid, setCid] = useState(edit?.categoryId ?? free[0]?.id ?? ''), [amt, setAmt] = useState(edit ? String(edit.limit / 100) : '');
  const ok = cid && Number(amt) > 0;
  const save = async () => { await service.saveBudget({ categoryId: cid, limit: Math.round(Number(amt) * 100) }); await d.reload(); onClose(); };
  return (
    <Sheet title="Budget" onClose={onClose}>
      <h2>{edit ? 'Edit budget' : 'New monthly budget'}</h2>
      {!free.length ? <p className="soft">Every category already has a budget.</p> : <>
        <div className="chips wrap" role="group" aria-label="Category">{free.map(c => <button key={c.id} className={`nm ${cid === c.id ? 'on' : ''}`} aria-pressed={cid === c.id} disabled={!!edit} onClick={() => setCid(c.id)}>{c.name}</button>)}</div>
        <label className="f"><span>Monthly limit (Ksh)</span><div className="fld"><input inputMode="decimal" placeholder="e.g. 10000" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} /></div></label>
        <button className="lq" style={{ marginTop: 16 }} disabled={!ok} onClick={save}>Save budget</button></>}
      {edit && <button className="nm" style={{ marginTop: 12, width: '100%' }} onClick={async () => { await service.removeBudget(edit.categoryId); await d.reload(); onClose(); }}>Remove budget</button>}
    </Sheet>
  );
}
export function Budgets({ d }: { d: D }) {
  const [sheet, setSheet] = useState<Budget | 'new' | null>(null), cats = useContext(Ctx).cats, month = useMemo(() => spentByCat(d.txs, 'month'), [d.txs]);
  const lim = d.budgets.reduce((s, b) => s + b.limit, 0), spent = d.budgets.reduce((s, b) => s + (month.get(b.categoryId) ?? 0), 0);
  return (
    <>
      <div className="chead"><h1>Budgets</h1><button className="nm sm" onClick={() => setSheet('new')}><Ic n="plus" s={18} />Add budget</button></div>
      <section className="glass"><small className="soft">This month across {d.budgets.length} budgets</small><div className="num big2"><M c={spent} /> <small className="soft">of <M c={lim} /></small></div>
        <div className="track"><span className="fill" style={{ width: `${Math.min(lim ? (spent / lim) * 100 : 0, 100)}%`, background: 'linear-gradient(90deg,var(--l2),var(--a))' }} /></div></section>
      {!d.budgets.length && <p className="soft">No budgets yet. Add one to see how much you have left each month.</p>}
      <div className="grid2">{d.budgets.map(b => { const s = month.get(b.categoryId) ?? 0, r = s / b.limit, c = cats.get(b.categoryId), st = r >= 1 ? 'Over budget' : r >= 0.8 ? 'Close to the limit' : 'On track'; return (
        <button key={b.categoryId} className="glass bud" onClick={() => setSheet(b)}>
          <div className="chead"><b><i className="dot" style={{ background: c?.color }} />{c?.name}</b><span className={`st ${r >= 1 ? 'over' : r >= 0.8 ? 'warn' : ''}`}>{st}</span></div>
          <div className="num total2"><M c={s} /><small>of <M c={b.limit} /></small></div>
          <div className="track"><span className="fill" style={{ width: `${Math.min(r * 100, 100)}%`, background: r >= 1 ? '#C0264B' : r >= 0.8 ? '#F59E0B' : c?.color }} /></div>
          <small className="soft">{r >= 1 ? <>Over by <M c={s - b.limit} /></> : <><M c={b.limit - s} /> left this month</>}</small></button>); })}</div>
      {sheet && <BudgetSheet d={d} edit={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} />}
    </>
  );
}

export function Insights({ d }: { d: D }) {
  const i = useMemo(() => insights(d.txs), [d.txs]), rec = useMemo(() => recurring(d.txs), [d.txs]), cats = useContext(Ctx).cats;
  const top = [...spentByCat(d.txs, 'month')].sort((a, b) => b[1] - a[1])[0], tc = top ? cats.get(top[0]) : null;
  const card = (h: string, v: React.ReactNode, s: React.ReactNode) => <div className="glass stat ins"><small>{h}</small><div className="num">{v}</div><small className="soft">{s}</small></div>;
  return (
    <>
      <h1>Insights</h1><p className="soft" style={{ margin: 0 }}>Calculated from your transactions. Internal transfers are left out.</p>
      <div className="grid3">
        {card('Spent this month', <M c={i.cur} />, i.change === null ? 'Nothing to compare with yet' : `${Math.abs(i.change).toFixed(0)}% ${i.change > 0 ? 'more' : 'less'} than the same days last month`)}
        {card('Daily average', <M c={i.avg} />, `Over ${i.dom} days so far`)}
        {card('On pace for', <M c={i.projected} />, `By the end of the month (${i.dim} days)`)}
        {card('Top category', tc?.name ?? 'None yet', top ? <M c={top[1]} /> : 'Categorize transactions to see this')}
        {card('Biggest expense', i.big ? <M c={i.big.amount} /> : 'None yet', i.big ? `${i.big.counterparty ?? 'Payment'} · ${dateLabel(i.big.occurredAt)}` : '')}
        {card('Uncategorized', String(d.txs.filter(t => !t.transferGroup && t.direction === 'out' && !t.categoryId).length), 'Spending transactions without a category')}
      </div>
      <section className="glass"><h2>Recurring payments</h2><p className="soft" style={{ margin: '4px 0 0' }}>Found automatically: same payee, similar amount, several months.</p>
        {rec.length ? rec.map(x => <div key={x.name} className="setrow"><div><b>{x.name}</b><br /><small className="soft">About every {x.every} days · next around {dateLabel(new Date(x.next).toISOString())}</small></div><b className="num"><M c={x.amount} /></b></div>) : <p className="soft">None found yet. They appear after the same payment shows up in three different months.</p>}</section>
    </>
  );
}

export function TxSheet({ d, tx, onClose }: { d: D; tx: Tx; onClose: () => void }) {
  const [rule, setRule] = useState(true), [copied, setCopied] = useState(false);
  const kv = (k: string, v: React.ReactNode) => <div className="kv"><span>{k}</span><b>{v}</b></div>;
  const pick = async (c: string | null) => {
    await service.setCategory(tx.id, c);
    if (c && rule && tx.counterparty) { await service.saveRule(tx.counterparty, c); await Promise.all(d.txs.filter(x => x.counterparty === tx.counterparty && !x.categoryId && x.id !== tx.id && !x.transferGroup).map(x => service.setCategory(x.id, c))); }
    await d.reload();
  };
  return (
    <Sheet title="Transaction details" onClose={onClose}>
      <div className="tc"><span className="pill">{TYPE[tx.type] ?? tx.type}</span>
        <div className="num big">{tx.type === 'unknown' ? '—' : <M c={tx.amount} sign={tx.transferGroup ? '' : tx.direction === 'out' ? '−' : '+'} />}</div>
        <b>{tx.counterparty ?? TYPE[tx.type]}</b><br /><small className="soft">{dateLabel(tx.occurredAt)} · {clock(tx.occurredAt)}</small></div>
      <div style={{ margin: '14px 0' }}>{kv('Account', tx.source === 'mpesa' ? 'M-Pesa' : 'Co-op Bank')}{kv('Reference', tx.dedupeKey.split(':').pop() ?? '')}{kv('Fee', <M c={tx.fee} />)}
        {tx.balanceAfter !== null && kv('Balance after', <M c={tx.balanceAfter} />)}{tx.transferGroup && kv('Counted in totals', 'No, internal transfer')}</div>
      {tx.type === 'unknown' && <div className="alert glass" style={{ margin: '0 0 12px' }}><span><b>This message could not be read.</b><br /><small className="soft">Copy it, remove your name and numbers, and send it so a reader can be added. It is not counted in any totals.</small></span><button className="nm sm" onClick={() => { navigator.clipboard?.writeText(tx.rawText).then(() => setCopied(true)); }}>{copied ? 'Copied' : 'Copy'}</button></div>}
      {!tx.transferGroup && tx.type !== 'unknown' && <><b>Category</b><div className="chips wrap" role="group" aria-label="Category">{d.cats.map(c => <button key={c.id} className={`nm ${tx.categoryId === c.id ? 'on' : ''}`} aria-pressed={tx.categoryId === c.id} onClick={() => pick(tx.categoryId === c.id ? null : c.id)}><i className="dot" style={{ background: c.color }} />{c.name}</button>)}</div>
        {tx.counterparty && <label className="chk"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)} /> Always use this category for {tx.counterparty}</label>}</>}
      <details><summary>Original message</summary><p className="raw">{tx.rawText}</p></details>
      <button className="lq" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
    </Sheet>
  );
}

export interface Sec { hide: boolean; setHide: (v: boolean) => void; lockOn: boolean; setLock: (v: boolean) => void; bioOn: boolean; setBio: (v: boolean) => void; photo: string | null; setPhoto: (s: string | null) => void }
export function ProfilePage({ d, sec, theme, setTheme, onOut }: { d: D; sec: Sec; theme: string; setTheme: (t: string) => void; onOut: () => void }) {
  const [busy, setBusy] = useState(false), [tips, setTips] = useState(false), [scan, setScan] = useState(''), file = useRef<HTMLInputElement>(null);
  const names = useMemo(() => new Map(d.cats.map(c => [c.id, c.name])), [d.cats]);
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d')!, s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160); sec.setPhoto(c.toDataURL('image/jpeg', 0.82)); };
    img.src = URL.createObjectURL(f);
  };
  const exportCsv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCsv(d.txs, names)], { type: 'text/csv' })); a.download = 'expense-planner.csv'; a.click(); };
  return (
    <>
      <h1>Profile & settings</h1>
      <section className="glass prof"><Avatar name={d.profile.name} photo={sec.photo} size={84} />
        <div><h2>{d.profile.name}</h2><p className="soft" style={{ margin: '2px 0 10px' }}>{d.profile.email}{service.demo && ' · Preview account'}</p>
          <input ref={file} type="file" accept="image/*" hidden onChange={onFile} aria-label="Choose profile photo" />
          <button className="nm sm" onClick={() => file.current?.click()}>Change photo</button>{sec.photo && <button className="nm sm" style={{ marginLeft: 8 }} onClick={() => sec.setPhoto(null)}>Remove</button>}</div></section>
      <div className="grid2">
        <section className="glass"><h2>Security</h2>
          <Toggle on={sec.lockOn} set={sec.setLock} label="App lock" desc="Ask for a PIN when the app opens or after 30 seconds away" />
          {service.biometric && <Toggle on={sec.bioOn && sec.lockOn} set={v => sec.lockOn ? sec.setBio(v) : undefined} label="Fingerprint unlock" desc={sec.lockOn ? 'Use your fingerprint instead of the PIN' : 'Turn on App lock first'} />}
          <Toggle on={sec.hide} set={sec.setHide} label="Hide balances" desc="Show Ksh •••• instead of amounts" /></section>
        <section className="glass"><h2>Appearance</h2><div className="two" style={{ marginTop: 12 }}>
          <button className={theme === 'neon' ? 'lq' : 'nm'} aria-pressed={theme === 'neon'} onClick={() => setTheme('neon')}>Neon lime</button>
          <button className={theme === 'warm' ? 'lq' : 'nm'} aria-pressed={theme === 'warm'} onClick={() => setTheme('warm')}>Warm lime</button></div></section>
        <section className="glass"><h2>Data</h2><p className="soft">Everything stays on this phone and syncs to your account when online.</p>
          <div style={{ display: 'grid', gap: 12 }}><button className="lq" disabled={busy} onClick={async () => { setBusy(true); try { await service.syncNow(); await d.reload(); } finally { setBusy(false); } }}>{busy ? <span className="spin" aria-label="Syncing" /> : <><Ic n="sync" s={20} /><span>Sync now</span></>}</button>
            <button className="nm" onClick={exportCsv}><Ic n="download" s={20} />Export statement (CSV)</button>
            <button className="nm" onClick={async () => { setScan('Scanning…'); try { const r = await service.importHistory(() => {}); await d.reload(); setScan(`Done. ${r.imported} messages checked.`); } catch { setScan('Could not scan. Check SMS permission.'); } }}><Ic n="search" s={20} />Rescan messages</button>
            {scan && <p role="status" className="soft" style={{ margin: 0 }}>{scan}</p>}
            <button className="nm" onClick={() => setTips(true)}><Ic n="battery" s={20} />Background tracking help</button></div></section>
        <section className="glass"><h2>Account</h2><p className="soft">{service.demo ? 'You are viewing sample data. Connect the backend to see your own.' : 'Signed in.'}</p>
          <button className="nm" onClick={onOut}><Ic n="logout" s={20} />Sign out</button></section>
      </div>
      {tips && <BatteryGuide onClose={() => setTips(false)} />}
    </>
  );
}
