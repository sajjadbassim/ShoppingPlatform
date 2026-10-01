import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, ShoppingBag, Volume2, VolumeX, RefreshCw, Play } from 'lucide-react'
import { getImageUrl } from '../../utils/imageHelper'

// مشغّل تيك توك الرسمي
const playerUrl = (video) => {
  const base = video.embedLink || `https://www.tiktok.com/player/v1/${video.externalId}`
  const url = new URL(base)
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('loop', '1')
  url.searchParams.set('rel', '0')
  return url.toString()
}

// أوامر مشغّل تيك توك عبر postMessage (play, pause, mute, unMute...)
const sendToPlayer = (frame, type) =>
  frame?.contentWindow?.postMessage({ type, 'x-tiktok-player': true }, '*')

// عتبات السحب: مسافة (نسبة من الشاشة) أو سرعة تكفي للانتقال
const SWIPE_DISTANCE = 0.18
const SWIPE_VELOCITY = 0.45 // بكسل/ملي ثانية
const PULL_THRESHOLD = 70

/**
 * شريحة واحدة. memo: لا تُعاد رسم الشرائح البعيدة عند كل تغيير في العارض.
 * near: الشرائح القريبة فقط ترسم الغلاف والبطاقات (الصور والتأثيرات مكلفة على الهاتف).
 */
