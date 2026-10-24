import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SocialItem } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';
import { ReelSlide } from './ReelSlide';

interface Viewable {
  index?: number | null;
  isViewable: boolean;
}

interface Props {
  items: SocialItem[];
  // الشريحة التي يبدأ منها العارض (فتح منشور من صفحة المتجر)
  initialIndex?: number;
  title?: string;
  isLoading?: boolean;
  isError?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  onClose: () => void;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// عارض بملء الشاشة بتمرير عمودي: يستعمله «ريلز» (كل المتاجر) وتبويب المنشورات في صفحة المتجر
export function ReelsViewer({
  items,
  initialIndex = 0,
  title = 'ريلز',
  isLoading,
  isError,
  emptyText = 'ستظهر هنا فيديوهات المتاجر عند نشرها',
  onRetry,
  onClose,
  onEndReached,
  onRefresh,
  refreshing = false,
}: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const [focused, setFocused] = useState(true);

  // الصوت يتوقف عند الانتقال لشاشة أخرى (منتج أو متجر) ويعود عند الرجوع
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: Viewable[] }) => {
    const first = viewableItems.find((v) => v.isViewable && v.index != null);
    if (first?.index != null) setActive(first.index);
  }).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const topBar = (
    <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable style={styles.round} onPress={onClose} accessibilityLabel="إغلاق">
        <Ionicons name="close" size={22} color={colors.white} />
      </Pressable>
      <AppText weight="extraBold" numberOfLines={1} style={styles.heading}>
        {title}
      </AppText>
      <Pressable style={styles.round} onPress={() => setMuted((m) => !m)} accessibilityLabel={muted ? 'تشغيل الصوت' : 'كتم الصوت'}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.white} />
      </Pressable>
    </View>
  );

  if (isLoading || isError || items.length === 0) {
    return (
      <View style={styles.page}>
        <StatusBar style="light" />
        {topBar}
        <View style={styles.center}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.white} />
              <AppText style={styles.dim}>جاري التحميل...</AppText>
            </>
          ) : (
            <>
              <Ionicons name="film-outline" size={44} color="rgba(255,255,255,0.6)" />
              <AppText weight="bold" style={styles.emptyTitle}>
                {isError ? 'تعذّر التحميل' : 'لا توجد منشورات بعد'}
              </AppText>
              <AppText style={styles.dim}>{isError ? 'تحقق من الاتصال وحاول مجدداً' : emptyText}</AppText>
              {isError && !!onRetry && (
                <Pressable style={styles.retry} onPress={onRetry}>
                  <AppText weight="bold" style={{ color: tc('#000') }}>
                    إعادة المحاولة
                  </AppText>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <StatusBar style="light" />
      {height > 0 && (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          onEndReachedThreshold={1.5}
          onEndReached={onEndReached}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} progressViewOffset={insets.top + 56} /> : undefined
          }
          renderItem={({ item, index }) => (
            <ReelSlide
              item={item}
              height={height}
              topInset={insets.top}
              bottomInset={insets.bottom}
              active={focused && index === active}
              near={Math.abs(index - active) <= 1}
              muted={muted}
            />
          )}
        />
      )}
      {topBar}
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, start: 0, end: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, textAlign: 'center', color: colors.white, fontSize: 18, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: colors.white, fontSize: 18 },
  dim: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center' },
  retry: { height: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
}));
