export function inr(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}
export function cr(n: number, digits = 2) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(digits)} Cr`
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return inr(n)
}
export function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export function ago(t: number, now = Date.now()) {
  const s = Math.round((now - t) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}
export const STATUS_COLOR = {
  available: '#34d399',
  held: '#fbbf24',
  booked: '#f43f5e',
} as const
