// APP_ENV=dev يعطي اسم حزمة مختلفاً ليُثبَّت التطبيقان (تطوير وإنتاج) معاً على نفس الهاتف
const isDev = (process.env.APP_ENV ?? 'dev') === 'dev';
const suffix = isDev ? '.dev' : '';

module.exports = {
  expo: {
    name: isDev ? 'وسيط (تجريبي)' : 'وسيط',
    slug: 'wasitplatform',
    owner: 'sajjadmaksoosis-team',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'wasit',
    userInterfaceStyle: 'light',
    ios: { bundleIdentifier: 'com.wasitplatform.app' + suffix },
    // ملف Firebase مستثنى من git (في بناء EAS يُرفع كمتغير ملف GOOGLE_SERVICES_JSON)؛ يجب أن يحوي تطبيق أندرويد لكل اسم حزمة (الإنتاج و.dev)
    android: { package: 'com.wasitplatform.app' + suffix, googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json' },
    web: { bundler: 'metro', output: 'single' },
    // forcesRTL: التطبيق عربي فقط. يعمل في النسخ المبنية؛ في Expo Go يتبع لغة الجهاز
    plugins: [
      'expo-router',
      ['expo-localization', { forcesRTL: true }],
      // الموقع «أثناء الاستخدام» فقط، ويُطلب عند الضغط على «حدّد موقعي»
      ['expo-location', { locationWhenInUsePermission: 'نستخدم موقعك لتحديد عنوان التوصيل بدقة ليصل السائق مباشرة.' }],
      // الإشعارات الفورية (FCM على أندرويد): تتطلب development build ولا تعمل في Expo Go
      ['expo-notifications', { color: '#4F46E5', defaultChannel: 'default' }],
      'expo-video',
      ['expo-image-picker', { photosPermission: 'نستخدم صورك لإضافتها إلى حسابك وتقييماتك وطلبات الإرجاع.' }],
    ],
    experiments: { typedRoutes: true },
    extra: {
      appEnv: isDev ? 'dev' : 'prod',
      eas: { projectId: '694005b8-6a41-490f-8d9b-73919e15ff75' },
    },
  },
};
