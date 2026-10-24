// Expo يستبدل EXPO_PUBLIC_* وقت البناء
declare const process: { env: Record<string, string | undefined> };
