import { router } from 'expo-router';

// التبويب يبقى مُحمَّلاً، فكل وصول يحمل رقماً جديداً (t) ليُطبَّق المقطع والحالة حتى لو تكرّرت القيم
export const goOrders = (tab: 'orders' | 'returns', status?: string) =>
  router.push({ pathname: '/orders', params: { tab, ...(status ? { status } : {}), t: String(Date.now()) } });
