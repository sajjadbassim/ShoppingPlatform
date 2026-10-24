import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT, useSessionStore, type AuthUser } from '@wasit/shared';
import { AppText, Button, Input, colors, fonts, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';
import { toast } from '../lib/toast';

const SUBJECTS = ['استفسار عام', 'مشكلة في طلب', 'الإرجاع والاسترداد', 'الدفع', 'الانضمام كبائع', 'اقتراح أو شكوى'];

type IconName = keyof typeof Ionicons.glyphMap;
const CARDS: { icon: IconName; title: string; value: string; href?: string }[] = [
  { icon: 'call-outline', title: 'الهاتف', value: CONTACT.phone, href: CONTACT.phoneHref },
  { icon: 'mail-outline', title: 'البريد الإلكتروني', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: 'location-outline', title: 'العنوان', value: CONTACT.address },
  { icon: 'time-outline', title: 'ساعات العمل', value: CONTACT.workingHours },
];

export default function ContactScreen() {
  useTheme();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [orderNumber, setOrderNumber] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  // لا توجد واجهة خلفية للرسائل، لذا نفتح تطبيق البريد برسالة معبأة مسبقاً (كما في الويب)
  const submit = () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'الاسم مطلوب';
    if (!/^\S+@\S+\.\S+$/.test(email)) found.email = 'البريد الإلكتروني غير صالح';
    if (message.trim().length < 10) found.message = 'يرجى كتابة رسالة لا تقل عن 10 أحرف';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = [
      `الاسم: ${name}`,
      `البريد الإلكتروني: ${email}`,
      phone ? `الهاتف: ${phone}` : null,
      orderNumber ? `رقم الطلب: ${orderNumber}` : null,
      '',
      message,
    ]
      .filter((l) => l !== null)
      .join('\n');

    Linking.openURL(`mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() =>
      toast.error(`تعذّر فتح البريد، يمكنك مراسلتنا على ${CONTACT.email}`),
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <AppText weight="bold" style={{ fontSize: 24 }}>
            تواصل معنا
          </AppText>
          <AppText muted style={{ fontSize: 15 }}>
            فريقنا جاهز للإجابة عن استفساراتك ومساعدتك في أي وقت
          </AppText>
        </View>

        {CARDS.map((c) => (
          <Pressable key={c.title} disabled={!c.href} onPress={() => c.href && Linking.openURL(c.href)} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name={c.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText muted style={{ fontSize: 13 }}>
                {c.title}
              </AppText>
              <AppText weight="medium" style={{ fontSize: 15 }}>
                {c.value}
              </AppText>
            </View>
          </Pressable>
        ))}

        <View style={styles.help}>
          <Ionicons name="help-circle-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText weight="bold" style={{ fontSize: 15 }}>
              لديك مشكلة في طلب؟
            </AppText>
            <AppText style={{ fontSize: 14, lineHeight: 24, color: tc('#4B5563') }}>
              يمكنك متابعة حالة طلبك من{' '}
              <AppText weight="medium" style={{ color: colors.primary }} onPress={() => router.push('/orders')}>
                طلباتي
              </AppText>{' '}
              أو تقديم طلب إرجاع من{' '}
              <AppText weight="medium" style={{ color: colors.primary }} onPress={() => router.push('/returns')}>
                طلبات الإرجاع
              </AppText>
              .
            </AppText>
          </View>
        </View>

        <View style={styles.form}>
          <AppText weight="bold" style={{ fontSize: 20 }}>
            أرسل لنا رسالة
          </AppText>
          <Input label="الاسم الكامل *" value={name} onChangeText={setName} error={errors.name} />
          <Input label="البريد الإلكتروني *" value={email} onChangeText={setEmail} error={errors.email} ltr keyboardType="email-address" autoCapitalize="none" />
          <Input label="رقم الهاتف" value={phone} onChangeText={setPhone} ltr keyboardType="phone-pad" />
          <Input label="رقم الطلب (اختياري)" value={orderNumber} onChangeText={setOrderNumber} ltr />

          <View style={{ gap: 8 }}>
            <AppText weight="medium" style={{ fontSize: 14 }}>
              الموضوع
            </AppText>
            <View style={styles.subjects}>
              {SUBJECTS.map((s) => (
                <Pressable key={s} onPress={() => setSubject(s)} style={[styles.chip, subject === s && styles.chipActive]}>
                  <AppText weight="medium" style={{ fontSize: 13, color: subject === s ? colors.white : tc('#374151') }}>
                    {s}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <AppText weight="medium" style={{ fontSize: 14 }}>
              الرسالة *
            </AppText>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="اكتب رسالتك هنا..."
              placeholderTextColor={colors.placeholder}
              multiline
              style={[styles.message, !!errors.message && { borderColor: colors.error }]}
            />
            {!!errors.message && (
              <AppText style={{ color: colors.error, fontSize: 13 }}>{errors.message}</AppText>
            )}
          </View>

          <Button title="إرسال الرسالة" onPress={submit} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  help: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  form: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 16 },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary },
  message: { minHeight: 130, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 15, textAlign: 'right', textAlignVertical: 'top', backgroundColor: colors.surface },
}));
