// APP_ENV=dev يعطي اسم حزمة مختلفاً ليُثبَّت التطبيقان (تطوير وإنتاج) معاً على نفس الهاتف
const isDev = (process.env.APP_ENV ?? 'dev') === 'dev';
const suffix = isDev ? '.dev' : '';

module.exports = {
  expo: {
    name: isDev ? 'وسيط بائع (تجريبي)' : 'وسيط بائع',
    slug: 'wasit-seller',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'wasit-seller',
    userInterfaceStyle: 'light',
    ios: { bundleIdentifier: 'com.wasit.seller' + suffix },
    android: { package: 'com.wasit.seller' + suffix },
    web: { bundler: 'metro', output: 'single' },
    plugins: [
      'expo-router',
      ['expo-localization', { forcesRTL: true }],
      ['expo-image-picker', { photosPermission: 'نستخدم صورك لرفع صور المنتجات وشعار المتجر.', cameraPermission: 'نستخدم الكاميرا لتصوير المنتجات.' }],
    ],
    experiments: { typedRoutes: true },
    extra: { appEnv: isDev ? 'dev' : 'prod' },
  },
};
