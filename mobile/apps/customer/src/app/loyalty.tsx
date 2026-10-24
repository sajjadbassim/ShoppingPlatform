import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { referralShareText, tierProgressPct, useSessionStore, type LoyaltyAccount, type LoyaltyTransaction, formatDate, loyaltyTierName } from '@wasit/shared';
import { AppText, Button, colors, createStyles, createThemed, spacing, tc, useTheme } from '@wasit/ui';
import { useLoyaltyAccount, useLoyaltySettings, useLoyaltyTransactions, useReferral } from '../api/useEngagement';
import { AppHeader } from '../components/AppHeader';

const num = (n: number) => Math.round(n).toLocaleString('en-US');

const TIERS = createThemed<Record<string, { label: string; icon: string; bg: string; fg: string }>>(() => ({
  bronze: { label: 'بذرة', icon: '🌱', bg: tc('#FEF3C7'), fg: tc('#B45309') },
  silver: { label: 'برعم', icon: '🌿', bg: tc('#F3F4F6'), fg: tc('#374151') },
  gold: { label: 'زهرة', icon: '🌸', bg: tc('#FEF9C3'), fg: tc('#A16207') },
  platinum: { label: 'ثمرة', icon: '🍊', bg: tc('#F3E8FF'), fg: tc('#7E22CE') },
}));

