// src/pages/vendor/VendorPublish.jsx
// نشر منتج على حسابات التواصل المربوطة: التاجر يختار الحسابات والصور والنص، يرى شكل المنشور على كل منصة،
// ثم يؤكد النشر بنفسه. النشر الفعلي على إنستغرام (API: /api/integrations/instagram/posts) وتيك توك (API: /api/tiktok/posts)، وفيسبوك قريباً
import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, CalendarClock, Check, ExternalLink, AlertTriangle, RefreshCw, RotateCcw, Info, CheckCircle2, Clock,
  Heart, MessageCircle, Bookmark, Share2, Music, Globe, ThumbsUp, Plus, Image as ImageIcon, Play, X,
} from 'lucide-react'
import api, { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import { useToast } from '../../components/common/Toast'
import { Skeleton } from '../../components/common/Loading'
import InstagramLogo from '../../components/social/InstagramLogo'
import TikTokLogo from '../../components/tiktok/TikTokLogo'
import FacebookLogo from '../../components/social/FacebookLogo'

const unwrap = (r) => r.data?.data ?? r.data
const MAX_IMAGES = 10
const MAX_CAPTION = 2200
const MAX_HASHTAGS = 30
const countHashtags = (s) => (s.match(/#[\p{L}\p{N}_]+/gu) || []).length

const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const formatDate = (d) => new Date(d).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })
const formatDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

// المنصات تختصر النص الطويل بـ «… المزيد» — القص بالأسطر لا بـ line-clamp (الإيموجي تُظهر نصف سطر)
const shortCaption = (text, maxLines, maxChars) => {
  const lines = text.split('\n')
  if (lines.length <= maxLines && text.length <= maxChars) return text
  return <>{lines.slice(0, maxLines).join('\n').slice(0, maxChars).trimEnd()}… <span className="text-gray-500">المزيد</span></>
}

// مدة الفيديو قبل رفعه (null إن لم يستطع المتصفح قراءته)
const readVideoDuration = (file) => new Promise(resolve => {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  const done = (value) => { URL.revokeObjectURL(url); resolve(value) }
  v.preload = 'metadata'
  v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null)
  v.onerror = () => done(null)
  setTimeout(() => done(null), 8000)
  v.src = url
})

// صور تُسحب أفقياً مع مؤشر الصفحة
const useSwipe = (count) => {
  const ref = useRef(null)
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex(0); ref.current?.scrollTo({ left: 0 }) }, [count])
  const onScroll = (e) => setIndex(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))
  return { ref, index, onScroll }
}

// الوسائط: صور المنتج، أو صور وفيديو يرفعها التاجر من الاستوديو
const isVideo = (url) => /\.(mp4|mov)(\?|$)/i.test(url || '')
const MAX_VIDEO_MB = 100
const MAX_IMAGE_MB = 15
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'

// صورة أو فيديو (المعاينات تشغّل الفيديو صامتاً ومتكرراً كما تعرضه المنصات)
const MediaView = ({ src, className, play = true }) => isVideo(src)
  ? <video src={getImageUrl(src)} className={className} muted playsInline loop autoPlay={play} preload="metadata" />
  : <img src={getImageUrl(src)} alt="" className={className} />

const Avatar = ({ src, Logo, className = 'w-8 h-8' }) => (
  <span className={`${className} rounded-full bg-gray-900 overflow-hidden flex items-center justify-center flex-shrink-0`}>
    {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <Logo className="w-1/2 h-1/2" />}
  </span>
)

