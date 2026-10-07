import { useQuery } from '@tanstack/react-query'
import { Gift, Copy, Share2, Users } from 'lucide-react'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { referralLink } from '../../utils/referral'
import { useToast } from './Toast'

// ادعُ صديقاً: رمز المستخدم ورابطه، وكم صديقاً سجّل وأكمل أول طلب
const ReferralCard = () => {
  const { success } = useToast()
  const { data } = useQuery({
    queryKey: ['loyalty-referral'],
    queryFn: async () => (await apiGet(API_ENDPOINTS.LOYALTY.REFERRAL)).data.data,
    staleTime: 60 * 1000,
  })
  if (!data?.enabled || !data.code) return null
  const link = referralLink(data.code)

  const share = async () => {
    const text = `سجّل في منصة واسط برمز دعوتي ${data.code} واحصل على ${data.rewardPoints} نقطة مع أول طلب`
    if (navigator.share) {
      try { await navigator.share({ title: 'منصة واسط التجارية', text, url: link }) } catch { /* ألغى المستخدم */ }
    } else {
      await navigator.clipboard?.writeText(`${text}\n${link}`)
      success('تم نسخ رابط الدعوة')
    }
  }
  const copyCode = async () => {
    await navigator.clipboard?.writeText(data.code)
    success('تم نسخ الرمز')
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-5 relative overflow-hidden">
      <Gift className="absolute -left-4 -bottom-4 w-28 h-28 text-white/10" aria-hidden="true" />
      <h3 className="relative text-lg font-bold flex items-center gap-2"><Gift size={20} />ادعُ صديقاً واكسبا معاً</h3>
      <p className="relative text-sm text-white/85 mt-1">
        يحصل كل منكما على <b>{data.rewardPoints} نقطة</b> عند تسليم أول طلب لصديقك
      </p>
      <div className="relative mt-4 flex items-center gap-2">
        <button type="button" onClick={copyCode} aria-label="نسخ الرمز"
          className="flex-1 h-12 rounded-xl bg-white/15 border border-dashed border-white/40 font-mono text-xl font-bold tracking-widest flex items-center justify-center gap-2" dir="ltr">
          {data.code}<Copy size={16} className="opacity-80" />
        </button>
        <button type="button" onClick={share}
          className="h-12 px-4 rounded-xl bg-white text-indigo-700 font-bold flex items-center gap-1.5">
          <Share2 size={17} />مشاركة
        </button>
      </div>
      {data.invitedCount > 0 && (
        <p className="relative mt-3 text-xs text-white/85 flex items-center gap-1.5">
          <Users size={13} />سجّل برمزك {data.invitedCount} {data.invitedCount === 1 ? 'صديق' : 'أصدقاء'}
          {data.rewardedCount > 0 && <> — أكمل {data.rewardedCount} منهم أول طلب</>}
        </p>
      )}
    </div>
  )
}

export default ReferralCard
