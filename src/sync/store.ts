import { useEffect, useState, useSyncExternalStore } from 'react'
import { PLOTS, SEED_BOOKED } from '../data/layout'
import { isLiveHold, supersedes, validRecord } from './merge'
import { NtfyRelay } from './relay'
import type { Activity, DbState, PlotRecord, Status, Transport, TransportStatus, WireMsg } from './types'

/* ------------------------------------------------------------------ setup */
const params = new URLSearchParams(location.search)
export const ROOM = (params.get('room') || 'aranya-demo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'aranya-demo'
const RELAY_ON = params.get('relay') !== 'off'
const LS_KEY = `plottwin:v1:${ROOM}`
const LS_HOLD = 'plottwin:holdMinutes'
const CHANNEL = `plottwin:${ROOM}`

const BIRDS = ['Kestrel', 'Myna', 'Bulbul', 'Hornbill', 'Kingfisher', 'Sunbird', 'Barbet', 'Koel', 'Drongo', 'Hoopoe', 'Oriole', 'Tailorbird']
function loadMe() {
  try {
    const raw = sessionStorage.getItem('plottwin:me')
    if (raw) return JSON.parse(raw) as { id: string; name: string }
  } catch { /* ignore */ }
  const id = crypto.randomUUID().slice(0, 8)
  const name = `Buyer ${BIRDS[Math.floor(Math.random() * BIRDS.length)]}`
  const me = { id, name }
  sessionStorage.setItem('plottwin:me', JSON.stringify(me))
  return me
}
export const ME = loadMe()

const emptyDb = (epoch = 0): DbState => ({ epoch, records: {}, activity: [], stats: { holdsStarted: 0, bookings: 0, expired: 0 } })

function readDb(): DbState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const d = JSON.parse(raw) as DbState
      if (d && typeof d.epoch === 'number' && d.records) return { ...emptyDb(d.epoch), ...d }
    }
  } catch { /* ignore */ }
  return emptyDb()
}
function writeDb(d: DbState) {
  localStorage.setItem(LS_KEY, JSON.stringify(d))
}

/** Cross-tab mutex (Web Locks API). Gives strict first-writer-wins between
 * windows of the same browser: read-check-write happens atomically. */
async function withLock<T>(fn: () => T): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  if (locks?.request) return locks.request(LS_KEY, () => fn()) as Promise<T>
  return fn()
}

export interface Effective {
  status: Status
  rec?: PlotRecord
  seed?: boolean
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'warn' | 'good' | 'bad'
}

/* ------------------------------------------------------------------ store */
class PlotStore {
  db: DbState = readDb()
  version = 0
  relayStatus: TransportStatus = 'off'
  holdMinutes = Number(localStorage.getItem(LS_HOLD)) || 10
  private listeners = new Set<() => void>()
  private toastListeners = new Set<(t: Toast) => void>()
  private bc?: BroadcastChannel
  private relay?: Transport
  private toastId = 1
  lastLatencyMs?: number

  constructor() {
    if ('BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(CHANNEL)
      this.bc.onmessage = (e) => {
        if (e.data?.type === 'changed') {
          if (typeof e.data.sentAt === 'number') this.lastLatencyMs = Math.max(0, Date.now() - e.data.sentAt)
          this.refresh()
        }
      }
    }
    // Fallback for browsers without BroadcastChannel
    window.addEventListener('storage', (e) => {
      if (e.key === LS_KEY) this.refresh()
    })
    if (RELAY_ON) {
      this.relay = new NtfyRelay(`plottwin-v1-${ROOM}-x7q`)
      this.relay.start(
        (m) => void this.ingest(m),
        (s) => {
          this.relayStatus = s
          this.emit()
        },
      )
    }
    // Lease sweeper: our own expired holds are released explicitly (others
    // already treat them as available because expiry is evaluated on read).
    setInterval(() => this.sweep(), 1000)
  }

