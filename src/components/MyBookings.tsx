import { CheckCircle2, Circle, Download, FileLock2, FileText, Map } from 'lucide-react'
import { PLOT_BY_ID } from '../data/layout'
import { cr, inr } from '../lib/format'
import { DOCS, downloadDoc } from '../lib/pdf'
import { ME, useStore } from '../sync/store'
import { DemoTag } from './ui'

const DAY = 86400000

export default function MyBookings({ onExplore }: { onExplore: () => void }) {
  const s = useStore()
  const mine = s.myBookings().sort((a, b) => b.at - a.at)
  if (!mine.length)
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <Map className="mx-auto text-emerald-300" size={40} />
        <h2 className="font-display mt-3 text-3xl">No bookings in this window yet</h2>
        <p className="mt-2 text-sm text-slate-400">Each browser window is a separate demo buyer ({ME.name}). Hold a plot, finish the mock KYC and the ₹999 demo payment, and your timeline and documents appear here.</p>
        <button onClick={onExplore} className="mt-5 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950">Explore the site plan</button>
      </div>
    )
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">My bookings · {ME.name}</div>
        <h2 className="font-display text-3xl">Your plots, timeline & document vault</h2>
      </div>
      {mine.map((r) => {
        const p = PLOT_BY_ID[r.plotId]
        const ctx = { plot: p, bookingId: r.bookingId ?? 'AR-DEMO', buyer: ME.name, bookedAt: r.at }
        const t = r.at
        const timeline = [
          { at: t - 4 * 60000, label: 'Plot held for 10 minutes', done: true },
          { at: t - 2 * 60000, label: 'KYC verified (simulated)', done: true },
          { at: t, label: `₹999 registration paid (DEMO) · booking ${r.bookingId}`, done: true },
          { at: t + 7 * DAY, label: `9.9% booking amount · ${inr(p.price * 0.099 - 999)}`, done: false },
          { at: t + 30 * DAY, label: `10% after 30 days · ${inr(p.price * 0.1)}`, done: false },
          { at: t + 45 * DAY, label: 'Agreement for sale e-signed & registered', done: false },
          { at: t + 60 * DAY, label: `1% a month starts · ${inr(p.price * 0.01)}/mo`, done: false },
          { at: t + 900 * DAY, label: 'Possession & sale-deed registration', done: false },
        ]
        return (
          <div key={r.plotId} className="glass grid gap-6 rounded-2xl p-5 md:grid-cols-2" data-testid="booking-card">
            <div>
              <div className="flex items-center gap-2"><span className="font-display text-2xl">{p.id}</span><DemoTag /></div>
              <div className="text-xs text-slate-400">{p.sqft.toLocaleString('en-IN')} sq ft · {p.facing} · {cr(p.price)}</div>
              <ol className="mt-4 space-y-3">
                {timeline.map((x, i) => (
                  <li key={i} className="flex gap-3">
                    {x.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-300" /> : <Circle size={18} className="shrink-0 text-slate-600" />}
                    <div>
                      <div className={`text-sm ${x.done ? 'text-slate-100' : 'text-slate-400'}`}>{x.label}</div>
                      <div className="text-[11px] text-slate-500">{new Date(x.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{x.done ? '' : ' (scheduled)'}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Document vault</div>
              <div className="space-y-2">
                {DOCS.map((d) => (
                  <button key={d.kind} onClick={() => downloadDoc(d.kind, ctx)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 hover:ring-emerald-300/40">
                    <FileText size={18} className="text-emerald-300" />
                    <span className="flex-1 text-sm">{d.title}</span>
                    <Download size={15} className="text-slate-400" />
                  </button>
                ))}
                {['Agreement for sale (unlocks at 10%)', 'Title report & 7/12 extract', 'Sale deed (on possession)'].map((x) => (
                  <div key={x} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3 text-slate-500 ring-1 ring-white/5">
                    <FileLock2 size={18} /> <span className="flex-1 text-sm">{x}</span><span className="text-[10px] uppercase tracking-wider">locked</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-slate-500">PDFs are generated in your browser, watermarked DEMO, and carry no legal value.</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
