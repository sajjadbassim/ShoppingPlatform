import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';

type IconName = keyof typeof Ionicons.glyphMap;

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'storefront-outline', title: 'متاجر متنوعة', text: 'مئات المنتجات من متاجر محلية موثوقة في مكان واحد.' },
  { icon: 'bicycle-outline', title: 'توصيل سريع', text: 'فريق توصيل خاص يتابع طلبك حتى باب منزلك.' },
  { icon: 'shield-checkmark-outline', title: 'تسوق آمن', text: 'دفع آمن وحماية كاملة لبياناتك الشخصية.' },
  { icon: 'gift-outline', title: 'النقاط التشجيعية', text: 'اجمع النقاط مع كل طلب واستبدلها بخصومات.' },
];

const VALUES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'heart-outline', title: 'الثقة', text: 'نبني علاقة طويلة مع عملائنا وبائعينا قائمة على الشفافية والمصداقية.' },
  { icon: 'sparkles-outline', title: 'الجودة', text: 'نحرص على أن تكون كل تجربة على المنصة مميزة، من التصفح حتى الاستلام.' },
  { icon: 'people-outline', title: 'دعم المجتمع', text: 'نمكّن التجار المحليين من الوصول إلى عملاء أكثر وتنمية أعمالهم.' },
];

export default function AboutScreen() {
  useTheme();
  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <AppText weight="medium" style={{ color: colors.primary, fontSize: 13 }}>
              من نحن
            </AppText>
          </View>
          <AppText weight="bold" style={styles.title}>
            منصة واسط التجارية
          </AppText>
          <AppText style={styles.lead}>
            منصة تسوق إلكتروني عراقية انطلقت من محافظة واسط، تجمع بين العملاء والمتاجر المحلية في سوق رقمي واحد، لنقدّم تجربة تسوق سهلة وآمنة وتوصيلاً سريعاً إلى باب منزلك.
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="flag-outline" size={24} color={colors.primary} />
          </View>
          <AppText weight="bold" style={styles.cardTitle}>
            رسالتنا
          </AppText>
          <AppText style={styles.body}>
            تسهيل وصول الجميع إلى المنتجات التي يحتاجونها بأفضل الأسعار، ودعم التجار المحليين بأدوات رقمية تساعدهم على النمو والوصول إلى شريحة أوسع من العملاء.
          </AppText>
        </View>
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="eye-outline" size={24} color={colors.primary} />
          </View>
          <AppText weight="bold" style={styles.cardTitle}>
            رؤيتنا
          </AppText>
          <AppText style={styles.body}>
            أن نكون الوجهة الأولى للتسوق الإلكتروني في العراق، والمنصة الأكثر ثقة لدى العملاء والبائعين على حد سواء.
          </AppText>
        </View>

        <View style={{ gap: 4, alignItems: 'center', marginTop: 8 }}>
          <AppText weight="bold" style={{ fontSize: 22 }}>
            لماذا واسط التجارية؟
          </AppText>
          <AppText muted style={{ fontSize: 14 }}>
            كل ما تحتاجه لتجربة تسوق متكاملة
          </AppText>
        </View>
        {FEATURES.map((f) => (
          <View key={f.title} style={[styles.card, { alignItems: 'center' }]}>
            <View style={styles.round}>
              <Ionicons name={f.icon} size={26} color={colors.primary} />
            </View>
            <AppText weight="bold" style={{ fontSize: 16 }}>
              {f.title}
            </AppText>
            <AppText muted style={{ fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              {f.text}
            </AppText>
          </View>
        ))}

        <AppText weight="bold" style={{ fontSize: 22, textAlign: 'center', marginTop: 8 }}>
          قيمنا
        </AppText>
        {VALUES.map((v) => (
          <View key={v.title} style={[styles.card, styles.valueRow]}>
            <View style={styles.valueIcon}>
              <Ionicons name={v.icon} size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText weight="bold" style={{ fontSize: 16 }}>
                {v.title}
              </AppText>
              <AppText muted style={{ fontSize: 14, lineHeight: 22 }}>
                {v.text}
              </AppText>
            </View>
          </View>
        ))}

        <View style={styles.cta}>
          <AppText weight="bold" style={{ color: colors.white, fontSize: 22, textAlign: 'center' }}>
            ابدأ رحلة التسوق معنا
          </AppText>
          <AppText style={{ color: tc('#E0E7FF'), fontSize: 14, textAlign: 'center' }}>تصفح آلاف المنتجات من المتاجر المحلية المفضلة لديك</AppText>
          <Pressable style={styles.ctaSolid} onPress={() => router.navigate('/products')}>
            <AppText weight="medium" style={{ color: colors.primary }}>
              تسوق الآن
            </AppText>
          </Pressable>
          <Pressable style={styles.ctaOutline} onPress={() => router.push('/contact')}>
            <AppText weight="medium" style={{ color: colors.white }}>
              تواصل معنا
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  badge: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  title: { fontSize: 28, textAlign: 'center' },
  lead: { fontSize: 15, lineHeight: 28, color: '#4B5563', textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 8 },
  cardIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 20 },
  body: { fontSize: 15, lineHeight: 28, color: '#4B5563' },
  round: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  valueIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cta: { backgroundColor: colors.primary, borderRadius: 16, padding: 24, gap: 12, marginTop: 8 },
  ctaSolid: { height: 48, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  ctaOutline: { height: 48, borderRadius: 12, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
}));
