import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

// المفتاح مرتبط بالمستخدم حتى لا تظهر تفضيلات حساب سابق بعد تبديل الحساب
export const preferencesKeys = {
  mine: (userId) => ['preferences', 'me', userId],
};

const useCurrentUserId = () => useAuthStore((s) => s.user?.userId || s.user?.id);

// تفضيلات المستخدم الحالي من الخادم (من لا يملك سجلاً تصله القيم الافتراضية)
export const useMyPreferences = ({ enabled = true } = {}) => {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: preferencesKeys.mine(userId),
    queryFn:  () => userService.getMyPreferences(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
};

export const useUpdateMyPreferences = () => {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (preferences) => userService.updateMyPreferences(preferences),
    onSuccess:  (data) => queryClient.setQueryData(preferencesKeys.mine(userId), data),
  });
};

/**
 * نسخة قابلة للتعديل من التفضيلات لصفحات الإعدادات.
 * كل قسم يحفظ حقوله فقط عبر save(['notifyNewOrders', ...]) حتى لا يُرسل تعديل قسم آخر لم يُحفظ بعد.
 */
export const usePreferencesDraft = () => {
  const { data, isLoading, isError } = useMyPreferences();
  const { mutateAsync, isPending } = useUpdateMyPreferences();
  const [draft, setDraft] = useState(null);

  // يُملأ مرة واحدة فقط — تحديث البيانات بعد حفظ قسم لا يمسح تعديلات قسم آخر لم يُحفظ
  useEffect(() => {
    if (data) setDraft((d) => d ?? data);
  }, [data]);

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const isDirty = (keys) => !!draft && !!data && keys.some((k) => draft[k] !== data[k]);

  const save = (keys) => {
    const payload = Object.fromEntries(keys.map((k) => [k, draft[k]]));
    return mutateAsync(payload);
  };

  return { draft, set, save, isDirty, isLoading, isError, isSaving: isPending };
};

/**
 * يطبّق المظهر المحفوظ على الخادم بعد تسجيل الدخول — يُستدعى مرة واحدة في App
 */
export const useThemeSync = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { data } = useMyPreferences({ enabled: isAuthenticated });

  useEffect(() => {
    if (isAuthenticated && data?.theme) setTheme(data.theme);
  }, [isAuthenticated, data?.theme]);
};

/**
 * المظهر الحالي مع دالة لتغييره: يُطبَّق فوراً ثم يُحفظ في تفضيلات المستخدم على الخادم
 */
export const useThemePreference = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { mutateAsync, isPending } = useUpdateMyPreferences();

  const changeTheme = async (value) => {
    const previous = theme;
    setTheme(value);
    try {
      await mutateAsync({ theme: value });
    } catch (err) {
      setTheme(previous);
      throw err;
    }
  };

  return { theme, changeTheme, isSaving: isPending };
};
