// نصوص الإرجاع بالعربية (مطابقة لـ ReturnStatus / ReturnReason في الخادم)

export const RETURN_STATUS_AR = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
  COMPLETED: 'مكتمل',
}

export const RETURN_REASON_AR = {
  defective: 'معيب',
  wrong_item: 'منتج خاطئ',
  not_as_described: 'لا يطابق الوصف',
  changed_mind: 'غيّر رأيه',
  other: 'سبب آخر',
}

export const returnReasonAr = (reason) => RETURN_REASON_AR[reason] || reason || ''
