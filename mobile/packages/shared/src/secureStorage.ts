import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { restoreProfile } from './auth';
import { configureSessionStorage, getAccessToken, loadSession, type SessionStorageAdapter } from './session';

// الرموز في SecureStore (Keychain / Keystore) لا في AsyncStorage أو MMKV
const nativeStorage: SessionStorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

// SecureStore غير مدعوم في المتصفح: نستعمل localStorage هناك (للتطوير والتجربة فقط، كما في موقع الويب)
const webStorage: SessionStorageAdapter = {
  getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key, value) => void globalThis.localStorage?.setItem(key, value),
  removeItem: async (key) => void globalThis.localStorage?.removeItem(key),
};

export const secureSessionStorage: SessionStorageAdapter = Platform.OS === 'web' ? webStorage : nativeStorage;

// يُستدعى مرة عند فتح التطبيق: يربط التخزين ويحمّل الرموز قبل أول طلب
export const initSession = async () => {
  configureSessionStorage(secureSessionStorage);
  await loadSession();
  // لا نحجب فتح التطبيق بانتظار الشبكة
  if (getAccessToken()) void restoreProfile();
};
