import { useEffect, useRef, useState } from 'react';
import { FlatList, type FlatListProps, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { getImageUrl, IMG_SIZE, type Banner } from '@wasit/shared';
import { colors, createStyles, useTheme } from '@wasit/ui';

const AUTO_ADVANCE_MS = 5000;

interface Props {
  banners: Banner[];
  onPress?: (banner: Banner) => void;
}

// السلايدر العلوي: بانرات بلا قسم (sectionId = null)، يتقدّم وحده كل 5 ثوانٍ
export function HeroSlider({ banners, onPress }: Props) {
  useTheme();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  const onViewable = useRef<NonNullable<FlatListProps<Banner>['onViewableItemsChanged']>>(({ viewableItems }) => {
    const first = viewableItems[0]?.index;
    if (first != null) {
      indexRef.current = first;
      setIndex(first);
    }
  }).current;

  if (banners.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => {
          return (
            <View style={{ width }}>
              <Pressable
                style={[styles.slide, { width }]}
                onPress={() => onPress?.(item)}
                accessibilityRole="imagebutton"
                accessibilityLabel={item.titleAr || item.title || 'عرض'}
              >
                <Image
                  source={{ uri: getImageUrl(item.imageUrl, IMG_SIZE.FULL) ?? undefined }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            </View>
          );
        }}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  container: {},
  slide: { aspectRatio: 1600 / 656, overflow: 'hidden', backgroundColor: colors.primaryLight },
  // مؤشرات الشرائح فوق أسفل الصورة من جهة البداية (كما في الويب)
  dots: { position: 'absolute', bottom: 10, start: 12, flexDirection: 'row', gap: 6 },
  dot: { width: 12, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 24, backgroundColor: colors.white },
}));