function BalanceCard({ account, progress }: { account: LoyaltyAccount; progress: number }) {
  useTheme();
  const tier = TIERS[account.tier?.toLowerCase()] ?? TIERS.bronze;
  const pointValue = account.balanceValue > 0 && account.balance > 0 ? account.balanceValue / account.balance : 0.1;
  return (
    <LinearGradient colors={[tc('#6366F1'), tc('#4F46E5')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
      <View style={styles.balanceTop}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.onMuted}>رصيد النقاط</AppText>
          <AppText weight="bold" style={styles.balance}>
            {num(account.balance)}
          </AppText>
          <AppText style={styles.onMuted}>≈ {num(account.balance * pointValue)} د.ع</AppText>
        </View>
        <View style={{ alignItems: 'flex-start', gap: 8 }}>
          <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
            <AppText weight="medium" style={{ color: tier.fg, fontSize: 14, lineHeight: 20 }}>
              {tier.icon} {tier.label}
            </AppText>
          </View>
        </View>
      </View>

      {!!account.nextTier && (
        <View style={{ marginTop: 24 }}>
          <View style={styles.progressLabels}>
            <AppText style={styles.progressText}>المستوى الحالي: {tier.label}</AppText>
            <AppText style={styles.progressText}>
              التالي: {loyaltyTierName(account.nextTier)} ({num(account.nextTierPoints)} نقطة)
            </AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

function StatTile({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  useTheme();
  void color;
  return (
    <View style={styles.stat}>
      {icon}
      <AppText weight="bold" style={styles.statValue}>
        {num(value)}
      </AppText>
      <AppText muted style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

function ReferralCard() {
  useTheme();
  const referral = useReferral().data;
  const [copied, setCopied] = useState(false);
  if (!referral?.enabled || !referral.code) return null;
  const share = (message: string) => Share.share({ message }).catch(() => {});
  const copy = async () => {
    await Clipboard.setStringAsync(referral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <LinearGradient colors={[tc('#7C3AED'), tc('#4F46E5')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.referral}>
      <Ionicons name="gift-outline" size={112} color="rgba(255,255,255,0.1)" style={styles.referralArt} />
      <View style={styles.inline}>
        <Ionicons name="gift-outline" size={20} color={colors.white} />
        <AppText weight="bold" style={styles.referralTitle}>
          ادعُ صديقاً واكسبا معاً
        </AppText>
      </View>
      <AppText style={styles.referralText}>
        يحصل كل منكما على <AppText weight="bold" style={styles.referralText}>{num(referral.rewardPoints)} نقطة</AppText> عند تسليم أول طلب لصديقك
      </AppText>
      <View style={styles.referralRow}>
        <Pressable style={styles.code} onPress={copy} accessibilityLabel="نسخ الرمز">
          <AppText weight="bold" style={styles.codeText}>
            {referral.code}
          </AppText>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? tc('#86EFAC') : 'rgba(255,255,255,0.8)'} />
        </Pressable>
        <Pressable style={styles.shareBtn} onPress={() => share(referralShareText(referral))}>
          <Ionicons name="share-social-outline" size={17} color={tc("#4338CA")} />
          <AppText weight="bold" style={styles.shareText}>
            مشاركة
          </AppText>
        </Pressable>
      </View>
      {referral.invitedCount > 0 && (
        <View style={[styles.inline, { marginTop: 12 }]}>
          <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.85)" />
          <AppText style={styles.invited}>
            سجّل برمزك {referral.invitedCount} {referral.invitedCount === 1 ? 'صديق' : 'أصدقاء'}
            {referral.rewardedCount > 0 ? ` — أكمل ${referral.rewardedCount} منهم أول طلب` : ''}
          </AppText>
        </View>
      )}
    </LinearGradient>
  );
}

function TransactionRow({ tx, last }: { tx: LoyaltyTransaction; last: boolean }) {
  useTheme();
  const earn = tx.points > 0 || tx.type === 'earned' || tx.type === 'bonus';
  return (
    <View style={[styles.tx, !last && styles.txDivider]}>
      <View style={[styles.txIcon, { backgroundColor: earn ? tc('#DCFCE7') : tc('#FEE2E2') }]}>
        <Ionicons name={earn ? 'trending-up' : 'flash-outline'} size={16} color={earn ? tc('#16A34A') : colors.error} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="medium" style={styles.txTitle}>
          {tx.descriptionAr || tx.description || tx.typeAr || tx.type}
        </AppText>
        {!!tx.orderNumber && <AppText style={styles.txOrder}>طلب #{tx.orderNumber}</AppText>}
        <AppText style={styles.txDate}>{formatDate(tx.createdAt)}</AppText>
        {!!tx.expiresAt && <AppText style={styles.txExpire}>تنتهي: {formatDate(tx.expiresAt)}</AppText>}
      </View>
      <AppText weight="bold" style={[styles.txPoints, { color: earn ? tc('#16A34A') : colors.error }]}>
        {earn ? '+' : '-'}
        {num(Math.abs(tx.points))} نقطة
      </AppText>
    </View>
  );
}

export default function LoyaltyScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const account = useLoyaltyAccount();
  const settings = useLoyaltySettings();
  const transactions = useLoyaltyTransactions();
  const [spinning, setSpinning] = useState(false);
  const items = transactions.data?.pages.flatMap((p) => p.items) ?? [];

  const refresh = async () => {
    setSpinning(true);
    await Promise.all([account.refetch(), transactions.refetch()]).catch(() => {});
    setSpinning(false);
  };

  const body = () => {
    if (!signedIn) {
      return (
        <View style={styles.center}>
          <AppText weight="bold">سجّل دخولك لعرض نقاطك</AppText>
          <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
        </View>
      );
    }
    if (account.isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }
    if (account.isError || !account.data) {
      // فشل التحميل لا يُعرض كرصيد صفر: الزبون قد يظن أن نقاطه ضاعت
      return (
        <View style={styles.center}>
          <View style={styles.errorBox}>
            <AppText weight="medium" style={{ color: tc('#B91C1C') }}>
              تعذّر تحميل رصيد نقاطك
            </AppText>
            <Button title="إعادة المحاولة" variant="outline" onPress={() => account.refetch()} style={{ marginTop: 12 }} />
          </View>
        </View>
      );
    }

    const a = account.data;
    const progress = tierProgressPct(a, settings.data);
    const ways = [
      { icon: '🛍️', title: 'كل طلب', desc: 'اكسب نقاط على كل عملية شراء', show: true },
      { icon: '⭐', title: 'كتابة تقييم', desc: 'قيّم منتجاتك واكسب نقاط إضافية', show: (settings.data?.reviewPoints ?? 0) > 0 },
      { icon: '🎁', title: 'ادعُ صديقاً', desc: 'تكسب أنت وصديقك نقاطاً عند توصيل أول طلب له', show: (settings.data?.referralPoints ?? 0) > 0 },
    ].filter((w) => w.show);

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <AppText weight="bold" style={styles.title}>
            النقاط التشجيعية
          </AppText>
          <Pressable onPress={refresh} hitSlop={8} accessibilityLabel="تحديث">
            {spinning ? <ActivityIndicator size="small" color={colors.placeholder} /> : <Ionicons name="refresh" size={18} color={colors.placeholder} />}
          </Pressable>
        </View>

        <BalanceCard account={a} progress={progress} />

        <View style={styles.stats}>
          <StatTile icon={<Ionicons name="trending-up" size={20} color={tc("#22C55E")} />} color={tc("#22C55E")} value={a.totalEarned} label="إجمالي المكتسبة" />
          <StatTile icon={<Ionicons name="gift-outline" size={20} color={tc("#A855F7")} />} color={tc("#A855F7")} value={a.totalRedeemed} label="إجمالي المستخدمة" />
          <StatTile icon={<Ionicons name="star-outline" size={20} color={colors.primary} />} color={colors.primary} value={a.balance} label="الرصيد الحالي" />
        </View>

        {(a.expiringPoints ?? 0) > 0 && !!a.expiringDate && (
          <View style={styles.expiring}>
            <Ionicons name="time-outline" size={18} color={tc("#F97316")} />
            <View style={{ flex: 1 }}>
              <AppText weight="medium" style={{ color: tc('#C2410C'), fontSize: 14 }}>
                {num(a.expiringPoints ?? 0)} نقطة ستنتهي قريباً
              </AppText>
              <AppText style={{ color: tc('#EA580C'), fontSize: 12 }}>تاريخ الانتهاء: {formatDate(a.expiringDate)}</AppText>
            </View>
          </View>
        )}

        <ReferralCard />

        <View style={styles.card}>
          <View style={[styles.inline, { marginBottom: 16 }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <AppText weight="bold" style={styles.cardTitle}>
              كيف تكسب نقاط؟
            </AppText>
          </View>
          <View style={{ gap: 12 }}>
            {ways.map((w) => (
              <View key={w.title} style={styles.way}>
                <AppText style={{ fontSize: 24, lineHeight: 34 }}>{w.icon}</AppText>
                <AppText weight="medium" style={styles.wayTitle}>
                  {w.title}
                </AppText>
                <AppText style={styles.wayDesc}>{w.desc}</AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.inline, { marginBottom: 16 }]}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
            <AppText weight="bold" style={styles.cardTitle}>
              سجل النقاط
            </AppText>
          </View>
          {transactions.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="star-outline" size={32} color={tc("#D1D5DB")} />
              <AppText muted style={{ marginTop: 8 }}>
                لا توجد معاملات بعد
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.placeholder, marginTop: 4 }}>ابدأ التسوق لكسب النقاط التشجيعية</AppText>
            </View>
          ) : (
            <>
              {items.map((tx, i) => (
                <TransactionRow key={tx.id} tx={tx} last={i === items.length - 1 && !transactions.hasNextPage} />
              ))}
              {transactions.hasNextPage && (
                <Button
                  title="عرض المزيد"
                  variant="outline"
                  loading={transactions.isFetchingNextPage}
                  onPress={() => transactions.fetchNextPage()}
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.page}>
      <AppHeader back />
      {body()}
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorBox: { alignSelf: 'stretch', alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  content: { padding: spacing.md, gap: 16, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceCard: { borderRadius: 16, padding: 24 },
  balanceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  onMuted: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  balance: { color: colors.white, fontSize: 48, lineHeight: 62 },
  tierPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.white },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, paddingHorizontal: 4 },
  statValue: { fontSize: 20, lineHeight: 28 },
  statLabel: { fontSize: 12, textAlign: 'center' },
  expiring: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  referral: { borderRadius: 16, padding: 20, overflow: 'hidden' },
  referralArt: { position: 'absolute', start: -16, bottom: -16 },
  referralTitle: { color: colors.white, fontSize: 18 },
  referralText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  referralRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  code: { flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.4)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  codeText: { color: colors.white, fontSize: 20, letterSpacing: 3 },
  shareBtn: { height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareText: { color: '#4338CA', fontSize: 15 },
  invited: { color: 'rgba(255,255,255,0.85)', fontSize: 12, flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20 },
  cardTitle: { fontSize: 16 },
  way: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 },
  wayTitle: { fontSize: 14, color: '#1F2937' },
  wayDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  txDivider: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 14, color: '#111827' },
  txOrder: { fontSize: 12, color: colors.primary },
  txDate: { fontSize: 12, color: colors.placeholder },
  txExpire: { fontSize: 12, color: '#F97316' },
  txPoints: { fontSize: 14, flexShrink: 0 },
}));
