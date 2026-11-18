import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PLOTS, PLOT_BY_ID } from '../data/layout'
import { cr, inr } from '../lib/format'
import { allPlans, cumulativeSeries } from '../lib/plans'

export default function PaymentPlans({ plotId, setPlotId }: { plotId: string | null; setPlotId: (id: string) => void }) {
  const plot = PLOT_BY_ID[plotId ?? ''] ?? PLOTS.find((p) => p.id === 'C-03') ?? PLOTS[0]
  const [possession, setPossession] = useState(30)
  const [rate, setRate] = useState(8)
  const [disc, setDisc] = useState(6)
  const plans = useMemo(() => allPlans({ price: plot.price, possessionMonth: possession, discountRate: rate, upfrontDiscount: disc }), [plot.price, possession, rate, disc])
  const series = useMemo(() => cumulativeSeries(plans, possession), [plans, possession])
  const [g, c, u] = plans
  const yr1 = (k: string) => series[Math.min(12, possession)][k] * 1e7
  const bars = plans.map((p) => ({ name: p.name.split(' ')[0] === '1%-a-month' ? '1% Growth' : p.name.split(' ')[0], total: +(p.total / 1e7).toFixed(3), pv: +(p.npv / 1e7).toFixed(3), color: p.color }))
  const cheapestPV = [...plans].sort((a, b) => a.npv - b.npv)[0]

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Payment plan studio</div>
          <h2 className="font-display text-3xl">Three ways to pay for plot {plot.id}</h2>
          <div className="text-sm text-slate-400">{plot.sqft.toLocaleString('en-IN')} sq ft · {plot.facing} · agreement value <span className="text-slate-100">{cr(plot.price)}</span></div>
        </div>
        <select value={plot.id} onChange={(e) => setPlotId(e.target.value)} className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
          {PLOTS.map((p) => <option key={p.id} value={p.id} className="bg-slate-900">{p.id} · {cr(p.price)}</option>)}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['Possession in', `${possession} months`, possession, setPossession, 12, 48, 1],
          ['Your opportunity cost (for present value)', `${rate}% / yr`, rate, setRate, 0, 15, 0.5],
          ['Upfront-payment discount', `${disc}%`, disc, setDisc, 0, 12, 0.5],
        ].map(([label, shown, val, set, min, max, step]) => (
          <div key={label as string} className="glass rounded-xl p-4">
            <div className="flex justify-between text-xs text-slate-400"><span>{label as string}</span><span className="font-semibold text-slate-100">{shown as string}</span></div>
            <input type="range" className="mt-2 w-full" min={min as number} max={max as number} step={step as number} value={val as number} onChange={(e) => (set as (n: number) => void)(+e.target.value)} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className="glass rounded-2xl p-4" style={{ boxShadow: `inset 0 2px 0 ${p.color}` }}>
            <div className="text-sm font-semibold" style={{ color: p.color }}>{p.name}</div>
            <div className="text-[11px] text-slate-400">{p.blurb}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-slate-500">Day 1</div><div className="font-semibold">{cr(p.rows.filter((r) => r.month === 0).reduce((s, r) => s + r.amount, 0))}</div></div>
              <div><div className="text-slate-500">By month 12</div><div className="font-semibold">{cr(yr1(p.key))}</div></div>
              <div><div className="text-slate-500">Total</div><div className="font-semibold">{cr(p.total)}</div></div>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Present value at {rate}%: <span className="text-slate-100">{cr(p.npv)}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold">Cumulative cash out (₹ Cr) by month</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip contentStyle={{ background: '#0b1714', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => `₹${Number(v).toFixed(2)} Cr`} labelFormatter={(m) => `Month ${m}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {plans.map((p) => <Line key={p.key} type="stepAfter" dataKey={p.key} name={p.name} stroke={p.color} strokeWidth={2.5} dot={false} animationDuration={600} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="mb-2 text-sm font-semibold">Total outlay vs present value (₹ Cr)</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={bars}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} />
                <YAxis stroke="#64748b" fontSize={11} domain={[(min: number) => Math.floor(min * 0.85 * 10) / 10, 'auto']} />
                <Tooltip contentStyle={{ background: '#0b1714', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => `₹${Number(v).toFixed(2)} Cr`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar animationDuration={500} dataKey="total" name="Total paid" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar animationDuration={500} dataKey="pv" name="Present value" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 rounded-xl bg-emerald-400/10 p-3 text-xs text-emerald-100 ring-1 ring-emerald-300/20">
            In year one the 1% plan keeps <b>{cr(yr1('upfront') - yr1('growth'))}</b> more in your pocket than paying upfront, and <b>{cr(yr1('clp') - yr1('growth'))}</b> versus development-linked. At {rate}% opportunity cost, <b>{cheapestPV.name}</b> is cheapest in today’s money.
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-3 border-b border-white/5 text-xs font-semibold">
          {plans.map((p) => <div key={p.key} className="p-3" style={{ color: p.color }}>{p.name} schedule</div>)}
        </div>
        <div className="scroll-thin grid max-h-64 grid-cols-3 overflow-y-auto text-[11px]">
          {[g, c, u].map((p) => (
            <div key={p.key} className="space-y-0.5 p-3">
              {p.rows.map((r, i) => <div key={i} className="flex justify-between gap-2 text-slate-300"><span className="truncate">M{r.month} · {r.label}</span><span className="shrink-0 font-mono">{inr(r.amount)}</span></div>)}
            </div>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-slate-500">Illustrative only. The Growth plan mirrors a publicly advertised ₹999 + 9.9% + 10% + 1%/month structure. Taxes, stamp duty and registration charges are excluded.</div>
    </div>
  )
}
