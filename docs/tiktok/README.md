# ربط TikTok

تم تنفيذ الربط في المشروع. الملفان `TikTokModels.cs` و`TikTokController.cs` في هذا المجلد هما الكود الأصلي المرجعي، ولا يُستخدمان.

## الملفات في المشروع

| الجزء | الملف |
|---|---|
| الجداول | `ecommerce/Core/Models/TikTok.cs` + `Data/Configurations/TikTokConfiguration.cs` + migration `AddTikTokIntegration` |
| الإعدادات | `Core/Models/TikTokOptions.cs` (القسم `TikTok` في appsettings) |
| استدعاءات TikTok API | `Services/TikTokService/TikTokApiClient.cs` |
| المنطق | `Services/TikTokService/TikTokService.cs` |
| تشفير التوكنات | `Services/TikTokService/TikTokTokenProtector.cs` (ASP.NET Data Protection) |
| المزامنة الدورية | `Services/TikTokService/TikTokSyncBackgroundService.cs` |
| الـ API | `Controllers/TikTokController.cs` |
| الاختبارات | `ecommerce.Tests/Services/TikTokServiceTests.cs` |
| الواجهة | `ShoppingPlatformFrontend/src/pages/vendor/VendorSocialAccounts.jsx` (`/vendor/social`) |

## الـ Endpoints

| الطريقة | المسار | الصلاحية |
|---|---|---|
| GET | `/api/tiktok/status` | تاجر |
| GET | `/api/tiktok/connect-url` | تاجر — يعيد رابط التفويض ويضع كوكي التحقق |
| GET | `/api/tiktok/callback` | عام — تيك توك يعيد المتصفح إليه |
| POST | `/api/tiktok/sync` | تاجر |
| GET | `/api/tiktok/videos` | تاجر |
| PATCH | `/api/tiktok/videos/{id}` | تاجر — `{ isHidden?, productId?, removeProduct? }` |
| PUT | `/api/tiktok/settings` | تاجر — `{ showOnStore?, autoShowNewVideos? }` |
| DELETE | `/api/tiktok/connection` | تاجر |
| GET | `/api/tiktok/stores/{vendorId}/videos` | عام — للعرض في صفحة المتجر |

## كيف يعمل الربط (ولماذا يختلف عن الكود الأصلي)

المنصة تستخدم JWT في ترويسة الطلب، والمتصفح لا يرسلها عند التوجيه إلى `/connect` أو العودة إلى `/callback`، فكان `[Authorize]` سيرفضهما دائماً. لذلك:

1. الواجهة تطلب `connect-url` بطلب عادي يحمل JWT. الخادم يعرف المتجر (`Vendor.OwnerId == userId`)، ويحفظ `state` عشوائياً مرتبطاً بالمتجر في جدول `tiktok_oauth_states` لمدة 10 دقائق، ويضع كوكي `HttpOnly` فيه قيمة تحقق.
2. المتصفح ينتقل إلى تيك توك، ثم يعود إلى `/api/tiktok/callback`.
3. الـ callback عام، يتعرّف على المتجر من `state` (صالح لمرة واحدة)، ويتحقق أن الكوكي من نفس المتصفح، ثم يبدّل الكود بالتوكن ويحفظه **مشفّراً**، ويجلب الحساب والفيديوهات، ثم يعيد التاجر إلى `/vendor/social?tiktok=connected`.

- التوكنات تُجدَّد تلقائياً قبل انتهائها. إذا انتهى الـ refresh token أو ألغى التاجر الإذن، تظهر في الواجهة «يحتاج إعادة ربط».
- المزامنة الدورية كل 3 ساعات تجدّد روابط أغلفة الفيديوهات، لأن روابط تيك توك مؤقتة.

## خطوات التفعيل

1. أنشئ تطبيقاً في [TikTok for Developers](https://developers.tiktok.com/)، وفعّل **Login Kit** و**Display API**، والصلاحيات `user.info.basic` و`video.list`.
2. سجّل Redirect URI بـ HTTPS، ويجب أن يكون من نفس نطاق الواجهة (لأن الكوكي يُكتب عليه):
   `https://<نطاقك>/api/tiktok/callback`
3. ضع المفاتيح (السر لا يوضع في appsettings.json):
   ```bash
   cd ShoppingPlatformAPI/ecommerce
   dotnet user-secrets set "TikTok:ClientKey" "..."
   dotnet user-secrets set "TikTok:ClientSecret" "..."
   dotnet user-secrets set "TikTok:RedirectUri" "https://<نطاقك>/api/tiktok/callback"
   ```
   في الإنتاج: متغيرات البيئة `TikTok__ClientKey` و`TikTok__ClientSecret` و`TikTok__RedirectUri`.
4. اختياري: لعرض اسم المستخدم وعدد المتابعين أضف الصلاحيات `user.info.profile,user.info.stats` في البوابة وفي `TikTok:Scopes`.
5. إذا كانت الواجهة على نطاق مختلف عن الـ API، اجعل `TikTok:AfterConnectUrl` رابطاً كاملاً مثل `https://<نطاق-الواجهة>/vendor/social`.

## ملاحظة النشر

مفاتيح Data Protection التي تشفّر التوكنات تُحفظ افتراضياً في ملف المستخدم على الخادم. إذا نُقل الخادم أو تغيّر المستخدم الذي يشغّله، لن يمكن فك التوكنات، فتظهر للتجار «يحتاج إعادة ربط». في الإنتاج يُفضَّل تحديد مكان ثابت للمفاتيح (`PersistKeysToFileSystem`).