const Slide = memo(({ video, index, active, near, loadPlayer, paused, gestures, setSlideRef, setFrameRef }) => (
  <section ref={setSlideRef} data-index={index}
    className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center">
    <div className="relative h-full w-full sm:w-auto sm:aspect-[9/16] sm:max-h-[100dvh] bg-black">
      {/* الغلاف يظهر فوراً إلى أن يُحمَّل المشغّل */}
      {near && video.coverImageUrl && (
        <img src={video.coverImageUrl} alt="" referrerPolicy="no-referrer" decoding="async"
          className="no-dim absolute inset-0 w-full h-full object-cover opacity-60" />
      )}
      {loadPlayer && (
        <iframe
          key={video.id}
          ref={setFrameRef}
          src={playerUrl(video)}
          title={video.title || 'فيديو TikTok'}
          className={`absolute inset-0 w-full h-full border-0 ${active ? '' : 'opacity-0 pointer-events-none'}`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* طبقة اللمس فوق الفيديو: السحب للتنقل/التحديث، والنقر للصوت أو الإيقاف.
          تترك شريط تحكم المشغّل في الأسفل. السحب هنا يُحسب لمسة، فيعمل الصوت مع الفيديو التالي */}
      {active && (
        <div {...gestures} className="absolute inset-x-0 top-0 bottom-16 z-[5] touch-none select-none cursor-pointer">
          {paused && (
            <span className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/40 text-white flex items-center justify-center pointer-events-none">
              <Play size={30} fill="currentColor" />
            </span>
          )}
        </div>
      )}

      {/* المتجر صاحب الفيديو (صفحة ريلز) */}
      {near && video.store && (
        <Link to={`/stores/${video.store.id}?tab=videos`}
          className="absolute bottom-36 sm:bottom-24 left-3 z-10 flex items-center gap-2 max-w-[65%] pr-3 p-1 rounded-full bg-black/55 text-white">
          <span className="w-9 h-9 rounded-full bg-white overflow-hidden flex-shrink-0 ring-2 ring-white">
            {video.store.logoUrl && <img src={getImageUrl(video.store.logoUrl)} alt="" className="w-full h-full object-cover" />}
          </span>
          <span className="text-sm font-bold truncate">{video.store.nameAr || video.store.name}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-gray-900 font-bold flex-shrink-0">المتجر</span>
        </Link>
      )}

      {/* المنتج المربوط */}
      {near && video.product && (
        <Link to={`/products/${video.product.id}`}
          className="absolute top-16 inset-x-3 z-10 flex items-center gap-3 p-2 pl-3 rounded-2xl bg-white shadow-lg">
          <span className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
            {video.product.primaryImageUrl && <img src={getImageUrl(video.product.primaryImageUrl)} alt="" className="w-full h-full object-cover" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-gray-900 truncate">{video.product.nameAr || video.product.name}</span>
            <span className="block text-sm font-bold text-primary">{video.product.price?.toLocaleString()} د.ع</span>
          </span>
          <span className="h-9 px-3 rounded-full bg-primary text-white text-xs font-bold flex items-center gap-1 flex-shrink-0">
            <ShoppingBag size={14} />اشترِ الآن
          </span>
        </Link>
      )}
    </div>
  </section>
))
Slide.displayName = 'Slide'

/**
 * عارض فيديوهات بملء الشاشة بأسلوب تيك توك: تمرير عمودي، فيديو واحد لكل شاشة.
 * standalone: صفحة كاملة (ريلز) بلا إضافة للسجل، والإغلاق عبر onClose.
 * onNearEnd: يُستدعى عند الاقتراب من آخر فيديو لتحميل المزيد.
 * onRefresh: السحب للأسفل من أول فيديو يجلب الجديد.
 */
const TikTokFeedViewer = ({ videos, startIndex = 0, onClose, standalone = false, title, onNearEnd, onRefresh, refreshing = false }) => {
  const [active, setActive] = useState(startIndex)
  const [showHint, setShowHint] = useState(videos.length > 1)
  useEffect(() => {
    if (!showHint) return
    const t = setTimeout(() => setShowHint(false), 3500)
    return () => clearTimeout(t)
  }, [showHint])

  const containerRef = useRef(null)
  const slideRefs = useRef([])
  const closingRef = useRef(false)
  const framesRef = useRef({})
  const activeRef = useRef(active)
  activeRef.current = active
  const videosRef = useRef(videos)
  videosRef.current = videos

  // ===== الصوت =====
  // المتصفح يمنع رفع الكتم برمجياً إلا مباشرة بعد لمسة (وإلا يوقف الفيديو): يبدأ مكتوماً،
  // ولمسة الفيديو أو زر الصوت أو السحب ترفع الكتم، والفيديو التالي محمَّل مسبقاً ليُرفع كتمه ضمن اللمسة نفسها
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const mutedRef = useRef(muted); mutedRef.current = muted
  const pausedRef = useRef(paused); pausedRef.current = paused
  const wantSoundRef = useRef(false)
  const unmuteAtRef = useRef(0)
  const readyRef = useRef(new Set())
  // الجاران يُحمَّلان بعد جاهزية الفيديو الحالي حتى لا يتنافسا معه على الشبكة
  const [neighborsOn, setNeighborsOn] = useState(false)

  const hasGesture = () => navigator.userActivation?.isActive ?? false

  const startPlayer = (frame) => {
    if (!frame) return
    setPaused(false)
    if (wantSoundRef.current && hasGesture()) {
      unmuteAtRef.current = Date.now()
      sendToPlayer(frame, 'unMute')
      sendToPlayer(frame, 'play')
    } else {
      sendToPlayer(frame, 'mute')
      sendToPlayer(frame, 'play')
      setMuted(true)
    }
  }

  useEffect(() => {
    const onMessage = (e) => {
      if (!/^https:\/\/([\w-]+\.)*tiktok\.com$/.test(e.origin)) return
      const data = typeof e.data === 'string' ? (() => { try { return JSON.parse(e.data) } catch { return null } })() : e.data
      if (!data?.['x-tiktok-player']) return
      const idx = Object.keys(framesRef.current).map(Number)
        .find(i => framesRef.current[i]?.contentWindow === e.source)
      if (idx === undefined) return
      const frame = framesRef.current[idx]
      const isActive = idx === activeRef.current

      if (data.type === 'onPlayerReady') {
        readyRef.current.add(frame)
        if (isActive) { startPlayer(frame); setNeighborsOn(true) }
        else { sendToPlayer(frame, 'mute'); sendToPlayer(frame, 'pause') }
      }
      // الفيديو المحمَّل مسبقاً قد يبدأ بعد انتهاء التخزين المؤقت، فيبقى متوقفاً
      if (!isActive) {
        if (data.type === 'onStateChange' && data.value === 1) sendToPlayer(frame, 'pause')
        return
      }
      if (data.type === 'onMute') setMuted(!!data.value)
      if (data.type === 'onStateChange' && (data.value === 1 || data.value === 2)) setPaused(data.value === 2)
      // المتصفح رفض الصوت وأوقف الفيديو: نكمل التشغيل مكتوماً ونُظهر زر الصوت
      if (data.type === 'onStateChange' && data.value === 2 && Date.now() - unmuteAtRef.current < 2500) {
        unmuteAtRef.current = 0
        sendToPlayer(frame, 'mute')
        sendToPlayer(frame, 'play')
        setMuted(true)
      }
    }
    window.addEventListener('message', onMessage)
    // احتياط: إن تأخر المشغّل كثيراً نحمّل الجارين على أي حال
    const t = setTimeout(() => setNeighborsOn(true), 6000)
    return () => { window.removeEventListener('message', onMessage); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // عند الانتقال: الفيديو السابق يُوقف ويُكتم، والجديد يعمل (بالصوت إن جاء الانتقال بلمسة)
  useEffect(() => {
    Object.entries(framesRef.current).forEach(([i, f]) => {
      if (Number(i) !== active) { sendToPlayer(f, 'mute'); sendToPlayer(f, 'pause') }
    })
    const frame = framesRef.current[active]
    if (frame && readyRef.current.has(frame)) startPlayer(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const toggleSound = () => {
    const frame = framesRef.current[activeRef.current]
    if (mutedRef.current) {
      wantSoundRef.current = true
      unmuteAtRef.current = Date.now()
      sendToPlayer(frame, 'unMute')
      sendToPlayer(frame, 'play')
      setMuted(false)
    } else {
      wantSoundRef.current = false
      sendToPlayer(frame, 'mute')
      setMuted(true)
    }
  }
  const toggleSoundRef = useRef(toggleSound); toggleSoundRef.current = toggleSound

  // ===== التمرير =====
  const snapBackTimer = useRef(0)
  const scrollTo = useCallback((i, smooth = true) => {
    const c = containerRef.current
    const target = slideRefs.current[Math.max(0, Math.min(videosRef.current.length - 1, i))]
    if (!c || !target) return
    c.scrollTo({ top: target.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // ===== السحب: المحتوى يتبع الإصبع ثم يستقر على الفيديو المناسب =====
  const pullRef = useRef(null)      // مؤشر السحب للتحديث (تحديث مباشر للـ DOM بلا إعادة رسم)
  const [pullReady, setPullReady] = useState(false)
  const [pulling, setPulling] = useState(false)
  const drag = useRef(null)
  const onRefreshRef = useRef(onRefresh); onRefreshRef.current = onRefresh

  const setPullVisual = (px) => {
    const el = pullRef.current
    if (!el) return
    el.style.transform = `translateY(${px * 0.4}px)`
    el.style.opacity = String(Math.min(1, px / PULL_THRESHOLD))
    const icon = el.querySelector('svg')
    if (icon) icon.style.transform = `rotate(${px * 3}deg)`
  }

  const gestures = useMemo(() => ({
    onPointerDown: (e) => {
      const c = containerRef.current
      if (!c) return
      clearTimeout(snapBackTimer.current)
      c.style.scrollSnapType = 'none' // أثناء السحب نحرك التمرير يدوياً
      drag.current = { id: e.pointerId, y: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, start: c.scrollTop, moved: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      const dy = e.clientY - d.y
      const dt = e.timeStamp - d.lastT
      if (dt > 0) d.v = (e.clientY - d.lastY) / dt
      d.lastY = e.clientY; d.lastT = e.timeStamp
      if (Math.abs(dy) > 6) d.moved = true
      const c = containerRef.current
      if (activeRef.current === 0 && dy > 0 && onRefreshRef.current) {
        // من أول فيديو: السحب للأسفل = تحديث
        const px = Math.min(110, dy * 0.5)
        d.pull = px
        if (!d.pulling) { d.pulling = true; setPulling(true) }
        setPullVisual(px)
        const ready = px >= PULL_THRESHOLD
        if (ready !== d.pullReady) { d.pullReady = ready; setPullReady(ready) }
        return
      }
      c.scrollTop = d.start - dy
    },
    onPointerUp: (e) => {
      const d = drag.current
      drag.current = null
      const c = containerRef.current
      if (!d || d.id !== e.pointerId || !c) return
      const i = activeRef.current
      const dy = e.clientY - d.y
      const h = c.clientHeight

      if (d.pulling) {
        setPulling(false); setPullReady(false)
        c.style.scrollSnapType = ''
        if (d.pull >= PULL_THRESHOLD) onRefreshRef.current?.()
        return
      }
      if (!d.moved) {
        c.style.scrollSnapType = ''
        // نقرة: أولاً تشغيل الصوت إن كان مكتوماً، وبعدها إيقاف/تشغيل
        const frame = framesRef.current[i]
        if (mutedRef.current) toggleSoundRef.current()
        else { sendToPlayer(frame, pausedRef.current ? 'play' : 'pause'); setPaused(!pausedRef.current) }
        return
      }
      // الانتقال حسب المسافة أو سرعة السحب
      let next = i
      if (dy < -h * SWIPE_DISTANCE || d.v < -SWIPE_VELOCITY) next = i + 1
      else if (dy > h * SWIPE_DISTANCE || d.v > SWIPE_VELOCITY) next = i - 1
      next = Math.max(0, Math.min(videosRef.current.length - 1, next))
      scrollTo(next)
      // إعادة الالتصاق بعد انتهاء الحركة
      snapBackTimer.current = setTimeout(() => { c.style.scrollSnapType = '' }, 450)
    },
    onPointerCancel: () => {
      const d = drag.current
      drag.current = null
      const c = containerRef.current
      if (d?.pulling) { setPulling(false); setPullReady(false) }
      if (c) { scrollTo(activeRef.current); snapBackTimer.current = setTimeout(() => { c.style.scrollSnapType = '' }, 450) }
    },
  }), [scrollTo])

  // مراجع ثابتة لكل شريحة: memo يعمل فقط إن لم تتغير الدوال في كل رسم
  const slideRefCallbacks = useRef({})
  const frameRefCallbacks = useRef({})
  const slideRefFor = (i) => (slideRefCallbacks.current[i] ||= (el) => { slideRefs.current[i] = el })
  const frameRefFor = (i) => (frameRefCallbacks.current[i] ||= (el) => { if (el) framesRef.current[i] = el; else delete framesRef.current[i] })

  // البدء من الفيديو المختار
  useEffect(() => {
    scrollTo(startIndex, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex])

  // الفيديو الظاهر حالياً
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setActive(Number(e.target.dataset.index))
          if (Number(e.target.dataset.index) !== startIndex) setShowHint(false)
        }
      })
    }, { root: containerRef.current, threshold: 0.6 })
    slideRefs.current.slice(0, videos.length).forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [videos.length, startIndex])

  // وصلت فيديوهات جديدة في الأعلى (تحديث): يبقى الفيديو المعروض نفسه بدل أن تنزاح القائمة تحته
  const activeIdRef = useRef(videos[active]?.id)
  useEffect(() => {
    const id = activeIdRef.current
    const idx = id ? videos.findIndex(v => v.id === id) : -1
    if (idx >= 0 && idx !== activeRef.current) {
      setActive(idx)
      requestAnimationFrame(() => scrollTo(idx, false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos])
  useEffect(() => { activeIdRef.current = videos[active]?.id }, [active, videos])

  // قفل تمرير الصفحة + لوحة المفاتيح + زر الرجوع
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onPop = () => { closingRef.current = true; onClose() }
    if (!standalone) {
      window.history.pushState({ tiktokViewer: true }, '')
      window.addEventListener('popstate', onPop)
    }

    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); scrollTo(activeRef.current + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); scrollTo(activeRef.current - 1) }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      clearTimeout(snapBackTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // الإغلاق بالزر يرجع خطوة في السجل (يزيل الحالة التي أضفناها)
  function handleClose() {
    if (standalone) { onClose(); return }
    if (closingRef.current) return
    closingRef.current = true
    window.history.back()
  }

  // تحميل المزيد قبل الوصول لآخر فيديو
  useEffect(() => {
    if (onNearEnd && videos.length > 0 && active >= videos.length - 3) onNearEnd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, videos.length])

  return (
    <div className="fixed inset-0 z-[70] bg-black" role="dialog" aria-modal="true" aria-label="فيديوهات TikTok">
      {/* الشريط العلوي */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={handleClose} aria-label="إغلاق"
          className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
          <X size={22} />
        </button>
        {title && <span className="text-white font-bold text-lg">{title}</span>}
        {!standalone && <span className="text-xs text-white/70" dir="ltr">{active + 1} / {videos.length}</span>}
        {/* تنبيه الصوت أعلى الشاشة، بعيداً عن منطقة السحب */}
        {muted && (
          <button onClick={toggleSound}
            className="mr-auto flex items-center gap-1.5 h-9 px-3.5 whitespace-nowrap rounded-full bg-white text-gray-900 text-xs font-bold shadow-lg">
            <VolumeX size={16} className="text-rose-500" />اضغط لتشغيل الصوت
          </button>
        )}
      </div>

      {/* الفيديوهات */}
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar overscroll-contain">
        {videos.map((v, i) => {
          const dist = Math.abs(i - active)
          return (
            <Slide key={v.id} video={v} index={i}
              active={i === active}
              near={dist <= 2}
              loadPlayer={i === active || (neighborsOn && dist === 1)}
              paused={i === active && paused}
              gestures={gestures}
              setSlideRef={slideRefFor(i)}
              setFrameRef={frameRefFor(i)} />
          )
        })}
      </div>

      {/* أزرار التنقل (مهمة على الكمبيوتر، ومفيدة على الهاتف) */}
      <div className="flex absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex-col gap-2 sm:gap-3">
        {active === 0 && onRefresh ? (
          <button onClick={onRefresh} disabled={refreshing} aria-label="تحديث"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/35 sm:bg-white/15 text-white flex items-center justify-center hover:bg-white/25">
            <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
          </button>
        ) : (
          <button onClick={() => scrollTo(active - 1)} disabled={active === 0} aria-label="الفيديو السابق"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/35 sm:bg-white/15 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0">
            <ChevronUp size={26} />
          </button>
        )}
        <button onClick={() => scrollTo(active + 1)} disabled={active === videos.length - 1} aria-label="الفيديو التالي"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/35 sm:bg-white/15 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0">
          <ChevronDown size={26} />
        </button>
      </div>

      {/* زر الصوت، يسار الشاشة */}
      <div className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4">
        <button onClick={toggleSound} aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className="flex flex-col items-center gap-1 text-white">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center ${muted ? 'bg-rose-500' : 'bg-black/35 sm:bg-white/15 hover:bg-white/25'}`}>
            {muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
          </span>
          <span className="text-[11px] font-medium drop-shadow">{muted ? 'تشغيل الصوت' : 'الصوت'}</span>
        </button>
      </div>

      {/* مؤشر السحب للتحديث: يُحرَّك مباشرة أثناء السحب بلا إعادة رسم */}
      {(pulling || refreshing) && (
        <div className="absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] inset-x-0 z-30 flex justify-center pointer-events-none">
          <span ref={pullRef} style={refreshing ? { transform: 'translateY(24px)', opacity: 1 } : undefined}
            className="flex items-center gap-2 h-10 px-4 rounded-full bg-white text-gray-900 text-sm font-bold shadow-xl">
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-primary' : pullReady ? 'text-primary' : 'text-gray-400'} />
            {refreshing ? 'جاري جلب الجديد...' : pullReady ? 'أفلت للتحديث' : 'اسحب للتحديث'}
          </span>
        </div>
      )}

      {/* تلميح السحب، يختفي بعد أول انتقال */}
      {showHint && (
        <div className="sm:hidden absolute bottom-28 inset-x-0 z-20 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium">
            اسحب للأعلى للفيديو التالي
          </span>
        </div>
      )}
    </div>
  )
}

export default TikTokFeedViewer
