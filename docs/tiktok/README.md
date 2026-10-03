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
| POST | `/api/tiktok/stores/{vendorId}/videos/refresh` | عام — محدود بـ 30 طلباً/دقيقة لكل جهاز |
| GET | `/api/tiktok/reels` | عام |
| POST | `/api/tiktok/reels/refresh` | عام — محدود بـ 30 طلباً/دقيقة لكل جهاز |

الواجهة تستخدم الآن المحتوى الموحّد مع إنستغرام (`/api/social/*`) — انظر [`docs/instagram/README.md`](../instagram/README.md).

## كيف يعمل الربط (ولماذا يختلف عن الكود الأصلي)

المنصة تستخدم JWT في ترويسة الطلب، والمتصفح لا يرسلها عند التوجيه إلى `/connect` أو العودة إلى `/callback`، فكان `[Authorize]` سيرفضهما دائماً. لذلك:

1. الواجهة تطلب `connect-url` بطلب عادي يحمل JWT. الخادم يعرف المتجر (`Vendor.OwnerId == userId`)، ويحفظ `state` عشوائياً مرتبطاً بالمتجر في جدول `tiktok_oauth_states` لمدة 10 دقائق، ويضع كوكي `HttpOnly` فيه قيمة تحقق.
2. المتصفح ينتقل إلى تيك توك، ثم يعود إلى `/api/tiktok/callback`.
3. الـ callback عام، يتعرّف على المتجر من `state` (صالح لمرة واحدة)، ويتحقق أن الكوكي من نفس المتصفح، ثم يبدّل الكود بالتوكن ويحفظه **مشفّراً**، ويجلب الحساب والفيديوهات، ثم يعيد التاجر إلى `/vendor/social?tiktok=connected`.

- التوكنات تُجدَّد تلقائياً قبل انتهائها. إذا انتهى الـ refresh token أو ألغى التاجر الإذن، تظهر في الواجهة «يحتاج إعادة ربط».
- المزامنة الدورية كل 15 دقيقة (`SyncIntervalMinutes`) تجدّد روابط أغلفة الفيديوهات، لأن روابط تيك توك مؤقتة. فتح المتجر أو ريلز يزامن الحساب أيضاً إن مضت 60 ثانية (`StoreRefreshSeconds`) على آخر مزامنة.
- كل عمليات المزامنة والربط والإلغاء لنفس المتجر تمر بقفل واحد، فلا يُدرَج الفيديو نفسه مرتين.

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

مفاتيح Data Protection التي تشفّر التوكنات تُحفظ في `App_Data/DataProtection-Keys`، أو في المسار المحدد بـ `DataProtection:KeysPath`. على ويندوز تُشفَّر بـ DPAPI مرتبطة بالجهاز. عند نقل الخادم انقل هذا المجلد معه، وإلا لن يمكن فك التوكنات، فتظهر للتجار «يحتاج إعادة ربط». المجلد مستثنى من git.
