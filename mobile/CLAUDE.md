# قواعد العمل في تطبيقات الهاتف (mobile/)

الخطة المعتمدة: [docs/mobile-app-plan-react-native.md](../docs/mobile-app-plan-react-native.md). سجل التقدّم: [docs/mobile-progress-log.md](../docs/mobile-progress-log.md).

## حدود العمل
- لا تعدّل `ShoppingPlatformFrontend/` ولا `ShoppingPlatformAPI/` إطلاقاً. أي تغيير مطلوب هناك يُذكر للمستخدم ويُنتظر قراره.
- كل كود الهاتف داخل `mobile/` فقط.

## البنية
- `packages/shared`: الـ API والجلسة والتوقيت (بلا أي واجهة).
- `packages/ui`: الثيم والمكوّنات المشتركة.
- `apps/customer` (`com.wasitplatform.app`) و`apps/driver` (`com.wasit.driver`).

## القواعد
1. هذا كود React Native: استعمل `View` و`Text` و`Pressable`، لا `div` ولا `span` ولا `localStorage`.
2. كل طلب API عبر `packages/shared`. لا تنشئ axios جديداً داخل تطبيق.
3. كل مبلغ يأتي محسوباً من الخادم. التطبيق يعرض فقط، والدينار بلا كسور.
4. التواريخ بتوقيت `Asia/Baghdad` (`TIME_ZONE` في `shared`).
5. النصوص بالعربية.
6. لا تغيّر عقد الـAPI. إن احتجت حقلاً جديداً فاطلبه من المستخدم.
7. لا تضف مكتبة أصلية (native) دون أن تذكر أنها تحتاج بناء development build جديداً.
8. ثبّت الحزم بـ`npx expo install <package>` داخل مجلد التطبيق، لتُحلّ النسخة المتوافقة مع SDK.
9. الرموز تُخزَّن في `expo-secure-store` فقط. لا أسرار داخل التطبيق، فكل `EXPO_PUBLIC_*` عام.
10. Expo يتغيّر بين الإصدارات: اقرأ docs.expo.dev للإصدار المطابق (الحالي SDK 58) قبل استعمال أي API.
11. **الثيم (فاتح/داكن):** لا تستعمل `StyleSheet.create` في الشاشات والمكوّنات. استعمل `createStyles(() => ({...}))` من `@wasit/ui` (يحلّ الأنماط لكل وضع)، واستدعِ `useTheme()` أول كل مكوّن يقرأ الأنماط أو `colors`/`brand`. الألوان السداسية خارج الأنماط (في JSX أو منطق) تُكتب `tc('#6B7280')`، وجداول الألوان الثابتة (حالات الطلب مثلاً) داخل `createThemed(() => ({...}))`، لا ثوابت على مستوى الملف تقرأ `colors`. الأبيض كنص على لون يبقى أبيض، وكخلفية يصير سطحاً داكناً (تلقائياً داخل `createStyles`).
12. **الخط العربي:** `AppText` يرفع `lineHeight` تلقائياً إلى 1.3 ضعف الحجم على الأقل (Tajawal يتجاوز حروفه وعلاماته الارتفاع المعتاد فيُقصّ في أندرويد). استعمل `AppText` لا `Text` للنصوص العربية.
13. جدول ألوان الداكن `packages/shared/src/darkMap.ts` مولَّد من لوحة الويب: أعد توليده بـ `node tools/gen-dark-map.mjs` إن تغيّرت `theme.palette.js`.

## الأوامر (من مجلد mobile/)
```
npm install
npm run customer          # تشغيل تطبيق الزبون (QR لـExpo Go)
npm run driver            # تشغيل تطبيق المندوب
npm run typecheck
```
عنوان الخادم: `EXPO_PUBLIC_API_URL` (مثال: `http://192.168.1.5:5010` من هاتف على نفس الشبكة).
