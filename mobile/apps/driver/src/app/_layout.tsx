import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initSession, useSessionStore } from '@wasit/shared';

export default function RootLayout() {
  const ready = useSessionStore((s) => s.ready);

  useEffect(() => {
    // أي فشل في قراءة الجلسة يعني «زائر»، ولا يُبقي الشاشة سوداء
    initSession().catch(() => useSessionStore.setState({ ready: true, signedIn: false }));
  }, []);

  // ننتظر قراءة الرموز من التخزين الآمن قبل عرض أي شاشة
  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
