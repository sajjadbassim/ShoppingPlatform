# تطبيقات الهاتف — وسيط

تطبيقان بـReact Native وExpo (SDK 58) يتصلان بنفس خادم المنصة (.NET) الذي يخدم الويب:

| التطبيق | المجلد | الحزمة | الحالة |
|---|---|---|---|
| **وسيط** (الزبون) | `apps/customer` | `com.wasitplatform.app` | مبني في معظمه، ويقلع على المحاكي |
| **وسيط مندوب** | `apps/driver` | `com.wasit.driver` | هيكل فقط (شاشة «مرحباً»)، مؤجَّل حتى يكتمل تطبيق الزبون |

- الخطة المعتمدة: [docs/mobile-app-plan-react-native.md](../docs/mobile-app-plan-react-native.md)
- سجل التقدّم والقرارات والأخطاء وما أُجِّل: [docs/mobile-progress-log.md](../docs/mobile-progress-log.md)
- قواعد العمل للذكاء الاصطناعي: [CLAUDE.md](CLAUDE.md)

> **حد صارم:** كود الهاتف كله داخل `mobile/`. لا يُعدَّل `ShoppingPlatformFrontend/` ولا `ShoppingPlatformAPI/` من هنا. الفرونت يُقرأ فقط للنقل منه، وأي تغيير مطلوب في الباك يُطلب من المسؤول عنه.

## 1. التشغيل

المتطلبات: Node 20+ (جُرّب على 24)، وExpo Go على المحاكي أو الهاتف، والخادم يعمل (`http://localhost:5010` افتراضياً).

```
cd mobile
npm install
npm run customer          # يطبع رمز QR، واضغط a لفتح أندرويد
npm run typecheck         # فحص الأنواع للحزم والتطبيقين
npm test --workspace @wasit/shared    # اختبارات الوحدة
```

**شغّل دائماً من مجلد التطبيق أو بهذه الأوامر.** تشغيل `expo start` من `mobile/` أو `mobile/apps/` يعطي `Unable to resolve "../../App"` لأن الجذر ليس تطبيقاً.

### عنوان الخادم

يُقرأ من `EXPO_PUBLIC_API_URL` (ملف `apps/customer/.env.local`، وهو خارج git). كل متغير `EXPO_PUBLIC_*` **عام** ولا يوضع فيه سرّ.

| أين يعمل التطبيق | القيمة |
|---|---|
| محاكي أندرويد | `http://10.0.2.2:5010` (الخادم على `localhost` يكفي) |
| هاتف على نفس الشبكة | `http://<IP الكمبيوتر>:5010` مع تشغيل الخادم على `0.0.0.0` وفتح المنفذ |
| هاتف على بيانات الجوال | Tailscale: `http://100.x.x.x:5010` |
| المتصفح (للواجهة فقط) | الاتصال يفشل بسبب CORS في الباك؛ لا يُعتمد عليه |

### المحاكي على ويندوز

```
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd mobile\apps\customer
npx expo start -c --android
```

المحاكي يحتاج **4 جيجا ذاكرة على الأقل**. بـ2.5 جيجا يدخل Expo Go في حالة ANR وتظهر شاشة سوداء حتى لـExpo Go نفسه، والحل تمهيد بارد وزيادة الذاكرة. لجعل الواجهة عربية RTL في Expo Go اجعل لغة المحاكي العربية، فالفرض عبر `forcesRTL` يعمل في النسخ المبنية فقط.

## 2. البنية

```
mobile/
  packages/
    shared/   منطق بلا واجهة: الجلسة، axios، الـAPI، التحقق، الحسابات (مختبَر بـJest)
    ui/       الثيم (فاتح/داكن: createStyles وuseTheme وtc) والخط والمكوّنات المشتركة
  apps/
    customer/ src/app (expo-router) · src/api (react-query) · src/components
    driver/   هيكل
  tools/
    gen-dark-map.mjs   يولّد جدول ألوان الداكن من لوحة الويب (node tools/gen-dark-map.mjs)
```

قواعد الثيم والخط للكود الجديد في [CLAUDE.md](CLAUDE.md) (البنود 11-13): `createStyles` بدل `StyleSheet.create`، و`useTheme()` في كل مكوّن، و`tc()` للألوان المباشرة، و`AppText` يحمي النص العربي من القصّ.

### `@wasit/shared`

