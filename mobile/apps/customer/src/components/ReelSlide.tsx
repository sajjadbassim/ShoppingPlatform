import { memo, useEffect, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import WebView from 'react-native-webview';
import {
  formatPrice,
  getImageUrl,
  IMG_SIZE,
  isNativeReel,
  reelHasPlayer,
  tiktokPlayerUrl,
  type SocialChild,
  type SocialItem,
} from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';

const PLATFORM_NAMES: Record<string, string> = { tiktok: 'تيك توك', instagram: 'إنستغرام', facebook: 'فيسبوك' };
const PLATFORM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  tiktok: 'logo-tiktok',
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
};

// مشغّل تيك توك يعرض أزرار الإعجاب والمشاركة أسفل الطرف الأيمن دائماً؛ نتركها بلا طبقة لمس لتعمل
const TIKTOK_ACTIONS_WIDTH = 64;
const TIKTOK_ACTIONS_TOP = 0.66;

interface Props {
  item: SocialItem;
  height: number;
  topInset: number;
  bottomInset: number;
  active: boolean;
  near: boolean;
  muted: boolean;
}

// ===== فيديو مباشر (إنستغرام/فيسبوك) =====
function NativeVideo({ url, active, paused, muted, onReady }: {
  url: string;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onReady: () => void;
}) {
  useTheme();
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      const d = player.duration;
      setProgress(d > 0 ? Math.min(1, currentTime / d) : 0);
    });
    return () => {
      time.remove();
    };
  }, [player]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (active && !paused) {
      player.play();
    } else {
      player.pause();
      if (!active) player.currentTime = 0;
    }
  }, [player, active, paused]);

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={onReady}
      />
      {active && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </>
  );
}

