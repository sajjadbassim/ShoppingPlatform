import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyPreferences, updateMyPreferences, useSessionStore, type UserPreferences } from '@wasit/shared';

const KEY = ['my-preferences'];

export const useMyPreferences = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: KEY, queryFn: fetchMyPreferences, enabled: signedIn, staleTime: 60 * 1000 });
};

// الحفظ فوري عند تبديل المفتاح: نُحدّث الشاشة أولاً ونتراجع إن فشل الطلب
export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserPreferences>) => updateMyPreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<UserPreferences>(KEY);
      queryClient.setQueryData<UserPreferences>(KEY, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _patch, ctx) => queryClient.setQueryData(KEY, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
};
