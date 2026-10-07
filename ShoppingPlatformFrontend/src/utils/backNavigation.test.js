import { afterEach, describe, expect, it, vi } from 'vitest'
import { goBack, isRootPath, parentPath } from './backNavigation'

describe('backNavigation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('الصفحات الأم لكل قسم بلا زر رجوع', () => {
    for (const p of ['/', '/vendor', '/vendor/', '/admin', '/operations']) expect(isRootPath(p)).toBe(true)
    for (const p of ['/products', '/cart', '/vendor/products', '/admin/orders/5']) expect(isRootPath(p)).toBe(false)
  })

  it('الصفحة الأم: مستوى واحد للأعلى', () => {
    expect(parentPath('/products/12')).toBe('/products')
    expect(parentPath('/products')).toBe('/')
    expect(parentPath('/stores/7')).toBe('/stores')
    expect(parentPath('/orders/9/')).toBe('/orders')
    expect(parentPath('/blog/hello')).toBe('/blog')
    expect(parentPath('/admin/orders/5')).toBe('/admin/orders')
    expect(parentPath('/admin/users')).toBe('/admin')
    expect(parentPath('/operations/tracking')).toBe('/operations')
    expect(parentPath('/vendor/products/new')).toBe('/vendor/products')
  })

  it('صفحات أمّها المنطقية مختلفة', () => {
    expect(parentPath('/checkout')).toBe('/cart')
    expect(parentPath('/vendor/products/abc/edit')).toBe('/vendor/products')
    expect(parentPath('/vendor/products/abc/publish')).toBe('/vendor/products')
  })

  it('الصعود المتكرر ينتهي دائماً بالصفحة الأم للقسم', () => {
    let p = '/vendor/products/abc/edit'
    const steps = []
    while (!isRootPath(p)) { p = parentPath(p); steps.push(p) }
    expect(steps).toEqual(['/vendor/products', '/vendor'])
  })

  it('جاء من صفحة داخل الموقع ← يرجع لها', () => {
    vi.stubGlobal('window', { history: { state: { idx: 3 } } })
    const navigate = vi.fn()
    goBack(navigate, '/products/12')
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('فُتحت مباشرة (رابط) ← يصعد للأم ويستبدل الصفحة في السجل', () => {
    vi.stubGlobal('window', { history: { state: { idx: 0 } } })
    const navigate = vi.fn()
    goBack(navigate, '/products/12')
    expect(navigate).toHaveBeenCalledWith('/products', { replace: true })
  })
})
