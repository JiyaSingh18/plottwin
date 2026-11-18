import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Clock, Compass, FileCheck2, IndianRupee, Loader2, Lock, MapPin, Ruler, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PLOT_BY_ID } from '../data/layout'
import { cr, inr, mmss } from '../lib/format'
import { ME, store, useNow, useStore } from '../sync/store'
import { Badge, DemoTag, Stat } from './ui'

type Step = 'hold' | 'kyc' | 'pay' | 'done'

export default function PlotPanel({ id, onClose, onPlans, onBookings }: { id: string; onClose: () => void; onPlans: () => void; onBookings: () => void }) {
  const s = useStore()
  const now = useNow(250)
  const p = PLOT_BY_ID[id]
  const eff = s.effective(id, now)
  const mine = eff.status === 'held' && eff.rec?.by === ME.id
  const [step, setStep] = useState<Step>('hold')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kyc, setKyc] = useState({ name: ME.name, phone: '98XXXXXX10', pan: 'ABCDE1234F', agree: false })
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [wasMine, setWasMine] = useState(false)

  useEffect(() => { setStep('hold'); setErr(null); setBookingId(null); setWasMine(false) }, [id])
  useEffect(() => {
    if (mine) { setWasMine(true); if (step === 'hold') setStep('kyc') }
    if (!mine && wasMine && step !== 'done') {
      setWasMine(false)
      setStep('hold')
      setErr(eff.status === 'held' ? `Lost the race: ${eff.rec?.byName} holds this plot now (first writer wins).` : 'Your 10-minute hold expired, so the plot is back on sale.')
    }
  }, [mine, wasMine, step, eff.status, eff.rec?.byName])

  const hold = async () => {
    setErr(null)
    setBusy(true)
    const r = await store.hold(id)
    setBusy(false)
    if (!r.ok) setErr(r.reason)
  }
  const pay = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 1300))
    const r = await store.book(id)
    setBusy(false)
    if (r.ok) { setBookingId(r.bookingId); setStep('done') } else setErr(r.reason)
  }

  const left = eff.rec?.exp ? eff.rec.exp - now : 0
  const holdPct = eff.rec?.exp && eff.rec?.at ? Math.max(0, left / (eff.rec.exp - eff.rec.at)) : 0
  const steps: { k: Step; label: string }[] = [{ k: 'hold', label: 'Hold' }, { k: 'kyc', label: 'KYC' }, { k: 'pay', label: '₹999' }, { k: 'done', label: 'Booked' }]
  const stepIdx = steps.findIndex((x) => x.k === step)

  return (
    <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="glass flex max-h-full w-[360px] flex-col overflow-hidden rounded-2xl" data-testid="plot-panel">
      <div className="relative border-b border-white/5 p-4">
        <button onClick={onClose} className="absolute right-3 top-3 text-slate-400 hover:text-white"><X size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="font-display text-3xl font-bold" data-testid="plot-id">{p.id}</div>
          <Badge status={eff.status}>{eff.status === 'held' && mine ? 'held by you' : eff.status}</Badge>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">Block {p.block} · Aranya Alibaug (demo project)</div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-emerald-300">{cr(p.price)}</div>
            <div className="text-[11px] text-slate-400">{inr(p.ratePerSqft)}/sq ft · all-inclusive (illustrative)</div>
          </div>
          <button onClick={onPlans} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/10">Payment plans →</button>
        </div>
      </div>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Size" value={<span className="flex items-center gap-1"><Ruler size={13} />{p.sqft.toLocaleString('en-IN')} sq ft</span>} sub={`${p.w.toFixed(1)} m × ${p.d.toFixed(1)} m`} />
          <Stat label="Facing" value={<span className="flex items-center gap-1"><Compass size={13} />{p.facing}</span>} sub={p.corner ? 'Corner plot' : 'Mid-row'} />
          <Stat label="To clubhouse" value={<span className="flex items-center gap-1"><MapPin size={13} />{p.clubDist} m</span>} sub={`~${Math.max(1, Math.round(p.clubDist / 80))} min walk`} />
          <Stat label="1% plan EMI" value={inr(p.price * 0.01)} sub="per month after 2nd month" />
        </div>
        {p.premiums.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{p.premiums.map((x) => <span key={x} className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-200 ring-1 ring-amber-300/20">{x}</span>)}</div>
        )}

        {/* booking stepper */}
        {(mine || step === 'done') && (
          <div className="flex items-center gap-1">
            {steps.map((x, i) => (
              <div key={x.k} className="flex flex-1 flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full ${i <= stepIdx ? 'bg-emerald-400' : 'bg-white/10'}`} />
                <span className={`text-[10px] ${i <= stepIdx ? 'text-emerald-300' : 'text-slate-500'}`}>{x.label}</span>
              </div>
            ))}
          </div>
        )}

        {mine && step !== 'done' && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-300/10 p-3 ring-1 ring-amber-300/25" data-testid="hold-countdown">
            <div className="relative h-12 w-12">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray={`${holdPct * 97.4} 97.4`} strokeLinecap="round" /></svg>
              <Clock size={14} className="absolute inset-0 m-auto text-amber-200" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-amber-100/80">Held for you. Others see it amber, live.</div>
              <div className="font-mono text-2xl font-bold text-amber-200">{mmss(left)}</div>
            </div>
            <button onClick={() => store.release(id)} className="text-[11px] text-slate-300 underline-offset-2 hover:underline">Release</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {err && (
            <motion.div key={err} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-rose-500/15 p-3 text-xs text-rose-200 ring-1 ring-rose-400/30" data-testid="booking-error">{err}</motion.div>
          )}
        </AnimatePresence>

        {step === 'hold' && eff.status === 'available' && (
          <button disabled={busy} onClick={hold} data-testid="hold-btn" className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 py-3 text-sm font-bold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(52,211,153,.8)] transition hover:brightness-110 disabled:opacity-60">
            {busy ? 'Locking…' : `Hold this plot for ${s.holdMinutes >= 1 ? s.holdMinutes + ' min' : Math.round(s.holdMinutes * 60) + ' s'}`}
          </button>
        )}
        {eff.status === 'held' && !mine && (
          <div className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300 ring-1 ring-white/10">
            <div className="flex items-center gap-2 font-semibold text-amber-200"><Lock size={13} /> Held by {eff.rec?.byName}</div>
            <div className="mt-1">Frees up in <span className="font-mono text-amber-100">{mmss(left)}</span> unless they book it.</div>
          </div>
        )}
        {eff.status === 'booked' && step !== 'done' && (
          <div className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300 ring-1 ring-white/10">
            {eff.seed ? 'Sold in an earlier phase.' : eff.rec?.by === ME.id ? 'You booked this plot.' : `Booked by ${eff.rec?.byName}.`}
          </div>
        )}

        {mine && step === 'kyc' && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (kyc.agree) setStep('pay') }}>
            <div className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-300" /> Quick KYC</span><DemoTag /></div>
            <div className="text-[11px] text-slate-400">Mock form. Nothing you type leaves this browser tab or gets stored.</div>
            {(['name', 'phone', 'pan'] as const).map((k) => (
              <input key={k} value={kyc[k]} onChange={(e) => setKyc({ ...kyc, [k]: e.target.value })} placeholder={k} className="w-full rounded-lg bg-black/30 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-emerald-300/50" />
            ))}
            <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={kyc.agree} onChange={(e) => setKyc({ ...kyc, agree: e.target.checked })} data-testid="kyc-agree" /> I understand this is a demo with fake data</label>
            <button disabled={!kyc.agree} data-testid="kyc-submit" className="w-full rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-emerald-950 disabled:opacity-40">Verify (simulated) →</button>
          </form>
        )}

        {mine && step === 'pay' && (
          <div className="space-y-3 rounded-xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-sm font-semibold"><IndianRupee size={15} /> Registration fee</span><DemoTag /></div>
            <div className="text-center">
              <div className="text-4xl font-bold">₹999</div>
              <div className="text-[11px] text-slate-400">Mock UPI. No real payment, no gateway, no money moves.</div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
              {['GPay', 'PhonePe', 'Paytm'].map((x) => <div key={x} className="rounded-lg bg-white/5 py-2 text-slate-300">{x}</div>)}
            </div>
            <button disabled={busy} onClick={pay} data-testid="pay-btn" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-emerald-300 py-3 text-sm font-bold text-slate-900 disabled:opacity-70">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Simulating payment…</> : 'Simulate ₹999 payment (DEMO)'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-3 rounded-xl bg-emerald-400/10 p-4 text-center ring-1 ring-emerald-300/30" data-testid="booked-ok">
            <CheckCircle2 size={40} className="mx-auto text-emerald-300" />
            <div className="font-display text-2xl">Plot {p.id} is yours</div>
            <div className="text-xs text-slate-300">Booking ID <span className="font-mono text-emerald-200">{bookingId}</span>. Every other window already shows it as booked.</div>
            <button onClick={onBookings} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-emerald-950"><FileCheck2 size={16} /> Timeline & document vault</button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
