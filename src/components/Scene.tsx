import { CameraControls, Html, Sky } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CLUBHOUSE, PLOTS, PLOT_BY_ID, ZONES, type Plot } from '../data/layout'
import { cr } from '../lib/format'
import type { Status } from '../sync/types'

const COL: Record<Status, string> = { available: '#2fcf94', held: '#f6b93b', booked: '#ef4b6c' }

interface Props {
  statuses: Record<string, Status>
  matches: Set<string> | null
  selectedId: string | null
  hoverId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  fly: { id: string | null; n: number }
  heat?: boolean
}

function PlotMesh({ p, status, dim, selected, hovered, onHover, onSelect }: {
  p: Plot; status: Status; dim: boolean; selected: boolean; hovered: boolean
  onHover: (id: string | null) => void; onSelect: (id: string) => void
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const grp = useRef<THREE.Group>(null)
  const house = useRef<THREE.Group>(null)
  const color = useMemo(() => new THREE.Color(), [])
  useFrame((state, dt) => {
    if (!mat.current || !grp.current) return
    const target = dim ? '#2a3633' : COL[status]
    color.set(target)
    mat.current.color.lerp(color, Math.min(1, dt * 6))
    const t = state.clock.elapsedTime
    const pulse = status === 'held' && !dim ? 0.35 + Math.sin(t * 5) * 0.25 : 0
    mat.current.emissive.set(status === 'held' ? '#f6b93b' : selected ? '#ffffff' : '#000000')
    mat.current.emissiveIntensity = selected ? 0.35 : hovered ? 0.2 : pulse
    if (hovered && !selected) mat.current.emissive.set('#ffffff')
    const lift = selected ? 2.2 : hovered ? 0.9 : 0
    grp.current.position.y = THREE.MathUtils.lerp(grp.current.position.y, lift, Math.min(1, dt * 8))
    if (house.current) {
      const s = status === 'booked' ? 1 : 0.0001
      house.current.scale.y = THREE.MathUtils.lerp(house.current.scale.y, s, Math.min(1, dt * 3))
      house.current.visible = house.current.scale.y > 0.01
    }
  })
  return (
    <group position={[p.x, 0, p.z]}>
      <group ref={grp}>
        <mesh
          position={[0, 0.35, 0]}
          castShadow={false}
          receiveShadow
          onPointerOver={(e) => { e.stopPropagation(); onHover(p.id); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}
          onClick={(e) => { e.stopPropagation(); onSelect(p.id) }}
        >
          <boxGeometry args={[p.w, 0.7, p.d]} />
          <meshStandardMaterial ref={mat} color={COL[status]} roughness={0.55} metalness={0.05} />
        </mesh>
        {/* booked plots grow a villa massing */}
        <group ref={house} position={[0, 0.7, -p.d * 0.05]} scale={[1, status === 'booked' ? 1 : 0.0001, 1]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <boxGeometry args={[p.w * 0.55, 3.6, p.d * 0.45]} />
            <meshStandardMaterial color="#f3ede2" roughness={0.8} />
          </mesh>
          <mesh position={[0, 4.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[Math.max(p.w, p.d) * 0.36, 2, 4]} />
            <meshStandardMaterial color="#7c4a3a" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function Trees({ points, scale = 1 }: { points: [number, number][]; scale?: number }) {
  const crowns = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    points.forEach(([x, z], i) => {
      const s = scale * (0.8 + ((i * 7919) % 100) / 220)
      m.compose(new THREE.Vector3(x, 3.2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
      crowns.current?.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(x, 0.9 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
      trunks.current?.setMatrixAt(i, m)
    })
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
  }, [points, scale])
  return (
    <group>
      <instancedMesh ref={crowns} args={[undefined, undefined, points.length]} castShadow>
        <icosahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color="#2f7d4f" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, points.length]}>
        <cylinderGeometry args={[0.25, 0.35, 1.8, 5]} />
        <meshStandardMaterial color="#6b4f35" />
      </instancedMesh>
    </group>
  )
}

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

function Environment() {
  const park = ZONES[0], lake = ZONES[1], garden = ZONES[2]
  const trees = useMemo(() => {
    const r = rng(7)
    const pts: [number, number][] = []
    // ring of trees around the central park
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2
      pts.push([Math.cos(a) * 38 + (r() - 0.5) * 3, Math.sin(a) * 38 + (r() - 0.5) * 3])
    }
    // lake shore
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2
      pts.push([(lake.x0 + lake.x1) / 2 + Math.cos(a) * 41, (lake.z0 + lake.z1) / 2 + Math.sin(a) * 43])
    }
    // orchard grid
    for (let x = garden.x0 + 6; x < garden.x1 - 3; x += 9) for (let z = garden.z0 + 5; z < garden.z1 - 3; z += 8) pts.push([x + (r() - 0.5) * 2, z])
    // perimeter green belt
    for (let i = -150; i <= 150; i += 9) {
      pts.push([i, -156 - r() * 4], [i, 156 + r() * 4], [-156 - r() * 4, i], [156 + r() * 4, i])
    }
    return pts
  }, [lake, garden])
  return (
    <group>
      {/* outside ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#1c3a2b" roughness={1} />
      </mesh>
      {/* road network (whole site asphalt, blocks sit on top) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#30363a" roughness={0.95} />
      </mesh>
      {/* boundary wall */}
      {([[0, -151, 302, 1], [0, 151, 302, 1], [-151, 0, 1, 302], [151, 0, 1, 302]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 1, z]}><boxGeometry args={[w, 2, d]} /><meshStandardMaterial color="#d8cfbd" /></mesh>
      ))}
      {/* entrance gate */}
      <group position={[50, 0, 151]}>
        <mesh position={[-6, 4, 0]}><boxGeometry args={[1.6, 8, 1.6]} /><meshStandardMaterial color="#b08d57" /></mesh>
        <mesh position={[6, 4, 0]}><boxGeometry args={[1.6, 8, 1.6]} /><meshStandardMaterial color="#b08d57" /></mesh>
        <mesh position={[0, 8.4, 0]}><boxGeometry args={[14, 1.4, 1.8]} /><meshStandardMaterial color="#b08d57" /></mesh>
        <Html position={[0, 12, 0]} center distanceFactor={300} zIndexRange={[10, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-200">MAIN GATE</div></Html>
      </group>
      {/* central park + clubhouse */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
        <planeGeometry args={[park.x1 - park.x0, park.z1 - park.z0]} />
        <meshStandardMaterial color="#3f8f55" roughness={1} />
      </mesh>
      <group position={[CLUBHOUSE.x, 0, CLUBHOUSE.z]}>
        <mesh position={[0, 3, -4]} castShadow><boxGeometry args={[26, 6, 14]} /><meshStandardMaterial color="#f5efe4" roughness={0.6} /></mesh>
        <mesh position={[0, 6.5, -4]} castShadow><boxGeometry args={[30, 1, 18]} /><meshStandardMaterial color="#1f2a2e" /></mesh>
        <mesh position={[-8, 8.5, -4]} castShadow><boxGeometry args={[10, 4, 10]} /><meshStandardMaterial color="#9fd3e6" metalness={0.6} roughness={0.15} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 12]}><planeGeometry args={[20, 8]} /><meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.35} metalness={0.3} roughness={0.1} /></mesh>
        <Html position={[0, 14, 0]} center distanceFactor={300} zIndexRange={[10, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-200">CLUBHOUSE</div></Html>
      </group>
      {/* lake */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(lake.x0 + lake.x1) / 2, 0.04, (lake.z0 + lake.z1) / 2]}>
        <planeGeometry args={[lake.x1 - lake.x0, lake.z1 - lake.z0]} />
        <meshStandardMaterial color="#3d7d52" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(lake.x0 + lake.x1) / 2, 0.1, (lake.z0 + lake.z1) / 2]} scale={[1, 1.06, 1]}>
        <circleGeometry args={[34, 48]} />
        <meshStandardMaterial color="#2b7bb9" emissive="#0b4f80" emissiveIntensity={0.4} metalness={0.5} roughness={0.12} />
      </mesh>
      <Html position={[(lake.x0 + lake.x1) / 2, 6, (lake.z0 + lake.z1) / 2]} center distanceFactor={300} zIndexRange={[10, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-200">ARANYA LAKE</div></Html>
      {/* orchard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(garden.x0 + garden.x1) / 2, 0.04, (garden.z0 + garden.z1) / 2]}>
        <planeGeometry args={[garden.x1 - garden.x0, garden.z1 - garden.z0]} />
        <meshStandardMaterial color="#4a7a3a" roughness={1} />
      </mesh>
      <Html position={[(garden.x0 + garden.x1) / 2, 10, (garden.z0 + garden.z1) / 2]} center distanceFactor={300} zIndexRange={[10, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-lime-200">MANGO ORCHARD</div></Html>
      <Trees points={trees} />
    </group>
  )
}

function Ripples({ statuses }: { statuses: Record<string, Status> }) {
  const prev = useRef<Record<string, Status> | null>(null)
  const [rings, setRings] = useState<{ id: string; t0: number; color: string }[]>([])
  useEffect(() => {
    const p = prev.current
    if (p) {
      const changed = Object.keys(statuses).filter((k) => p[k] !== statuses[k])
      if (changed.length && changed.length < 20) {
        const now = performance.now()
        setRings((r) => [...r.filter((x) => now - x.t0 < 2000), ...changed.map((id) => ({ id, t0: now, color: COL[statuses[id]] }))])
      }
    }
    prev.current = statuses
  }, [statuses])
  return <>{rings.map((r) => <Ring key={r.id + r.t0} {...r} />)}</>
}
function Ring({ id, t0, color }: { id: string; t0: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const p = PLOT_BY_ID[id]
  useFrame(() => {
    if (!ref.current) return
    const k = Math.min(1, (performance.now() - t0) / 1800)
    ref.current.scale.setScalar(1 + k * 5)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k)
  })
  return (
    <mesh ref={ref} position={[p.x, 1.2, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[6, 7.5, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Overview framing: on wide screens shift the target left so the filter panel doesn't cover the site. */
function overview(c: CameraControls, animate: boolean) {
  const wide = window.innerWidth >= 1024
  const narrow = window.innerWidth < 640
  const tx = wide ? -45 : 0
  if (narrow) return c.setLookAt(0, 620, 330, 0, 0, 25, animate)
  return c.setLookAt(tx + 145, 215, 290, tx, 0, 20, animate)
}

function CameraRig({ fly, controls }: { fly: Props['fly']; controls: React.RefObject<CameraControls | null> }) {
  useEffect(() => {
    const c = controls.current
    if (!c) return
    if (fly.id) {
      const p = PLOT_BY_ID[fly.id]
      if (p) void c.setLookAt(p.x + 48, 62, p.z + 66, p.x, 0, p.z, true)
    } else if (fly.n > 0) {
      void overview(c, true)
    }
  }, [fly, controls])
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.setLookAt(-50, 560, 460, -50, 0, 15, false)
    const t = setTimeout(() => void overview(c, true), 250)
    return () => clearTimeout(t)
  }, [controls])
  return null
}

export default function Scene(props: Props) {
  const controls = useRef<CameraControls>(null)
  const sel = props.selectedId ? PLOT_BY_ID[props.selectedId] : null
  const hov = props.hoverId && props.hoverId !== props.selectedId ? PLOT_BY_ID[props.hoverId] : null
  return (
    <Canvas
      id="plottwin-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [150, 190, 250], fov: 42, near: 1, far: 3000 }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <color attach="background" args={['#0a1714']} />
      <fog attach="fog" args={['#0a1714', 600, 1300]} />
      <Sky distance={4500} sunPosition={[120, 60, 80]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} />
      <hemisphereLight args={['#dff3ff', '#1d3326', 0.75]} />
      <directionalLight
        position={[160, 240, 120]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-near={50}
        shadow-camera-far={700}
        shadow-bias={-0.0006}
        shadow-normalBias={0.4}
      />
      <Environment />
      {PLOTS.map((p) => (
        <PlotMesh
          key={p.id}
          p={p}
          status={props.statuses[p.id]}
          dim={!!props.matches && !props.matches.has(p.id)}
          selected={props.selectedId === p.id}
          hovered={props.hoverId === p.id}
          onHover={props.onHover}
          onSelect={props.onSelect}
        />
      ))}
      <Ripples statuses={props.statuses} />
      {sel && (
        <Html position={[sel.x, 9, sel.z]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none flex flex-col items-center">
            <div className="whitespace-nowrap rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow-xl">{sel.id}</div>
            <div className="h-5 w-px bg-white" />
          </div>
        </Html>
      )}
      {hov && (
        <Html position={[hov.x, 4, hov.z]} center zIndexRange={[30, 0]}>
          <div className="pointer-events-none -translate-y-10 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: COL[props.statuses[hov.id]] }} />
              {hov.id} · {hov.sqft.toLocaleString('en-IN')} sq ft
            </div>
            <div className="mt-0.5 text-slate-300">{hov.facing} · {cr(hov.price)} · {hov.clubDist} m to clubhouse</div>
            {hov.premiums.length > 0 && <div className="mt-0.5 text-amber-200">{hov.premiums.join(' · ')}</div>}
          </div>
        </Html>
      )}
      <CameraControls ref={controls} minDistance={30} maxDistance={700} maxPolarAngle={Math.PI / 2.25} smoothTime={0.6} />
      <CameraRig fly={props.fly} controls={controls} />
    </Canvas>
  )
}
