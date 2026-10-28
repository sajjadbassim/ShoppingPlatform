// APP_ENV=dev يعطي اسم حزمة مختلفاً ليُثبَّت التطبيقان (تطوير وإنتاج) معاً على نفس الهاتف
const isDev = (process.env.APP_ENV ?? 'dev') === 'dev';
const suffix = isDev ? '.dev' : '';

// ملف Firebase الخاص بهذا التطبيق (com.wasit.driver)؛ يُرفع في EAS كمتغير ملف GOOGLE_SERVICES_JSON.
// قبل إنشائه يُبنى التطبيق دون FCM (الإشعارات الفورية معطّلة) ولا يفشل البناء
const fs = require('fs');
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

module.exports = {
  expo: {
    name: isDev ? 'وسيط مندوب (تجريبي)' : 'وسيط مندوب',
    slug: 'wasit-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'wasit-driver',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier: 'com.wasit.driver' + suffix,
      infoPlist: { UIBackgroundModes: ['location'] },
    },
    android: { package: 'com.wasit.driver' + suffix, ...(googleServicesFile ? { googleServicesFile } : {}) },
    web: { bundler: 'metro', output: 'single' },
    plugins: [
      'expo-router',
      ['expo-localization', { forcesRTL: true }],
      // التتبّع أثناء الدوام فقط: إذن الخلفية وخدمة أمامية بإشعار دائم «أنت في الخدمة»
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'نستخدم موقعك أثناء دوامك ليرى الزبون أين طلبه.',
          locationAlwaysAndWhenInUsePermission: 'نتتبّع موقعك أثناء دوامك فقط، حتى والتطبيق في الخلفية، ليرى الزبون أين طلبه.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      ['expo-notifications', { color: '#4F46E5', defaultChannel: 'default' }],
    ],
    experiments: { typedRoutes: true },
    extra: { appEnv: isDev ? 'dev' : 'prod' },
  },
};
