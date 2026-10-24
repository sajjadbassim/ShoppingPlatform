import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSearch, onBeforeLogout } from '@wasit/shared';

const KEY = 'recent-searches';

export async function getRecentSearches(): Promise<string[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(term: string): Promise<string[]> {
  const next = addRecentSearch(await getRecentSearches(), term);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export const clearRecentSearches = () => AsyncStorage.removeItem(KEY).catch(() => {});

// كما في الويب: يُمسح السجل عند تسجيل الخروج
onBeforeLogout(clearRecentSearches);
