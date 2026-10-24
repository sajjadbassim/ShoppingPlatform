import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchSearchSuggestions, MIN_SUGGEST_LENGTH, type SearchSuggestion } from '@wasit/shared';
import { AppText, colors, fonts, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '../lib/recentSearches';

const ICONS: Record<SearchSuggestion['type'], keyof typeof Ionicons.glyphMap> = {
  product: 'cube-outline',
  store: 'storefront-outline',
  category: 'pricetag-outline',
};
const LABELS: Record<SearchSuggestion['type'], string> = { product: 'منتج', store: 'متجر', category: 'فئة' };

// البحث (يقابل نافذة البحث العامة في الويب): اقتراحات حية أثناء الكتابة (منتجات ومتاجر وفئات)،
// وآخر عمليات البحث عند الفراغ، والإرسال يفتح نتائج المنتجات
export default function SearchScreen() {
  useTheme();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const grocery = scope === 'grocery';
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);

  // الطلب بعد توقف الكتابة 300ms: لا طلب مع كل حرف
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const enabled = term.length >= MIN_SUGGEST_LENGTH;
  const { data: suggestions = [], isFetching } = useQuery({
    queryKey: ['search-suggestions', term, grocery],
    queryFn: () => fetchSearchSuggestions(term, grocery ? 'grocery' : 'general'),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const typed = text.trim();
  const scopeParams = grocery ? { scope: 'grocery' } : {};

  const submit = (value: string = typed) => {
    const q = value.trim();
    if (!q) return;
    saveRecentSearch(q);
    Keyboard.dismiss();
    router.replace({ pathname: '/products', params: { search: q, ...scopeParams } });
  };

  const open = (s: SearchSuggestion) => {
    Keyboard.dismiss();
    if (s.type === 'product') router.replace({ pathname: '/product/[id]', params: { id: s.id } });
    else if (s.type === 'store') router.replace({ pathname: '/store/[id]', params: { id: s.id } });
    else router.replace({ pathname: '/products', params: { categoryId: s.id, ...scopeParams } });
  };

  const clearRecent = () => {
    setRecent([]);
    clearRecentSearches();
  };

  return (
    <View style={styles.page}>
      <AppHeader back />
      <View style={styles.box}>
        <View style={styles.row}>
          <Ionicons name="search-outline" size={20} color={colors.placeholder} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit()}
            placeholder={grocery ? 'ابحث في السوبرماركت...' : 'ابحث عن منتج، متجر...'}
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            autoFocus
            style={styles.input}
          />
          {!!text && (
            <Pressable onPress={() => setText('')} hitSlop={8} accessibilityLabel="مسح">
              <Ionicons name="close-circle" size={18} color={tc("#9CA3AF")} />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.go, !typed && { opacity: 0.5 }]} disabled={!typed} onPress={() => submit()}>
          <AppText weight="medium" style={{ color: colors.white }}>
            بحث
          </AppText>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {!typed ? (
          recent.length > 0 && (
            <>
              <View style={styles.head}>
                <AppText weight="bold" muted style={{ fontSize: 13 }}>
                  عمليات بحث سابقة
                </AppText>
                <Pressable onPress={clearRecent} hitSlop={8}>
                  <AppText style={{ fontSize: 13, color: colors.primary }}>مسح</AppText>
                </Pressable>
              </View>
              {recent.map((r) => (
                <Pressable key={r} style={styles.item} onPress={() => submit(r)}>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                  <AppText style={styles.itemText}>{r}</AppText>
                  <Ionicons name="arrow-back" size={16} color={colors.placeholder} />
                </Pressable>
              ))}
            </>
          )
        ) : (
          <>
            <Pressable style={styles.item} onPress={() => submit()}>
              <Ionicons name="search" size={20} color={colors.primary} />
              <AppText style={styles.itemText} numberOfLines={1}>
                بحث عن «{typed}»
              </AppText>
              {enabled && isFetching && <ActivityIndicator size="small" color={colors.primary} />}
            </Pressable>
            {enabled &&
              suggestions.map((s) => (
                <Pressable key={`${s.type}-${s.id}`} style={styles.item} onPress={() => open(s)}>
                  <Ionicons name={ICONS[s.type]} size={20} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1} style={styles.itemText}>
                      {s.text}
                    </AppText>
                    {!!s.subtitle && (
                      <AppText muted numberOfLines={1} style={{ fontSize: 12 }}>
                        {s.subtitle}
                      </AppText>
                    )}
                  </View>
                  <View style={styles.tag}>
                    <AppText style={styles.tagText}>{LABELS[s.type]}</AppText>
                  </View>
                </Pressable>
              ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  box: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, textAlign: 'right', paddingVertical: 0 },
  go: { height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemText: { flex: 1, fontSize: 15, color: colors.text },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tagText: { fontSize: 11, color: '#6B7280' },
}));
