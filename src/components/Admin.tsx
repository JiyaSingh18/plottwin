import { Activity as ActIcon, ExternalLink, FlaskConical, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BLOCKS, PLOTS, PRICE_MAX, PRICE_MIN, ZONES } from '../data/layout'
import { ago, cr, STATUS_COLOR } from '../lib/format'
import { ROOM, store, useNow, useStore } from '../sync/store'
import type { Status } from '../sync/types'
import { Stat } from './ui'

function heat(t: number) {
  // teal -> amber -> rose
  const stops = [[52, 211, 153], [251, 191, 36], [244, 63, 94]]
  const k = Math.min(1, Math.max(0, t)) * 2
  const i = Math.min(1, Math.floor(k))
  const f = k - i
  const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * f))
  return `rgb(${c.join(',')})`
}

export default function Admin({ statuses, onPick }: { statuses: Record<string, Status>; onPick: (id: string) => void }) {
  const s = useStore()
  const now = useNow(1000)
  const [mode, setMode] = useState<'status' | 'price'>('status')
  const [race, setRace] = useState<string[] | null>(null)
  const counts = { available: 0, held: 0, booked: 0 }
  let gmv = 0
  PLOTS.forEach((p) => { counts[statuses[p.id]]++; if (statuses[p.id] === 'booked') gmv += p.price })
  const liveBookings = Object.values(s.db.records).filter((r) => r.status === 'booked').length
  const sell = (counts.booked / PLOTS.length) * 100
  const byBlock = BLOCKS.map((b) => {
    const ps = PLOTS.filter((p) => p.block === b)
    return { block: b, available: ps.filter((p) => statuses[p.id] === 'available').length, held: ps.filter((p) => statuses[p.id] === 'held').length, booked: ps.filter((p) => statuses[p.id] === 'booked').length }
  })
  const conv = s.db.stats.holdsStarted ? Math.round((s.db.stats.bookings / s.db.stats.holdsStarted) * 100) : 0

  const runRace = async () => {
    const target = PLOTS.find((p) => statuses[p.id] === 'available')
    if (!target) return
    const bots = Array.from({ length: 8 }, (_, i) => ({ id: `bot-${i}-${Math.random().toString(36).slice(2, 6)}`, name: `Load-test bot ${i + 1}` }))
    const results = await Promise.all(bots.map((b) => store.hold(target.id, b)))
    const winner = bots[results.findIndex((r) => r.ok)]
    setRace([`8 bots hit ${target.id} in the same instant:`, `✔ ${winner?.name ?? 'nobody'} won the hold`, `✖ ${results.filter((r) => !r.ok).length} were rejected (“already held, first writer wins”)`, 'The bot hold is released again in 4 s.'])
    setTimeout(() => winner && store.release(target.id, 'release', winner), 4000)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Sales command centre</div>
          <h2 className="font-display text-3xl">Aranya Alibaug · live inventory</h2>
          <div className="text-xs text-slate-400">Room <span className="font-mono text-slate-200">{ROOM}</span> · updates in real time from every window</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">Hold length
            <select value={s.holdMinutes} onChange={(e) => s.setHoldMinutes(+e.target.value)} className="ml-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-slate-100 ring-1 ring-white/10">
              <option className="bg-slate-900" value={10}>10 min</option>
              <option className="bg-slate-900" value={2}>2 min</option>
              <option className="bg-slate-900" value={0.5}>30 s (demo expiry)</option>
            </select>
          </label>
          <button onClick={runRace} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 hover:bg-white/10"><FlaskConical size={14} /> Race test (8 bots)</button>
          <button onClick={() => { if (confirm('Reset the demo for every connected window?')) void s.reset() }} data-testid="reset-btn" className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/30"><RotateCcw size={14} /> Reset demo</button>
        </div>
      </div>
      {race && <div className="glass rounded-xl p-3 text-xs text-slate-200">{race.map((l) => <div key={l}>{l}</div>)}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Sell-through" value={<span className="text-xl">{sell.toFixed(1)}%</span>} sub={`${counts.booked} of ${PLOTS.length} plots`} />
        <Stat label="Revenue booked" value={<span className="text-xl">{cr(gmv)}</span>} sub="agreement value (incl. earlier phase)" />
        <Stat label="Live holds" value={<span className="text-xl text-amber-300">{counts.held}</span>} sub="10-min leases" />
        <Stat label="Bookings this demo" value={<span className="text-xl text-rose-300">{liveBookings}</span>} sub={`₹${(liveBookings * 999).toLocaleString('en-IN')} tokens (demo)`} />
        <Stat label="Hold → book" value={<span className="text-xl">{conv}%</span>} sub={`${s.db.stats.holdsStarted} holds · ${s.db.stats.expired} expired`} />
        <Stat label="Available" value={<span className="text-xl text-emerald-300">{counts.available}</span>} sub={`of ${PLOTS.length}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Plot heatmap</div>
            <div className="flex gap-1 text-[11px]">
              {(['status', 'price'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 ${mode === m ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-slate-300'}`}>{m === 'status' ? 'By status' : 'By price'}</button>)}
            </div>
          </div>
          <svg viewBox="-152 -152 304 304" className="mx-auto aspect-square w-full max-w-[520px]" data-testid="heatmap">
            <rect x={-150} y={-150} width={300} height={300} fill="#1f2629" rx={4} />
            {ZONES.map((z) => <rect key={z.name} x={z.x0} y={z.z0} width={z.x1 - z.x0} height={z.z1 - z.z0} fill="#2d6b40" rx={3} />)}
            <ellipse cx={(ZONES[1].x0 + ZONES[1].x1) / 2} cy={(ZONES[1].z0 + ZONES[1].z1) / 2} rx={34} ry={36} fill="#1e5a86" />
            <rect x={-13} y={-11} width={26} height={14} fill="#e9e2d4" rx={1.5} />
            <text x={0} y={-1} fontSize={5} textAnchor="middle" fill="#1f2a2e" fontWeight={700}>CLUB</text>
            {PLOTS.map((p) => {
              const fill = mode === 'status' ? STATUS_COLOR[statuses[p.id]] : heat((p.price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN))
              return (
                <rect key={p.id} x={p.x - p.w / 2} y={p.z - p.d / 2} width={p.w} height={p.d} fill={fill} opacity={mode === 'price' && statuses[p.id] === 'booked' ? 0.35 : 0.92} rx={0.8} className="cursor-pointer transition-all hover:opacity-60" onClick={() => onPick(p.id)}>
                  <title>{`${p.id} · ${statuses[p.id]} · ${cr(p.price)}`}</title>
                </rect>
              )
            })}
          </svg>
        </div>
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-semibold">Holds vs bookings</div>
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={(['available', 'held', 'booked'] as const).map((k) => ({ name: k, value: counts[k] }))} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {(['available', 'held', 'booked'] as const).map((k) => <Cell key={k} fill={STATUS_COLOR[k]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0b1714', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-[11px] text-slate-300">
              {(['available', 'held', 'booked'] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k] }} />{k} <b>{counts[k]}</b></span>)}
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ActIcon size={14} className="text-emerald-300" /> Live activity</div>
            <div className="scroll-thin max-h-56 space-y-1.5 overflow-y-auto text-xs" data-testid="activity">
              {s.db.activity.length === 0 && <div className="text-slate-500">No activity yet. Hold a plot in another window.</div>}
              {s.db.activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span>
                    <span className={{ hold: 'text-amber-300', book: 'text-rose-300', release: 'text-emerald-300', expire: 'text-slate-400', reset: 'text-sky-300', lost: 'text-rose-400' }[a.kind]}>{a.kind.toUpperCase()}</span>{' '}
                    {a.plotId && <button className="font-semibold hover:underline" onClick={() => onPick(a.plotId!)}>{a.plotId}</button>} <span className="text-slate-400">by {a.who}</span>
                    {a.remote && <span className="ml-1 text-[10px] text-sky-300">· relay</span>}
                  </span>
                  <span className="shrink-0 text-slate-500">{ago(a.t, now)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="mb-2 text-sm font-semibold">Sell-through by block</div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={byBlock}>
              <XAxis dataKey="block" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0b1714', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="booked" stackId="a" fill={STATUS_COLOR.booked} />
              <Bar dataKey="held" stackId="a" fill={STATUS_COLOR.held} />
              <Bar dataKey="available" stackId="a" fill={STATUS_COLOR.available} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <a href={location.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">Open another window <ExternalLink size={12} /></a>
    </div>
  )
}
