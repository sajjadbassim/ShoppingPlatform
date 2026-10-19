import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  customerStatusMessage,
  friendlyStatusNotification,
  localizeStatusCodes,
  staffStatusMessage,
} from './orderStatusText'
import { IMG_SIZE, getAllProductImages, getImageUrl, getPrimaryImage } from './imageHelper'
import { getDashboardLink } from './dashboardLink'
import { SCOPE, isGroceryCategory, searchLink } from './shopScope'
import { normalizeIraqiPhone } from './phone'

describe('orderStatusText', () => {
  it('ترجمة رموز الحالة داخل النص', () => {
    expect(localizeStatusCodes('الطلب الآن OUT_FOR_DELIVERY')).toBe('الطلب الآن في الطريق')
    expect(localizeStatusCodes(null)).toBe(null)
  })

  it('جملة الزبون والفريق مع رقم الطلب', () => {
    expect(customerStatusMessage('DELIVERED', 'ORD-1')).toContain('ORD-1')
    expect(staffStatusMessage('READY', 'ORD-1')).toBe('الطلب ORD-1 جاهز للاستلام ويحتاج سائقاً')
    expect(staffStatusMessage('READY')).toBe('الطلب جاهز للاستلام ويحتاج سائقاً')
  })

  it('حالة غير معروفة تعرض الرمز كما هو', () => {
    expect(customerStatusMessage('NEW_STATE', 'ORD-1')).toBe('تم تحديث طلبك ORD-1: NEW_STATE')
  })

  it('الإشعارات القديمة تُعاد صياغتها بالجمل الجديدة', () => {
    expect(friendlyStatusNotification('طلبك ORD-7 أصبح في حالة: DELIVERED')).toEqual({
      message: customerStatusMessage('DELIVERED', 'ORD-7'),
      status: 'DELIVERED',
    })
    expect(friendlyStatusNotification('تم تحديث حالة الطلب ORD-7 من «مؤكد» إلى «قيد التحضير»').status).toBe('PREPARING')
  })
})

describe('imageHelper', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('المسار النسبي يُكمَّل بعنوان الـ API بلا شرطة مضاعفة', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    expect(getImageUrl('/uploads/a.png')).toBe('http://api.test/uploads/a.png')
    expect(getImageUrl('uploads/a.png')).toBe('http://api.test/uploads/a.png')
  })

  it('العرض يطلب نسخة الخادم المصغّرة لصور /uploads فقط', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    expect(getImageUrl('/uploads/a.png', IMG_SIZE.CARD)).toBe('http://api.test/uploads/a.png?w=600')
    expect(getImageUrl('https://cdn.test/x.jpg', IMG_SIZE.CARD)).toBe('https://cdn.test/x.jpg')
    expect(getImageUrl('/images/logo.png', IMG_SIZE.THUMB)).toBe('http://api.test/images/logo.png')
    expect(getPrimaryImage({ primaryImageUrl: '/uploads/p.png' }, IMG_SIZE.THUMB)).toBe('http://api.test/uploads/p.png?w=200')
  })

  it('الرابط الكامل يبقى كما هو والفارغ يرجع null', () => {
    expect(getImageUrl('https://cdn.test/x.jpg')).toBe('https://cdn.test/x.jpg')
    expect(getImageUrl('')).toBe(null)
  })

  it('الصورة الرئيسية: primaryImageUrl ثم isPrimary ثم أول صورة', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(getPrimaryImage({ primaryImageUrl: '/p.png', images: [{ imageUrl: '/x.png' }] })).toBe('/p.png')
    expect(getPrimaryImage({ images: [{ imageUrl: '/a.png' }, { imageUrl: '/b.png', isPrimary: true }] })).toBe('/b.png')
    expect(getPrimaryImage({ images: [{ imageUrl: '/a.png' }] })).toBe('/a.png')
    expect(getPrimaryImage({})).toBe(null)
  })

  it('كل صور المنتج مع الرجوع لـ primaryImageUrl', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(getAllProductImages({ images: [{ imageUrl: '/a.png' }, { url: '/b.png' }] })).toEqual(['/a.png', '/b.png'])
    expect(getAllProductImages({ primaryImageUrl: '/p.png' })).toEqual(['/p.png'])
  })
})

describe('dashboardLink', () => {
  it('الدور من الخادم بحروف كبيرة أو صغيرة', () => {
    expect(getDashboardLink('ADMIN').path).toBe('/admin')
    expect(getDashboardLink('vendor').path).toBe('/vendor')
  })

  it('الزبون بلا لوحة', () => {
    expect(getDashboardLink('CUSTOMER')).toBe(null)
    expect(getDashboardLink(undefined)).toBe(null)
  })
})

describe('shopScope', () => {
  it('رابط البحث يرمّز النص ويقيّد بالسوبرماركت عند الحاجة', () => {
    expect(searchLink('حليب & خبز', SCOPE.GROCERY)).toBe('/products?search=%D8%AD%D9%84%D9%8A%D8%A8%20%26%20%D8%AE%D8%A8%D8%B2&scope=grocery')
    expect(searchLink('قميص', SCOPE.GENERAL)).toBe(`/products?search=${encodeURIComponent('قميص')}`)
  })

  it('قسم الفئة يأتي من الخادم', () => {
    expect(isGroceryCategory({ section: 'grocery' })).toBe(true)
    expect(isGroceryCategory({ section: 'general' })).toBe(false)
    expect(isGroceryCategory(null)).toBe(false)
  })
})

describe('phone', () => {
  it('صيغ الرقم العراقي تتوحّد كما في الخادم', () => {
    expect(normalizeIraqiPhone('+964 770 123-4567')).toBe('07701234567')
    expect(normalizeIraqiPhone('009647701234567')).toBe('07701234567')
    expect(normalizeIraqiPhone('7701234567')).toBe('07701234567')
    expect(normalizeIraqiPhone('07012345678')).toBe(null)
    expect(normalizeIraqiPhone('')).toBe(null)
  })
})
