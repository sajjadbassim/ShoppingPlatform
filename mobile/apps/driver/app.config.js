// APP_ENV=dev يعطي اسم حزمة مختلفاً ليُثبَّت التطبيقان (تطوير وإنتاج) معاً على نفس الهاتف
const isDev = (process.env.APP_ENV ?? 'dev') === 'dev';
const suffix = isDev ? '.dev' : '';

module.exports = {
  expo: {
    name: isDev ? 'وسيط مندوب (تجريبي)' : 'وسيط مندوب',
    slug: 'wasit-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'wasit-driver',
    userInterfaceStyle: 'light',
    ios: { bundleIdentifier: 'com.wasit.driver' + suffix },
    android: { package: 'com.wasit.driver' + suffix },
    web: { bundler: 'metro', output: 'single' },
    plugins: ['expo-router'],
    experiments: { typedRoutes: true },
    extra: { appEnv: isDev ? 'dev' : 'prod' },
  },
};