  /* ---------- subscription plumbing ---------- */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  getVersion = () => this.version
  onToast(fn: (t: Toast) => void) {
    this.toastListeners.add(fn)
    return () => { this.toastListeners.delete(fn) }
  }
  toast(text: string, tone: Toast['tone'] = 'info') {
    const t = { id: this.toastId++, text, tone }
    this.toastListeners.forEach((f) => f(t))
  }
  private emit() {
    this.version++
    this.listeners.forEach((f) => f())
  }

  /** Re-read shared storage and diff against what this window showed before. */
  private refresh() {
    const prev = this.db
    const next = readDb()
    this.db = next
    if (next.epoch !== prev.epoch) {
      this.toast('Demo was reset in another window', 'info')
    } else {
      for (const id of Object.keys(next.records)) {
        const a = prev.records[id]
        const b = next.records[id]
        if (a && a.ver === b.ver && a.at === b.at) continue
        if (b.by === ME.id) continue
        if (isLiveHold(a) && a!.by === ME.id && b.by !== ME.id) {
          this.toast(`You lost the race for ${id}: ${b.byName ?? 'another buyer'} got there first`, 'bad')
          continue
        }
        if (Date.now() - b.at > 15000) continue // don't toast replayed history
        if (b.status === 'held') this.toast(`${id} was just HELD by ${b.byName}`, 'warn')
        if (b.status === 'booked') this.toast(`${id} was just BOOKED by ${b.byName}`, 'bad')
        if (b.status === 'available' && a) this.toast(`${id} is available again`, 'good')
      }
    }
    this.emit()
  }

  private commitLocal(next: DbState, published?: WireMsg) {
    writeDb(next)
    this.db = next
    this.bc?.postMessage({ type: 'changed', sentAt: Date.now() })
    if (published) this.relay?.publish(published)
    this.emit()
  }

  private pushActivity(d: DbState, a: Activity) {
    d.activity = [a, ...d.activity].slice(0, 80)
  }

  /** Apply a record (local or remote) to a db copy, keeping activity + stats. */
  private apply(d: DbState, r: PlotRecord, remote: boolean): boolean {
    if (r.epoch < d.epoch) return false
    if (r.epoch > d.epoch) {
      d.epoch = r.epoch
      d.records = {}
    }
    const cur = d.records[r.plotId]
    if (!supersedes(cur, r)) return false
    d.records[r.plotId] = r
    const who = r.byName ?? 'buyer'
    if (r.status === 'held') { d.stats.holdsStarted++; this.pushActivity(d, { t: r.at, plotId: r.plotId, kind: 'hold', who, remote }) }
    if (r.status === 'booked') { d.stats.bookings++; this.pushActivity(d, { t: r.at, plotId: r.plotId, kind: 'book', who, remote }) }
    if (r.status === 'available') {
      const expired = cur && cur.exp && cur.exp <= r.at + 1500
      if (expired) d.stats.expired++
      this.pushActivity(d, { t: r.at, plotId: r.plotId, kind: expired ? 'expire' : 'release', who, remote })
    }
    return true
  }

  /* ---------- reads ---------- */
  effective(plotId: string, now = Date.now()): Effective {
    const rec = this.db.records[plotId]
    if (!rec && SEED_BOOKED.has(plotId)) return { status: 'booked', seed: true }
    if (!rec) return { status: 'available' }
    if (rec.status === 'held' && (rec.exp ?? 0) <= now) return { status: 'available', rec }
    return { status: rec.status, rec }
  }
  myHold(now = Date.now()) {
    return Object.values(this.db.records).find((r) => r.by === ME.id && isLiveHold(r, now))
  }
  myBookings() {
    return Object.values(this.db.records).filter((r) => r.by === ME.id && r.status === 'booked')
  }

