import { useState } from 'react';
import { router } from 'expo-router';
import { changePassword, validateChangePassword, type ApiError, type ChangePasswordErrors } from '@wasit/shared';
import { AuthCard, AuthLayout, Button, ErrorBanner, Input } from '@wasit/ui';
import { toast } from '../lib/toast';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = (key: keyof ChangePasswordErrors) => setErrors((p) => ({ ...p, [key]: undefined }));

  const submit = async () => {
    const found = validateChangePassword({ currentPassword, password, confirmPassword });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await changePassword(currentPassword, password);
      toast.success('سُجّل خروجك من الأجهزة الأخرى لأمان حسابك', { title: 'تم تغيير كلمة المرور' });
      router.back();
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر تغيير كلمة المرور');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="تغيير كلمة المرور">
      <AuthCard>
        {serverError && <ErrorBanner title="تعذّر التغيير" message={serverError} />}
        <Input
          label="كلمة المرور الحالية"
          value={currentPassword}
          onChangeText={(t) => { setCurrentPassword(t); clear('currentPassword'); }}
          error={errors.currentPassword}
          autoCapitalize="none"
          secure
          ltr
        />
        <Input
          label="كلمة المرور الجديدة"
          value={password}
          onChangeText={(t) => { setPassword(t); clear('password'); }}
          error={errors.password}
          placeholder="6 أحرف على الأقل"
          autoCapitalize="none"
          secure
          ltr
        />
        <Input
          label="تأكيد كلمة المرور الجديدة"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); clear('confirmPassword'); }}
          error={errors.confirmPassword}
          autoCapitalize="none"
          secure
          ltr
        />
        <Button title="تغيير كلمة المرور" loading={busy} onPress={submit} />
      </AuthCard>
      <Button title="إلغاء" variant="outline" onPress={() => router.back()} />
    </AuthLayout>
  );
}
