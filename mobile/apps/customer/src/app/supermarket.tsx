import { View } from 'react-native';
import { colors, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';
import { HomeFeed } from '../components/HomeFeed';

// السوبرماركت: صفحة رئيسية مستقلة بسلايدرها وأقسامها، والسلة مشتركة مع باقي المنتجات
export default function SupermarketScreen() {
  useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader back />
      <HomeFeed page="grocery" />
    </View>
  );
}
