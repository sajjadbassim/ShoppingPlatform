import { describe, it, expect } from 'vitest'
import { formatQuantity, formatPrice, pricePerKg, isByWeight, stepLabel } from './weight'

describe('البيع بالوزن', () => {
  it('يعرض الكمية بالكيلو أو الغرام', () => {
    expect(formatQuantity(3, 0.5)).toBe('1.5 كغم')
    expect(formatQuantity(2, 0.25)).toBe('500 غ')
    expect(formatQuantity(1, 1)).toBe('1 كغم')
    expect(formatQuantity(3, 0.1)).toBe('300 غ')
  })

  it('القطعة تبقى عدداً', () => {
    expect(formatQuantity(3, null)).toBe('3')
    expect(isByWeight({ weightStepKg: null })).toBe(false)
    expect(isByWeight({ weightStepKg: 0.5 })).toBe(true)
  })

  it('سعر الكيلو من سعر الوحدة', () => {
    expect(pricePerKg(750, 0.5)).toBe(1500)
    expect(formatPrice(750, 0.5)).toBe('1,500 د.ع / كغم')
    expect(formatPrice(2000, null)).toBe('2,000 د.ع')
  })

  it('وصف الوحدة', () => {
    expect(stepLabel(0.25)).toBe('250 غ')
  })
})
