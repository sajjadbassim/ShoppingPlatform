import { useEffect } from 'react';
import { router } from 'expo-router';
import { canReceiveOrders, useSessionStore } from '@wasit/shared';
import { useDriverProfile } from '../api/useDriver';
import { getTrackingPermission, startTracking, stopTracking } from './tracking';

// التتبّع يعمل فقط والمندوب «متاح» أو في رحلة، ويتوقف في الاستراحة وخارج الدوام وعند الخروج.
// إن لم يكن إذن «طوال الوقت» ممنوحاً نعرض شاشة الشرح مرة واحدة لكل جلسة
let explained = false;

export function useTrackingSync() {
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data: me } = useDriverProfile();
  const working = canReceiveOrders(me?.workStatus);
  const loaded = !!me;

  useEffect(() => {
    if (!signedIn) {
      stopTracking().catch(() => {});
      return;
    }
    if (!loaded) return;
    if (!working) {
      stopTracking().catch(() => {});
      return;
    }
    (async () => {
      if ((await getTrackingPermission()) !== 'always') {
        if (!explained) {
          explained = true;
          router.push('/location-permission');
        }
        return;
      }
      await startTracking();
    })().catch(() => {});
  }, [signedIn, working, loaded]);
}
