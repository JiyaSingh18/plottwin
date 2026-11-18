import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Clock, Copy, LayoutDashboard, Map, Radio, Wallet } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import Admin from './components/Admin'
import Filters, { DEFAULT_FILTERS, filterActive, matchPlot, type FilterState } from './components/Filters'
import MyBookings from './components/MyBookings'
import PaymentPlans from './components/PaymentPlans'
import PlotPanel from './components/PlotPanel'
import Quiz from './components/Quiz'
import Toasts from './components/Toasts'
import { PLOTS, PROJECT } from './data/layout'
import { mmss } from './lib/format'
import { ME, ROOM, useNow, useStore } from './sync/store'
import type { Status } from './sync/types'

const Scene = lazy(() => import('./components/Scene'))
type Tab = 'explore' | 'plans' | 'bookings' | 'admin'

function SyncPill() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const relay = { off: ['bg-slate-500', 'off'], connecting: ['bg-amber-400', 'connecting'], live: ['bg-emerald-400', 'live'], error: ['bg-rose-500', 'offline'] }[s.relayStatus]
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} data-testid="sync-pill" className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[11px] ring-1 ring-white/10 hover:bg-white/10">
        <Radio size={13} className="text-emerald-300" />
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
        <span className="hidden sm:inline">Live sync</span>
        <span className="text-slate-500">|</span>
        <span className={`h-2 w-2 rounded-full ${relay[0]}`} />
        <span className="hidden text-slate-300 sm:inline">relay {relay[1]}</span>
        {s.lastLatencyMs !== undefined && <span className="hidden text-slate-500 md:inline">· {s.lastLatencyMs} ms</span>}
      </button>
      {open && (
        <div className="glass absolute right-0 top-10 z-50 w-80 rounded-xl p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-100">How sync works</div>
          <p className="mt-1"><b className="text-emerald-300">Same browser:</b> every window shares one store (localStorage) guarded by a Web Lock, and changes fan out over BroadcastChannel in a few ms. This is strict first-writer-wins.</p>
          <p className="mt-1"><b className="text-sky-300">Cross-device:</b> records also go through a free public pub/sub relay (ntfy.sh). Every client merges them with the same deterministic rule (higher version wins, and on a tie the earliest claim wins), so they all converge.</p>
          <p className="mt-1 text-slate-400">Room: <span className="font-mono">{ROOM}</span>. Add <span className="font-mono">?room=yourname</span> for a private room or <span className="font-mono">?relay=off</span> to stay local.</p>
        </div>
      )}
    </div>
  )
}

function SceneLoader() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 16 }, (_, i) => (
            <motion.div key={i} className="h-4 w-4 rounded-[4px] bg-emerald-400/70" animate={{ opacity: [0.15, 1, 0.15] }} transition={{ duration: 1.4, repeat: Infinity, delay: ((i % 4) + Math.floor(i / 4)) * 0.09 }} />
          ))}
        </div>
        <div className="text-xs font-medium tracking-wide text-slate-400">Building the 3D site plan…</div>
      </div>
    </div>
  )
}

