import type { ReactNode } from 'react'
import type { Status } from '../sync/types'

export function Badge({ status, children }: { status: Status; children?: ReactNode }) {
  const cls = {
    available: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
    held: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
    booked: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'held' ? 'animate-pulse bg-amber-300' : status === 'booked' ? 'bg-rose-400' : 'bg-emerald-300'}`} />
      {children ?? status}
    </span>
  )
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-emerald-400 text-emerald-950 shadow-[0_0_20px_-4px_rgba(52,211,153,.7)]' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
    >
      {children}
    </button>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export function DemoTag({ className = '' }: { className?: string }) {
  return <span className={`rounded bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-black tracking-widest text-white ${className}`}>DEMO</span>
}