  /* ---------- writes ---------- */
  async hold(plotId: string, who: { id: string; name: string } = ME): Promise<{ ok: true } | { ok: false; reason: string }> {
    return withLock(() => {
      const d = readDb()
      const now = Date.now()
      this.db = d
      const eff = this.effective(plotId, now)
      if (eff.status === 'booked') return { ok: false as const, reason: `${plotId} is already booked.` }
      if (eff.status === 'held') {
        if (eff.rec?.by === who.id) return { ok: true as const }
        const ms = now - eff.rec!.at
        const when = ms < 1000 ? `${ms}ms` : `${Math.round(ms / 1000)}s`
        return { ok: false as const, reason: `${eff.rec!.byName} held ${plotId} ${when} before you. First writer wins, so try another plot.` }
      }
      const mine = Object.values(d.records).find((r) => r.by === who.id && isLiveHold(r, now))
      if (mine) return { ok: false as const, reason: `You already hold ${mine.plotId}. One live hold per buyer, so release it first.` }
      const cur = d.records[plotId]
      const r: PlotRecord = {
        plotId, epoch: d.epoch, ver: (cur?.ver ?? 0) + 1, status: 'held',
        by: who.id, byName: who.name, at: now, exp: now + this.holdMinutes * 60_000,
      }
      this.apply(d, r, false)
      this.commitLocal(d, { k: 'rec', r, app: 'plottwin' })
      return { ok: true as const }
    })
  }

  async release(plotId: string, reason: 'release' | 'expire' = 'release', who: { id: string; name: string } = ME) {
    return withLock(() => {
      const d = readDb()
      const cur = d.records[plotId]
      if (!cur || cur.by !== who.id || cur.status !== 'held') { this.db = d; this.emit(); return }
      const r: PlotRecord = { plotId, epoch: d.epoch, ver: cur.ver + 1, status: 'available', by: who.id, byName: who.name, at: reason === 'expire' ? cur.exp ?? Date.now() : Date.now() }
      this.apply(d, r, false)
      this.commitLocal(d, { k: 'rec', r, app: 'plottwin' })
    })
  }

  async book(plotId: string): Promise<{ ok: true; bookingId: string } | { ok: false; reason: string }> {
    return withLock(() => {
      const d = readDb()
      this.db = d
      const now = Date.now()
      const cur = d.records[plotId]
      if (!cur || cur.by !== ME.id || !isLiveHold(cur, now)) {
        this.emit()
        return { ok: false as const, reason: 'Your hold has expired or was lost. Hold the plot again to continue.' }
      }
      const bookingId = `AR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      const r: PlotRecord = { ...cur, ver: cur.ver + 1, status: 'booked', at: now, exp: undefined, bookingId }
      this.apply(d, r, false)
      this.commitLocal(d, { k: 'rec', r, app: 'plottwin' })
      return { ok: true as const, bookingId }
    })
  }

  async reset() {
    return withLock(() => {
      const d = readDb()
      const epoch = Math.max(d.epoch + 1, Date.now())
      const n = emptyDb(epoch)
      this.pushActivity(n, { t: Date.now(), kind: 'reset', who: ME.name })
      this.commitLocal(n, { k: 'reset', epoch, at: Date.now(), by: ME.id, byName: ME.name, app: 'plottwin' })
    })
  }

  setHoldMinutes(m: number) {
    this.holdMinutes = m
    localStorage.setItem(LS_HOLD, String(m))
    this.emit()
  }

  /** Messages from the cross-device relay. */
  private async ingest(m: WireMsg) {
    await withLock(() => {
      const d = readDb()
      let changed = false
      if (m.k === 'reset') {
        if (typeof m.epoch === 'number' && m.epoch > d.epoch) {
          const n = emptyDb(m.epoch)
          this.pushActivity(n, { t: m.at, kind: 'reset', who: m.byName, remote: true })
          Object.assign(d, n)
          changed = true
        }
      } else if (m.k === 'rec' && validRecord(m.r) && PLOTS.some((p) => p.id === m.r.plotId)) {
        changed = this.apply(d, m.r, m.r.by !== ME.id)
      }
      if (changed) {
        writeDb(d)
        this.bc?.postMessage({ type: 'changed', sentAt: Date.now() })
        this.refresh()
      }
    })
  }

  private sweep() {
    const now = Date.now()
    const mine = Object.values(this.db.records).find((r) => r.by === ME.id && r.status === 'held' && (r.exp ?? 0) <= now)
    if (mine) {
      void this.release(mine.plotId, 'expire')
      this.toast(`Your hold on ${mine.plotId} expired and the plot is back on sale`, 'warn')
    }
  }
}

export const store = new PlotStore()

export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion)
  return store
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
