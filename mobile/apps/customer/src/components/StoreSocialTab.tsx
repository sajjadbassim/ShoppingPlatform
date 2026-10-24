import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { compactCount, type SocialItem } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';

const PLATFORM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  tiktok: 'logo-tiktok',
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
};

// شبكة منشورات المتجر (3 أعمدة بفواصل رفيعة كما في الويب). الضغط على منشور يفتح عارض الريلز
// بملء الشاشة من ذلك المنشور (الفيديو يُشغَّل داخل التطبيق ويمكن التمرير لبقية المنشورات)
export function StoreSocialTab({ items, vendorId }: { items: SocialItem[]; vendorId: string }) {
  useTheme();
  const open = (item: SocialItem) => router.push({ pathname: '/reels', params: { vendor: vendorId, start: item.id } });

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        // إنستغرام وفيسبوك لا يعطيان المشاهدات، فنعرض الإعجابات
        const showLikes = item.platform !== 'tiktok' || item.viewCount == null;
        return (
          <Pressable key={item.id} style={styles.tile} onPress={() => open(item)} accessibilityLabel={item.title || 'فتح المنشور'}>
            {item.coverImageUrl ? (
              <Image source={{ uri: item.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.noCover]}>
                <Ionicons name={PLATFORM_ICONS[item.platform] ?? 'play'} size={30} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={styles.shade} />
            {item.mediaType === 'video' && (
              <View style={styles.playBadge}>
                <Ionicons name="play" size={22} color={colors.white} />
              </View>
            )}
            {(item.likeCount != null || item.viewCount != null) && (
              <View style={styles.count}>
                <Ionicons name={showLikes ? 'heart' : 'play'} size={12} color={colors.white} />
                <AppText weight="medium" style={styles.countText}>
                  {compactCount(showLikes ? item.likeCount : item.viewCount)}
                </AppText>
              </View>
            )}
            <View style={styles.platform}>
              <Ionicons name={PLATFORM_ICONS[item.platform] ?? 'globe-outline'} size={15} color={colors.white} />
            </View>
            {!!item.product && (
              <View style={styles.product}>
                <Ionicons name="bag-handle" size={12} color={tc("#111827")} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = createStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tile: { width: '33%', flexGrow: 1, maxWidth: '33.5%', aspectRatio: 3 / 4, backgroundColor: '#111827', overflow: 'hidden' },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', start: 0, end: 0, bottom: 0, height: '33%', backgroundColor: 'rgba(0,0,0,0.35)' },
  playBadge: {
    position: 'absolute', alignSelf: 'center', top: '38%', width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  count: { position: 'absolute', bottom: 6, start: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  countText: { color: colors.white, fontSize: 12 },
  platform: { position: 'absolute', bottom: 6, end: 6 },
  product: { position: 'absolute', top: 6, end: 6, width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
}));
