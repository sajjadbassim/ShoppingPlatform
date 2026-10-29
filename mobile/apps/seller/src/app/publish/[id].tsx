import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  PUBLISH_LIMITS, TIKTOK_PRIVACY_LABELS, countHashtags, createInstagramPost, createTikTokPost, fetchInstagramPublishOptions, fetchSocialPosts, fetchTikTokPublishOptions,
  fetchTikTokStatus, formatDateTime, getImageUrl, isVideoUrl, publishedPlatformsByProduct, requestFailure, retrySocialPost, uploadPublishMedia,
  type PublishPayload, type PublishPlatform, type SocialPost, type TikTokSettings,
} from '@wasit/shared';
import { AppText, brand, colors, Input, useTheme } from '@wasit/ui';
import { ActionButton, Card, Chip, Screen, Segmented, SectionTitle, ToggleRow } from '../../components/kit';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';

const PLATFORMS: { key: PublishPlatform; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'instagram', label: 'إنستغرام', icon: 'logo-instagram' },
  { key: 'tiktok', label: 'تيك توك', icon: 'musical-notes-outline' },
];

type Item = { key: string; url: string; video: boolean; durationSec?: number | null };
type Uploading = { key: string; uri: string; video: boolean };
type Mode = 'now' | 'schedule';

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
const tonightAt = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime() > Date.now() + 10 * 60000 ? d : tomorrowAt(h); };

// تاريخ ووقت الجدولة بالعربية (أرقام لاتينية كبقية التطبيق)
const when = (d: Date) => formatDateTime(d.toISOString());

