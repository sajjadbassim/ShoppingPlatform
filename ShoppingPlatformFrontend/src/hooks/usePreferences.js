import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';

export const preferencesKeys = {
  mine: ['preferences', 'me'],
};

// تفضيلات المستخدم الحالي من الخادم (من لا يملك سجلاً تصله القيم الافتراضية)
export const useMyPreferences = () => useQuery({
  queryKey: preferencesKeys.mine,
  queryFn:  () => userService.getMyPreferences(),
  staleTime: 5 * 60 * 1000,
});

export const useUpdateMyPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences) => userService.updateMyPreferences(preferences),
    onSuccess:  (data) => queryClient.setQueryData(preferencesKeys.mine, data),
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
