import type { PlotRecord } from './types'

/** Returns true if `incoming` should replace `current`. Pure + deterministic,
 * so every peer converges to the same answer regardless of message order. */
export function supersedes(current: PlotRecord | undefined, incoming: PlotRecord): boolean {
  if (!current) return true
  if (incoming.epoch !== current.epoch) return incoming.epoch > current.epoch
  if (incoming.ver !== current.ver) return incoming.ver > current.ver
  // Same version = two writers raced from the same base version.
  if (incoming.at !== current.at) return incoming.at < current.at // first writer wins
  return (incoming.by ?? '') < (current.by ?? '')
}

export function isLiveHold(r: PlotRecord | undefined, now = Date.now()) {
  return !!r && r.status === 'held' && (r.exp ?? 0) > now
}

export function validRecord(r: unknown): r is PlotRecord {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return (
    typeof o.plotId === 'string' && typeof o.epoch === 'number' && typeof o.ver === 'number' &&
    typeof o.at === 'number' && (o.status === 'available' || o.status === 'held' || o.status === 'booked')
  )
}
