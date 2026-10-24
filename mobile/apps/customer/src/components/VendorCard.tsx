import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { formatPrice, getImageUrl, IMG_SIZE, type VendorSummary } from '@wasit/shared';
import { AppText, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';

export const VENDOR_CARD_WIDTH = 200;

interface Props {
  vendor: VendorSummary;
  onPress?: (vendor: VendorSummary) => void;
}

function VendorCardBase({ vendor, onPress }: Props) {
  useTheme();
  const cover = getImageUrl(vendor.coverImageUrl, IMG_SIZE.CARD);
  const logo = getImageUrl(vendor.logoUrl, IMG_SIZE.THUMB);

  return (
    <Pressable style={styles.card} onPress={() => onPress?.(vendor)} accessibilityRole="button">
      <View style={styles.cover}>
        {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={vendor.id} />}
      </View>
      <View style={styles.logoWrap}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" />
        ) : (
          <AppText weight="bold" style={styles.logoLetter}>
            {(vendor.nameAr || vendor.name).charAt(0)}
          </AppText>
        )}
      </View>
      <View style={styles.body}>
        <AppText weight="bold" numberOfLines={1}>
          {vendor.nameAr || vendor.name}
        </AppText>
        <View style={styles.meta}>
          {!!vendor.rating && (
            <AppText muted style={styles.small}>
              ★ {vendor.rating.toFixed(1)}
            </AppText>
          )}
          {vendor.deliveryFee != null && (
            <AppText muted style={styles.small}>
              توصيل {vendor.deliveryFee === 0 ? 'مجاني' : formatPrice(vendor.deliveryFee)}
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const VendorCard = memo(VendorCardBase);

const styles = createStyles(() => ({
  card: {
    width: VENDOR_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { height: 80, backgroundColor: colors.primaryLight },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    marginTop: -24,
    marginStart: spacing.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  logoLetter: { color: colors.primary, fontSize: 20 },
  body: { padding: spacing.md, paddingTop: spacing.sm, gap: 2 },
  meta: { flexDirection: 'row', gap: spacing.md },
  small: { fontSize: 12 },
}));