// ===========================
// المعاينات — شكل المنشور على كل منصة
// ===========================
const InstagramPreview = ({ account, images, caption }) => {
  const { ref, index, onScroll } = useSwipe(images.length)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-gray-900">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar src={account.avatarUrl} Logo={InstagramLogo} />
        <span className="text-sm font-bold flex-1 truncate" dir="ltr">{account.username}</span>
        {images.length > 1 && <span className="text-xs text-gray-500" dir="ltr">{index + 1}/{images.length}</span>}
      </div>
      <div ref={ref} onScroll={onScroll} dir="ltr" className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
        {images.map(src => isVideo(src) ? (
          // الفيديو المنفرد ريلز (طولي)، وداخل الألبوم بإطار الألبوم
          <div key={src} className={`relative w-full flex-shrink-0 snap-center bg-black flex items-center justify-center ${images.length === 1 ? 'aspect-[4/5]' : 'aspect-square'}`}>
            <MediaView src={src} className="w-full h-full object-contain" />
            {images.length === 1 && <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">Reels</span>}
          </div>
        ) : (
          // الخادم يجهز الصورة مربعاً أبيض بهامش 6% — المعاينة تطابقه
          <div key={src} className="w-full flex-shrink-0 snap-center aspect-square bg-white flex items-center justify-center p-[6%]">
            <MediaView src={src} className="max-w-full max-h-full object-contain" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-3 pt-2.5" dir="ltr">
        <Heart size={22} /><MessageCircle size={22} /><Send size={21} />
        <span className="flex-1 flex justify-center gap-1">
          {images.length > 1 && images.map((src, i) => <span key={src} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-blue-500' : 'bg-gray-300'}`} />)}
        </span>
        <Bookmark size={22} />
      </div>
      <p className="px-3 py-2.5 text-sm whitespace-pre-line break-words">
        <span className="font-bold ml-1" dir="ltr">{account.username}</span>{shortCaption(caption, 2, 125)}
      </p>
    </div>
  )
}

const TikTokPreview = ({ account, images, caption }) => {
  const { ref, index, onScroll } = useSwipe(images.length)
  return (
    <div className="relative bg-black rounded-2xl overflow-hidden aspect-[9/16] max-h-[620px] mx-auto text-white">
      <div ref={ref} onScroll={onScroll} dir="ltr" className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
        {images.map(src => (
          // تيك توك يعرض الصورة بعرض الشاشة على خلفية سوداء
          <div key={src} className="w-full h-full flex-shrink-0 snap-center bg-black flex items-center justify-center">
            <MediaView src={src} className="w-full max-h-full object-contain" />
          </div>
        ))}
      </div>
      {/* أعلى: تبويبات تيك توك */}
      <div className="absolute top-0 inset-x-0 pt-3 pb-8 bg-gradient-to-b from-black/50 to-transparent flex justify-center gap-4 text-sm font-bold pointer-events-none" dir="ltr">
        <span className="opacity-60">Following</span><span className="border-b-2 border-white pb-0.5">For You</span>
      </div>
      {/* يمين: الأزرار */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 pointer-events-none" dir="ltr">
        <span className="relative mb-1">
          <Avatar src={account.avatarUrl} Logo={TikTokLogo} className="w-11 h-11 ring-2 ring-white" />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] flex items-center justify-center"><Plus size={13} strokeWidth={3} /></span>
        </span>
        {[[Heart, '0'], [MessageCircle, '0'], [Bookmark, '0'], [Share2, '0']].map(([Icon, n], i) => (
          <span key={i} className="flex flex-col items-center text-[11px] font-bold drop-shadow">
            <Icon size={28} fill={i === 0 || i === 2 ? 'white' : 'none'} />{n}
          </span>
        ))}
      </div>
      {/* أسفل: الحساب والنص */}
      <div className="absolute bottom-0 inset-x-0 pt-16 pb-4 px-3 pr-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        {images.length > 1 && (
          <div className="flex justify-center gap-1 mb-3" dir="ltr">
            {images.map((src, i) => <span key={src} className={`h-1 rounded-full ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />)}
          </div>
        )}
        <p className="font-bold text-sm" dir="ltr">@{account.username}</p>
        <p className="text-[13px] mt-1 line-clamp-2 whitespace-pre-line break-words" dir="auto">{caption}</p>
        <p className="text-xs mt-2 flex items-center gap-1.5 opacity-90" dir="ltr"><Music size={12} />original sound - {account.username}</p>
      </div>
      {images.length > 1 && (
        <span className="absolute top-12 left-3 text-[11px] font-bold bg-black/50 rounded px-1.5 py-0.5 flex items-center gap-1 pointer-events-none" dir="ltr">
          <ImageIcon size={12} />{index + 1}/{images.length}
        </span>
      )}
    </div>
  )
}

const FacebookPreview = ({ account, images, caption }) => {
  const shown = images.slice(0, images.length > 4 ? 4 : images.length)
  const extra = images.length - shown.length
  const [expanded, setExpanded] = useState(false)
  // فيسبوك يختصر النص الطويل بـ «عرض المزيد» — القص بالأسطر لا بـ line-clamp (الإيموجي تُظهر نصف سطر)
  const lines = caption.split('\n')
  const long = caption.length > 180 || lines.length > 4
  const short = lines.slice(0, 4).join('\n').slice(0, 180).trimEnd()
  const grid = shown.length === 1 ? 'grid-cols-1' : shown.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-gray-900">
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar src={account.avatarUrl} Logo={FacebookLogo} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{account.name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">الآن · <Globe size={11} /></p>
        </div>
      </div>
      <p className="px-3 py-2.5 text-sm whitespace-pre-line break-words">
        {long && !expanded
          ? <>{short}… <button type="button" onClick={() => setExpanded(true)} className="font-bold text-gray-500">عرض المزيد</button></>
          : caption}
      </p>
      <div className={`grid ${grid} gap-0.5 bg-white`}>
        {shown.map((src, i) => (
          <div key={src} className={`relative bg-white flex items-center justify-center ${shown.length === 1 ? 'aspect-square' : shown.length === 3 && i === 0 ? 'row-span-2' : 'aspect-square'}`}>
            {isVideo(src)
              ? <MediaView src={src} className="w-full h-full object-cover bg-black" />
              : <MediaView src={src} className="w-full h-full object-contain p-[4%]" />}
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 bg-black/45 text-white text-3xl font-bold flex items-center justify-center">+{extra}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-[#0866FF] flex items-center justify-center"><ThumbsUp size={9} className="text-white" fill="white" /></span>0
        </span>
        <span>0 تعليق · 0 مشاركة</span>
      </div>
      <div className="grid grid-cols-3 text-sm font-medium text-gray-600 py-1">
        {[[ThumbsUp, 'أعجبني'], [MessageCircle, 'تعليق'], [Share2, 'مشاركة']].map(([Icon, label]) => (
          <span key={label} className="flex items-center justify-center gap-1.5 py-1.5"><Icon size={17} />{label}</span>
        ))}
      </div>
    </div>
  )
}

// ===========================
// المنصات: حالة كل حساب وهل يمكن النشر عليه الآن
// ===========================
const buildPlatforms = (ig, tiktok, facebook, store) => {
  let igState = 'ready'
  if (!ig.publishingEnabled) igState = 'disabled'
  else if (!ig.connected) igState = 'connect'
  else if (ig.needsReconnect || !ig.canPublish) igState = 'reconnect'

  let tkState = 'ready'
  if (!tiktok) tkState = 'soon'
  else if (!tiktok.publishingEnabled) tkState = 'disabled'
  else if (!tiktok.connected) tkState = 'connect'
  else if (tiktok.needsReconnect || !tiktok.canPublish) tkState = 'reconnect'

  const tk = tiktok?.account
  return [
    {
      key: 'instagram', name: 'Instagram', Logo: InstagramLogo, Preview: InstagramPreview, state: igState,
      account: { username: ig.username || 'your_account', name: ig.username, avatarUrl: ig.profilePictureUrl },
      connected: ig.connected,
      hint: {
        ready: ig.quotaTotal != null ? `${ig.quotaUsage}/${ig.quotaTotal} منشور اليوم` : 'صور أو فيديو (ريلز)، حتى 10 عناصر',
        disabled: 'النشر غير مفعّل على المنصة بعد',
        connect: 'غير مربوط',
        reconnect: ig.needsReconnect ? 'انتهت صلاحية الربط' : 'أعد الربط لمنح صلاحية النشر',
      }[igState],
    },
    {
      key: 'tiktok', name: 'TikTok', Logo: TikTokLogo, Preview: TikTokPreview, state: tkState,
      // اسم المستخدم يحتاج صلاحية user.info.profile — بدونها نعرض اسم الحساب الظاهر
      account: { username: tk?.username || tk?.displayName || 'your_account', name: tk?.displayName, avatarUrl: tk?.avatarUrl },
      connected: !!tiktok?.connected,
      hint: {
        ready: 'فيديو واحد أو صور (حتى 35) — النشر الآن فقط',
        soon: 'جارٍ التحميل…',
        disabled: 'النشر غير مفعّل على المنصة بعد',
        connect: 'غير مربوط',
        reconnect: tiktok?.needsReconnect ? 'انتهت صلاحية الربط' : 'أعد الربط لمنح صلاحية النشر',
      }[tkState],
    },
    {
      // الربط متاح (عرض منشورات الصفحة في المتجر) — النشر من المنصة على الصفحة لم يُبنَ بعد
      key: 'facebook', name: 'Facebook', Logo: FacebookLogo, Preview: FacebookPreview,
      state: facebook?.configured && !facebook?.connected ? 'connect' : 'soon',
      account: facebook?.connected
        ? { username: facebook.account?.username || facebook.account?.name, name: facebook.account?.name, avatarUrl: facebook.account?.pictureUrl }
        : { username: store.name, name: store.name || 'صفحة متجرك', avatarUrl: store.logo ? getImageUrl(store.logo) : null },
      connected: !!facebook?.connected,
      hint: facebook?.connected ? 'النشر على فيسبوك قريباً' : facebook?.configured ? 'غير مربوط' : 'ربط صفحة فيسبوك قريباً',
    },
  ]
}

// ===========================
// صف حساب: اختيار للنشر أو إجراء مطلوب
// ===========================
const AccountOption = ({ p, selected, onToggle }) => {
  const ready = p.state === 'ready'
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition ${selected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white'} ${ready ? 'cursor-pointer' : ''}`}
      onClick={ready ? onToggle : undefined} role={ready ? 'checkbox' : undefined} aria-checked={ready ? selected : undefined}>
      <span className="relative flex-shrink-0">
        {p.connected
          ? <Avatar src={p.account.avatarUrl} Logo={p.Logo} className="w-11 h-11" />
          : <span className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center"><p.Logo className="w-6 h-6" /></span>}
        {p.connected && p.account.avatarUrl && (
          <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-black ring-2 ring-white flex items-center justify-center"><p.Logo className="w-3 h-3" /></span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-900 truncate">
          {p.name}{p.connected && p.account.username && <span className="font-normal text-gray-500 mr-1.5" dir="ltr">@{p.account.username}</span>}
        </span>
        <span className={`block text-xs mt-0.5 ${p.state === 'reconnect' ? 'text-amber-700' : 'text-gray-500'}`}>{p.hint}</span>
      </span>
      {ready ? (
        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300'}`}>
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
      ) : p.state === 'connect' || p.state === 'reconnect' ? (
        <Link to={`/vendor/social?connect=${p.key}`} onClick={e => e.stopPropagation()}
          className="h-8 px-3 rounded-full bg-black text-white text-xs font-bold inline-flex items-center flex-shrink-0">
          {p.state === 'connect' ? 'ربط' : 'إعادة الربط'}
        </Link>
      ) : (
        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">قريباً</span>
      )}
    </div>
  )
}

// ===========================
// النشر الفعلي لكل منصة — إضافة منصة جديدة = سطر هنا + state: 'ready' في buildPlatforms
// النشر الآن يتم داخل الطلب (تجهيز الصور + انتظار المنصة) فقد يتجاوز المهلة الافتراضية
// ===========================
// create يستقبل (الحمولة المشتركة، إعدادات تيك توك) — لكل منصة شكل طلبها
const PUBLISHERS = {
  instagram: {
    create: async (body) => unwrap(await api.post(API_ENDPOINTS.INSTAGRAM.POSTS, body, { timeout: 120000 })),
    retry: async (postId) => unwrap(await api.post(API_ENDPOINTS.INSTAGRAM.POST_RETRY(postId), {}, { timeout: 120000 })),
    invalidate: [['instagram-posts'], ['instagram-items']],
  },
  tiktok: {
    create: async (body, tt) => unwrap(await api.post(API_ENDPOINTS.TIKTOK.POSTS, {
      productId: body.productId,
      media: body.images,
      caption: body.caption,
      privacyLevel: tt.privacy,
      allowComment: tt.comment,
      allowDuet: tt.duet,
      allowStitch: tt.stitch,
      promotesOwnBusiness: tt.promotes,
      consent: tt.consent,
    }, { timeout: 120000 })),
    retry: async (postId) => unwrap(await api.post(API_ENDPOINTS.TIKTOK.POST_RETRY(postId), {}, { timeout: 120000 })),
    invalidate: [['tiktok-posts'], ['tiktok-videos'], ['tiktok-items'], ['tiktok-status']],
  },
}

const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: 'الجميع',
  MUTUAL_FOLLOW_FRIENDS: 'الأصدقاء (متابعة متبادلة)',
  FOLLOWER_OF_CREATOR: 'متابعوك',
  SELF_ONLY: 'أنا فقط',
}

// إعدادات تيك توك: الخصوصية بلا قيمة افتراضية (اشتراط تيك توك)، والتفاعل يحدده التاجر
const TikTokSettings = ({ options, settings, onChange, isVideoPost, durationTooLong }) => {
  const privacyOptions = options?.privacyOptions || []
  const onlyPrivate = privacyOptions.length > 0 && privacyOptions.every(o => o === 'SELF_ONLY')
  const toggles = [
    { key: 'comment', label: 'السماح بالتعليقات', disabled: options?.commentDisabled },
    { key: 'duet', label: 'السماح بالدويت', disabled: options?.duetDisabled, videoOnly: true },
    { key: 'stitch', label: 'السماح بالستيتش', disabled: options?.stitchDisabled, videoOnly: true },
  ].filter(t => !t.videoOnly || isVideoPost)

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TikTokLogo className="w-5 h-5" />
        <h2 className="font-bold text-gray-900 flex-1">إعدادات تيك توك</h2>
        {options?.nickname && <span className="text-xs text-gray-500 truncate max-w-[50%]" dir="ltr">{options.nickname}</span>}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 mb-2">من يستطيع مشاهدة المنشور؟ <span className="text-red-500">*</span></p>
        {privacyOptions.length === 0
          ? <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3">تعذّر جلب خيارات الخصوصية من تيك توك — حدّث الصفحة وحاول مرة أخرى</p>
          : (
            <div className="grid grid-cols-2 gap-2">
              {privacyOptions.map(o => (
                <button key={o} type="button" onClick={() => onChange({ privacy: o })} aria-pressed={settings.privacy === o}
                  className={`h-11 rounded-xl border text-sm font-bold ${settings.privacy === o ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700'}`}>
                  {PRIVACY_LABELS[o] || o}
                </button>
              ))}
            </div>
          )}
        {onlyPrivate && (
          <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3 mt-2 flex items-start gap-1.5">
            <Info size={14} className="flex-shrink-0 mt-0.5" />النشر عبر المنصة يظهر الآن لك وحدك فقط، حتى يعتمد تيك توك تطبيق واسط.
          </p>
        )}
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {toggles.map(t => (
          <label key={t.key} className={`flex items-center gap-3 p-3 ${t.disabled ? 'opacity-50' : 'cursor-pointer'}`}>
            <span className="flex-1 text-sm text-gray-900">{t.label}{t.disabled && <span className="text-xs text-gray-500 mr-1.5">(معطّل في حسابك)</span>}</span>
            <input type="checkbox" className="w-5 h-5 accent-black" disabled={t.disabled}
              checked={!!settings[t.key] && !t.disabled} onChange={e => onChange({ [t.key]: e.target.checked })} />
          </label>
        ))}
        <label className="flex items-center gap-3 p-3 cursor-pointer">
          <span className="flex-1">
            <span className="block text-sm text-gray-900">هذا المنشور يروّج لمتجري ومنتجاتي</span>
            <span className="block text-xs text-gray-500 mt-0.5">يظهر على المنشور وسم «ترويج» (محتوى تجاري)</span>
          </span>
          <input type="checkbox" className="w-5 h-5 accent-black" checked={!!settings.promotes} onChange={e => onChange({ promotes: e.target.checked })} />
        </label>
      </div>

      {durationTooLong && (
        <p className="text-xs text-red-600">مدة الفيديو أطول من الحد المسموح لحسابك في تيك توك ({options.maxVideoDurationSeconds} ثانية)</p>
      )}

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5 flex-shrink-0" checked={!!settings.consent} onChange={e => onChange({ consent: e.target.checked })} />
        <span className="text-xs text-gray-600 leading-relaxed">
          أوافق على نشر هذا المحتوى على حسابي في تيك توك، وأقرّ بموافقتي على{' '}
          <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" className="underline text-gray-900">تأكيد استخدام الموسيقى</a>
          {settings.promotes && <>{' '}و<a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer" className="underline text-gray-900">سياسة المحتوى التجاري</a></>}
          {' '}من تيك توك.
        </span>
      </label>
    </section>
  )
}

// ===========================
// نتيجة النشر لكل منصة
// ===========================
const ResultRow = ({ platform, post, onRetry, retrying }) => {
  const published = post.status === 'PUBLISHED'
  const failed = post.status === 'FAILED'   // رفضته المنصة، أو فشل الطلب نفسه (requestFailed)
  const delayed = !published && !failed && post.error
  const processing = post.status === 'PUBLISHING'
  return (
    <div className="flex items-start gap-3 p-4">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${published ? 'bg-green-50 text-green-600' : failed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
        {published ? <CheckCircle2 size={22} /> : failed ? <AlertTriangle size={20} /> : <Clock size={20} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 flex items-center gap-1.5">
          <platform.Logo className="w-4 h-4" />{platform.name}
          <span className="font-normal text-sm text-gray-500" dir="ltr">@{platform.account.username}</span>
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          {published ? (platform.key === 'tiktok'
              ? (post.privacyLevel === 'SELF_ONLY' ? 'تم النشر على تيك توك بخصوصية «أنا فقط» — تجده في حسابك' : 'تم النشر على تيك توك')
              : 'تم النشر، وظهر في صفحة متجرك مربوطاً بالمنتج')
            : failed ? post.error
            : processing ? 'تيك توك يعالج المنشور — سيظهر على حسابك خلال دقائق، ويمكنك متابعته من سجل المنشورات'
            : delayed ? post.error
            : `مجدول — يُنشر تلقائياً في ${formatDate(post.scheduledAt)}`}
        </p>
        <div className="flex gap-3 mt-2">
          {published && post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-900 inline-flex items-center gap-1">
              <ExternalLink size={14} />عرض المنشور
            </a>
          )}
          {failed && (
            <button onClick={onRetry} disabled={retrying} className="text-sm font-bold text-gray-900 inline-flex items-center gap-1 disabled:opacity-50">
              <RotateCcw size={14} className={retrying ? 'animate-spin' : ''} />إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ===========================
// الصفحة
// ===========================
const VendorPublish = () => {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { error: showError } = useToast()

  const { data: ig, isLoading, isError, refetch } = useQuery({
    queryKey: ['publish-options', id],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.INSTAGRAM.PUBLISH_OPTIONS, { productId: id })),
  })
  const { data: tiktok } = useQuery({
    queryKey: ['tiktok-status'],
    // يُعاد عند الفشل كبقية الطلبات: إعادة تشغيل الخادم لحظة فتح الصفحة كانت تُظهر الحساب كأنه غير مربوط
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.TIKTOK.STATUS)),
  })
  const { data: facebook } = useQuery({
    queryKey: ['facebook-status'],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.FACEBOOK.STATUS)),
  })
  // خيارات حساب تيك توك (الخصوصية والتفاعل) — تُجلب من تيك توك نفسه، فلا تُطلب إلا لحساب جاهز للنشر
  const tiktokReady = !!(tiktok?.publishingEnabled && tiktok.connected && tiktok.canPublish && !tiktok.needsReconnect)
  const { data: tiktokOptions } = useQuery({
    queryKey: ['tiktok-publish-options', id],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.TIKTOK.PUBLISH_OPTIONS, { productId: id })),
    enabled: tiktokReady,
    staleTime: 60 * 1000,
  })

  const [targets, setTargets] = useState([])
  const [previewKey, setPreviewKey] = useState(null)
  const [selected, setSelected] = useState([])
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState('now')
  const [scheduleAt, setScheduleAt] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [results, setResults] = useState(null)   // { instagram: post, ... }
  const [uploads, setUploads] = useState([])       // روابط ما رفعه التاجر من الاستوديو
  const [uploading, setUploading] = useState([])   // [{ id, name, preview, video, progress }]
  const [durations, setDurations] = useState({})   // رابط الفيديو ← مدته بالثواني
  // إعدادات تيك توك — الخصوصية فارغة عمداً: يختارها التاجر بنفسه
  const [tt, setTt] = useState({ privacy: '', comment: false, duet: false, stitch: false, promotes: true, consent: false })
  const patchTt = (patch) => setTt(s => ({ ...s, ...patch }))
  const fileInput = useRef(null)

  const platforms = ig ? buildPlatforms(ig, tiktok, facebook, { name: ig.storeName, logo: ig.storeLogoUrl }) : []
  const byKey = Object.fromEntries(platforms.map(p => [p.key, p]))
  // الحسابات التي يمكن النشر عليها الآن
  const readyKeys = platforms.filter(p => p.state === 'ready' && PUBLISHERS[p.key]).map(p => p.key)
  const allSelected = readyKeys.length > 0 && readyKeys.every(k => targets.includes(k))

  // البداية: الصورة الرئيسية + النص المقترح
  useEffect(() => {
    if (!ig) return
    setSelected(ig.images.slice(0, 1))
    setCaption(ig.suggestedCaption || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ig?.productId])

  // كل الحسابات الجاهزة محددة افتراضياً (تُعاد عند تغيّرها — حالة منصة قد تصل متأخرة)
  const readySignature = readyKeys.join()
  useEffect(() => {
    if (!ig) return
    setTargets(readyKeys)
    setPreviewKey(k => (k && byKey[k] && readyKeys.includes(k)) ? k : readyKeys[0] || 'instagram')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ig?.productId, readySignature])

  const toggleTarget = (key) => setTargets(t => {
    const next = t.includes(key) ? t.filter(k => k !== key) : [...t, key]
    if (!t.includes(key)) setPreviewKey(key)
    return next
  })
  const toggleAll = () => setTargets(allSelected ? [] : readyKeys)
  const toggleImage = (src) => setSelected(list =>
    list.includes(src) ? list.filter(s => s !== src) : list.length >= MAX_IMAGES ? list : [...list, src])

  // ===== الإضافة من الاستوديو =====
  const patchUploading = (uid, patch) => setUploading(list => list.map(u => u.id === uid ? { ...u, ...patch } : u))

  const addFiles = async (files) => {
    for (const file of files) {
      const video = file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name)
      const image = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
      if (!video && !image) { showError(`«${file.name}»: الصيغ المقبولة صور JPG/PNG/WebP أو فيديو MP4/MOV`); continue }
      if (file.size > (video ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024) {
        showError(video ? `الفيديو أكبر من ${MAX_VIDEO_MB} ميغابايت` : `الصورة أكبر من ${MAX_IMAGE_MB} ميغابايت`); continue
      }
      const duration = video ? await readVideoDuration(file) : null
      // بعض المتصفحات لا تقرأ مدة HEVC — نتجاوز الفحص وإنستغرام يتحقق
      if (duration && (duration < 3 || duration > 900)) { showError('مدة الفيديو يجب أن تكون بين 3 ثوانٍ و15 دقيقة'); continue }

      const uid = `${Date.now()}-${Math.random()}`
      const preview = URL.createObjectURL(file)
      setUploading(list => [...list, { id: uid, name: file.name, preview, video, progress: 0 }])
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = unwrap(await api.post(API_ENDPOINTS.SOCIAL.PUBLISH_UPLOAD, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 10 * 60 * 1000,
          onUploadProgress: (e) => e.total && patchUploading(uid, { progress: Math.round((e.loaded / e.total) * 100) }),
        }))
        setUploads(list => [...list, res.url])
        if (duration) setDurations(d => ({ ...d, [res.url]: duration }))
        setSelected(list => list.length >= MAX_IMAGES ? list : [...list, res.url])
      } catch (err) {
        showError(err.message || `تعذّر رفع «${file.name}»`)
      } finally {
        setUploading(list => list.filter(u => u.id !== uid))
        URL.revokeObjectURL(preview)
      }
    }
  }

  const removeUpload = (url) => {
    setUploads(list => list.filter(u => u !== url))
    setSelected(list => list.filter(u => u !== url))
  }

  const body = () => ({
    productId: id,
    images: selected,
    caption: caption.trim(),
    scheduledAt: mode === 'schedule' ? new Date(scheduleAt).toISOString() : null,
  })

  const invalidate = (keys) => keys.forEach(k => PUBLISHERS[k]?.invalidate.forEach(queryKey => queryClient.invalidateQueries({ queryKey })))
  // فشل الطلب نفسه (تحقق، شبكة) يُعرض كنتيجة فاشلة لتلك المنصة فقط
  const requestFailure = (err) => ({ status: 'FAILED', requestFailed: true, error: err?.message || 'تعذّر الإرسال' })

  const publish = useMutation({
    // كل منصة بطلب مستقل وبالتوازي — فشل منصة لا يُلغي النشر على الباقي
    mutationFn: async () => {
      const payload = body()
      const settled = await Promise.allSettled(targets.map(k => PUBLISHERS[k].create(payload, tt)))
      return Object.fromEntries(targets.map((k, i) => [k, settled[i].status === 'fulfilled' ? settled[i].value : requestFailure(settled[i].reason)]))
    },
    onSuccess: (out) => {
      setConfirming(false)
      setResults(out)
      invalidate(Object.keys(out))
    },
    onError: (err) => { setConfirming(false); showError(err.message || 'تعذّر النشر') },
  })

  const retry = useMutation({
    // منشور رفضته المنصة: إعادة محاولته. طلب لم يصل أصلاً: إرساله من جديد
    mutationFn: async (key) => {
      const post = results[key]
      try {
        return post.requestFailed ? await PUBLISHERS[key].create(body(), tt) : await PUBLISHERS[key].retry(post.id)
      } catch (err) {
        return requestFailure(err)
      }
    },
    onSuccess: (post, key) => { setResults(r => ({ ...r, [key]: post })); invalidate([key]) },
  })

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-gray-900">نشر المنتج</h1>
        {ig?.productName && <p className="text-xs text-gray-500 truncate">{ig.productName}</p>}
      </div>
    </div>
  )

  if (isLoading) return (
    <div className="max-w-5xl mx-auto">{header}
      <div className="grid lg:grid-cols-2 gap-5"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
    </div>
  )

  if (isError || !ig) return (
    <div className="max-w-2xl mx-auto">{header}
      <div className="rounded-2xl p-5 bg-amber-50 text-amber-900">
        <p className="font-bold flex items-center gap-2"><AlertTriangle size={18} />تعذّر تحميل المنتج</p>
        <p className="text-sm mt-1">تأكد أن المنتج موجود في متجرك ثم حاول مرة أخرى.</p>
        <button onClick={() => refetch()} className="mt-4 h-10 px-4 rounded-full bg-white border border-amber-200 text-sm font-bold inline-flex items-center gap-1.5"><RefreshCw size={15} />إعادة المحاولة</button>
      </div>
    </div>
  )

  if (results) {
    const entries = Object.entries(results)
    const ok = entries.filter(([, p]) => p.status !== 'FAILED').length
    return (
    <div className="max-w-2xl mx-auto">{header}
      {entries.length > 1 && (
        <p className={`mb-3 text-sm font-bold rounded-xl p-3 ${ok === entries.length ? 'bg-green-50 text-green-800' : ok === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-900'}`}>
          {ok === entries.length ? `تم على كل الحسابات (${ok})` : ok === 0 ? 'تعذّر النشر على كل الحسابات' : `تم على ${ok} من ${entries.length} حسابات — أعد المحاولة للباقي`}
        </p>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {entries.map(([key, post]) => (
          <ResultRow key={key} platform={byKey[key]} post={post} onRetry={() => retry.mutate(key)}
            retrying={retry.isPending && retry.variables === key} />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Link to="/vendor/social#instagram-posts" className="sm:flex-1 h-11 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-700 inline-flex items-center justify-center">سجل المنشورات</Link>
        <Link to="/vendor/products" className="sm:flex-1 h-11 rounded-full bg-black text-white text-sm font-bold inline-flex items-center justify-center">العودة للمنتجات</Link>
      </div>
    </div>
    )
  }

  const library = [...ig.images, ...uploads]
  const longAlbumVideo = selected.length > 1 && selected.some(u => isVideo(u) && durations[u] > 60)
  const kind = selected.length > 1 ? `ألبوم من ${selected.length} عناصر` : isVideo(selected[0]) ? 'فيديو (ريلز)' : 'صورة واحدة'

  const preview = byKey[previewKey] || platforms[0]
  const hashtags = countHashtags(caption)
  const now = new Date()
  const maxDate = new Date(now.getTime() + 30 * 86400000)
  const scheduleInvalid = mode === 'schedule' && (!scheduleAt || new Date(scheduleAt) <= now || new Date(scheduleAt) > maxDate)
  // قيود تيك توك: فيديو واحد أو صور فقط، النشر الآن، الخصوصية والإقرار من التاجر
  const tiktokOn = targets.includes('tiktok')
  const selectedVideos = selected.filter(isVideo)
  const tiktokMixed = tiktokOn && selectedVideos.length > 0 && selected.length > 1
  const tiktokMaxDuration = tiktokOptions?.maxVideoDurationSeconds
  const tiktokTooLong = tiktokOn && selectedVideos.length === 1 && tiktokMaxDuration > 0 && durations[selectedVideos[0]] > tiktokMaxDuration
  const errors = [
    // لا حساب جاهز أصلاً: "اختر حساباً" مضلل — نوجّه للربط
    targets.length === 0 && (readyKeys.length === 0
      ? 'لا يوجد حساب جاهز للنشر بعد — اربط حساب إنستغرام من الأعلى'
      : 'اختر حساباً واحداً على الأقل للنشر'),
    selected.length === 0 && 'اختر صورة أو فيديو واحداً على الأقل',
    uploading.length > 0 && 'انتظر اكتمال الرفع',
    longAlbumVideo && 'الفيديو داخل الألبوم حتى 60 ثانية — أو انشره وحده كريلز',
    !caption.trim() && 'اكتب نص المنشور',
    caption.length > MAX_CAPTION && `النص أطول من ${MAX_CAPTION} حرف`,
    hashtags > MAX_HASHTAGS && `الوسوم أكثر من ${MAX_HASHTAGS}`,
    scheduleInvalid && 'اختر موعداً خلال 30 يوماً القادمة',
    tiktokOn && mode === 'schedule' && 'تيك توك لا يدعم الجدولة — انشر الآن أو ألغِ تحديد تيك توك',
    tiktokMixed && 'تيك توك يقبل فيديو واحداً أو صوراً فقط — لا خلط بينهما',
    tiktokTooLong && `الفيديو أطول من حد حسابك في تيك توك (${tiktokMaxDuration} ثانية)`,
    tiktokOn && !tt.privacy && 'اختر من يستطيع مشاهدة المنشور على تيك توك',
    tiktokOn && !tt.consent && 'وافق على نشر المحتوى على حسابك في تيك توك',
  ].filter(Boolean)
  const chosen = targets.map(k => byKey[k])
  const publishLabel = mode === 'schedule'
    ? (targets.length > 1 ? `جدولة على ${targets.length} حسابات` : 'جدولة المنشور')
    : allSelected && readyKeys.length > 1 ? `نشر على كل الحسابات (${targets.length})`
    : targets.length > 1 ? `نشر على ${targets.length} حسابات`
    : chosen[0] ? `نشر على ${chosen[0].name}` : 'نشر'

  const PublishButton = ({ className }) => (
    <button type="button" onClick={() => setConfirming(true)} disabled={errors.length > 0}
      className={`bg-black text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 ${className}`}>
      {mode === 'now' ? <Send size={17} /> : <CalendarClock size={17} />}{publishLabel}
    </button>
  )

  return (
    <div className="max-w-5xl mx-auto pb-28 lg:pb-6">
      {header}

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* الحسابات */}
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">انشر على</h2>
              {readyKeys.length > 0 && (
                <button type="button" onClick={toggleAll} aria-pressed={allSelected}
                  className={`h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${allSelected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
                  {allSelected && <Check size={13} strokeWidth={3} />}كل الحسابات المربوطة ({readyKeys.length})
                </button>
              )}
            </div>
            <div className="space-y-2">
              {platforms.map(p => <AccountOption key={p.key} p={p} selected={targets.includes(p.key)} onToggle={() => toggleTarget(p.key)} />)}
            </div>
          </section>

          {/* الصور والفيديو: صور المنتج + ما يضيفه التاجر من الاستوديو */}
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-bold text-gray-900">الصور والفيديو</h2>
              <span className="text-xs text-gray-500">{selected.length}/{MAX_IMAGES} · الترتيب حسب اختيارك</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {/* الإضافة من الاستوديو */}
              <button type="button" onClick={() => fileInput.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-800 flex flex-col items-center justify-center gap-1 text-[11px] font-bold leading-tight text-center px-1">
                <Plus size={22} />من الاستوديو
                <span className="font-normal text-[10px] text-gray-400">صورة أو فيديو</span>
              </button>
              <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden
                onChange={e => { addFiles([...e.target.files]); e.target.value = '' }} />

              {library.map(src => {
                const order = selected.indexOf(src)
                const on = order >= 0
                const video = isVideo(src)
                const uploaded = uploads.includes(src)
                return (
                  <div key={src} className="relative">
                    <button type="button" onClick={() => toggleImage(src)} aria-pressed={on}
                      className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 transition ${video ? 'bg-black' : 'bg-white'} ${on ? 'border-blue-500' : 'border-gray-100 opacity-70 hover:opacity-100'}`}>
                      <MediaView src={src} play={false} className={`w-full h-full ${video ? 'object-cover' : 'object-contain'}`} />
                      {video && (
                        <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/60 rounded px-1 flex items-center gap-0.5" dir="ltr">
                          <Play size={9} fill="white" />{durations[src] ? formatDuration(durations[src]) : ''}
                        </span>
                      )}
                      <span className={`absolute top-1 right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${on ? 'bg-blue-500 text-white' : 'bg-white/90 border border-gray-300'}`}>
                        {on ? order + 1 : ''}
                      </span>
                    </button>
                    {uploaded && (
                      <button type="button" onClick={() => removeUpload(src)} aria-label="إزالة"
                        className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center ring-2 ring-white">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })}

              {/* قيد الرفع */}
              {uploading.map(u => (
                <div key={u.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-900">
                  {u.video
                    ? <video src={u.preview} muted playsInline preload="metadata" className="w-full h-full object-cover opacity-50" />
                    : <img src={u.preview} alt="" className="w-full h-full object-cover opacity-50" />}
                  <span className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                    <RefreshCw size={16} className="animate-spin" />{u.progress}%
                  </span>
                  <span className="absolute bottom-0 inset-x-0 h-1 bg-white/20"><span className="block h-full bg-blue-500 transition-all" style={{ width: `${u.progress}%` }} /></span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selected.length > 1 ? `سيُنشر كألبوم من ${selected.length} عناصر`
                : isVideo(selected[0]) ? 'فيديو واحد يُنشر ريلز على إنستغرام'
                : 'أضف صوراً أو فيديو من هاتفك — فيديو MP4/MOV حتى 100 ميغابايت'}
            </p>
          </section>

          {/* النص */}
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-900">نص المنشور</h2>
              {caption !== ig.suggestedCaption && (
                <button type="button" onClick={() => setCaption(ig.suggestedCaption)} className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
                  <RotateCcw size={12} />النص المقترح
                </button>
              )}
            </div>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={8} maxLength={MAX_CAPTION + 200}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y" />
            <div className="flex justify-between text-xs mt-1.5">
              <span className={hashtags > MAX_HASHTAGS ? 'text-red-600 font-bold' : 'text-gray-500'}>الوسوم # : {hashtags}/{MAX_HASHTAGS}</span>
              <span className={caption.length > MAX_CAPTION ? 'text-red-600 font-bold' : 'text-gray-500'} dir="ltr">{caption.length}/{MAX_CAPTION}</span>
            </div>
          </section>

          {tiktokOn && (
            <TikTokSettings options={tiktokOptions} settings={tt} onChange={patchTt}
              isVideoPost={selectedVideos.length > 0} durationTooLong={tiktokTooLong} />
          )}

          {/* الموعد */}
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-bold text-gray-900 mb-3">موعد النشر</h2>
            <div className="grid grid-cols-2 gap-2">
              {[{ key: 'now', label: 'الآن', icon: Send }, { key: 'schedule', label: 'جدولة', icon: CalendarClock }].map(o => (
                <button key={o.key} type="button" onClick={() => { setMode(o.key); if (o.key === 'schedule' && !scheduleAt) setScheduleAt(toLocalInput(new Date(Date.now() + 3600000))) }}
                  className={`h-11 rounded-xl border text-sm font-bold inline-flex items-center justify-center gap-1.5 ${mode === o.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'}`}>
                  <o.icon size={16} />{o.label}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <div className="mt-3">
                <input type="datetime-local" value={scheduleAt} min={toLocalInput(new Date(now.getTime() + 5 * 60000))} max={toLocalInput(maxDate)}
                  onChange={e => setScheduleAt(e.target.value)} className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm" dir="ltr" />
                <p className="text-xs text-gray-500 mt-1.5">يُنشر تلقائياً في الموعد. يمكنك إلغاؤه قبل ذلك من سجل المنشورات.</p>
              </div>
            )}
          </section>
        </div>

        {/* المعاينة — شكل المنشور على كل منصة */}
        <aside className="lg:sticky lg:top-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500">المعاينة</h2>
            <div className="flex gap-1 bg-gray-100 rounded-full p-1">
              {platforms.map(p => (
                <button key={p.key} type="button" onClick={() => setPreviewKey(p.key)} aria-label={`معاينة ${p.name}`} title={p.name}
                  className={`w-9 h-8 rounded-full flex items-center justify-center transition ${preview.key === p.key ? (p.key === 'tiktok' ? 'bg-black shadow' : 'bg-white shadow') : 'opacity-60'}`}>
                  <p.Logo className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
          {selected.length === 0
            ? <div className="aspect-square rounded-2xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-400">اختر صورة أو فيديو</div>
            : <preview.Preview account={preview.account} images={selected} caption={caption} />}
          {preview.state !== 'ready' && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><Info size={13} />معاينة فقط — {preview.hint}</p>
          )}
          {errors.length > 0 && <p className="text-xs text-red-600">{errors[0]}</p>}
          <PublishButton className="hidden lg:inline-flex w-full h-12 rounded-full" />
        </aside>
      </div>

      {/* شريط ثابت — الهاتف */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {errors.length > 0 && <p className="text-xs text-red-600 mb-2 text-center">{errors[0]}</p>}
        <PublishButton className="w-full h-12 rounded-xl" />
      </div>

      {/* تأكيد صريح قبل النشر */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !publish.isPending && setConfirming(false)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-bold text-gray-900 text-center">{mode === 'now' ? 'نشر المنشور الآن؟' : 'جدولة المنشور؟'}</h3>
            <p className="text-sm text-gray-600 text-center mt-2">
              {mode === 'now' ? 'سيُنشر على:' : `سيُنشر في ${formatDate(scheduleAt)} على:`}
            </p>
            <div className="mt-3 space-y-2">
              {chosen.map(p => (
                <div key={p.key} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5">
                  <Avatar src={p.account.avatarUrl} Logo={p.Logo} className="w-8 h-8" />
                  <span className="flex-1 text-sm font-bold text-gray-900 truncate" dir="ltr">@{p.account.username}</span>
                  {p.key === 'tiktok' && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{PRIVACY_LABELS[tt.privacy] || ''}</span>}
                  {p.account.avatarUrl && <p.Logo className="w-5 h-5" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              {kind} · يمكنك حذفه لاحقاً من التطبيق
            </p>
            {publish.isPending && <p className="text-xs text-gray-500 text-center mt-2">جارٍ تجهيز الصور وإرسالها… قد يستغرق دقيقة</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirming(false)} disabled={publish.isPending} className="flex-1 h-11 rounded-full border border-gray-200 font-bold text-gray-700 disabled:opacity-50">إلغاء</button>
              <button onClick={() => publish.mutate()} disabled={publish.isPending}
                className="flex-1 h-11 rounded-full bg-black text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {publish.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {mode === 'now' ? 'نشر' : 'جدولة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorPublish
