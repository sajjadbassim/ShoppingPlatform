import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { getImageUrl, IMG_SIZE } from '@wasit/shared';
import { AppText, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';

interface Props {
  title: string;
  subtitle?: string | null;
  // بانر رأس القسم (اختياري)
  bannerImageUrl?: string | null;
}

export function SectionHeader({ title, subtitle, bannerImageUrl }: Props) {
  useTheme();
  const banner = getImageUrl(bannerImageUrl, IMG_SIZE.FULL);

  if (banner) {
    return (
      <View style={styles.bannerWrap}>
        <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" transition={150} />
        <View style={styles.bannerText}>
          <AppText weight="extraBold" style={styles.bannerTitle}>
            {title}
          </AppText>
          {!!subtitle && <AppText style={styles.bannerSub}>{subtitle}</AppText>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <AppText weight="bold" style={styles.title}>
        {title}
      </AppText>
      {!!subtitle && (
        <AppText muted style={styles.subtitle}>
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  header: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  title: { fontSize: 20 },
  subtitle: { fontSize: 13 },
  bannerWrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.xl, overflow: 'hidden', height: 110 },
  banner: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.primaryLight },
  bannerText: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.25)' },
  bannerTitle: { color: colors.white, fontSize: 22 },
  bannerSub: { color: colors.white, fontSize: 13 },
}));
