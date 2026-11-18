import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { store, type Toast } from '../sync/store'

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => store.onToast((t) => {
    setItems((x) => [...x.slice(-3), t])
    setTimeout(() => setItems((x) => x.filter((y) => y.id !== t.id)), 4200)
  }), [])
  const tone = { info: 'ring-sky-300/30 text-sky-100', warn: 'ring-amber-300/40 text-amber-100', good: 'ring-emerald-300/40 text-emerald-100', bad: 'ring-rose-400/40 text-rose-100' }
  return (
    <div className="pointer-events-none fixed top-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" data-testid="toasts">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} className={`glass rounded-full px-4 py-2 text-sm font-medium ring-1 ${tone[t.tone]}`}>
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current align-middle" />{t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
