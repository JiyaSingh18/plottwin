import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { PLOTS, type Plot } from '../data/layout'
import { cr } from '../lib/format'
import type { Status } from '../sync/types'

const QS = [
  { key: 'budget', q: 'What is your budget?', opts: [['Up to ₹3.5 Cr', 3.5e7], ['₹3.5 – 4.5 Cr', 4.5e7], ['₹4.5 Cr +', 9e9]] },
  { key: 'size', q: 'How much land do you want?', opts: [['Compact (~2,000–2,500 sq ft)', 2250], ['Classic (~2,700 sq ft)', 2700], ['Large (3,000+ sq ft)', 3200]] },
  { key: 'vibe', q: 'What matters most?', opts: [['Lake views', 'lake'], ['Walk to clubhouse & park', 'club'], ['Corner plot, more light', 'corner'], ['Best value per sq ft', 'value']] },
  { key: 'facing', q: 'Facing preference?', opts: [['North / East (Vastu)', 'ne'], ['Doesn’t matter', 'any']] },
] as const

type Ans = { budget?: number; size?: number; vibe?: string; facing?: string }

function score(p: Plot, a: Ans) {
  let s = 50
  const why: string[] = []
  if (a.budget) { if (p.price <= a.budget) { s += 15; why.push('within budget') } else s -= 40 }
  if (a.size) { const diff = Math.abs(p.sqft - a.size) / a.size; s += 15 - diff * 60; if (diff < 0.1) why.push('right size') }
  if (a.vibe === 'lake' && p.lakeFacing) { s += 25; why.push('lake-facing') }
  if (a.vibe === 'club') { s += Math.max(0, 25 - p.clubDist / 6); if (p.clubDist < 90) why.push(`${p.clubDist} m to clubhouse`) }
  if (a.vibe === 'corner' && p.corner) { s += 25; why.push('corner plot') }
  if (a.vibe === 'value') { s += Math.max(0, (15500 - p.ratePerSqft) / 80); why.push(`₹${p.ratePerSqft.toLocaleString('en-IN')}/sq ft`) }
  if (a.facing === 'ne' && (p.facing.includes('East') || p.facing.startsWith('North'))) { s += 10; why.push(p.facing + ' facing') }
  if (p.parkFacing && a.vibe !== 'lake') { s += 4 }
  return { s: Math.max(1, Math.min(99, Math.round(s))), why }
}

export default function Quiz({ statuses, onClose, onPick }: { statuses: Record<string, Status>; onClose: () => void; onPick: (id: string) => void }) {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Ans>({})
  const done = step >= QS.length
  const results = done
    ? PLOTS.filter((p) => statuses[p.id] === 'available').map((p) => ({ p, ...score(p, a) })).sort((x, y) => y.s - x.s).slice(0, 3)
    : []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass w-full max-w-lg rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><Sparkles size={16} /> Plot matchmaker</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="mt-3 flex gap-1">{QS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-emerald-400' : 'bg-white/10'}`} />)}</div>
        {!done ? (
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mt-5">
            <div className="font-display text-2xl">{QS[step].q}</div>
            <div className="mt-4 space-y-2">
              {QS[step].opts.map(([label, val]) => (
                <button key={label} onClick={() => { setA({ ...a, [QS[step].key]: val }); setStep(step + 1) }} className="w-full rounded-xl bg-white/[0.04] px-4 py-3 text-left text-sm ring-1 ring-white/10 transition hover:bg-emerald-400/10 hover:ring-emerald-300/40">
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="mt-5">
            <div className="font-display text-2xl">Your top 3 plots</div>
            <div className="mt-1 text-xs text-slate-400">Ranked from live availability right now.</div>
            <div className="mt-4 space-y-2">
              {results.map(({ p, s, why }, i) => (
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} key={p.id} onClick={() => { onPick(p.id); onClose() }} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 hover:ring-emerald-300/50">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-sm font-bold text-emerald-200">{s}%</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm font-semibold"><span>{p.id}</span><span className="text-emerald-300">{cr(p.price)}</span></div>
                    <div className="truncate text-[11px] text-slate-400">{p.sqft.toLocaleString('en-IN')} sq ft · {why.join(' · ')}</div>
                  </div>
                </motion.button>
              ))}
            </div>
            <button onClick={() => { setStep(0); setA({}) }} className="mt-4 text-xs text-slate-400 hover:text-white">Start over</button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