| الملف | الدور |
|---|---|
| `config.ts` | `API_URL` والتوقيت `Asia/Baghdad` |
| `session.ts` | الرموز في الذاكرة + مخزن zustand (`useSessionStore`). تجديد **واحد** فقط مهما فشلت طلبات معاً. فشل القراءة يعني «زائر» |
| `secureStorage.ts` | `expo-secure-store` على الهاتف و`localStorage` على الويب، و`initSession()` |
| `api.ts` | عميل axios: يضيف التوكن، وعند 401 يجدّد ويعيد الطلب مرة واحدة، ويطبّع الأخطاء إلى `{status, message}` |
| `endpoints.ts` | نسخة من `endpoints.js` في الويب. أي endpoint جديد يُضاف هناك أولاً ثم يُنسخ |
| `auth.ts`، `account.ts` | الدخول والتسجيل وOTP واستعادة كلمة المرور والملف وكلمة المرور والإشعارات |
| `home.ts`، `catalog.ts` | الرئيسية والمنتجات والمتغيّرات (`findVariant` و`isOptionAvailable`) والأقسام والمتجر |
| `cart.ts`، `orders.ts`، `addresses.ts` | السلة وإعادة الطلب، وإنشاء الطلب والكوبون والنقاط والمواعيد، والعناوين |
| `myOrders.ts`، `orderRating.ts`، `realtime.ts` | طلباتي والتتبّع والإلغاء، وتقييم الطلب، وSignalR |
| `engagement.ts`، `feedback.ts` | المفضلة والولاء، والتقييمات والمرتجعات |
| `money.ts`، `images.ts`، `phone.ts`، `validators.ts` | الدينار والوزن، `?w=` للصور المصغّرة، الأرقام العراقية، قواعد الحقول |

### `@wasit/ui`
`theme` (ألوان الويب وخط Tajawal)، و`useAppFonts`، و`AppText` و`Button` و`Input` و`Checkbox` و`StarRating` و`OtpCodeForm` و`AuthLayout`.

### تطبيق الزبون: خريطة الشاشات

| الشاشة | المسار | الـAPI الرئيسي |
|---|---|---|
| الرئيسية والسوبرماركت | `index`، `supermarket` | `GET /api/Home?page=general|grocery` |
| المنتجات (فلاتر وترقيم) والبحث | `products`، `search` | `POST /api/Products/advanced-filter`، `GET /api/Categories` |
| المنتج | `product/[id]` | `GET /api/Products/{id}`، `.../variants`، `/api/Reviews` |
| المتجر | `store/[id]` | `GET /api/Vendors/{id}` |
| الدخول والتسجيل والاستعادة | `login`، `register`، `forgot-password` | `/api/Auth/*`، `/api/auth/phone/*` |
| السلة والدفع | `cart`، `checkout` (نجاح الطلب داخل `order/[id]?success=1`) | `/api/Cart/*`، `POST /api/Orders`، `/api/delivery-zones/*` |
| العناوين | `address-new`، `addresses` | `/api/Addresses` |
| الطلبات | `orders`، `order/[id]` (التقييم والفاتورة داخلها) | `/api/Orders/*`، `/api/orders/{id}/rating/*`، `/api/Invoice/{id}/preview` |
| الإرجاع والتقييم | `return-new`، `returns`، `review-new` | `/api/Returns`، `POST /api/Reviews` |
| الحساب | `account`، `change-password`، `notifications`، `wishlist`، `loyalty` | `/api/Users`، `/api/Notifications`، `/api/Wishlist`، `/api/Loyalty/*` |
| المعلومات والدعم | `info/[doc]`، `help`، `contact`، `about` | بلا API (محتوى منسوخ من الويب في `shared/src/content`) |

الدخول والتسجيل واستعادة كلمة المرور محمية بـ`Stack.Protected` (للزائر فقط)، وتزول تلقائياً بعد الدخول. باقي الشاشات تعرض دعوة لتسجيل الدخول للزائر.

## 3. قواعد يجب الالتزام بها

