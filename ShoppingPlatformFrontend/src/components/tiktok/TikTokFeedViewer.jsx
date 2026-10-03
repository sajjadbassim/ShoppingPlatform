import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ShoppingBag, Volume2, VolumeX, RefreshCw, Play, ExternalLink } from 'lucide-react'
import { getImageUrl } from '../../utils/imageHelper'
import InstagramLogo from '../social/InstagramLogo'

// عناصر العارض من تيك توك (مشغّل iframe) أو إنستغرام (فيديو mp4 مباشر، صورة، أو ألبوم).
// "المشغّل" = iframe تيك توك أو عنصر <video>؛ الصور والألبومات بلا مشغّل وبلا صوت
const hasPlayer = (item) => !!item && (item.platform !== 'instagram' || (item.mediaType === 'video' && !!item.videoUrl))

// مشغّل تيك توك الرسمي بلا أدواته — أدوات التحكم موحّدة لكل المنصات (ProgressBar أدناه)
const playerUrl = (video) => {
  const base = video.embedLink || `https://www.tiktok.com/player/v1/${video.externalId}`
  const url = new URL(base)
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('loop', '1')
  url.searchParams.set('rel', '0')
  url.searchParams.set('controls', '0')
  // controls=0 وحدها تُبقي بعض العناصر عند الإيقاف المؤقت (الوقت والإعدادات)
  for (const key of ['progress_bar', 'play_button', 'volume_control', 'fullscreen_button', 'timestamp'])
    url.searchParams.set(key, '0')
  url.searchParams.set('description', '0')
  url.searchParams.set('music_info', '0')
  url.searchParams.set('native_context_menu', '0')
  url.searchParams.set('closed_caption', '0')
  return url.toString()
}

// أوامر المشغّل (play, pause, mute, unMute, seekTo): لتيك توك عبر postMessage، ولفيديو إنستغرام مباشرة
const sendToPlayer = (frame, type, value) => {
  if (!frame) return
  if (frame.tagName === 'VIDEO') {
    if (type === 'mute') frame.muted = true
    else if (type === 'unMute') frame.muted = false
    else if (type === 'pause') frame.pause()
    else if (type === 'seekTo') frame.currentTime = value
    else if (type === 'play') {
      frame.play()?.catch((err) => {
        // المتصفح رفض التشغيل بالصوت: نكمل مكتوماً (volumechange يُظهر زر الصوت)
        if (err?.name === 'NotAllowedError' && !frame.muted) { frame.muted = true; frame.play().catch(() => {}) }
      })
    }
    return
  }
  frame.contentWindow?.postMessage({ type, value, 'x-tiktok-player': true }, '*')
}

const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// ===== عناصر فيديو إنستغرام =====
// على آيفون يُسمح بالصوت فقط لعنصر <video> شُغِّل بلمسة. لذلك ثلاثة عناصر ثابتة (السابق/الحالي/التالي)
// تُنقل بين الشرائح ويُبدَّل مصدرها: بعد أول لمسة للصوت تبقى "مفتوحة" ويستمر الصوت مع التمرير
const POOL_SIZE = 3
const createVideoPool = () => Array.from({ length: POOL_SIZE }, () => {
  const v = document.createElement('video')
  v.muted = true
  v.defaultMuted = true
  v.loop = true
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  v.preload = 'auto'
  v.className = 'absolute inset-0 w-full h-full object-contain'
  return v
})
const poolSlot = (i) => ((i % POOL_SIZE) + POOL_SIZE) % POOL_SIZE