export default function PublishScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const ig = useQuery({ queryKey: ['v-publish-ig', id], queryFn: () => fetchInstagramPublishOptions(id), retry: false });
  const tkStatus = useQuery({ queryKey: ['v-publish-tt-status'], queryFn: fetchTikTokStatus, retry: false });
  const tkReady = !!(tkStatus.data?.publishingEnabled && tkStatus.data.connected && tkStatus.data.canPublish && !tkStatus.data.needsReconnect);
  const tkOptions = useQuery({ queryKey: ['v-publish-tt-options', id], queryFn: () => fetchTikTokPublishOptions(id), enabled: tkReady, staleTime: 60000 });
  const posts = useQuery({
    queryKey: ['v-social-posts'],
    queryFn: async () => (await Promise.all(PLATFORMS.map((p) => fetchSocialPosts(p.key).catch(() => [] as SocialPost[])))).flat(),
    staleTime: 30000,
  });
  const before = publishedPlatformsByProduct(posts.data ?? [])[id] ?? [];

  const o = ig.data;
  const igReady = !!(o?.publishingEnabled && o.connected && o.canPublish && !o.needsReconnect);
  const state = (key: PublishPlatform): { ready: boolean; hint: string; account?: string | null } => {
    if (key === 'instagram') {
      if (!o) return { ready: false, hint: 'جاري التحقق...' };
      if (!o.publishingEnabled) return { ready: false, hint: 'النشر غير مفعّل على المنصة بعد' };
      if (!o.connected) return { ready: false, hint: 'غير مربوط' };
      if (o.needsReconnect || !o.canPublish) return { ready: false, hint: o.needsReconnect ? 'انتهت صلاحية الربط' : 'أعد الربط لمنح صلاحية النشر', account: o.username };
      return { ready: true, hint: o.quotaTotal != null ? `${o.quotaUsage}/${o.quotaTotal} منشور اليوم` : 'صور أو فيديو (ريلز)، حتى 10 عناصر', account: o.username };
    }
    const t = tkStatus.data;
    const account = t?.account?.username || t?.account?.displayName;
    if (!t) return { ready: false, hint: 'جاري التحقق...' };
    if (!t.publishingEnabled) return { ready: false, hint: 'النشر غير مفعّل على المنصة بعد' };
    if (!t.connected) return { ready: false, hint: 'غير مربوط' };
    if (t.needsReconnect || !t.canPublish) return { ready: false, hint: t.needsReconnect ? 'انتهت صلاحية الربط' : 'أعد الربط لمنح صلاحية النشر', account };
    return { ready: true, hint: 'فيديو واحد أو صور (حتى 35)', account };
  };

  const [targets, setTargets] = useState<PublishPlatform[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [extra, setExtra] = useState<Item[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [caption, setCaption] = useState('');
  const [mode, setMode] = useState<Mode>('now');
  const [scheduleAt, setScheduleAt] = useState<Date>(() => addMinutes(new Date(), 60));
  const [tt, setTt] = useState<TikTokSettings>({ privacy: '', comment: true, duet: true, stitch: true, promotes: true, consent: true });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Partial<Record<PublishPlatform, SocialPost>> | null>(null);
  const [retrying, setRetrying] = useState<PublishPlatform | null>(null);

  // البداية: الصورة الرئيسية + النص المقترح
  useEffect(() => {
    if (!o) return;
    setSelected(o.images.slice(0, 1));
    setCaption(o.suggestedCaption || '');
  }, [o?.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // كل الحسابات الجاهزة محدّدة افتراضياً (حالة منصة قد تصل متأخرة)
  const readySig = PLATFORMS.filter((p) => state(p.key).ready).map((p) => p.key).join();
  useEffect(() => {
    setTargets(readySig ? (readySig.split(',') as PublishPlatform[]) : []);
  }, [readySig]); // eslint-disable-line react-hooks/exhaustive-deps

  // الخصوصية الافتراضية «الجميع» وإلا أول خيار متاح
  useEffect(() => {
    const opts = tkOptions.data?.privacyOptions;
    if (!opts?.length) return;
    setTt((s) => (s.privacy && opts.includes(s.privacy) ? s : { ...s, privacy: opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0] }));
  }, [tkOptions.data]);

  const library: Item[] = useMemo(() => [...(o?.images ?? []).map((u) => ({ key: u, url: u, video: isVideoUrl(u) })), ...extra], [o?.images, extra]);
  const toggleMedia = (url: string) =>
    setSelected((l) => (l.includes(url) ? l.filter((x) => x !== url) : l.length >= PUBLISH_LIMITS.maxMedia ? l : [...l, url]));

  const pickMedia = async () => {
    const room = PUBLISH_LIMITS.maxMedia - selected.length;
    if (room <= 0) return toast.error(`الحد الأقصى ${PUBLISH_LIMITS.maxMedia} عناصر`);
    let res: ImagePicker.ImagePickerResult;
    try {
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    } catch {
      return toast.error('تعذّر فتح المعرض');
    }
    if (res.canceled) return;
    for (const a of res.assets.slice(0, room)) {
      const video = a.type === 'video' || /\.(mp4|mov)$/i.test(a.fileName ?? a.uri);
      const sizeMb = (a.fileSize ?? 0) / 1048576;
      if (video && sizeMb > PUBLISH_LIMITS.maxVideoMb) { toast.error(`الفيديو أكبر من ${PUBLISH_LIMITS.maxVideoMb} ميغابايت`); continue; }
      if (!video && sizeMb > PUBLISH_LIMITS.maxImageMb) { toast.error(`الصورة أكبر من ${PUBLISH_LIMITS.maxImageMb} ميغابايت`); continue; }
      const durationSec = video && a.duration ? Math.round(a.duration / (a.duration > 1000 ? 1000 : 1)) : null;
      if (durationSec && (durationSec < 3 || durationSec > 900)) { toast.error('مدة الفيديو يجب أن تكون بين 3 ثوانٍ و15 دقيقة'); continue; }
      const key = `${a.uri}-${Date.now()}`;
      setUploading((l) => [...l, { key, uri: a.uri, video }]);
      try {
        const url = await uploadPublishMedia({
          uri: a.uri,
          name: a.fileName ?? `post-${Date.now()}.${video ? 'mp4' : 'jpg'}`,
          type: a.mimeType ?? (video ? 'video/mp4' : 'image/jpeg'),
          video,
        });
        setExtra((l) => [...l, { key: url, url, video, durationSec }]);
        setSelected((l) => (l.length >= PUBLISH_LIMITS.maxMedia ? l : [...l, url]));
      } catch (e) {
        toast.error((e as { message?: string }).message || 'تعذّر رفع الملف');
      } finally {
        setUploading((l) => l.filter((u) => u.key !== key));
      }
    }
  };

  const removeExtra = (url: string) => {
    setExtra((l) => l.filter((x) => x.url !== url));
    setSelected((l) => l.filter((x) => x !== url));
  };

  // ===== التحقق =====
  const itemOf = (url: string) => library.find((x) => x.url === url);
  const videos = selected.filter((u) => itemOf(u)?.video ?? isVideoUrl(u));
  const hashtags = countHashtags(caption);
  const now = new Date();
  const maxDate = new Date(now.getTime() + PUBLISH_LIMITS.scheduleDays * 86400000);
  const scheduleBad = mode === 'schedule' && (scheduleAt.getTime() < now.getTime() + 4 * 60000 || scheduleAt > maxDate);
  const tiktokOn = targets.includes('tiktok');
  const tkMax = tkOptions.data?.maxVideoDurationSeconds ?? 0;
  const tkVideoLen = videos.length === 1 ? itemOf(videos[0])?.durationSec ?? null : null;
  const longAlbumVideo = selected.length > 1 && videos.some((u) => (itemOf(u)?.durationSec ?? 0) > 60);
  const errors = [
    targets.length === 0 && (PLATFORMS.every((p) => !state(p.key).ready) ? 'لا يوجد حساب جاهز للنشر — اربط حساباً أولاً' : 'اختر حساباً واحداً على الأقل'),
    selected.length === 0 && 'اختر صورة أو فيديو واحداً على الأقل',
    uploading.length > 0 && 'انتظر اكتمال الرفع',
    longAlbumVideo && 'الفيديو داخل الألبوم حتى 60 ثانية، أو انشره وحده كريلز',
    !caption.trim() && 'اكتب نص المنشور',
    caption.length > PUBLISH_LIMITS.maxCaption && `النص أطول من ${PUBLISH_LIMITS.maxCaption} حرفاً`,
    hashtags > PUBLISH_LIMITS.maxHashtags && `الوسوم أكثر من ${PUBLISH_LIMITS.maxHashtags}`,
    scheduleBad && `اختر موعداً بعد 5 دقائق وخلال ${PUBLISH_LIMITS.scheduleDays} يوماً`,
    tiktokOn && videos.length > 0 && selected.length > 1 && 'تيك توك يقبل فيديو واحداً أو صوراً فقط، بلا خلط',
    tiktokOn && !!tkVideoLen && tkMax > 0 && tkVideoLen > tkMax && `الفيديو أطول من حد حسابك في تيك توك (${tkMax} ثانية)`,
    tiktokOn && !tt.privacy && 'اختر من يستطيع مشاهدة المنشور على تيك توك',
    tiktokOn && !tt.consent && 'وافق على نشر المحتوى على حسابك في تيك توك',
  ].filter(Boolean) as string[];

  const payload = (): PublishPayload => ({ productId: id, media: selected, caption: caption.trim(), scheduledAt: mode === 'schedule' ? scheduleAt.toISOString() : null });
  const create = (k: PublishPlatform, body: PublishPayload) => (k === 'instagram' ? createInstagramPost(body) : createTikTokPost(body, tt));

  const publish = async () => {
    setBusy(true);
    try {
      const body = payload();
      // كل منصة بطلب مستقل وبالتوازي: فشل منصة لا يُلغي النشر على الباقي
      const settled = await Promise.allSettled(targets.map((k) => create(k, body)));
      const out: Partial<Record<PublishPlatform, SocialPost>> = {};
      targets.forEach((k, i) => { const r = settled[i]; out[k] = r.status === 'fulfilled' ? r.value : requestFailure(k, r.reason); });
      setResults(out);
      queryClient.invalidateQueries({ queryKey: ['v-social-posts'] });
    } finally {
      setBusy(false);
    }
  };

  const ask = () => {
    const names = targets.map((k) => PLATFORMS.find((p) => p.key === k)?.label).join(' و');
    confirmDialog({
      title: mode === 'now' ? 'نشر المنشور الآن؟' : 'جدولة المنشور؟',
      message: mode === 'now' ? `سيُنشر على ${names}. قد يستغرق دقيقة.` : `سيُنشر في ${when(scheduleAt)} على ${names}.`,
      confirmText: mode === 'now' ? 'نشر' : 'جدولة',
      tone: 'primary',
      onConfirm: publish,
    });
  };

  const retry = async (k: PublishPlatform) => {
    const post = results?.[k];
    if (!post) return;
    setRetrying(k);
    try {
      const next = post.requestFailed ? await create(k, payload()) : await retrySocialPost(k, post.id);
      setResults((r) => ({ ...r, [k]: next }));
      queryClient.invalidateQueries({ queryKey: ['v-social-posts'] });
    } catch (e) {
      setResults((r) => ({ ...r, [k]: requestFailure(k, e) }));
    } finally {
      setRetrying(null);
    }
  };

  // ===== نتيجة النشر =====
  if (results) {
    const entries = Object.entries(results) as [PublishPlatform, SocialPost][];
    const ok = entries.filter(([, p]) => p.status !== 'FAILED').length;
    return (
      <Screen
        title="نتيجة النشر"
        subtitle={o?.productName}
        back
        footer={<><ActionButton title="سجل المنشورات" tone="ghost" onPress={() => router.replace('/social-posts')} /><ActionButton title="تم" onPress={() => router.back()} /></>}
      >
        {entries.length > 1 && (
          <Card tone={ok === entries.length ? 'ok' : ok === 0 ? 'bad' : 'warn'}>
            <AppText weight="bold">{ok === entries.length ? `تم على كل الحسابات (${ok})` : ok === 0 ? 'تعذّر النشر على كل الحسابات' : `تم على ${ok} من ${entries.length}، أعد المحاولة للباقي`}</AppText>
          </Card>
        )}
        {entries.map(([k, post]) => (
          <ResultCard key={k} platformKey={k} post={post} account={state(k).account} retrying={retrying === k} onRetry={() => retry(k)} />
        ))}
      </Screen>
    );
  }

  const publishLabel = mode === 'schedule' ? (targets.length > 1 ? `جدولة على ${targets.length} حسابات` : 'جدولة المنشور') : targets.length > 1 ? `نشر على ${targets.length} حسابات` : 'نشر الآن';

  return (
    <Screen
      title="نشر المنتج"
      subtitle={o?.productName}
      back
      footer={
        <View style={{ flex: 1, gap: 6 }}>
          {errors.length > 0 && <AppText style={{ color: colors.error, fontSize: 12.5, textAlign: 'center' }}>{errors[0]}</AppText>}
          <ActionButton title={publishLabel} icon={mode === 'now' ? 'send-outline' : 'calendar-outline'} onPress={ask} disabled={errors.length > 0} loading={busy} />
        </View>
      }
    >
      {ig.isError && (
        <Card tone="warn">
          <AppText weight="bold">تعذّر تحميل المنتج</AppText>
          <ActionButton title="إعادة المحاولة" tone="soft" compact onPress={() => ig.refetch()} />
        </Card>
      )}
      {!results && before.length > 0 && (
        <Card tone="warn">
          <AppText weight="bold" style={{ fontSize: 13.5 }}>نُشر هذا المنتج سابقاً على {before.map((k) => PLATFORMS.find((p) => p.key === k)?.label).join(' و')}</AppText>
        </Card>
      )}

      <SectionTitle>انشر على</SectionTitle>
      <Card>
        {PLATFORMS.map((p, i) => {
          const s = state(p.key);
          const on = targets.includes(p.key);
          return (
            <Pressable
              key={p.key}
              disabled={!s.ready}
              onPress={() => setTargets((t) => (t.includes(p.key) ? t.filter((x) => x !== p.key) : [...t, p.key]))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !s.ready }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: brand.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={p.icon} size={21} color={s.ready ? colors.primaryHover : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="bold">{p.label}{!!s.account && <AppText muted style={{ fontSize: 13 }}>  @{s.account}</AppText>}</AppText>
                <AppText muted style={{ fontSize: 12.5 }}>{s.hint}</AppText>
              </View>
              {s.ready ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? colors.primaryHover : colors.border, backgroundColor: on ? colors.primaryHover : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
              ) : s.hint === 'غير مربوط' || s.hint.startsWith('انتهت') || s.hint.startsWith('أعد') ? (
                <ActionButton title={s.hint === 'غير مربوط' ? 'ربط' : 'إعادة الربط'} tone="soft" compact onPress={() => router.push('/social')} />
              ) : (
                <Chip label="غير متاح" tone="muted" />
              )}
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>الصور والفيديو</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable onPress={pickMedia} style={tile({ dashed: true })} accessibilityLabel="من المعرض">
            <Ionicons name="add" size={24} color={colors.textMuted} />
            <AppText muted style={{ fontSize: 11, textAlign: 'center' }}>من المعرض</AppText>
          </Pressable>
          {library.map((it) => {
            const order = selected.indexOf(it.url);
            const on = order >= 0;
            const uploaded = extra.some((x) => x.url === it.url);
            return (
              <View key={it.key}>
                <Pressable onPress={() => toggleMedia(it.url)} style={[tile(), { borderColor: on ? colors.primaryHover : colors.border, opacity: on ? 1 : 0.65 }]} accessibilityState={{ selected: on }}>
                  <Image source={{ uri: getImageUrl(it.url, 200) ?? it.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  {it.video && <View style={{ position: 'absolute', bottom: 4, start: 4 }}><Ionicons name="play-circle" size={20} color="#FFFFFF" /></View>}
                  <View style={{ position: 'absolute', top: 4, end: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: on ? colors.primaryHover : 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
                    <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 12, lineHeight: 16 }}>{on ? order + 1 : ''}</AppText>
                  </View>
                </Pressable>
                {uploaded && (
                  <Pressable onPress={() => removeExtra(it.url)} accessibilityLabel="إزالة" style={{ position: 'absolute', top: -6, start: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
            );
          })}
          {uploading.map((u) => (
            <View key={u.key} style={[tile(), { alignItems: 'center', justifyContent: 'center' }]}>
              <Image source={{ uri: u.uri }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.4 }} contentFit="cover" />
              <AppText weight="bold" style={{ fontSize: 11 }}>جاري الرفع...</AppText>
            </View>
          ))}
        </View>
        <AppText muted style={{ fontSize: 12 }}>
          {selected.length}/{PUBLISH_LIMITS.maxMedia} ·{' '}
          {selected.length > 1 ? `سيُنشر كألبوم من ${selected.length} عناصر` : videos.length === 1 ? 'فيديو واحد يُنشر ريلز' : 'الترتيب حسب اختيارك. أضف صوراً أو فيديو (حتى 100 ميغابايت)'}
        </AppText>
      </Card>

      <SectionTitle>نص المنشور</SectionTitle>
      <Card>
        <Input label="النص" value={caption} onChangeText={setCaption} multiline numberOfLines={7} textAlignVertical="top" style={{ minHeight: 140 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText style={{ fontSize: 12, color: hashtags > PUBLISH_LIMITS.maxHashtags ? colors.error : colors.textMuted }}>الوسوم #: {hashtags}/{PUBLISH_LIMITS.maxHashtags}</AppText>
          <AppText style={{ fontSize: 12, color: caption.length > PUBLISH_LIMITS.maxCaption ? colors.error : colors.textMuted }}>{caption.length}/{PUBLISH_LIMITS.maxCaption}</AppText>
        </View>
        {!!o?.suggestedCaption && caption !== o.suggestedCaption && (
          <ActionButton title="النص المقترح" icon="refresh-outline" tone="ghost" compact onPress={() => setCaption(o.suggestedCaption)} />
        )}
      </Card>

      {tiktokOn && (
        <>
          <SectionTitle>إعدادات تيك توك</SectionTitle>
          <Card>
            <AppText weight="bold" style={{ fontSize: 14 }}>من يستطيع مشاهدة المنشور؟</AppText>
            {!tkOptions.data?.privacyOptions?.length ? (
              <AppText muted style={{ fontSize: 12.5 }}>{tkOptions.isLoading ? 'جاري جلب خيارات حسابك...' : 'تعذّر جلب خيارات الخصوصية من تيك توك، أعد فتح الشاشة'}</AppText>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tkOptions.data.privacyOptions.map((p) => {
                  const on = tt.privacy === p;
                  return (
                    <Pressable key={p} onPress={() => setTt((s) => ({ ...s, privacy: p }))} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5, borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : 'transparent' }}>
                      <AppText weight="bold" style={{ fontSize: 13, color: on ? '#FFFFFF' : colors.text }}>{TIKTOK_PRIVACY_LABELS[p] ?? p}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!!tkOptions.data?.privacyOptions?.length && tkOptions.data.privacyOptions.every((p) => p === 'SELF_ONLY') && (
              <AppText style={{ fontSize: 12.5, color: '#8A5A00' }}>النشر عبر المنصة يظهر الآن لك وحدك فقط، حتى يعتمد تيك توك تطبيق واسط.</AppText>
            )}
            <ToggleRow title="السماح بالتعليقات" value={tt.comment && !tkOptions.data?.commentDisabled} disabled={tkOptions.data?.commentDisabled} onChange={(v) => setTt((s) => ({ ...s, comment: v }))} />
            {videos.length > 0 && (
              <>
                <ToggleRow title="السماح بالدويت" value={tt.duet && !tkOptions.data?.duetDisabled} disabled={tkOptions.data?.duetDisabled} onChange={(v) => setTt((s) => ({ ...s, duet: v }))} />
                <ToggleRow title="السماح بالستيتش" value={tt.stitch && !tkOptions.data?.stitchDisabled} disabled={tkOptions.data?.stitchDisabled} onChange={(v) => setTt((s) => ({ ...s, stitch: v }))} />
              </>
            )}
            <ToggleRow title="هذا المنشور يروّج لمتجري" desc="يظهر على المنشور وسم «ترويج» (محتوى تجاري)" value={tt.promotes} onChange={(v) => setTt((s) => ({ ...s, promotes: v }))} />
            <ToggleRow title="أوافق على نشر هذا المحتوى على حسابي" desc="وأقرّ بموافقتي على تأكيد استخدام الموسيقى من تيك توك" value={tt.consent} onChange={(v) => setTt((s) => ({ ...s, consent: v }))} />
          </Card>
        </>
      )}

      <SectionTitle>موعد النشر</SectionTitle>
      <Card>
        <Segmented<Mode> value={mode} onChange={setMode} options={[{ key: 'now', label: 'الآن' }, { key: 'schedule', label: 'جدولة' }]} />
        {mode === 'schedule' && (
          <>
            <AppText weight="extraBold" style={{ fontSize: 17, textAlign: 'center' }}>{when(scheduleAt)}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              <Quick label="بعد ساعة" onPress={() => setScheduleAt(addMinutes(new Date(), 60))} />
              <Quick label="الليلة 8 م" onPress={() => setScheduleAt(tonightAt(20))} />
              <Quick label="غداً 10 ص" onPress={() => setScheduleAt(tomorrowAt(10))} />
              <Quick label="غداً 8 م" onPress={() => setScheduleAt(tomorrowAt(20))} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Step label="يوم" onMinus={() => setScheduleAt((d) => addMinutes(d, -1440))} onPlus={() => setScheduleAt((d) => addMinutes(d, 1440))} />
              <Step label="ساعة" onMinus={() => setScheduleAt((d) => addMinutes(d, -60))} onPlus={() => setScheduleAt((d) => addMinutes(d, 60))} />
              <Step label="15 د" onMinus={() => setScheduleAt((d) => addMinutes(d, -15))} onPlus={() => setScheduleAt((d) => addMinutes(d, 15))} />
            </View>
            <AppText muted style={{ fontSize: 12 }}>يُنشر تلقائياً في الموعد، ويمكنك إلغاؤه قبل ذلك من سجل المنشورات.</AppText>
          </>
        )}
      </Card>
    </Screen>
  );
}

const tile = (o: { dashed?: boolean } = {}) => ({
  width: 78,
  height: 78,
  borderRadius: 12,
  overflow: 'hidden' as const,
  borderWidth: o.dashed ? 1.5 : 2,
  borderStyle: o.dashed ? ('dashed' as const) : ('solid' as const),
  borderColor: colors.border,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: brand.surfaceMuted,
});

function Quick({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, backgroundColor: colors.primaryLight }}>
      <AppText weight="bold" style={{ fontSize: 13, color: colors.primaryHover }}>{label}</AppText>
    </Pressable>
  );
}

function Step({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  const btn = { width: 34, height: 34, borderRadius: 17, backgroundColor: brand.surfaceMuted, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <AppText muted style={{ fontSize: 12 }}>{label}</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onMinus} style={btn} accessibilityLabel={`ناقص ${label}`}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
        <Pressable onPress={onPlus} style={btn} accessibilityLabel={`زائد ${label}`}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
      </View>
    </View>
  );
}

function ResultCard({ platformKey, post, account, retrying, onRetry }: { platformKey: PublishPlatform; post: SocialPost; account?: string | null; retrying: boolean; onRetry: () => void }) {
  const p = PLATFORMS.find((x) => x.key === platformKey)!;
  const failed = post.status === 'FAILED';
  const published = post.status === 'PUBLISHED';
  const processing = post.status === 'PUBLISHING';
  const text = published
    ? platformKey === 'tiktok' && post.privacyLevel === 'SELF_ONLY' ? 'تم النشر بخصوصية «أنا فقط»، تجده في حسابك' : 'تم النشر'
    : failed ? post.error
    : processing ? 'تيك توك يعالج المنشور، سيظهر على حسابك خلال دقائق'
    : post.error ? post.error
    : `مجدول، يُنشر تلقائياً في ${post.scheduledAt ? formatDateTime(post.scheduledAt) : 'الموعد'}`;
  return (
    <Card tone={published ? 'ok' : failed ? 'bad' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={p.icon} size={20} color={colors.text} />
        <AppText weight="extraBold" style={{ flex: 1 }}>{p.label}{!!account && <AppText muted style={{ fontSize: 13 }}>  @{account}</AppText>}</AppText>
        <Chip label={published ? 'منشور' : failed ? 'فشل' : processing ? 'قيد المعالجة' : 'مجدول'} tone={published ? 'ok' : failed ? 'bad' : 'muted'} />
      </View>
      <AppText muted style={{ fontSize: 13, lineHeight: 21 }}>{text}</AppText>
      {failed && <ActionButton title="إعادة المحاولة" icon="refresh-outline" tone="soft" compact loading={retrying} onPress={onRetry} />}
    </Card>
  );
}
