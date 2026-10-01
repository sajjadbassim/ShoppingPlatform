// src/pages/vendor/VendorSocialAccounts.jsx
// ربط حسابات التواصل الاجتماعي للمتجر — تيك توك (API: /api/tiktok)
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Link2, Unlink, CheckCircle2, ShieldCheck, Eye, EyeOff, Video, Users, Play,
  RefreshCw, X, Package, ExternalLink, Search, AlertTriangle, Settings2,
} from 'lucide-react'
import { useToast } from '../../components/common/Toast'
import { Toggle } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useAuthStore } from '../../stores/authStore'
import { apiGet, apiPatch, apiPut, apiPost, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getPrimaryImage } from '../../utils/imageHelper'
import TikTokLogo, { usernameFromVideos } from '../../components/tiktok/TikTokLogo'
import TikTokFeedViewer from '../../components/tiktok/TikTokFeedViewer'
import { ReelsGrid, ReelTile } from '../../components/tiktok/ReelsGrid'

const PERMISSIONS = [
  { icon: Users, text: 'قراءة اسم الحساب والصورة' },
  { icon: Video, text: 'عرض الفيديوهات المنشورة للعامة' },
  { icon: Eye, text: 'قراءة عدد المشاهدات والإعجابات' },
]

// أسباب فشل الربط القادمة من الخادم (?tiktok=error&reason=...)
const CONNECT_ERRORS = {
  denied: 'تم إلغاء الربط من صفحة تيك توك',
  expired: 'انتهت مهلة الربط، حاول مرة أخرى',
  invalid_state: 'تعذّر التحقق من طلب الربط، حاول مرة أخرى من نفس المتصفح',
  token: 'رفض تيك توك طلب الربط، حاول لاحقاً',
}

const compact = (n) => n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)
const unwrap = (r) => r.data?.data ?? r.data

// ===========================
// نافذة الموافقة على الربط
// ===========================
const ConnectModal = ({ onClose, onConfirm, connecting }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={connecting ? undefined : onClose} />
    <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up">
      <div className="bg-black p-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-2xl">🏪</span>
          <Link2 className="text-white/60" />
          <span className="w-14 h-14 rounded-2xl bg-gray-900 ring-1 ring-white/20 flex items-center justify-center">
            <TikTokLogo className="w-8 h-8" />
          </span>
        </div>
        <h2 className="text-lg font-bold text-white mt-4">ربط متجرك مع TikTok</h2>
        <p className="text-sm text-white/70 mt-1">سيتم تحويلك إلى TikTok لتسجيل الدخول والموافقة</p>
      </div>

      <div className="p-5">
        <p className="text-sm font-bold text-gray-900 mb-3">ستتمكن منصة واسط من:</p>
        <ul className="space-y-2.5">
          {PERMISSIONS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Icon size={16} /></span>
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-green-50 rounded-xl p-3">
          <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
          لن ننشر أي شيء على حسابك، ولن نطّلع على رسائلك أو كلمة المرور. يمكنك إلغاء الربط في أي وقت.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={onClose} disabled={connecting}
            className="h-12 rounded-full border border-gray-300 text-gray-700 font-bold disabled:opacity-50">
            إلغاء
          </button>
          <button onClick={onConfirm} disabled={connecting}
            className="h-12 rounded-full bg-black text-white font-bold flex items-center justify-center gap-2 disabled:opacity-80">
            {connecting ? <><RefreshCw size={16} className="animate-spin" />جاري التحويل...</> : <><TikTokLogo className="w-5 h-5" />متابعة</>}
          </button>
        </div>
      </div>
    </div>
  </div>
)

// ===========================
// نافذة ربط فيديو بمنتج
// ===========================
const LinkProductModal = ({ video, vendorId, onClose, onSave, saving }) => {
  const [query, setQuery] = useState('')
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: async () => {
      const data = unwrap(await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId)))
      return Array.isArray(data) ? data : data?.items || []
    },
    enabled: !!vendorId,
  })
  const q = query.trim()
  const list = products.filter(p => p.isActive !== false && (!q || (p.nameAr || p.name || '').includes(q)))
  const current = video.product?.id

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">ربط الفيديو بمنتج</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={16} /></button>
        </div>
        {video.title && <p className="text-sm text-gray-500 mb-3 line-clamp-1">«{video.title}»</p>}
        <div className="relative mb-3">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في منتجاتك..."
            className="w-full h-11 pr-9 pl-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {isLoading
            ? [1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)
            : list.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">لا توجد منتجات مطابقة</p>
              : list.map(p => {
                const img = getPrimaryImage(p)
                return (
                  <button key={p.id} onClick={() => onSave({ productId: p.id })} disabled={saving}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-right disabled:opacity-60 ${current === p.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-500" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{p.nameAr || p.name}</span>
                      <span className="block text-xs text-gray-500">{p.price?.toLocaleString()} د.ع</span>
                    </span>
                    {current === p.id && <CheckCircle2 size={18} className="text-primary flex-shrink-0" />}
                  </button>
                )
              })}
        </div>
        {current && (
          <button onClick={() => onSave({ removeProduct: true })} disabled={saving}
            className="w-full mt-3 h-10 text-sm text-red-500 font-medium">إزالة الربط</button>
        )}
      </div>
    </div>
  )
}

