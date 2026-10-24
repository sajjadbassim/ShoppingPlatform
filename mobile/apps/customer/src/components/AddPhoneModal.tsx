import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addPhone, normalizeIraqiPhone, sendPhoneCode, validateResetPhone, verifyPhoneCode, type ApiError } from '@wasit/shared';
import { AppText, Button, Input, OtpCodeForm, colors, createStyles, useTheme } from '@wasit/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone?: () => void;
}

// إضافة رقم هاتف لحساب بلا هاتف: رقم ← رمز التحقق ← حفظ (نفس خطوات AddPhoneModal في الويب)
export function AddPhoneModal({ visible, onClose, onDone }: Props) {
  useTheme();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ phone: string; devCode: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setPhone('');
      setError(undefined);
      setSent(null);
    }
  }, [visible]);

  const send = async () => {
    const invalid = validateResetPhone(phone);
    if (invalid) return setError(invalid);
    const normalized = normalizeIraqiPhone(phone) ?? phone.replace(/\s/g, '');
    setBusy(true);
    try {
      setSent({ phone: normalized, devCode: await sendPhoneCode(normalized) });
    } catch (e) {
      setError((e as ApiError).message || 'تعذّر إرسال رمز التحقق');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <AppText weight="bold" style={{ fontSize: 18 }}>
              أضف رقم هاتفك
            </AppText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="إغلاق">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {sent ? (
            <OtpCodeForm
              phone={sent.phone}
              initialDevCode={sent.devCode}
              submitText="تأكيد وحفظ"
              onVerify={async (code) => {
                const token = await verifyPhoneCode(sent.phone, code);
                await addPhone(sent.phone, token);
                onDone?.();
                onClose();
              }}
              onResend={() => sendPhoneCode(sent.phone)}
              onChangePhone={() => setSent(null)}
            />
          ) : (
            <View style={{ gap: 16 }}>
              <AppText muted style={{ fontSize: 14, lineHeight: 22 }}>
                نحتاج رقم هاتفك لإكمال الطلب — ليتواصل معك عامل التوصيل بخصوص طلباتك.
              </AppText>
              <Input
                label="رقم الهاتف"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setError(undefined);
                }}
                error={error}
                placeholder="07XX XXX XXXX"
                keyboardType="phone-pad"
                ltr
              />
              <Button title="إرسال رمز التحقق" loading={busy} onPress={send} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));
