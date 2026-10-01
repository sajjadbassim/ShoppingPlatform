// سحب الصفحة للأسفل للتحديث: الصفحات تسجّل ما تحتاجه (مثل جلب فيديوهات تيك توك الجديدة)
// إضافة إلى إعادة جلب كل الاستعلامات الظاهرة
const handlers = new Set()

export const onPullRefresh = (fn) => {
  handlers.add(fn)
  return () => handlers.delete(fn)
}

export const runPullRefresh = (queryClient) =>
  Promise.allSettled([
    ...[...handlers].map(fn => fn()),
    queryClient.refetchQueries({ type: 'active' }),
  ])
