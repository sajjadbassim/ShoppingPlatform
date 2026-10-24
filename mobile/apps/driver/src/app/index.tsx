import Constants from 'expo-constants';
import { HelloScreen } from '@wasit/ui';

export default function Home() {
  const env = String(Constants.expoConfig?.extra?.appEnv ?? 'dev');
  return <HelloScreen title="وسيط مندوب" subtitle="مرحباً أيها المندوب" environment={env} />;
}
