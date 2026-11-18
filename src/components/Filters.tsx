import { SlidersHorizontal, Sparkles } from 'lucide-react'
import { PLOTS, PRICE_MAX, PRICE_MIN, SIZE_MAX, SIZE_MIN, type Plot } from '../data/layout'
import { cr } from '../lib/format'
import type { Status } from '../sync/types'
import { Chip } from './ui'

export interface FilterState {
  maxPrice: number
  minSize: number
  facing: 'Any' | 'North' | 'South' | 'East' | 'West'
  statuses: Status[]
  corner: boolean
  park: boolean
  lake: boolean
}
export const DEFAULT_FILTERS: FilterState = {
  maxPrice: PRICE_MAX, minSize: SIZE_MIN, facing: 'Any', statuses: ['available', 'held', 'booked'], corner: false, park: false, lake: false,
}

export function filterActive(f: FilterState) {
  return JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS)
}

export function matchPlot(p: Plot, f: FilterState, status: Status) {
  if (p.price > f.maxPrice) return false
  if (p.sqft < f.minSize) return false
  if (f.facing !== 'Any' && !p.facing.includes(f.facing)) return false
  if (!f.statuses.includes(status)) return false
  if (f.corner && !p.corner) return false
  if (f.park && !p.parkFacing) return false
  if (f.lake && !p.lakeFacing) return false
  return true
}

export default function Filters({ f, setF, statuses, onPick, onQuiz }: {
  f: FilterState; setF: (f: FilterState) => void; statuses: Record<string, Status>; onPick: (id: string) => void; onQuiz: () => void
}) {
  const matches = PLOTS.filter((p) => matchPlot(p, f, statuses[p.id]))
  const avail = matches.filter((p) => statuses[p.id] === 'available').sort((a, b) => a.price - b.price)
  const toggle = (s: Status) => setF({ ...f, statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s] })
  return (
    <div className="glass flex max-h-full w-[300px] flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={15} className="text-emerald-300" /> Find your plot</div>
        <button className="text-[11px] text-slate-400 hover:text-white" onClick={() => setF(DEFAULT_FILTERS)}>Reset</button>
      </div>
      <div className="scroll-thin space-y-4 overflow-y-auto px-4 py-3">
        <button onClick={onQuiz} className="group flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-emerald-400/20 via-teal-400/10 to-amber-300/20 px-3 py-2.5 text-left ring-1 ring-emerald-300/30 transition hover:ring-emerald-300/60">
          <span>
            <span className="block text-sm font-semibold">Recommend me a plot</span>
            <span className="block text-[11px] text-slate-300">4 quick questions → top 3 matches</span>
          </span>
          <Sparkles size={18} className="text-amber-200 transition group-hover:rotate-12" />
        </button>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Budget up to</span><span className="font-semibold text-slate-100">{cr(f.maxPrice)}</span></div>
          <input type="range" className="w-full" min={PRICE_MIN} max={PRICE_MAX} step={100000} value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: +e.target.value })} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Min size</span><span className="font-semibold text-slate-100">{f.minSize.toLocaleString('en-IN')} sq ft</span></div>
          <input type="range" className="w-full" min={SIZE_MIN} max={SIZE_MAX} step={50} value={f.minSize} onChange={(e) => setF({ ...f, minSize: +e.target.value })} />
        </div>
        <div>
          <div className="mb-1.5 text-xs text-slate-400">Facing</div>
          <div className="flex flex-wrap gap-1.5">
            {(['Any', 'North', 'South', 'East', 'West'] as const).map((x) => <Chip key={x} active={f.facing === x} onClick={() => setF({ ...f, facing: x })}>{x}</Chip>)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs text-slate-400">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {(['available', 'held', 'booked'] as const).map((s) => <Chip key={s} active={f.statuses.includes(s)} onClick={() => toggle(s)}>{s[0].toUpperCase() + s.slice(1)}</Chip>)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs text-slate-400">Premium</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={f.corner} onClick={() => setF({ ...f, corner: !f.corner })}>Corner</Chip>
            <Chip active={f.park} onClick={() => setF({ ...f, park: !f.park })}>Park-facing</Chip>
            <Chip active={f.lake} onClick={() => setF({ ...f, lake: !f.lake })}>Lake-facing</Chip>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-slate-400"><span>{matches.length} plots match</span><span>{avail.length} available</span></div>
          <div className="space-y-1">
            {avail.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)} className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-left text-xs hover:bg-white/[0.08]">
                <span className="font-semibold">{p.id}</span>
                <span className="text-slate-400">{p.sqft.toLocaleString('en-IN')} sq ft · {p.facing}</span>
                <span className="font-semibold text-emerald-300">{cr(p.price)}</span>
              </button>
            ))}
            {avail.length === 0 && <div className="rounded-lg bg-white/[0.03] p-3 text-center text-xs text-slate-400">No available plots match. Loosen a filter.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
