import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT, infoDocuments, type DocBlock, type InfoDocKey } from '@wasit/shared';
import { AppText, Button, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { AppHeader } from '../../components/AppHeader';

// مسارات الويب ← شاشات التطبيق
const ACTION_ROUTES: Record<string, Href> = { '/orders': '/orders', '/returns': '/returns' };

const TABS: { key: InfoDocKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'terms', icon: 'document-text-outline', label: 'الشروط والأحكام' },
  { key: 'privacy', icon: 'shield-checkmark-outline', label: 'سياسة الخصوصية' },
  { key: 'usage', icon: 'reader-outline', label: 'سياسة الاستخدام' },
  { key: 'shipping', icon: 'bicycle-outline', label: 'الشحن والتوصيل' },
  { key: 'returnPolicy', icon: 'refresh-circle-outline', label: 'سياسة الإرجاع' },
  { key: 'payment', icon: 'card-outline', label: 'طرق الدفع' },
];

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ar-IQ-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });

function Block({ block }: { block: DocBlock }) {
  useTheme();
  if (typeof block === 'string') return <AppText style={styles.para}>{block}</AppText>;
  if ('note' in block) {
    return (
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 3 }} />
        <AppText style={styles.noteText}>{block.note}</AppText>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {block.list.map((item, i) => (
        <View key={i} style={styles.li}>
          <View style={styles.dot} />
          <AppText style={styles.liText}>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

export default function InfoDocumentScreen() {
  useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = (doc in infoDocuments ? doc : 'terms') as InfoDocKey;
  const document = infoDocuments[key];

  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <AppText weight="bold" style={styles.title}>
            {document.title}
          </AppText>
          <AppText muted style={styles.subtitle}>
            {document.subtitle}
          </AppText>
          <View style={styles.date}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <AppText muted style={{ fontSize: 13 }}>
              آخر تحديث: {formatDate(document.lastUpdated)}
            </AppText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const active = t.key === key;
            return (
              <Pressable
                key={t.key}
                onPress={() => router.replace({ pathname: '/info/[doc]', params: { doc: t.key } })}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons name={t.icon} size={16} color={active ? colors.white : tc('#374151')} />
                <AppText weight="medium" style={{ fontSize: 14, color: active ? colors.white : tc('#374151') }}>
                  {t.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          {document.sections.map((s, i) => (
            <View key={s.id} style={{ gap: 12 }}>
              <View style={styles.sectionTitle}>
                <View style={styles.num}>
                  <AppText weight="bold" style={{ color: colors.primary, fontSize: 14 }}>
                    {i + 1}
                  </AppText>
                </View>
                <AppText weight="bold" style={styles.sectionText}>
                  {s.title}
                </AppText>
              </View>
              {s.content.map((b, j) => (
                <Block key={j} block={b} />
              ))}
            </View>
          ))}
          {document.action && ACTION_ROUTES[document.action.path] && (
            <Button title={document.action.label} onPress={() => router.push(ACTION_ROUTES[document.action!.path])} />
          )}
        </View>

        <View style={styles.card}>
          <AppText weight="bold" style={{ fontSize: 17 }}>
            هل لديك استفسار؟
          </AppText>
          <AppText muted style={{ fontSize: 14 }}>
            إذا كانت لديك أي أسئلة حول {document.title}، لا تتردد في التواصل مع فريق الدعم.
          </AppText>
          <Button title={CONTACT.email} onPress={() => Linking.openURL(`mailto:${CONTACT.email}`)} />
          <Button title={CONTACT.phone} variant="outline" onPress={() => Linking.openURL(CONTACT.phoneHref)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  head: { gap: 6 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 15, lineHeight: 24 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tabs: { gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 24 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  sectionText: { fontSize: 17, flex: 1 },
  para: { fontSize: 15, lineHeight: 28, color: '#4B5563' },
  li: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 11 },
  liText: { flex: 1, fontSize: 15, lineHeight: 28, color: '#4B5563' },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#EEF2FF' },
  noteText: { flex: 1, fontSize: 14, lineHeight: 24, color: colors.primary },
}));
