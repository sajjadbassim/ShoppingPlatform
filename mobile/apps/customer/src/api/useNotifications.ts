import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteReadNotifications,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  useSessionStore,
} from '@wasit/shared';

export const useNotifications = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(30), enabled: signedIn });
};

// الشارة على الرئيسية؛ تتحدّث مع الإشعار الحي
export const useUnreadCount = (): number => {
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data } = useQuery({ queryKey: ['notifications-unread'], queryFn: fetchUnreadCount, enabled: signedIn });
  return data ?? 0;
};

export const useNotificationActions = () => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };
  return {
    markRead: useMutation({ mutationFn: markNotificationRead, onSuccess: refresh }),
    markAllRead: useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh }),
    deleteRead: useMutation({ mutationFn: deleteReadNotifications, onSuccess: refresh }),
  };
};