// ألبوم إنستغرام: السحب أفقياً (أو الأسهم على الكمبيوتر) للتنقل بين العناصر — السحب العمودي يبقى للمتصفح
const Carousel = ({ item, active }) => {
  const [index, setIndex] = useState(0)
  const start = useRef(null)
  const children = item.children?.length ? item.children : [{ mediaType: 'image', url: item.coverImageUrl }]
  const current = children[Math.min(index, children.length - 1)]
  const go = (step) => setIndex(i => Math.max(0, Math.min(children.length - 1, i + step)))

  // RTL: العنصر التالي يأتي من اليسار، فالسحب نحو اليمين = التالي
  const swipe = {
    onPointerDown: (e) => { start.current = { x: e.clientX, y: e.clientY } },
    onPointerUp: (e) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx > 0 ? 1 : -1)
    },
    onPointerCancel: () => { start.current = null },
  }

  return (
    <div {...swipe} className="absolute inset-0 z-[6] touch-pan-y select-none">
      {current.mediaType === 'video' && active ? (
        <video key={current.url} src={current.url} poster={current.thumbnailUrl} muted autoPlay loop playsInline
          className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <img src={current.mediaType === 'video' ? current.thumbnailUrl : current.url} alt="" referrerPolicy="no-referrer" decoding="async" draggable={false}
          className="absolute inset-0 w-full h-full object-contain" />
      )}
      {children.length > 1 && (
        <>
          {/* RTL: السهم الأيمن للسابق والأيسر للتالي */}
          {index > 0 && (
            <button onClick={() => go(-1)} aria-label="السابق"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 text-gray-900 items-center justify-center shadow">
              <ChevronRight size={20} />
            </button>
          )}
          {index < children.length - 1 && (
            <button onClick={() => go(1)} aria-label="التالي"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 text-gray-900 items-center justify-center shadow">
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="absolute top-[max(4rem,calc(env(safe-area-inset-top)+3.5rem))] left-3 z-10 px-2 py-0.5 rounded-full bg-black/55 text-white text-xs font-bold pointer-events-none" dir="ltr">
            {index + 1}/{children.length}
          </span>
          <span className="absolute bottom-28 inset-x-0 z-10 flex justify-center gap-1.5 pointer-events-none" dir="ltr">
            {children.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/45'}`} />
            ))}
          </span>
        </>
      )}
    </div>
  )
}

const PULL_THRESHOLD = 70

// مشغّل تيك توك يعرض دائماً اسم صاحب الفيديو وشعار تيك توك (أعلى) وأزرار الإعجاب والتعليق والمشاركة (أسفل اليمين)،
// وشروط التضمين تمنع إخفاءها. لذلك: المشغّل يبدأ تحت شريطنا العلوي، وطبقة النقر لا تغطي أزراره فتعمل
const TIKTOK_PLAYER_HEIGHT = 'calc(100% - max(4rem, calc(env(safe-area-inset-top) + 3.25rem)))'
const TIKTOK_ACTIONS_CUTOUT = 'polygon(0 0, 100% 0, 100% 66%, calc(100% - 64px) 66%, calc(100% - 64px) 100%, 0 100%)'

/**
 * شريحة واحدة. memo: لا تُعاد رسم الشرائح البعيدة عند كل تغيير في العارض.
 * near: الشرائح القريبة فقط ترسم الغلاف والبطاقات (الصور والتأثيرات مكلفة على الهاتف).
 */
