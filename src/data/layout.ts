// Procedurally generated (but deterministic) site plan for the fictional
// "Aranya Alibaug" plotted township. 1 world unit = 1 metre.

export type Facing = 'North' | 'South' | 'North-East' | 'North-West' | 'South-East' | 'South-West'

export interface Plot {
  id: string
  block: string
  x: number // centre
  z: number
  w: number // frontage (x)
  d: number // depth (z)
  sqft: number
  facing: Facing
  corner: boolean
  parkFacing: boolean
  lakeFacing: boolean
  clubDist: number // metres, straight line to clubhouse
  ratePerSqft: number
  price: number // INR
  premiums: string[]
}

export interface Zone {
  kind: 'park' | 'lake' | 'garden'
  x0: number; x1: number; z0: number; z1: number
  name: string
}

export const SITE = { half: 150, road: 10, blockDepthBase: 40 }
export const BASE_RATE = 13_500 // ₹/sqft, fictional
export const PROJECT = {
  name: 'Aranya Alibaug',
  tagline: 'Demo plotted township · fictional project',
  acres: 20,
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COLS: [number, number][] = [[-140, -55], [-45, 45], [55, 140]]
const ROWS: [number, number][] = [[-145, -105], [-95, -55], [-45, -5], [5, 45], [55, 95], [105, 145]]

export const ZONES: Zone[] = [
  { kind: 'park', x0: -45, x1: 45, z0: -45, z1: 45, name: 'Clubhouse & Central Park' },
  { kind: 'lake', x0: -140, x1: -55, z0: 55, z1: 145, name: 'Aranya Lake' },
  { kind: 'garden', x0: 55, x1: 140, z0: 105, z1: 145, name: 'Mango Orchard' },
]

function zoneAt(col: number, row: number): Zone | undefined {
  const [x0, x1] = COLS[col]
  const [z0, z1] = ROWS[row]
  return ZONES.find((zn) => x0 >= zn.x0 && x1 <= zn.x1 && z0 >= zn.z0 && z1 <= zn.z1)
}

export const CLUBHOUSE = { x: 0, z: 0 }

function build(): Plot[] {
  const rand = mulberry32(20261119)
  const plots: Plot[] = []
  let blockIdx = 0
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS.length; c++) {
      if (zoneAt(c, r)) continue
      const letter = String.fromCharCode(65 + blockIdx++)
      const [x0, x1] = COLS[c]
      const [z0, z1] = ROWS[r]
      const len = x1 - x0
      const mid = (z0 + z1) / 2
      // two rows of plots back to back: north row faces north road, south row faces south road
      let n = 1
      for (const side of ['N', 'S'] as const) {
        const count = 6
        const raw = Array.from({ length: count }, () => 0.8 + rand() * 0.5)
        const sum = raw.reduce((a, b) => a + b, 0)
        const widths = raw.map((v) => (v / sum) * len)
        let cx = x0
        const zA = side === 'N' ? z0 : mid
        const zB = side === 'N' ? mid : z1
        widths.forEach((w, i) => {
          const d = zB - zA
          const px = cx + w / 2
          const pz = (zA + zB) / 2
          cx += w
          const corner = i === 0 || i === count - 1
          let facing: Facing = side === 'N' ? 'North' : 'South'
          if (corner) facing = `${side === 'N' ? 'North' : 'South'}-${i === 0 ? 'West' : 'East'}` as Facing
          // Which zone (if any) is across the road this plot faces?
          const acrossRow = side === 'N' ? r - 1 : r + 1
          const across = acrossRow >= 0 && acrossRow < ROWS.length ? zoneAt(c, acrossRow) : undefined
          // corner plots also see across the cross-road
          const sideCol = i === 0 ? c - 1 : c + 1
          const sideZone = corner && sideCol >= 0 && sideCol < COLS.length ? zoneAt(sideCol, r) : undefined
          const z = across ?? sideZone
          const parkFacing = !!z && (z.kind === 'park' || z.kind === 'garden')
          const lakeFacing = !!z && z.kind === 'lake'
          // plots are a bit shallower than the half block (internal service lane / setback)
          const depth = d - 1.2
          const width = w - 0.9
          const sqft = Math.round(width * depth * 10.7639)
          const premiums: string[] = []
          let mult = 1
          if (corner) { mult += 0.05; premiums.push('Corner +5%') }
          if (parkFacing) { mult += 0.04; premiums.push('Park-facing +4%') }
          if (lakeFacing) { mult += 0.08; premiums.push('Lake-facing +8%') }
          if (facing.includes('East') || facing === 'North') { mult += 0.02; premiums.push('Vastu (N/E) +2%') }
          const clubDist = Math.round(Math.hypot(px - CLUBHOUSE.x, pz - CLUBHOUSE.z))
          // gentle location gradient: closer to the clubhouse costs a little more
          const loc = 1 + Math.max(0, (160 - clubDist) / 160) * 0.06
          const rate = Math.round((BASE_RATE * mult * loc) / 50) * 50
          plots.push({
            id: `${letter}-${String(n).padStart(2, '0')}`,
            block: letter,
            x: px, z: pz, w: width, d: depth,
            sqft, facing, corner, parkFacing, lakeFacing, clubDist,
            ratePerSqft: rate,
            price: Math.round((rate * sqft) / 10000) * 10000,
            premiums,
          })
          n++
        })
      }
    }
  }
  return plots
}

export const PLOTS: Plot[] = build()
export const PLOT_BY_ID: Record<string, Plot> = Object.fromEntries(PLOTS.map((p) => [p.id, p]))
export const BLOCKS = Array.from(new Set(PLOTS.map((p) => p.block)))

// Deterministic "already sold" plots so the demo opens with a realistic map.
const seedRand = mulberry32(999)
export const SEED_BOOKED = new Set(PLOTS.filter(() => seedRand() < 0.28).map((p) => p.id))

export const PRICE_MIN = Math.min(...PLOTS.map((p) => p.price))
export const PRICE_MAX = Math.max(...PLOTS.map((p) => p.price))
export const SIZE_MIN = Math.min(...PLOTS.map((p) => p.sqft))
export const SIZE_MAX = Math.max(...PLOTS.map((p) => p.sqft))
