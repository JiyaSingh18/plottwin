export interface PlanRow { month: number; amount: number; label: string }
export interface Plan {
  key: 'growth' | 'clp' | 'upfront'
  name: string
  blurb: string
  color: string
  rows: PlanRow[]
  total: number
  npv: number
}

export interface PlanInputs {
  price: number
  possessionMonth: number // months from booking to possession
  discountRate: number // annual % used for present value (your opportunity cost)
  upfrontDiscount: number // % off for paying upfront
}

function pv(rows: PlanRow[], annualRate: number) {
  const r = annualRate / 100 / 12
  return rows.reduce((s, x) => s + x.amount / Math.pow(1 + r, x.month), 0)
}

export const REGISTRATION = 999

/** Growth-style plan modelled on the publicly advertised structure:
 * ₹999 registration, 9.9% at booking, 10% after a month, then 1% a month
 * until possession, balance on possession. */
export function growthPlan(i: PlanInputs): PlanRow[] {
  const rows: PlanRow[] = [
    { month: 0, amount: REGISTRATION, label: 'Registration (₹999)' },
    { month: 0, amount: i.price * 0.099 - REGISTRATION, label: 'Booking 9.9% (₹999 adjusted)' },
    { month: 1, amount: i.price * 0.1, label: '10% after 30 days' },
  ]
  let paid = 0.199
  for (let m = 2; m < i.possessionMonth && paid < 0.99; m++) {
    rows.push({ month: m, amount: i.price * 0.01, label: '1% monthly' })
    paid += 0.01
  }
  rows.push({ month: i.possessionMonth, amount: i.price * (1 - paid), label: 'Balance on possession' })
  return rows
}

/** Typical development-linked plan (plotted projects link to infra milestones). */
export function clpPlan(i: PlanInputs): PlanRow[] {
  const P = i.possessionMonth
  const ms = [0.2, 0.4, 0.6, 0.8].map((f) => Math.max(2, Math.round(P * f)))
  return [
    { month: 0, amount: i.price * 0.1, label: 'Booking 10%' },
    { month: 2, amount: i.price * 0.15, label: 'Agreement for sale 15%' },
    { month: ms[0], amount: i.price * 0.15, label: 'Roads & drainage 15%' },
    { month: ms[1], amount: i.price * 0.15, label: 'Water & power 15%' },
    { month: ms[2], amount: i.price * 0.15, label: 'Clubhouse structure 15%' },
    { month: ms[3], amount: i.price * 0.15, label: 'Landscaping 15%' },
    { month: P, amount: i.price * 0.15, label: 'Possession 15%' },
  ]
}

export function upfrontPlan(i: PlanInputs): PlanRow[] {
  const net = i.price * (1 - i.upfrontDiscount / 100)
  return [
    { month: 0, amount: net * 0.1, label: 'Booking 10%' },
    { month: 1, amount: net * 0.9, label: `Balance 90% in 30 days (${i.upfrontDiscount}% off)` },
  ]
}

export function allPlans(i: PlanInputs): Plan[] {
  const defs: Omit<Plan, 'total' | 'npv'>[] = [
    { key: 'growth', name: '1%-a-month Growth plan', blurb: '₹999 + 9.9% now, 10% next month, then 1%/month', color: '#34d399', rows: growthPlan(i) },
    { key: 'clp', name: 'Development-linked', blurb: 'Pay as roads, utilities & clubhouse get built', color: '#60a5fa', rows: clpPlan(i) },
    { key: 'upfront', name: 'Upfront (down payment)', blurb: `Pay ~all in 30 days, ${i.upfrontDiscount}% discount`, color: '#f472b6', rows: upfrontPlan(i) },
  ]
  return defs.map((d) => ({ ...d, total: d.rows.reduce((s, r) => s + r.amount, 0), npv: pv(d.rows, i.discountRate) }))
}

export function cumulativeSeries(plans: Plan[], months: number) {
  const out: Record<string, number>[] = []
  for (let m = 0; m <= months; m++) {
    const row: Record<string, number> = { month: m }
    for (const p of plans) row[p.key] = p.rows.filter((r) => r.month <= m).reduce((s, r) => s + r.amount, 0) / 1e7
    out.push(row)
  }
  return out
}
