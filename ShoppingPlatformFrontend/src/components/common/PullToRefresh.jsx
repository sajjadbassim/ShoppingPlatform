import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { runPullRefresh } from '../../utils/pullRefresh'

const THRESHOLD = 70
const MAX_PULL = 110

/**
 * سحب الصفحة للأسفل من أعلاها لتحديثها (اللمس فقط) — بدل تحديث المتصفح الذي يعيد تحميل التطبيق كاملاً
 */
const PullToRefresh = () => {
  const queryClient = useQueryClient()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const pullRef = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    const root = document.documentElement
    const prevOverscroll = root.style.overscrollBehaviorY
    root.style.overscrollBehaviorY = 'contain'

    const setPullValue = (v) => { pullRef.current = v; setPull(v) }

    const onStart = (e) => {
      // لا سحب أثناء نافذة منبثقة (تقفل تمرير الصفحة) أو إن لم تكن الصفحة في أعلاها
      startY.current = !busy.current && window.scrollY <= 0 && e.touches.length === 1 &&
        document.body.style.overflow !== 'hidden' ? e.touches[0].clientY : null
    }
    const onMove = (e) => {
      if (startY.current == null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) { if (pullRef.current) setPullValue(0); return }
      setPullValue(Math.min(MAX_PULL, dy * 0.5))
    }
    const onEnd = async () => {
      if (startY.current == null) return
      startY.current = null
      const reached = pullRef.current >= THRESHOLD
      setPullValue(0)
      if (!reached) return
      busy.current = true
      setRefreshing(true)
      try {
        // حد أدنى قصير حتى يرى المستخدم أن التحديث حدث
        await Promise.all([runPullRefresh(queryClient), new Promise(r => setTimeout(r, 600))])
      } finally {
        busy.current = false
        setRefreshing(false)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      root.style.overscrollBehaviorY = prevOverscroll
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  if (!pull && !refreshing) return null
  const offset = refreshing ? THRESHOLD * 0.6 : pull * 0.6
  const ready = pull >= THRESHOLD

  return (
    <div className="fixed top-[70px] inset-x-0 z-40 flex justify-center pointer-events-none" aria-live="polite">
      <span
        style={{ transform: `translateY(${offset}px)`, opacity: refreshing ? 1 : Math.min(1, pull / THRESHOLD) }}
        className={`w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center ${pull ? '' : 'transition-transform'}`}>
        <RefreshCw size={20}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          className={`${ready || refreshing ? 'text-primary' : 'text-gray-400'} ${refreshing ? 'animate-spin' : ''}`} />
      </span>
      {refreshing && <span className="sr-only">جاري التحديث</span>}
    </div>
  )
}

export default PullToRefresh