1. **React Native لا ويب:** `View` و`Text` و`Pressable`. لا `div` ولا `localStorage` (إلا في محوّل الويب).
2. كل طلب API عبر `@wasit/shared`. لا axios جديد في التطبيق.
3. **كل مبلغ من الخادم**، والتطبيق يعرض فقط. الدينار بلا كسور (`formatPrice`).
4. التواريخ بتوقيت `Asia/Baghdad`، والنصوص بالعربية.
5. لا تغيّر عقد الـAPI. الباك تُضاف حقوله فقط، والتغيير الكاسر يمرّ عبر فحص الإصدار (المرحلة 1).
6. الرموز في `expo-secure-store` فقط. لا أسرار في التطبيق.
7. مكتبة أصلية جديدة (native) تحتاج development build، فتُذكر صراحة.
8. ثبّت الحزم بـ`npx expo install <pkg>` داخل مجلد التطبيق (يحلّ النسخة المتوافقة مع SDK).
9. كل منطق جديد يُكتب في `shared` مع اختبار، والشاشة تبقى رقيقة.
10. **الإشعارات والنوافذ:** لا `Alert.alert` أصلي. النجاح والخطأ والتنبيه عبر `toast.success/error/warning/info` (`src/lib/toast.ts`)، والتأكيد عبر `confirmDialog` والقوائم عبر `actionSheet` (`src/lib/dialog.ts`). المضيفان `ToastHost` و`DialogHost` في `_layout.tsx`.
11. الصور من الجهاز عبر `pickImages` (`src/lib/pickImages.ts`) وتُرفع بـ`appendImages` من `shared`.
12. بعد إضافة شاشة: شغّل `npx expo start` مرة ليتحدّث `typedRoutes` (`.expo/types`) قبل `npm run typecheck`.

## 4. نمط العمل المتّبع في الكود

- **react-query** للبيانات (`src/api/use*.ts`): صلاحية 5 دقائق، وإعادة محاولة واحدة لأخطاء الشبكة ولا إعادة لأخطاء 4xx. عمليات السلة تعيد السلة كاملة من الخادم فتوضع في الذاكرة بلا طلب إضافي.
- **الخروج** يمسح كل مفاتيح بيانات المستخدم من الذاكرة (`_layout.tsx`).
- **التحديث الحي:** `connectNotifications` (SignalR، WebSocket فقط) يعيد جلب الطلبات والإشعارات. يُغلق عند الخلفية ويُعاد عند الرجوع.
- **الجلسة بعد إعادة الفتح:** تُستعاد الرموز ثم تُملأ بيانات المستخدم من `GET /api/Auth/me` (`restoreProfile`).
- **دون اتصال:** `PersistQueryClientProvider` يحفظ 24 ساعة بيانات التصفح العامة فقط (`PERSISTED_KEYS` في `queryClient.ts`). بيانات المستخدم لا تُحفظ أبداً. `OfflineBanner` يظهر عند انقطاع الإنترنت.
- **الإقلاع:** لا تُعرض شاشة قبل قراءة الجلسة وتحميل الخط، بحدّ أقصى 4 ثوانٍ، وأي فشل يعني «زائر».

## 5. الجودة وما لم يُغطَّ

- 178 اختباراً وحدة في `packages/shared` (الجلسة والتجديد والتحقق والسلة والطلب والتقييم والمتغيّرات...). لا اختبارات لمكوّنات الواجهة بعد.
- `tsc` و`expo-doctor` (20/20) و`expo export` للتطبيقين تمرّ.
- كل نقاط الـAPI العامة فُحصت على الخادم الحي. **ما يحتاج حساب زبون لم يُجرَّب إلا بالوحدات** (السلة، العناوين، الطلب، الإشعارات، المفضلة، الولاء، المرتجعات، التقييم).
- **لم يُتحقق** من اتصال SignalR من React Native فعلياً.

## 6. ما ينقص (التفاصيل في سجل التقدّم، القسم الأخير «الحصيلة والمتبقي (محدَّث بعد فز-20)»)

- **أهم شيء:** حفظ العمل في commit (لم يُحفظ شيء بعد)، وإعادة تشغيل الـ API ليأخذ تعديل قناة الإشعارات.
- **تجارب على الجهاز:** إشعار حقيقي من الباك وفتح الطلب عند الضغط وإزالة الرمز عند الخروج، والخريطة، وصور التقييم والفاتورة، والإرجاع المتعدد، وحذف حساب اختباري.
- **الباك (بإذن):** أُنجز حذف الحساب وفحص الإصدار وFCM؛ بقي ClientIds لدخول Google ودفعة موقع المندوب وروابط التطبيق العميقة.
- **تصميم:** نموذج «كتابة تقييم» (تفصيل صغير) والريلز (نُفِّذت في فز-21، تنتظر تجربة بحسابات حقيقية)؛ نموذج الإرجاع معتمد كما هو؛ «افتح متجرك» ملغاة من التطبيق.
- **مؤجَّل/قادم قريباً:** دخول Google، تسجيل التاجر. (أُنجز في فز-22: تشغيل فيديو المنشورات وعرض القائمة.)
- **تطبيق المندوب،** ثم **الإطلاق** (الأيقونات، المتاجر، سياسة الخصوصية، EAS، iOS للإشعارات).
- **بناء أندرويد على ويندوز:** يحتاج `JAVA_HOME` و`ANDROID_HOME` وninja حديثاً (انظر السجل)؛ و`android/` مولَّد وخارج git.