// ===== تيك توك: المشغّل الرسمي داخل صفحة صغيرة (كما في الويب) =====
function TikTokPlayer({ item, top, active, paused, muted, onReady }: {
  item: SocialItem;
  top: number;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onReady: () => void;
}) {
  useTheme();
  const ref = useRef<ComponentRef<typeof WebView>>(null);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe id="f" src="${tiktokPlayerUrl(item)}" allow="autoplay; encrypted-media; fullscreen"></iframe></body></html>`;

  const send = (type: string) =>
    ref.current?.injectJavaScript(
      `document.getElementById('f').contentWindow.postMessage({type:'${type}','x-tiktok-player':true},'*');true;`,
    );

  useEffect(() => {
    send(muted ? 'mute' : 'unMute');
  }, [muted]);
  useEffect(() => {
    send(active && !paused ? 'play' : 'pause');
  }, [active, paused]);

  return (
    <WebView
      ref={ref}
      source={{ html, baseUrl: 'https://wasit.app' }}
      style={[styles.tiktok, { top }]}
      originWhitelist={['*']}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      onLoadEnd={() => {
        onReady();
        send(muted ? 'mute' : 'unMute');
      }}
    />
  );
}

// ===== ألبوم: تمرير أفقي بين العناصر =====
function Carousel({ item, width, active }: { item: SocialItem; width: number; active: boolean }) {
  useTheme();
  const [index, setIndex] = useState(0);
  const children: SocialChild[] = item.children?.length ? item.children : [{ mediaType: 'image', url: item.coverImageUrl }];
  return (
    <View style={StyleSheet.absoluteFill}>
      <FlatList
        data={children}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item: child, index: i }) => (
          <View style={{ width, height: '100%' }}>
            {child.mediaType === 'video' && child.url && active && i === index ? (
              <NativeVideo url={child.url} active paused={false} muted onReady={() => {}} />
            ) : (
              <Image
                source={{ uri: (child.mediaType === 'video' ? child.thumbnailUrl : child.url) ?? undefined }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            )}
          </View>
        )}
      />
      {children.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {children.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

function ReelSlideBase({ item, height, topInset, bottomInset, active, near, muted }: Props) {
  useTheme();
  const native = isNativeReel(item);
  const player = reelHasPlayer(item);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const platformName = PLATFORM_NAMES[item.platform] ?? item.platform;

  // عند مغادرة الشريحة يُعاد تشغيلها من البداية عند الرجوع
  useEffect(() => {
    if (!active) {
      setPaused(false);
      setReady(false);
    }
  }, [active]);

  const onReady = useRef(() => setReady(true)).current;

  return (
    <View style={[styles.slide, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* الغلاف يظهر فوراً إلى أن يجهز المشغّل */}
      {near && !!item.coverImageUrl && item.mediaType !== 'carousel' && !(player && ready && active) && (
        <Image
          source={{ uri: item.coverImageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={native ? 'contain' : 'cover'}
          transition={150}
        />
      )}

      {active && native && item.mediaType === 'video' && !!item.videoUrl && (
        <NativeVideo url={item.videoUrl} active={active} paused={paused} muted={muted} onReady={onReady} />
      )}
      {active && !native && (
        <TikTokPlayer item={item} top={topInset + 52} active={active} paused={paused} muted={muted} onReady={onReady} />
      )}
      {near && item.mediaType === 'carousel' && width > 0 && <Carousel item={item} width={width} active={active} />}

      {/* طبقة اللمس فوق المشغّل: اللمسة تُوقف/تشغّل، والسحب العمودي يبقى للقائمة */}
      {active && player && !native && (
        <>
          <Pressable
            style={[styles.tapTikTok, { height: `${TIKTOK_ACTIONS_TOP * 100}%`, top: topInset + 52, end: 0 }]}
            onPress={() => setPaused((p) => !p)}
          />
          <Pressable
            style={[styles.tapTikTok, { bottom: 0, start: 0, end: TIKTOK_ACTIONS_WIDTH, top: height * TIKTOK_ACTIONS_TOP }]}
            onPress={() => setPaused((p) => !p)}
          />
        </>
      )}
      {active && player && native && <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((p) => !p)} />}
      {active && player && paused && (
        <View style={styles.pauseIcon} pointerEvents="none">
          <Ionicons name="play" size={30} color={colors.white} />
        </View>
      )}

      {near && (
        <View style={[styles.info, { paddingBottom: bottomInset + 18, paddingStart: native ? 16 : TIKTOK_ACTIONS_WIDTH + 12 }]} pointerEvents="box-none">
          {!!item.product && (
            <Pressable
              style={styles.product}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product!.id } })}
            >
              <Image
                source={{ uri: getImageUrl(item.product.primaryImageUrl, IMG_SIZE.THUMB) ?? undefined }}
                style={styles.productImg}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <AppText weight="bold" numberOfLines={1} style={{ fontSize: 14, color: colors.text }}>
                  {item.product.nameAr || item.product.name}
                </AppText>
                <AppText weight="bold" style={{ fontSize: 14, color: colors.primary }}>
                  {formatPrice(item.product.price)}
                </AppText>
              </View>
              <View style={styles.buy}>
                <Ionicons name="bag-handle" size={14} color={colors.white} />
                <AppText weight="bold" style={{ color: colors.white, fontSize: 12 }}>
                  اشترِ الآن
                </AppText>
              </View>
            </Pressable>
          )}

          {!!item.store && (
            <Pressable
              style={styles.store}
              onPress={() => router.push({ pathname: '/store/[id]', params: { id: item.store!.id } })}
            >
              <View style={styles.logo}>
                {!!item.store.logoUrl && (
                  <Image source={{ uri: getImageUrl(item.store.logoUrl, IMG_SIZE.THUMB) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
                )}
              </View>
              <AppText weight="bold" numberOfLines={1} style={styles.storeName}>
                {item.store.nameAr || item.store.name}
              </AppText>
              <View style={styles.storeTag}>
                <AppText weight="bold" style={{ fontSize: 11, color: tc('#111827') }}>
                  المتجر
                </AppText>
              </View>
            </Pressable>
          )}

          {native && !!item.title && (
            <AppText numberOfLines={2} style={styles.title}>
              {item.title}
            </AppText>
          )}
          {native && !!item.shareUrl && (
            <Pressable style={styles.link} onPress={() => Linking.openURL(item.shareUrl!)}>
              <Ionicons name={PLATFORM_ICONS[item.platform] ?? 'open-outline'} size={16} color={colors.white} />
              <AppText weight="bold" style={{ color: colors.white, fontSize: 12 }}>
                {player || item.mediaType !== 'video' ? 'عرض' : 'شاهد الفيديو'} على {platformName}
              </AppText>
              <Ionicons name="open-outline" size={12} color={colors.white} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export const ReelSlide = memo(ReelSlideBase);

const styles = createStyles(() => ({
  slide: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  tiktok: { position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, backgroundColor: 'transparent' },
  tapTikTok: { position: 'absolute', start: 0 },
  pauseIcon: {
    position: 'absolute', alignSelf: 'center', top: '45%', width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { position: 'absolute', start: 0, end: 0, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', flexDirection: 'row' },
  progressFill: { height: '100%', backgroundColor: colors.white },
  dots: { position: 'absolute', start: 0, end: 0, bottom: 150, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: colors.white },
  info: {
    position: 'absolute', start: 0, end: 0, bottom: 0, paddingTop: 40, paddingEnd: 16, gap: 8,
    alignItems: 'flex-start', backgroundColor: 'transparent',
  },
  product: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16,
    backgroundColor: colors.white,
  },
  productImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6' },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.primary },
  store: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '85%', padding: 4, paddingEnd: 12, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  logo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, overflow: 'hidden' },
  storeName: { color: colors.white, fontSize: 14, flexShrink: 1 },
  storeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.white },
  title: { color: colors.white, fontSize: 14, lineHeight: 24 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)' },
}));