export default function App() {
  const s = useStore()
  const now = useNow(1000)
  const [tab, setTab] = useState<Tab>('explore')
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [fly, setFly] = useState<{ id: string | null; n: number }>({ id: null, n: 0 })
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [quiz, setQuiz] = useState(false)
  const [planPlot, setPlanPlot] = useState<string | null>(null)

  const statuses = useMemo(() => {
    const o: Record<string, Status> = {}
    PLOTS.forEach((p) => (o[p.id] = s.effective(p.id, now).status))
    return o
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version, now])
  const matches = useMemo(() => (filterActive(filters) ? new Set(PLOTS.filter((p) => matchPlot(p, filters, statuses[p.id])).map((p) => p.id)) : null), [filters, statuses])
  const counts = useMemo(() => Object.values(statuses).reduce((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {} as Record<string, number>), [statuses])
  const myHold = s.myHold(now)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setQuiz(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (id: string) => {
    setTab('explore')
    setSelected(id)
    setFly((f) => ({ id, n: f.n + 1 }))
  }
  const select = (id: string | null) => {
    setSelected(id)
    if (id) setFly((f) => ({ id, n: f.n + 1 }))
  }

  const tabs: { k: Tab; label: string; icon: typeof Map }[] = [
    { k: 'explore', label: 'Site plan', icon: Map },
    { k: 'plans', label: 'Payment plans', icon: Wallet },
    { k: 'bookings', label: 'My bookings', icon: Building2 },
    { k: 'admin', label: 'Admin', icon: LayoutDashboard },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="relative z-40 flex items-center gap-3 border-b border-white/5 bg-[#08130f]/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg font-black text-emerald-950 shadow-[0_0_30px_-6px_rgba(52,211,153,.7)]">P</div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">Plot<span className="text-emerald-300">Twin</span></div>
            <div className="whitespace-nowrap text-[10px] text-slate-400">{PROJECT.name} · <span className="text-amber-200">demo project</span></div>
          </div>
        </div>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} data-testid={`tab-${t.k}`} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === t.k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SyncPill />
          <button onClick={() => window.open(location.href, '_blank', 'popup,width=1280,height=820')} className="hidden items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30 hover:bg-emerald-400/25 lg:flex"><Copy size={12} /> Open 2nd window</button>
          <div className="hidden whitespace-nowrap rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-white/10 sm:block" title="Each window is a separate demo buyer" data-testid="me">{ME.name}</div>
        </div>
      </header>
      <nav className="flex justify-around border-b border-white/5 bg-[#08130f] py-1 md:hidden">
        {tabs.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`flex flex-col items-center px-2 py-1 text-[10px] ${tab === t.k ? 'text-emerald-300' : 'text-slate-400'}`}><t.icon size={16} />{t.label}</button>)}
      </nav>

      <main className="relative flex-1 overflow-hidden">
        {/* 3D scene stays mounted so the camera is preserved between tabs */}
        <div className={`absolute inset-0 ${tab === 'explore' ? '' : 'invisible'}`}>
          <Suspense fallback={<SceneLoader />}>
            <Scene statuses={statuses} matches={matches} selectedId={selected} hoverId={hover} onHover={setHover} onSelect={select} fly={fly} />
          </Suspense>
          <div className="pointer-events-none absolute inset-0 flex justify-between gap-4 p-4">
            <div className="pointer-events-auto hidden max-h-full md:flex"><Filters f={filters} setF={setFilters} statuses={statuses} onPick={pick} onQuiz={() => setQuiz(true)} /></div>
            <div className="pointer-events-auto ml-auto flex max-h-full">
              <AnimatePresence>{selected && <PlotPanel key={selected} id={selected} onClose={() => { setSelected(null); setFly((f) => ({ id: null, n: f.n + 1 })) }} onPlans={() => { setPlanPlot(selected); setTab('plans') }} onBookings={() => setTab('bookings')} />}</AnimatePresence>
            </div>
          </div>
          {!selected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="pointer-events-none absolute right-6 top-6 hidden max-w-sm text-right lg:block">
              <div className="font-display text-4xl leading-tight"><span className="shimmer">Aranya Alibaug</span></div>
              <div className="mt-1 text-sm text-slate-300">20-acre plotted township · {PLOTS.length} plots · fictional demo</div>
              <div className="mt-1 text-xs text-slate-400">Click any plot. Open a second window to watch holds sync live.</div>
            </motion.div>
          )}
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-[#0a1512]/90 px-4 py-2 text-[11px] text-slate-200 ring-1 ring-white/10" data-testid="legend">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Available <b data-testid="count-available">{counts.available ?? 0}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 animate-pulse rounded-sm bg-amber-400" /> Held <b data-testid="count-held">{counts.held ?? 0}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Booked <b data-testid="count-booked">{counts.booked ?? 0}</b></span>
          </div>
          {!selected && (
            <button onClick={() => setQuiz(true)} className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-emerald-950 shadow-lg md:hidden">Recommend me a plot</button>
          )}
          {myHold && selected !== myHold.plotId && (
            <button onClick={() => pick(myHold.plotId)} className="pulse-ring absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-xs font-bold text-amber-950">
              <Clock size={14} /> Holding {myHold.plotId} · {mmss((myHold.exp ?? 0) - now)} left · continue booking
            </button>
          )}
        </div>
        {tab !== 'explore' && (
          <div className="scroll-thin absolute inset-0 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(16,64,48,.45),_transparent_60%)]">
            {tab === 'plans' && <PaymentPlans plotId={planPlot ?? selected} setPlotId={setPlanPlot} />}
            {tab === 'bookings' && <MyBookings onExplore={() => setTab('explore')} />}
            {tab === 'admin' && <Admin statuses={statuses} onPick={pick} />}
          </div>
        )}
      </main>
      {quiz && <Quiz statuses={statuses} onClose={() => setQuiz(false)} onPick={pick} />}
      <Toasts />
    </div>
  )
}
