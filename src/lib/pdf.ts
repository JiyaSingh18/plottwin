import { jsPDF } from 'jspdf'
import type { Plot } from '../data/layout'
import { PROJECT } from '../data/layout'
import { allPlans } from './plans'

// jsPDF's built-in fonts have no ₹ glyph, so PDFs use "Rs."
const rs = (n: number) => 'Rs. ' + Math.round(n).toLocaleString('en-IN')

export type DocKind = 'confirmation' | 'receipt' | 'costsheet' | 'kyc'
export const DOCS: { kind: DocKind; title: string }[] = [
  { kind: 'confirmation', title: 'Booking confirmation' },
  { kind: 'receipt', title: 'Payment receipt (₹999 demo)' },
  { kind: 'costsheet', title: 'Cost sheet & payment schedule' },
  { kind: 'kyc', title: 'KYC acknowledgement' },
]

export interface DocCtx { plot: Plot; bookingId: string; buyer: string; bookedAt: number }

function frame(doc: jsPDF, title: string, ctx: DocCtx) {
  doc.setFillColor(11, 31, 26)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(167, 243, 208)
  doc.setFontSize(18)
  doc.text(`${PROJECT.name}`, 14, 15)
  doc.setFontSize(10)
  doc.setTextColor(220, 230, 226)
  doc.text('PlotTwin · fictional demo project · not a real offer', 14, 23)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(15)
  doc.text(title, 14, 46)
  doc.setFontSize(10)
  doc.text(`Booking ID: ${ctx.bookingId}`, 14, 54)
  doc.text(`Date: ${new Date(ctx.bookedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, 120, 54)
  // DEMO watermark
  doc.setTextColor(244, 63, 94)
  doc.setFontSize(70)
  doc.text('DEMO', 40, 190, { angle: 30 })
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(8)
  doc.text('Generated in-browser for a portfolio demo. No payment was taken, no personal data was stored, and this document has no legal value.', 14, 287)
  doc.setFontSize(11)
}

function kv(doc: jsPDF, rows: [string, string][], y: number) {
  rows.forEach(([k, v], i) => {
    doc.setTextColor(100, 110, 105)
    doc.text(k, 14, y + i * 8)
    doc.setTextColor(20, 20, 20)
    doc.text(v, 80, y + i * 8)
  })
}

export function makeDoc(kind: DocKind, ctx: DocCtx): jsPDF {
  const doc = new jsPDF()
  const p = ctx.plot
  const title = DOCS.find((d) => d.kind === kind)!.title.replace('₹', 'Rs. ')
  frame(doc, title, ctx)
  const base: [string, string][] = [
    ['Buyer', ctx.buyer],
    ['Plot', `${p.id} (Block ${p.block})`],
    ['Area', `${p.sqft.toLocaleString('en-IN')} sq ft`],
    ['Facing', p.facing],
    ['Premiums', p.premiums.join(', ') || 'None'],
    ['Agreement value', rs(p.price)],
  ]
  if (kind === 'confirmation') {
    kv(doc, [...base, ['Status', 'BOOKED (demo)'], ['Next step', 'Pay 9.9% within 7 days (demo)']], 68)
  } else if (kind === 'receipt') {
    kv(doc, [['Received from', ctx.buyer], ['Amount', 'Rs. 999 (DEMO, no money moved)'], ['Towards', `Registration for plot ${p.id}`], ['Mode', 'Mock UPI'], ['Txn ref', 'DEMO-' + ctx.bookingId]], 68)
  } else if (kind === 'kyc') {
    kv(doc, [['Buyer', ctx.buyer], ['PAN', 'XXXXX0000X (masked demo)'], ['Aadhaar', 'XXXX XXXX 0000 (masked demo)'], ['Status', 'Verified (simulated)'], ['Stored', 'Nothing. Demo form only']], 68)
  } else {
    const g = allPlans({ price: p.price, possessionMonth: 30, discountRate: 8, upfrontDiscount: 6 })[0]
    kv(doc, base, 68)
    doc.setFontSize(12)
    doc.text('Growth plan schedule (1% a month, illustrative)', 14, 125)
    doc.setFontSize(9)
    const rows = g.rows
    rows.slice(0, 34).forEach((r, i) => {
      const y = 133 + (i % 17) * 7
      const x = i < 17 ? 14 : 110
      doc.text(`M${r.month}  ${r.label.replace('₹', 'Rs. ')}`, x, y)
      doc.text(rs(r.amount), x + 70, y)
    })
  }
  return doc
}

export function downloadDoc(kind: DocKind, ctx: DocCtx) {
  makeDoc(kind, ctx).save(`${ctx.bookingId}-${kind}.pdf`)
}
