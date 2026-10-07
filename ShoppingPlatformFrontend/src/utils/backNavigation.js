import { matchPath } from 'react-router-dom'

// الصفحات الأم لكل قسم — لا يظهر عليها زر الرجوع
export const ROOT_PATHS = ['/', '/vendor', '/admin', '/operations']

// صفحات أمّها المنطقية ليست الأقرب في الرابط (أو الأقرب ليس صفحة موجودة)
const PARENT_OVERRIDES = [
  ['/checkout', '/cart'],
  ['/vendor/products/:id/edit', '/vendor/products'],
  ['/vendor/products/:id/publish', '/vendor/products'],
]

const normalize = (pathname) => {
  const path = (pathname || '/').replace(/\/+$/, '')
  return path === '' ? '/' : path
}

export const isRootPath = (pathname) => ROOT_PATHS.includes(normalize(pathname))

// الصفحة الأم: /products/12 ← /products ، /admin/orders/5 ← /admin/orders ، /admin/users ← /admin ، /cart ← /
export const parentPath = (pathname) => {
  const path = normalize(pathname)
  for (const [pattern, parent] of PARENT_OVERRIDES)
    if (matchPath(pattern, path)) return parent

  const segments = path.split('/').filter(Boolean)
  return segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : '/'
}

// الرجوع: للصفحة السابقة إن جاء المستخدم منها داخل الموقع، وإلا للصفحة الأم.
// الصعود للأم يستبدل الصفحة الحالية في السجل — حتى لا يعود «رجوع» التالي إليها، فينتهي دائماً بالصفحة الأم للقسم
export const goBack = (navigate, pathname) => {
  if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
  else navigate(parentPath(pathname), { replace: true })
}
