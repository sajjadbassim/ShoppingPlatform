// صلاحيات الحسابات المساعدة (موظف متجر / مسؤول محدود) — الخادم يفرضها، والواجهة تخفي ما لا يملكه فقط.
// permissions = null: بلا قيود (صاحب المتجر، الأدمن الكامل، والأدوار الأخرى)
export const can = (user, key) => !key || user?.permissions == null || user.permissions.includes(key)

// صاحب المتجر (لا موظف) / الأدمن الكامل — يديران الحسابات المساعدة
export const isStoreOwner = (user) => user?.role === 'VENDOR' && !user?.isStoreStaff
export const isFullAdmin = (user) => user?.role === 'ADMIN' && user?.permissions == null
