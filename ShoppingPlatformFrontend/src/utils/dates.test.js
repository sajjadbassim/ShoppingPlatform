import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatClock } from './dates'

describe('dates', () => {
  it('يعيد نصاً فارغاً بلا تاريخ', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatClock('')).toBe('')
  })
  it('أرقام لاتينية وتوقيت بغداد', () => {
    const d = formatDate('2026-10-24T12:00:00Z')
    expect(d).toMatch(/24/)
    expect(d).toMatch(/2026/)
    expect(d).not.toMatch(/[٠-٩]/)
    expect(formatDateTime('2026-10-24T12:45:00Z')).toContain('،')
  })
})
