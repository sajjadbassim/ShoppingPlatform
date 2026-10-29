import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSocialPosts, formatClock, type PublishPlatform, type SocialPost } from '@wasit/shared';
import type { Ionicons } from '@expo/vector-icons';

export const PLATFORM_LABEL: Record<PublishPlatform, string> = { instagram: 'إنستغرام', tiktok: 'تيك توك' };
export const PLATFORM_ICON: Record<PublishPlatform, React.ComponentProps<typeof Ionicons>['name']> = { instagram: 'logo-instagram', tiktok: 'musical-notes-outline' };

export const POST_STATUS: Record<string, { label: string; tone: 'ok' | 'bad' | 'warn' | 'muted' | 'primary' }> = {
  SCHEDULED: { label: 'مجدول', tone: 'primary' },
  PUBLISHING: { label: 'قيد المعالجة', tone: 'warn' },
  PUBLISHED: { label: 'منشور', tone: 'ok' },
  FAILED: { label: 'فشل', tone: 'bad' },
  CANCELLED: { label: 'أُلغي', tone: 'muted' },
};

export const postKey = (p: Pick<SocialPost, 'platform' | 'id'>) => `${p.platform}-${p.id}`;

// كل منشورات المتجر على المنصتين، الأحدث أولاً (فشل منصة واحدة لا يُسقط الأخرى)
export const loadAllPosts = async (): Promise<SocialPost[]> => {
  const lists = await Promise.all((['instagram', 'tiktok'] as PublishPlatform[]).map((p) => fetchSocialPosts(p).catch(() => [] as SocialPost[])));
  return lists.flat().sort((a, b) => new Date(b.scheduledAt ?? b.createdAt).getTime() - new Date(a.scheduledAt ?? a.createdAt).getTime());
};

export const useSocialPosts = () => useQuery({ queryKey: ['v-social-posts'], queryFn: loadAllPosts });

export const useRefreshPosts = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['v-social-posts'] });
};

export const isVideo = (u?: string | null) => /\.(mp4|mov)(\?|$)/i.test(u || '');

// «29 تشرين الأول · 3:47 ص» بسطر واحد (التاريخ الكامل في شاشة التفاصيل)
export const shortWhen = (iso?: string | null): string =>
  iso ? `${new Date(iso).toLocaleDateString('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', day: 'numeric', month: 'long' })} · ${formatClock(iso)}` : '';