// ===========================
// أدوات العرض
// ===========================
const timeAgo = (date) => {
  if (!date) return null
  const min = Math.round((Date.now() - new Date(date).getTime()) / 60000)
  // صيغ العدد في العربية: دقيقة، دقيقتين، 3–10 دقائق، 11+ دقيقة
  const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`
  if (min < 1) return 'الآن'
  if (min < 60) return `منذ ${plural(min, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`
  const h = Math.round(min / 60)
  if (h < 24) return `منذ ${plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`
  return new Date(date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })
}

// المنصات القادمة — تظهر كصفوف مختصرة في نفس القائمة
const UPCOMING = [
  { name: 'Instagram', color: 'from-amber-400 via-pink-500 to-purple-600', letter: 'IG' },
  { name: 'Facebook', color: 'from-blue-500 to-blue-700', letter: 'f' },
  { name: 'YouTube', color: 'from-red-500 to-red-700', letter: '▶' },
  { name: 'Snapchat', color: 'from-yellow-300 to-yellow-400', letter: '👻' },
]

const StatusDot = ({ tone, children }) => {
  const tones = {
    ok: 'bg-green-50 text-green-700',
    warn: 'bg-amber-50 text-amber-800',
    muted: 'bg-gray-100 text-gray-500',
  }
  const dots = { ok: 'bg-green-500', warn: 'bg-amber-500', muted: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${tones[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[tone]}`} />{children}
    </span>
  )
}

// ===========================
// صف حساب تيك توك في قائمة الحسابات
// ===========================
const TikTokRow = ({ status, videos, onConnect, onOpen, onSync, syncing }) => {
  const connected = !!status?.connected
  const account = status?.account
  const username = account?.username || usernameFromVideos(videos)

  if (!connected) {
    return (
      <div className="flex items-center gap-3 p-4">
        <span className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center flex-shrink-0">
          <TikTokLogo className="w-7 h-7" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">TikTok</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">فيديوهاتك تظهر في متجرك وفي صفحة ريلز، مع زر «اشترِ الآن»</p>
        </div>
        {status?.configured
          ? <button onClick={onConnect} className="h-10 px-5 rounded-full bg-black text-white text-sm font-bold inline-flex items-center gap-1.5 flex-shrink-0">
              <Link2 size={15} />ربط
            </button>
          : <StatusDot tone="muted">غير مفعّل</StatusDot>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-4">
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-right">
        <span className="relative flex-shrink-0">
          <span className="w-12 h-12 rounded-full bg-gray-900 overflow-hidden flex items-center justify-center">
            {account?.avatarUrl
              ? <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              : <TikTokLogo className="w-7 h-7" />}
          </span>
          <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-black ring-2 ring-white flex items-center justify-center">
            <TikTokLogo className="w-3 h-3" />
          </span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-gray-900 truncate">
            {account?.displayName || 'TikTok'}
            {username && <span className="font-normal text-xs text-gray-400 mr-1.5 hidden sm:inline" dir="ltr">@{username}</span>}
          </span>
          <span className="flex items-center gap-2 mt-1 min-w-0">
            {status.needsReconnect
              ? <StatusDot tone="warn">يحتاج إعادة ربط</StatusDot>
              : status.settings?.showOnStore ? <StatusDot tone="ok">ظاهر</StatusDot> : <StatusDot tone="muted">مخفي</StatusDot>}
            <span className="text-xs text-gray-500 truncate">
              {videos.length} فيديو · {timeAgo(status.lastSyncedAt) || '—'}
            </span>
          </span>
        </span>
      </button>
      <button onClick={onSync} disabled={syncing || status.needsReconnect} aria-label="مزامنة الآن" title="مزامنة الآن"
        className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40">
        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
      </button>
      <button onClick={onOpen} aria-label="إعدادات الحساب" title="الإعدادات"
        className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
        <Settings2 size={18} />
      </button>
    </div>
  )
}

// ===========================
// نافذة تفاصيل وإعدادات الحساب
// ===========================
const AccountSheet = ({ status, videos, onClose, onToggle, savingSettings, onSync, syncing, onReconnect, onDisconnect, disconnecting }) => {
  const account = status.account
  const settings = status.settings
  const username = account?.username || usernameFromVideos(videos)
  const stats = [
    { label: 'متابع', value: account?.followerCount },
    { label: 'إعجاب', value: account?.likesCount },
    { label: 'فيديو', value: account?.videoCount ?? videos.length },
  ].filter(s => s.value != null)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl animate-slide-up pb-[env(safe-area-inset-bottom)]">
        {/* رأس */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <span className="w-14 h-14 rounded-full bg-gray-900 overflow-hidden flex items-center justify-center flex-shrink-0">
            {account?.avatarUrl
              ? <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              : <TikTokLogo className="w-8 h-8" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{account?.displayName || 'حساب TikTok'}</p>
            {username && <p className="text-sm text-gray-500" dir="ltr">@{username}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {status.needsReconnect && (
            <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 rounded-2xl p-3">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">انتهت صلاحية الربط ولم تعد الفيديوهات تتحدث.</span>
              <button onClick={onReconnect} disabled={!status.configured} className="text-sm font-bold underline disabled:opacity-50">إعادة الربط</button>
            </div>
          )}

          {stats.length > 0 && (
            <div className="flex divide-x divide-x-reverse divide-gray-100 rounded-2xl bg-gray-50 py-3">
              {stats.map(s => (
                <div key={s.label} className="flex-1 text-center">
                  <p className="font-bold text-gray-900" dir="ltr">{compact(s.value)}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* الإعدادات */}
          <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {[
              { key: 'showOnStore', title: 'عرض الفيديوهات في المتجر وصفحة ريلز' },
              { key: 'autoShowNewVideos', title: 'إظهار الفيديوهات الجديدة تلقائياً', desc: 'عند الإيقاف: الجديد يبقى مخفياً حتى تُظهره' },
            ].map(({ key, title, desc }) => (
              <label key={key} className="flex items-center gap-3 p-3.5 cursor-pointer">
                <span className="flex-1">
                  <span className="block text-sm font-medium text-gray-900">{title}</span>
                  {desc && <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>}
                </span>
                <Toggle checked={!!settings?.[key]} disabled={savingSettings} onChange={e => onToggle({ [key]: e.target.checked })} />
              </label>
            ))}
          </div>

          {/* المزامنة */}
          <div className="rounded-2xl bg-gray-50 p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900">آخر مزامنة: {timeAgo(status.lastSyncedAt) || 'لم تتم بعد'}</span>
                <span className="block text-xs text-gray-500 mt-0.5">تلقائياً كل 15 دقيقة، وعند فتح متجرك أو صفحة ريلز</span>
              </span>
              <button onClick={onSync} disabled={syncing || status.needsReconnect}
                className="h-9 px-3.5 rounded-full bg-white border border-gray-200 text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />مزامنة
              </button>
            </div>
            {status.lastSyncError && !status.needsReconnect && (
              <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} />تعذّرت آخر مزامنة، ستُعاد المحاولة تلقائياً</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>مربوط منذ {new Date(status.connectedAt).toLocaleDateString('ar-IQ')}</span>
            <a href="https://www.tiktok.com/legal/page/global/privacy-policy/ar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-600">
              سياسة خصوصية TikTok <ExternalLink size={11} />
            </a>
          </div>

          <button onClick={onDisconnect} disabled={disconnecting}
            className="w-full h-11 rounded-full border border-red-200 text-red-600 text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-red-50 disabled:opacity-50">
            <Unlink size={15} />إلغاء ربط الحساب
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================
// الصفحة
// ===========================
const VendorSocialAccounts = () => {
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId
  const [showConnect, setShowConnect] = useState(false)
  const [linkingVideo, setLinkingVideo] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [actionVideo, setActionVideo] = useState(null)
  const [showAccount, setShowAccount] = useState(false)
  const [filter, setFilter] = useState('all')

  const { data: status, isLoading: statusLoading, isError: statusError } = useQuery({
    queryKey: ['tiktok-status'],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.TIKTOK.STATUS)),
  })
  const connected = !!status?.connected

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['tiktok-videos'],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.TIKTOK.VIDEOS)) || [],
    enabled: connected,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tiktok-status'] })
    queryClient.invalidateQueries({ queryKey: ['tiktok-videos'] })
  }

  // نتيجة العودة من تيك توك (مرة واحدة — StrictMode يشغّل التأثير مرتين في التطوير)
  const handledResult = useRef(false)
  useEffect(() => {
    const result = searchParams.get('tiktok')
    if (!result || handledResult.current) return
    handledResult.current = true
    if (result === 'connected') success('تم ربط حساب TikTok بنجاح 🎉')
    else showError(CONNECT_ERRORS[searchParams.get('reason')] || 'تعذّر ربط حساب TikTok')
    setSearchParams({}, { replace: true })
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // الخطوة 1: الخادم يعطي رابط التفويض ويضع كوكي التحقق، ثم ينتقل المتصفح لتيك توك
  const connectMutation = useMutation({
    mutationFn: async () => unwrap(await apiGet(API_ENDPOINTS.TIKTOK.CONNECT_URL)),
    onSuccess: (data) => window.location.assign(data.authorizeUrl),
    onError: (err) => { setShowConnect(false); showError(err.message || 'تعذّر بدء الربط') },
  })

  const syncMutation = useMutation({
    mutationFn: async () => unwrap(await apiPost(API_ENDPOINTS.TIKTOK.SYNC)),
    onSuccess: () => { success('تمت مزامنة الفيديوهات'); refresh() },
    onError: (err) => { showError(err.message || 'تعذّرت المزامنة'); refresh() },
  })

  const settingsMutation = useMutation({
    mutationFn: async (patch) => unwrap(await apiPut(API_ENDPOINTS.TIKTOK.SETTINGS, patch)),
    onSuccess: (settings) => queryClient.setQueryData(['tiktok-status'], (s) => s && { ...s, settings }),
    onError: (err) => showError(err.message || 'تعذّر حفظ الإعداد'),
  })

  const videoMutation = useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await apiPatch(API_ENDPOINTS.TIKTOK.VIDEO(id), patch)),
    onSuccess: (updated) => queryClient.setQueryData(['tiktok-videos'], (list = []) => list.map(v => v.id === updated.id ? updated : v)),
    onError: (err) => showError(err.message || 'تعذّر تحديث الفيديو'),
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => apiDelete(API_ENDPOINTS.TIKTOK.CONNECTION),
    onSuccess: () => { success('تم إلغاء ربط حساب TikTok'); setShowAccount(false); queryClient.removeQueries({ queryKey: ['tiktok-videos'] }); refresh() },
    onError: (err) => showError(err.message || 'تعذّر إلغاء الربط'),
  })

  const handleDisconnect = () => {
    if (confirm('هل تريد إلغاء ربط حساب TikTok؟ ستختفي الفيديوهات من صفحة متجرك.')) disconnectMutation.mutate()
  }

  const account = status?.account
  const hiddenCount = videos.filter(v => v.isHidden).length
  const linkedCount = videos.filter(v => v.product).length
  const filters = [
    { key: 'all', label: 'الكل', count: videos.length },
    { key: 'visible', label: 'ظاهر', count: videos.length - hiddenCount },
    { key: 'hidden', label: 'مخفي', count: hiddenCount },
    { key: 'linked', label: 'مربوط بمنتج', count: linkedCount },
  ]
  const shownVideos = videos.filter(v =>
    filter === 'visible' ? !v.isHidden : filter === 'hidden' ? v.isHidden : filter === 'linked' ? !!v.product : true)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* العنوان */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ربط حسابات التواصل</h1>
        <p className="text-sm text-gray-500 mt-1">اعرض فيديوهاتك داخل متجرك واربط كل فيديو بمنتجه</p>
      </div>

      {/* الحسابات — صف واحد لكل منصة */}
      <section>
        <h2 className="text-sm font-bold text-gray-500 mb-2">الحسابات</h2>
        {statusLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : statusError ? (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
            <AlertTriangle size={18} />تعذّر تحميل حالة الربط، حدّث الصفحة وحاول مرة أخرى
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            <TikTokRow status={status} videos={videos}
              onConnect={() => setShowConnect(true)}
              onOpen={() => setShowAccount(true)}
              onSync={() => syncMutation.mutate()} syncing={syncMutation.isPending} />
            {UPCOMING.map(p => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-3 opacity-70">
                <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${p.color} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}>{p.letter}</span>
                <span className="flex-1 text-sm font-medium text-gray-700" dir="ltr">{p.name}</span>
                <StatusDot tone="muted">قريباً</StatusDot>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* الفيديوهات — من الحسابات المربوطة */}
      {connected && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex-1">الفيديوهات</h2>
            <span className="text-xs text-gray-400 hidden sm:inline">اضغط على فيديو لتشغيله أو ربطه بمنتج أو إخفائه</span>
          </div>

          {videos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 -mx-1 px-1">
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors ${filter === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  {f.label}
                  <span className={`text-[11px] px-1.5 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{f.count}</span>
                </button>
              ))}
            </div>
          )}

          {videosLoading ? (
            <ReelsGrid className="rounded-2xl overflow-hidden">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-none" />)}
            </ReelsGrid>
          ) : videos.length === 0 ? (
            <div className="text-center text-sm text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 py-10">
              <Video size={28} className="mx-auto mb-2 text-gray-300" />
              لا توجد فيديوهات بعد — انشر فيديو على TikTok وسيظهر هنا تلقائياً
            </div>
          ) : shownVideos.length === 0 ? (
            <p className="text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 py-8">لا توجد فيديوهات في هذا التصنيف</p>
          ) : (
            <ReelsGrid className="rounded-2xl overflow-hidden">
              {shownVideos.map(v => (
                <ReelTile key={v.id} video={v} dimmed={v.isHidden} onClick={() => setActionVideo(v)} />
              ))}
            </ReelsGrid>
          )}
        </section>
      )}

      {showAccount && connected && (
        <AccountSheet status={status} videos={videos}
          onClose={() => setShowAccount(false)}
          onToggle={(patch) => settingsMutation.mutate(patch)} savingSettings={settingsMutation.isPending}
          onSync={() => syncMutation.mutate()} syncing={syncMutation.isPending}
          onReconnect={() => { setShowAccount(false); setShowConnect(true) }}
          onDisconnect={handleDisconnect} disconnecting={disconnectMutation.isPending} />
      )}

      {showConnect && (
        <ConnectModal onClose={() => setShowConnect(false)} onConfirm={() => connectMutation.mutate()} connecting={connectMutation.isPending || connectMutation.isSuccess} />
      )}
      {actionVideo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setActionVideo(null)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]">
            <div className="flex gap-3 p-4 border-b border-gray-100">
              <div className="w-16 flex-shrink-0 rounded-xl overflow-hidden"><ReelTile video={actionVideo} onClick={() => {}} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-3">{actionVideo.title || 'فيديو بدون عنوان'}</p>
                {actionVideo.product && (
                  <p className="mt-1 text-xs text-primary font-medium truncate">🛍️ {actionVideo.product.nameAr || actionVideo.product.name}</p>
                )}
              </div>
            </div>
            {[
              { icon: Play, label: 'تشغيل الفيديو', onClick: () => { setViewerIndex(videos.findIndex(v => v.id === actionVideo.id)); setActionVideo(null) } },
              { icon: Package, label: actionVideo.product ? 'تغيير المنتج المربوط' : 'ربط بمنتج', onClick: () => { setLinkingVideo(actionVideo); setActionVideo(null) } },
              {
                icon: actionVideo.isHidden ? Eye : EyeOff,
                label: actionVideo.isHidden ? 'إظهار في المتجر' : 'إخفاء من المتجر',
                onClick: () => { videoMutation.mutate({ id: actionVideo.id, patch: { isHidden: !actionVideo.isHidden } }); setActionVideo(null) },
              },
            ].map(({ icon: Icon, label, onClick }) => (
              <button key={label} onClick={onClick}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100">
                <Icon size={19} className="text-gray-500" />{label}
              </button>
            ))}
            {actionVideo.shareUrl && (
              <a href={actionVideo.shareUrl} target="_blank" rel="noopener noreferrer" onClick={() => setActionVideo(null)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                <ExternalLink size={19} className="text-gray-500" />فتح في TikTok
              </a>
            )}
            <button onClick={() => setActionVideo(null)} className="w-full py-3.5 text-sm font-bold text-gray-500 border-t border-gray-100">إلغاء</button>
          </div>
        </div>
      )}
      {viewerIndex !== null && (
        <TikTokFeedViewer videos={videos} startIndex={viewerIndex} account={account} onClose={() => setViewerIndex(null)} />
      )}
      {linkingVideo && (
        <LinkProductModal video={linkingVideo} vendorId={vendorId} saving={videoMutation.isPending}
          onClose={() => setLinkingVideo(null)}
          onSave={(patch) => videoMutation.mutate({ id: linkingVideo.id, patch }, {
            onSuccess: (updated) => {
              setLinkingVideo(null)
              success(updated.product ? `تم ربط الفيديو بـ «${updated.product.nameAr || updated.product.name}»` : 'تمت إزالة الربط')
            },
          })} />
      )}
    </div>
  )
}

export default VendorSocialAccounts
