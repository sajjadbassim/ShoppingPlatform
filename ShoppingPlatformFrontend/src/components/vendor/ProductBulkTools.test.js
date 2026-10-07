import { describe, expect, it } from 'vitest'
import { parseCsv, planImport, planPriceChange, productsToCsv, roundIqd } from './ProductBulkTools'

const product = (o = {}) => ({ id: 'p1', nameAr: 'قميص', name: 'Shirt', sku: 'SH-1', price: 9000, regularPrice: 10000, regularOriginalPrice: null, isActive: true, ...o })

describe('تعديل الأسعار جماعياً', () => {
  it('التقريب لأقرب 250 دينار', () => {
    expect(roundIqd(10120)).toBe(10000)
    expect(roundIqd(10130)).toBe(10250)
    expect(roundIqd(10)).toBe(250)
  })

  it('الخصم يُحسب من السعر المخزّن لا سعر العرض، ويضع السعر الأصلي', () => {
    expect(planPriceChange(product(), 'discount', 20)).toEqual({ Price: 8000, OriginalPrice: 10000 })
  })

  it('خصم على منتج مخفّض أصلاً يُحسب من سعره الأصلي', () => {
    expect(planPriceChange(product({ regularPrice: 9000, regularOriginalPrice: 12000 }), 'discount', 50))
      .toEqual({ Price: 6000, OriginalPrice: 12000 })
  })

  it('رفع السعر بنسبة يرفع السعر الأصلي معه', () => {
    expect(planPriceChange(product({ regularOriginalPrice: 12000 }), 'change', 10))
      .toEqual({ Price: 11000, OriginalPrice: 13250 })
  })

  it('إلغاء الخصم يعيد السعر الأصلي، وبلا خصم لا تغيير', () => {
    expect(planPriceChange(product({ regularPrice: 8000, regularOriginalPrice: 10000 }), 'remove')).toEqual({ Price: 10000, ClearOriginalPrice: true })
    expect(planPriceChange(product(), 'remove')).toBe(null)
  })

  it('نسب غير صالحة لا تغيّر شيئاً', () => {
    expect(planPriceChange(product(), 'discount', 0)).toBe(null)
    expect(planPriceChange(product(), 'discount', 100)).toBe(null)
    expect(planPriceChange(product(), 'change', 0)).toBe(null)
  })
})

describe('CSV', () => {
  it('المحلل يدعم الاقتباس والفواصل داخل الخلية والـ BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\n\n1,2')).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['1', '2']])
  })

  it('التصدير ثم القراءة يعيدان نفس القيم', () => {
    const rows = parseCsv(productsToCsv([product({ nameAr: 'قميص, أزرق', categoryName: 'ملابس' })]))
    expect(rows[1].slice(0, 5)).toEqual(['SH-1', 'قميص, أزرق', 'Shirt', '10000', ''])
  })

  const categories = [{ id: 'c1', nameAr: 'ملابس', name: 'Clothes' }]

  it('SKU موجود ← تحديث، وجديد ← إنشاء مخفي افتراضياً', () => {
    const { lines } = planImport(parseCsv('sku,name_ar,price,stock,category\nSH-1,,12000,5,ملابس\nNEW-1,بنطلون,15000,3,clothes'), [product()], categories)
    expect(lines[0]).toMatchObject({ action: 'update', id: 'p1', fields: { Price: 12000, StockQuantity: 5, CategoryId: 'c1' } })
    expect(lines[1]).toMatchObject({ action: 'create', fields: { NameAr: 'بنطلون', Price: 15000, IsActive: false, Sku: 'NEW-1' } })
  })

  it('غياب عمود السعر الأصلي لا يلغي الخصم الحالي، ووجوده فارغاً يلغيه', () => {
    const without = planImport(parseCsv('sku,name_ar,price\nSH-1,,12000'), [product()], categories).lines[0]
    expect(without.fields.ClearOriginalPrice).toBeUndefined()
    const empty = planImport(parseCsv('sku,name_ar,price,original_price\nSH-1,,12000,'), [product()], categories).lines[0]
    expect(empty.fields.ClearOriginalPrice).toBe(true)
  })

  it('أخطاء الأسطر تُذكر ولا تُنفَّذ', () => {
    const { lines } = planImport(parseCsv('name_ar,price,original_price,category\nأ,0,,\nب,100,50,\nج,100,,غير موجودة\n,100,,'), [], categories)
    expect(lines.map(l => l.action)).toEqual(['error', 'error', 'error', 'error'])
  })

  it('عناوين ناقصة ← رسالة واضحة', () => {
    expect(planImport(parseCsv('foo,bar\n1,2'), [], categories).error).toMatch(/name_ar/)
  })
})
