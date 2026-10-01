// src/pages/vendor/VendorSettings.jsx
import { useState, useEffect } from 'react'
import {
  Store, Bell,
  Upload, Phone, MapPin, Clock, DollarSign, Info,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPutForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import { usePreferencesDraft } from '../../hooks/usePreferences'
import { usePublicZones, vendorUsesZones } from '../../hooks/useDeliveryZones'
import {
  SettingsSection as Section, SettingsToggle as Toggle, AppearanceSection,
} from '../../components/settings/SettingsSection'

const NOTIFICATION_KEYS = ['notifyNewOrders', 'notifyOrderConfirmations', 'notifyLowStock', 'notifyReviews']

const VendorSettings = () => {
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const { data: zonesCfg } = usePublicZones()
  const queryClient = useQueryClient()

  // ===== جلب بيانات المتجر =====
  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor-info', vendorId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDORS.BY_ID(vendorId))
      return r.data.data || r.data
    },
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
  })

  const { mutateAsync: updateVendor, isPending: saving } = useMutation({
    mutationFn: async (fd) => {
      const r = await apiPutForm(API_ENDPOINTS.VENDORS.BY_ID(vendorId), fd)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-info', vendorId] }),
  })

  // ===== Store Info Form =====
  const [storeForm, setStoreForm] = useState({
    Name: '', NameAr: '', Description: '', Phone: '',
    Address: '', MinOrderAmount: '', DeliveryFee: '', EstimatedPrepTime: '',
  })
  const [logoFile, setLogoFile]     = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [coverFile, setCoverFile]     = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  useEffect(() => {
    if (vendor) {
      setStoreForm({
        Name:               vendor.name              || '',
        NameAr:             vendor.nameAr            || '',
        Description:        vendor.description       || '',
        Phone:              vendor.phone             || '',
        Address:            vendor.address           || '',
        MinOrderAmount:     vendor.minOrderAmount?.toString() || '',
        DeliveryFee:        vendor.deliveryFee?.toString()    || '',
        EstimatedPrepTime:  vendor.estimatedPrepTime?.toString() || '',
      })
      setLogoPreview(getImageUrl(vendor.logoUrl) || vendor.logoUrl || null)
      setCoverPreview(getImageUrl(vendor.coverImageUrl) || vendor.coverImageUrl || null)
    }
  }, [vendor])

  const handleSaveStore = async (e) => {
    e?.preventDefault()
    try {
      const fd = new FormData()
      Object.entries(storeForm).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (logoFile) fd.append('NewLogo', logoFile)
      if (coverFile) fd.append('NewCover', coverFile)
      await updateVendor(fd)
      success('تم تحديث معلومات المتجر ✅')
    } catch (err) {
      showError(err.message || 'فشل التحديث')
    }
  }

  // ===== تفضيلات الإشعارات والعرض (محفوظة في قاعدة البيانات) =====
  const prefs = usePreferencesDraft()

  const savePreferences = (keys, message) => async () => {
    try {
      await prefs.save(keys)
      success(message)
    } catch (err) {
      showError(err.message || 'فشل حفظ الإعدادات')
    }
  }

  const prefsLoading = <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
  const prefsError = <p className="text-sm text-red-500">تعذّر تحميل الإعدادات من الخادم</p>

  const inputCls = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1 text-sm">إدارة معلومات متجرك وتفضيلاتك</p>
      </div>

      {/* معلومات المتجر */}
      <Section icon={Store} title="معلومات المتجر" onSave={handleSaveStore} saving={saving}>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Logo */}
            <div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex-shrink-0 flex items-center justify-center">
                  {logoPreview
                    ? <img src={logoPreview} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                    : <Store size={24} className="text-gray-300" />
                  }
                </div>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <Upload size={14} />تغيير الشعار
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if(f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Info size={12} />المقاس المثالي: <span dir="ltr">512×512</span> بكسل (صورة مربعة)
              </p>
            </div>

            {/* Cover */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">صورة الغلاف</label>
              <div className="relative h-32 rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                {coverPreview
                  ? <img src={coverPreview} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  : <span className="text-xs text-gray-400">لا توجد صورة غلاف</span>
                }
                <label className="absolute bottom-2 left-2 cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-white/90 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-white shadow-sm">
                  <Upload size={13} />تغيير الغلاف
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if(f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) } }} />
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Info size={12} />المقاس المثالي: <span dir="ltr">1200×400</span> بكسل (نسبة عرض إلى ارتفاع <span dir="ltr">3:1</span>)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">الاسم العربي</label>
                <input value={storeForm.NameAr} onChange={e => setStoreForm({...storeForm, NameAr: e.target.value})} className={inputCls} placeholder="اسم المتجر بالعربي" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">English Name</label>
                <input value={storeForm.Name} onChange={e => setStoreForm({...storeForm, Name: e.target.value})} className={inputCls} placeholder="Store Name" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الوصف</label>
              <textarea value={storeForm.Description} onChange={e => setStoreForm({...storeForm, Description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary"
                rows={3} placeholder="وصف مختصر للمتجر" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <Phone size={12} />رقم الهاتف
                </label>
                <input value={storeForm.Phone} onChange={e => setStoreForm({...storeForm, Phone: e.target.value})} className={inputCls} dir="ltr" placeholder="+964..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <MapPin size={12} />العنوان
                </label>
                <input value={storeForm.Address} onChange={e => setStoreForm({...storeForm, Address: e.target.value})} className={inputCls} placeholder="عنوان المتجر" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <DollarSign size={12} />الحد الأدنى للطلب
                </label>
                <input type="number" value={storeForm.MinOrderAmount} onChange={e => setStoreForm({...storeForm, MinOrderAmount: e.target.value})} className={inputCls} placeholder="0 د.ع" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">رسوم التوصيل</label>
                <input type="number" value={storeForm.DeliveryFee} onChange={e => setStoreForm({...storeForm, DeliveryFee: e.target.value})} className={inputCls} placeholder="0 د.ع" />
                {vendorUsesZones(zonesCfg, vendor?.id || vendorId) && (
                  <p className="text-xs text-blue-600 mt-1">متجرك يتبع مناطق التوصيل: الزبون يدفع سعر منطقته، وهذا السعر يُستخدم فقط للعناوين بلا منطقة</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <Clock size={12} />وقت التحضير (دقيقة)
                </label>
                <input type="number" value={storeForm.EstimatedPrepTime} onChange={e => setStoreForm({...storeForm, EstimatedPrepTime: e.target.value})} className={inputCls} placeholder="30" />
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* الإشعارات */}
      <Section icon={Bell} title="إعدادات الإشعارات"
        onSave={savePreferences(NOTIFICATION_KEYS, 'تم حفظ إعدادات الإشعارات')}
        saving={prefs.isSaving} saveDisabled={!prefs.isDirty(NOTIFICATION_KEYS)}>
        {prefs.isLoading ? prefsLoading : prefs.isError || !prefs.draft ? prefsError : (
          <div>
            <Toggle label="طلبات جديدة"   desc="إشعار عند وصول طلب جديد لمتجرك"
              checked={prefs.draft.notifyNewOrders} onChange={v => prefs.set('notifyNewOrders', v)} />
            <Toggle label="تأكيد الطلبات" desc="إشعار عند تأكيد أو إلغاء طلب لمتجرك"
              checked={prefs.draft.notifyOrderConfirmations} onChange={v => prefs.set('notifyOrderConfirmations', v)} />
            <Toggle label="مخزون منخفض"   desc="تنبيه عند انخفاض أو نفاد مخزون منتج"
              checked={prefs.draft.notifyLowStock} onChange={v => prefs.set('notifyLowStock', v)} />
            <Toggle label="تقييمات جديدة" desc="إشعار عند كتابة تقييم جديد على منتجاتك"
              checked={prefs.draft.notifyReviews} onChange={v => prefs.set('notifyReviews', v)} />
          </div>
        )}
      </Section>

      {/* المظهر */}
      <AppearanceSection />

      {/* معلومات الحساب */}
      <Section icon={Info} title="معلومات الحساب">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'الاسم',         value: user?.fullName || user?.name || '—' },
            { label: 'الهاتف',        value: user?.phone    || '—',  dir: 'ltr' },
            { label: 'البريد',        value: user?.email    || '—'               },
            { label: 'حالة المتجر',   value: vendor?.isActive ? 'نشط ✅' : 'معطل ❌' },
          ].map(({ label, value, dir }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-medium text-gray-900 text-sm" dir={dir}>{isLoading ? '...' : value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

export default VendorSettings