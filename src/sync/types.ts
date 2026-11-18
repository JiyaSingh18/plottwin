export type Status = 'available' | 'held' | 'booked'

/**
 * One versioned record per plot. Every mutation bumps `ver` (optimistic
 * concurrency, like `UPDATE plots SET ... WHERE id = $1 AND ver = $2`).
 * Two writers that raced from the same version are resolved deterministically:
 * earliest claim timestamp wins, then lowest client id ("first writer wins").
 */
export interface PlotRecord {
  plotId: string
  epoch: number // bumped by "reset demo"; older epochs are ignored everywhere
  ver: number
  status: Status
  by?: string // client id of the buyer holding / owning it
  byName?: string
  at: number // claim time (ms since epoch)
  exp?: number // hold expiry (ms)
  bookingId?: string
}

export type WireMsg =
  | { k: 'rec'; r: PlotRecord; app: 'plottwin' }
  | { k: 'reset'; epoch: number; at: number; by: string; byName: string; app: 'plottwin' }

export interface Activity {
  t: number
  plotId?: string
  kind: 'hold' | 'release' | 'book' | 'expire' | 'reset' | 'lost'
  who: string
  remote?: boolean
}

export interface DbState {
  epoch: number
  records: Record<string, PlotRecord>
  activity: Activity[]
  stats: { holdsStarted: number; bookings: number; expired: number }
}

/** A transport moves records between peers. Swap this for websockets/Supabase/etc. */
export interface Transport {
  name: string
  start(onMsg: (m: WireMsg) => void, onStatus: (s: TransportStatus) => void): void
  publish(m: WireMsg): void
  stop(): void
}
export type TransportStatus = 'off' | 'connecting' | 'live' | 'error'
