import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT, faqCategories, faqs } from '@wasit/shared';
import { AppText, colors, fonts, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Record<string, IconName> = {
  orders: 'cube-outline',
  shipping: 'bicycle-outline',
  returns: 'refresh-outline',
  payment: 'card-outline',
  account: 'person-outline',
  points: 'gift-outline',
  vendors: 'storefront-outline',
};

const QUICK_LINKS: { icon: IconName; title: string; text: string; onPress: () => void }[] = [
  { icon: 'cube-outline', title: 'تتبع طلباتي', text: 'تابع حالة طلباتك وشحناتك', onPress: () => router.push('/orders') },
  { icon: 'refresh-outline', title: 'طلب إرجاع', text: 'قدّم طلب إرجاع وتابع حالته', onPress: () => router.push('/returns') },
  { icon: 'bicycle-outline', title: 'الشحن والتوصيل', text: 'الرسوم والمدة ومراحل الطلب', onPress: () => router.push({ pathname: '/info/[doc]', params: { doc: 'shipping' } }) },
  { icon: 'card-outline', title: 'طرق الدفع', text: 'الدفع عند الاستلام وزين كاش', onPress: () => router.push({ pathname: '/info/[doc]', params: { doc: 'payment' } }) },
];

// إزالة التشكيل وتوحيد الهمزات لتحسين البحث بالعربية
const normalize = (text: string) =>
  text
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();

export default function HelpScreen() {
  useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return faqs.filter((f) => {
      if (category !== 'all' && f.category !== category) return false;
      return !q || normalize(f.q).includes(q) || normalize(f.a).includes(q);
    });
  }, [query, category]);

  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6, alignItems: 'center' }}>
          <AppText weight="bold" style={styles.title}>
            كيف يمكننا مساعدتك؟
          </AppText>
          <AppText muted style={{ fontSize: 15, textAlign: 'center' }}>
            ابحث في الأسئلة الشائعة أو تصفح المواضيع أدناه
          </AppText>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setOpen(null);
            }}
            placeholder="اكتب سؤالك، مثلاً: الإرجاع، رسوم التوصيل..."
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {!query && (
          <View style={{ gap: 10 }}>
            {QUICK_LINKS.map((l) => (
              <Pressable key={l.title} onPress={l.onPress} style={styles.quick}>
                <View style={styles.quickIcon}>
                  <Ionicons name={l.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 15 }}>
                    {l.title}
                  </AppText>
                  <AppText muted style={{ fontSize: 13 }}>
                    {l.text}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ id: 'all', title: 'جميع الأسئلة' }, ...faqCategories].map((c) => {
            const active = category === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCategory(c.id);
                  setOpen(null);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons name={CATEGORY_ICONS[c.id] ?? 'chatbubble-outline'} size={16} color={active ? colors.primary : tc('#4B5563')} />
                <AppText weight={active ? 'medium' : 'regular'} style={{ fontSize: 14, color: active ? colors.primary : tc('#4B5563') }}>
                  {c.title}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <AppText weight="bold" style={{ fontSize: 19 }}>
          {query ? `نتائج البحث (${results.length})` : 'الأسئلة الشائعة'}
        </AppText>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={44} color={tc("#D1D5DB")} />
            <AppText weight="bold">لم نجد نتائج مطابقة</AppText>
            <AppText muted style={{ fontSize: 14, textAlign: 'center' }}>
              جرّب كلمات أخرى أو تواصل مع فريق الدعم مباشرة
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {results.map((f, i) => {
              const isOpen = open === f.q;
              return (
                <View key={f.q} style={i > 0 && styles.divider}>
                  <Pressable onPress={() => setOpen(isOpen ? null : f.q)} style={styles.q} accessibilityState={{ expanded: isOpen }}>
                    <AppText weight="medium" style={{ flex: 1, fontSize: 15, color: isOpen ? colors.primary : colors.text }}>
                      {f.q}
                    </AppText>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={tc("#9CA3AF")} />
                  </Pressable>
                  {isOpen && <AppText style={styles.a}>{f.a}</AppText>}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.contact}>
          <AppText weight="bold" style={{ fontSize: 20, color: colors.white }}>
            لم تجد إجابة لسؤالك؟
          </AppText>
          <AppText style={{ color: tc('#E0E7FF'), fontSize: 14 }}>فريق خدمة العملاء متاح {CONTACT.workingHours}</AppText>
          <Pressable style={styles.contactSolid} onPress={() => router.push('/contact')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            <AppText weight="medium" style={{ color: colors.primary }}>
              راسلنا
            </AppText>
          </Pressable>
          <Pressable style={styles.contactOutline} onPress={() => Linking.openURL(CONTACT.phoneHref)}>
            <Ionicons name="call-outline" size={18} color={colors.white} />
            <AppText weight="medium" style={{ color: colors.white }}>
              {CONTACT.phone}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  title: { fontSize: 26, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, textAlign: 'right', paddingVertical: 0 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  list: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  q: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  a: { paddingHorizontal: 18, paddingBottom: 18, marginTop: -4, fontSize: 14, lineHeight: 26, color: '#4B5563' },
  empty: { alignItems: 'center', gap: 8, padding: 32, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  contact: { backgroundColor: colors.primary, borderRadius: 16, padding: 24, gap: 12 },
  contactSolid: { height: 48, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  contactOutline: { height: 48, borderRadius: 12, borderWidth: 2, borderColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
}));