const Slide = memo(({ video, index, active, near, loadPlayer, paused, onTap, setSlideRef, setFrameRef, setHostRef }) => {
  const isInstagram = video.platform === 'instagram'
  const player = hasPlayer(video)
  return (
  <section ref={setSlideRef} data-index={index}
    className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center">
    <div className="relative h-full w-full sm:w-auto sm:aspect-[9/16] sm:max-h-[100dvh] bg-black overflow-hidden">
      {/* الغلاف يظهر فوراً إلى أن يُحمَّل المشغّل */}
      {near && player && video.coverImageUrl && (
        <img src={video.coverImageUrl} alt="" referrerPolicy="no-referrer" decoding="async"
          className={`no-dim absolute inset-0 w-full h-full ${isInstagram ? 'object-contain' : 'object-cover opacity-60'}`} />
      )}
      {loadPlayer && player && !isInstagram && (
        <iframe
          key={video.id}
          ref={setFrameRef}
          src={playerUrl(video)}
          title={video.title || 'فيديو TikTok'}
          className={`absolute inset-x-0 bottom-0 w-full border-0 ${active ? '' : 'opacity-0 pointer-events-none'}`}
          style={{ height: TIKTOK_PLAYER_HEIGHT }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        />
      )}
      {/* مكان فيديو إنستغرام: العارض ينقل إليه أحد عناصر <video> الثابتة */}
      {loadPlayer && player && isInstagram && <div ref={setHostRef} className="absolute inset-0" />}

      {/* صورة إنستغرام، أو فيديو لا يتيح إنستغرام تشغيله خارج التطبيق (موسيقى محمية) */}
      {near && isInstagram && !player && video.mediaType !== 'carousel' && video.coverImageUrl && (
        <img src={video.coverImageUrl} alt="" referrerPolicy="no-referrer" decoding="async"
          className="absolute inset-0 w-full h-full object-contain" />
      )}
      {near && isInstagram && video.mediaType === 'carousel' && <Carousel item={video} active={active} />}

      {/* طبقة النقر فوق المشغّل: النقرة للصوت ثم الإيقاف/التشغيل.
          touch-pan-y: السحب العمودي يبقى للمتصفح (تمرير طبيعي بزخم)، ومشغّل تيك توك لا يبتلع اللمس */}
      {active && player && (
        <div onClick={onTap} className="absolute inset-0 z-[5] touch-pan-y select-none cursor-pointer"
          style={isInstagram ? undefined : { clipPath: TIKTOK_ACTIONS_CUTOUT }}>
          {paused && (
            <span className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/40 text-white flex items-center justify-center pointer-events-none">
              <Play size={30} fill="currentColor" />
            </span>
          )}
        </div>
      )}

      {/* إنستغرام: الوصف ورابط المنشور الأصلي (فوق شريط التقدم) */}
      {near && isInstagram && (
        <div className="absolute bottom-0 inset-x-0 z-10 px-3 pt-8 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] bg-gradient-to-t from-black/75 to-transparent text-white pointer-events-none">
          {video.title && <p className="text-sm line-clamp-2 mb-2 drop-shadow">{video.title}</p>}
          {video.shareUrl && (
            <a href={video.shareUrl} target="_blank" rel="noopener noreferrer"
              className="pointer-events-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 text-xs font-bold">
              <InstagramLogo className="w-4 h-4" />
              {player || video.mediaType !== 'video' ? 'عرض على Instagram' : 'شاهد الفيديو على Instagram'}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* المتجر صاحب الفيديو (صفحة ريلز) */}
      {near && video.store && (
        <Link to={`/stores/${video.store.id}?tab=videos`}
          className="absolute bottom-36 sm:bottom-28 left-3 z-10 flex items-center gap-2 max-w-[65%] pr-3 p-1 rounded-full bg-black/55 text-white">
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
          className={`absolute ${isInstagram ? 'top-16' : 'top-[max(8rem,calc(env(safe-area-inset-top)+7.25rem))]'} inset-x-3 z-10 flex items-center gap-3 p-2 pl-3 rounded-2xl bg-white shadow-lg`}>
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
  )
})
Slide.displayName = 'Slide'

/**
 * شريط التقدم بأسلوب التطبيقات: رفيع، يمتلئ من اليمين (RTL)، ويُسحب للتقديم مع عرض الوقت.
 * الامتلاء يُحدَّث من العارض مباشرة عبر fillRef (60 إطاراً/ثانية بلا إعادة رسم)
 */
const ProgressBar = ({ fillRef, timeRef, scrubbingRef, onSeek }) => {
  const trackRef = useRef(null)
  const [scrub, setScrub] = useState(null) // نسبة السحب الحالية

  const ratioAt = (x) => {
    const r = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (r.right - x) / r.width))
  }
  const show = (ratio) => {
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`
    setScrub(ratio)
  }

  return (
    <div
      className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] z-20 h-7 flex items-end touch-none cursor-pointer"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); scrubbingRef.current = true; show(ratioAt(e.clientX)) }}
      onPointerMove={(e) => { if (scrubbingRef.current) show(ratioAt(e.clientX)) }}
      onPointerUp={(e) => { if (!scrubbingRef.current) return; scrubbingRef.current = false; onSeek(ratioAt(e.clientX)); setScrub(null) }}
      onPointerCancel={() => { scrubbingRef.current = false; setScrub(null) }}>
      {scrub !== null && (
        <span className="absolute bottom-10 inset-x-0 text-center text-white text-2xl font-bold drop-shadow-lg pointer-events-none" dir="ltr">
          {formatTime(scrub * timeRef.current.d)} <span className="text-white/60">/ {formatTime(timeRef.current.d)}</span>
        </span>
      )}
      <div ref={trackRef} className={`relative w-full bg-white/25 transition-[height] duration-150 ${scrub !== null ? 'h-1.5' : 'h-0.5'}`}>
        <div ref={fillRef} className="absolute inset-0 bg-white origin-right will-change-transform" style={{ transform: 'scaleX(0)' }} />
      </div>
    </div>
  )
}

/**
 * عارض بملء الشاشة بأسلوب تيك توك/ريلز: تمرير عمودي طبيعي من المتصفح، منشور واحد لكل شاشة.
 * standalone: صفحة كاملة (ريلز) بلا إضافة للسجل، والإغلاق عبر onClose.
 * onNearEnd: يُستدعى عند الاقتراب من آخر منشور لتحميل المزيد.
 * onRefresh: السحب للأسفل من أول منشور يجلب الجديد.
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
  const hostsRef = useRef({})
  const closingRef = useRef(false)
  const framesRef = useRef({})        // رقم الشريحة ← المشغّل (iframe أو <video>)
  const activeRef = useRef(active)
  activeRef.current = active
  const videosRef = useRef(videos)
  videosRef.current = videos
  const poolRef = useRef(null)
  if (!poolRef.current) poolRef.current = createVideoPool()

  // ===== الصوت =====
  // يبدأ مكتوماً. أول لمسة للصوت ترفع الكتم وتفتح عناصر الفيديو (آيفون)، وبعدها يبدأ كل فيديو بالصوت.
  // إن رفض المتصفح الصوت يكمل الفيديو مكتوماً ويظهر زر الصوت
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const mutedRef = useRef(muted); mutedRef.current = muted
  const pausedRef = useRef(paused); pausedRef.current = paused
  const bufferingRef = useRef(buffering); bufferingRef.current = buffering
  const wantSoundRef = useRef(false)
  const unlockedRef = useRef(false)
  const unmuteAtRef = useRef(0)
  const readyRef = useRef(new Set())
  // الجاران يُحمَّلان بعد جاهزية الفيديو الحالي حتى لا يتنافسا معه على الشبكة
  const [neighborsOn, setNeighborsOn] = useState(false)

  // ===== التقدم =====
  const fillRef = useRef(null)
  const timeRef = useRef({ t: 0, d: 0 })
  const scrubbingRef = useRef(false)
  const tiktokTimeRef = useRef({ t: 0, d: 0, at: 0 }) // آخر onCurrentTime من تيك توك (يُستكمل بين الرسائل)
  const seekRef = useRef({ t: 0, at: 0 })              // آخر تقديم: رسائل تيك توك القديمة بعده تُتجاهل لحظة

  // سبق للمستخدم أن لمس الصفحة (لا يشترط أن تكون اللمسة الآن — السحب الطبيعي لا يُحسب لمسة)
  const mayPlaySound = () => navigator.userActivation?.hasBeenActive ?? true

  const startPlayer = (frame) => {
    if (!frame) return
    setPaused(false)
    if (wantSoundRef.current && mayPlaySound()) {
      unmuteAtRef.current = Date.now()
      sendToPlayer(frame, 'unMute')
      sendToPlayer(frame, 'play')
    } else {
      sendToPlayer(frame, 'mute')
      sendToPlayer(frame, 'play')
      setMuted(true)
    }
  }

  // أحداث المشغّل بصيغة مشغّل تيك توك (onPlayerReady / onStateChange 1=تشغيل 2=إيقاف 3=تحميل / onMute / onCurrentTime).
  // تصل من رسائل iframe تيك توك، أو من أحداث عناصر <video> لإنستغرام
  const handlePlayerEvent = (frame, type, value) => {
    const idx = Object.keys(framesRef.current).map(Number).find(i => framesRef.current[i] === frame)
    if (idx === undefined) return
    const isActive = idx === activeRef.current

    if (type === 'onPlayerReady') {
      readyRef.current.add(frame)
      if (isActive) { startPlayer(frame); setNeighborsOn(true) }
      else { sendToPlayer(frame, 'mute'); sendToPlayer(frame, 'pause') }
    }
    // الفيديو المحمَّل مسبقاً قد يبدأ بعد انتهاء التخزين المؤقت، فيبقى متوقفاً
    if (!isActive) {
      if (type === 'onStateChange' && value === 1) sendToPlayer(frame, 'pause')
      return
    }
    if (type === 'onCurrentTime' && value) {
      const t = value.currentTime || 0
      // بعد التقديم مباشرة قد تصل رسائل بالوقت القديم — لا نُرجع الشريط إليه
      const justSeeked = performance.now() - seekRef.current.at < 1500 && Math.abs(t - seekRef.current.t) > 1.5
      if (!justSeeked) tiktokTimeRef.current = { t, d: value.duration || 0, at: performance.now() }
    }
    if (type === 'onMute') setMuted(!!value)
    if (type === 'onStateChange') {
      if (value === 1 || value === 2) { setPaused(value === 2); setBuffering(false) }
      if (value === 3) setBuffering(true)
      if (value === 1) tiktokTimeRef.current = { ...tiktokTimeRef.current, at: performance.now() }
    }
    // المتصفح رفض الصوت وأوقف الفيديو: نكمل التشغيل مكتوماً ونُظهر زر الصوت
    if (type === 'onStateChange' && value === 2 && Date.now() - unmuteAtRef.current < 2500) {
      unmuteAtRef.current = 0
      sendToPlayer(frame, 'mute')
      sendToPlayer(frame, 'play')
      setMuted(true)
    }
  }
  const handlePlayerEventRef = useRef(handlePlayerEvent); handlePlayerEventRef.current = handlePlayerEvent

  // رسائل مشغّل تيك توك
  useEffect(() => {
    const onMessage = (e) => {
      if (!/^https:\/\/([\w-]+\.)*tiktok\.com$/.test(e.origin)) return
      const data = typeof e.data === 'string' ? (() => { try { return JSON.parse(e.data) } catch { return null } })() : e.data
      if (!data?.['x-tiktok-player']) return
      const frame = Object.values(framesRef.current).find(f => f?.contentWindow === e.source)
      if (frame) handlePlayerEventRef.current(frame, data.type, data.value)
    }
    window.addEventListener('message', onMessage)
    // احتياط: إن تأخر المشغّل كثيراً نحمّل الجارين على أي حال
    const t = setTimeout(() => setNeighborsOn(true), 6000)
    return () => { window.removeEventListener('message', onMessage); clearTimeout(t) }
  }, [])

  // أحداث عناصر فيديو إنستغرام (مرة واحدة — العناصر ثابتة طوال عمر العارض)
  useEffect(() => {
    const pool = poolRef.current
    const listeners = pool.map(v => {
      const send = (type, value) => () => handlePlayerEventRef.current(v, type, typeof value === 'function' ? value() : value)
      const on = {
        // سفاري آيفون لا يحمّل بيانات الفيديو قبل play() — البيانات الوصفية تكفي كإشارة جاهزية
        loadedmetadata: send('onPlayerReady'),
        loadeddata: send('onPlayerReady'),
        play: send('onStateChange', 1),
        playing: send('onStateChange', 1),
        pause: send('onStateChange', 2),
        waiting: send('onStateChange', 3),
        volumechange: send('onMute', () => v.muted),
      }
      Object.entries(on).forEach(([k, f]) => v.addEventListener(k, f))
      return on
    })
    return () => pool.forEach((v, i) => {
      Object.entries(listeners[i]).forEach(([k, f]) => v.removeEventListener(k, f))
      v.pause()
      v.removeAttribute('src')
      v.load()
    })
  }, [])

  // توزيع عناصر الفيديو على الشريحة الحالية وجارتيها (يسبق تأثير الانتقال أدناه)
  useEffect(() => {
    const pool = poolRef.current
    const used = new Set()
    for (const i of [active, active + 1, active - 1]) {
      const item = videos[i]
      if (!item || item.platform !== 'instagram' || !hasPlayer(item)) continue
      if (i !== active && !neighborsOn) continue
      const host = hostsRef.current[i]
      if (!host) continue
      const v = pool[poolSlot(i)]
      used.add(v)
      for (const k of Object.keys(framesRef.current)) if (framesRef.current[k] === v && Number(k) !== i) delete framesRef.current[k]
      if (v.dataset.itemId !== String(item.id)) {
        readyRef.current.delete(v)
        v.pause()
        v.muted = true
        v.dataset.itemId = String(item.id)
        v.poster = item.coverImageUrl || ''
        v.src = item.videoUrl
      }
      framesRef.current[i] = v
      if (v.parentNode !== host) host.appendChild(v)
      // الحالي يبدأ فوراً (play يبدأ التحميل) بدل انتظار حدث الجاهزية
      if (i === active && v.paused) startPlayer(v)
    }
    pool.forEach(v => {
      if (used.has(v)) return
      v.pause()
      v.muted = true
      for (const k of Object.keys(framesRef.current)) if (framesRef.current[k] === v) delete framesRef.current[k]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, neighborsOn, videos])

  // عند الانتقال: السابق يُوقف ويُكتم، والجديد يعمل (بالصوت إن سبق اختياره)
  useEffect(() => {
    tiktokTimeRef.current = { t: 0, d: 0, at: 0 }
    setBuffering(false)
    Object.entries(framesRef.current).forEach(([i, f]) => {
      if (Number(i) !== active) { sendToPlayer(f, 'mute'); sendToPlayer(f, 'pause') }
    })
    const frame = framesRef.current[active]
    if (frame && readyRef.current.has(frame)) startPlayer(frame)
    // صورة أو ألبوم بلا مشغّل: لا ننتظر جاهزيته لتحميل الجارين
    if (!hasPlayer(videosRef.current[active])) setNeighborsOn(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // تقدم الفيديو الحالي: يُقرأ كل إطار ويُرسم مباشرة في الشريط
  useEffect(() => {
    let raf
    const tick = () => {
      const frame = framesRef.current[activeRef.current]
      let t = 0, d = 0
      if (frame?.tagName === 'VIDEO') {
        t = frame.currentTime
        d = Number.isFinite(frame.duration) ? frame.duration : 0
      } else if (frame) {
        const p = tiktokTimeRef.current
        d = p.d
        // رسائل تيك توك متباعدة: نكمل الحركة بينها ما دام الفيديو يعمل
        t = p.t + (p.at && !pausedRef.current && !bufferingRef.current ? (performance.now() - p.at) / 1000 : 0)
        if (d) t = d > 0 ? t % d : t
      }
      timeRef.current = { t, d }
      if (!scrubbingRef.current && fillRef.current) fillRef.current.style.transform = `scaleX(${d ? Math.min(1, t / d) : 0})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const seek = useCallback((ratio) => {
    const frame = framesRef.current[activeRef.current]
    const { d } = timeRef.current
    if (!frame || !d) return
    const t = ratio * d
    sendToPlayer(frame, 'seekTo', t)
    if (frame.tagName !== 'VIDEO') {
      tiktokTimeRef.current = { t, d, at: performance.now() }
      seekRef.current = { t, at: performance.now() }
    }
  }, [])

  // آيفون: اللمسة التي تفتح الصوت تشغّل كل عناصر الفيديو مكتومة لحظة — فتبقى مسموحاً لها بالصوت لاحقاً
  const unlockPool = () => {
    if (unlockedRef.current) return
    unlockedRef.current = true
    const current = framesRef.current[activeRef.current]
    poolRef.current.forEach(v => {
      if (v === current) return
      v.muted = true
      v.play()?.then(() => { if (v !== framesRef.current[activeRef.current]) v.pause() }).catch(() => {})
    })
  }

  const toggleSound = () => {
    const frame = framesRef.current[activeRef.current]
    if (mutedRef.current) {
      wantSoundRef.current = true
      unlockPool()
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

  // نقرة على المشغّل: أولاً تشغيل الصوت إن كان مكتوماً، وبعدها إيقاف/تشغيل
  const onTap = useCallback(() => {
    const frame = framesRef.current[activeRef.current]
    if (!frame) return
    if (mutedRef.current) { toggleSoundRef.current(); return }
    // إيقاف بطلب المستخدم: لا يُفسَّر كرفض المتصفح للصوت (منطق الاحتياط في handlePlayerEvent)
    unmuteAtRef.current = 0
    sendToPlayer(frame, pausedRef.current ? 'play' : 'pause')
    setPaused(!pausedRef.current)
  }, [])

  // ===== التمرير =====
  const scrollTo = useCallback((i, smooth = true) => {
    const c = containerRef.current
    const target = slideRefs.current[Math.max(0, Math.min(videosRef.current.length - 1, i))]
    if (!c || !target) return
    c.scrollTo({ top: target.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // ===== السحب للتحديث من أول منشور (أحداث لمس سلبية — لا تعيق التمرير الطبيعي) =====
  const pullRef = useRef(null)      // مؤشر السحب (تحديث مباشر للـ DOM بلا إعادة رسم)
  const [pullReady, setPullReady] = useState(false)
  const [pulling, setPulling] = useState(false)
  const onRefreshRef = useRef(onRefresh); onRefreshRef.current = onRefresh

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    let startY = null, pull = 0, ready = false
    const setVisual = (px) => {
      const el = pullRef.current
      if (!el) return
      el.style.transform = `translateY(${px * 0.4}px)`
      el.style.opacity = String(Math.min(1, px / PULL_THRESHOLD))
      const icon = el.querySelector('svg')
      if (icon) icon.style.transform = `rotate(${px * 3}deg)`
    }
    const reset = () => { if (pull) { setPulling(false); setPullReady(false) } pull = 0; ready = false }
    const onStart = (e) => {
      startY = activeRef.current === 0 && onRefreshRef.current && c.scrollTop <= 0 ? e.touches[0].clientY : null
      pull = 0; ready = false
    }
    const onMove = (e) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || c.scrollTop > 0) { reset(); return }
      if (!pull) setPulling(true)
      pull = Math.min(110, dy * 0.5)
      setVisual(pull)
      const r = pull >= PULL_THRESHOLD
      if (r !== ready) { ready = r; setPullReady(r) }
    }
    const onEnd = () => {
      if (startY !== null && pull >= PULL_THRESHOLD) onRefreshRef.current?.()
      startY = null
      reset()
    }
    c.addEventListener('touchstart', onStart, { passive: true })
    c.addEventListener('touchmove', onMove, { passive: true })
    c.addEventListener('touchend', onEnd, { passive: true })
    c.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      c.removeEventListener('touchstart', onStart)
      c.removeEventListener('touchmove', onMove)
      c.removeEventListener('touchend', onEnd)
      c.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // مراجع ثابتة لكل شريحة: memo يعمل فقط إن لم تتغير الدوال في كل رسم
  const slideRefCallbacks = useRef({})
  const frameRefCallbacks = useRef({})
  const hostRefCallbacks = useRef({})
  const slideRefFor = (i) => (slideRefCallbacks.current[i] ||= (el) => { slideRefs.current[i] = el })
  const frameRefFor = (i) => (frameRefCallbacks.current[i] ||= (el) => { if (el) framesRef.current[i] = el; else delete framesRef.current[i] })
  const hostRefFor = (i) => (hostRefCallbacks.current[i] ||= (el) => { if (el) hostsRef.current[i] = el; else delete hostsRef.current[i] })

  // البدء من المنشور المختار
  useEffect(() => {
    scrollTo(startIndex, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex])

  // المنشور الظاهر حالياً
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

  // وصلت منشورات جديدة في الأعلى (تحديث): يبقى المنشور المعروض نفسه بدل أن تنزاح القائمة تحته
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
      if (e.key === ' ') { e.preventDefault(); onTap() }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
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

  // تحميل المزيد قبل الوصول لآخر منشور
  useEffect(() => {
    if (onNearEnd && videos.length > 0 && active >= videos.length - 3) onNearEnd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, videos.length])

  const activeHasPlayer = hasPlayer(videos[active])

  return (
    <div className="fixed inset-0 z-[70] bg-black" role="dialog" aria-modal="true" aria-label="المنشورات">
      {/* الشريط العلوي */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <button onClick={handleClose} aria-label="إغلاق"
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
          <X size={22} />
        </button>
        {title && <span className="text-white font-bold text-lg">{title}</span>}
        {!standalone && <span className="text-xs text-white/70" dir="ltr">{active + 1} / {videos.length}</span>}
        {/* تنبيه الصوت أعلى الشاشة */}
        {muted && activeHasPlayer && (
          <button onClick={toggleSound}
            className="pointer-events-auto mr-auto flex items-center gap-1.5 h-9 px-3.5 whitespace-nowrap rounded-full bg-white text-gray-900 text-xs font-bold shadow-lg">
            <VolumeX size={16} className="text-rose-500" />اضغط لتشغيل الصوت
          </button>
        )}
      </div>

      {/* المنشورات — تمرير طبيعي من المتصفح مع الالتصاق بمنشور واحد */}
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar overscroll-contain">
        {videos.map((v, i) => {
          const dist = Math.abs(i - active)
          return (
            <Slide key={v.id} video={v} index={i}
              active={i === active}
              near={dist <= 2}
              loadPlayer={i === active || (neighborsOn && dist === 1)}
              paused={i === active && paused}
              onTap={onTap}
              setSlideRef={slideRefFor(i)}
              setFrameRef={frameRefFor(i)}
              setHostRef={hostRefFor(i)} />
          )
        })}
      </div>

      {/* مؤشر التحميل أثناء التقطيع */}
      {activeHasPlayer && buffering && !paused && (
        <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
          <span className="w-12 h-12 rounded-full border-4 border-white/25 border-t-white animate-spin" />
        </div>
      )}

      {/* شريط التقدم — للفيديو فقط */}
      {activeHasPlayer && <ProgressBar fillRef={fillRef} timeRef={timeRef} scrubbingRef={scrubbingRef} onSeek={seek} />}

      {/* أزرار التنقل — للكمبيوتر (على الهاتف يكفي السحب) */}
      <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 flex-col gap-3">
        {active === 0 && onRefresh ? (
          <button onClick={onRefresh} disabled={refreshing} aria-label="تحديث"
            className="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25">
            <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
          </button>
        ) : (
          <button onClick={() => scrollTo(active - 1)} disabled={active === 0} aria-label="السابق"
            className="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0">
            <ChevronUp size={26} />
          </button>
        )}
        <button onClick={() => scrollTo(active + 1)} disabled={active === videos.length - 1} aria-label="التالي"
          className="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0">
          <ChevronDown size={26} />
        </button>
      </div>

      {/* زر الصوت، يسار الشاشة */}
      <div className={`absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4 ${activeHasPlayer ? '' : 'hidden'}`}>
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
            اسحب للأعلى للمنشور التالي
          </span>
        </div>
      )}
    </div>
  )
}

export default TikTokFeedViewer
