# ربط Instagram

ربط متجر التاجر بحساب إنستغرام **احترافي** (Business أو Creator) عبر **Instagram API with Instagram Login**. المنصة تجلب منشورات الحساب (ريلز، فيديو، صور، ألبومات) وتعرضها في صفحة المتجر وصفحة ريلز، مع زر «اشترِ الآن» للمنشور المربوط بمنتج.

> الحسابات الشخصية لا يمكن ربطها: أوقفت Meta واجهة Basic Display في ديسمبر 2024. يستطيع التاجر تحويل حسابه إلى احترافي مجاناً من إعدادات إنستغرام.

## الملفات في المشروع

| الجزء | الملف |
|---|---|
| الجداول | `ecommerce/Core/Models/Instagram.cs` + `Data/Configurations/InstagramConfiguration.cs` + migrations `AddInstagramIntegration` و`InstagramFullSyncTimestamp` |
| الإعدادات | `Core/Models/InstagramOptions.cs` (القسم `Instagram` في appsettings) |
| استدعاءات Instagram API | `Services/InstagramService/InstagramApiClient.cs` |
| المنطق | `Services/InstagramService/InstagramService.cs` |
| تشفير التوكنات | `Services/InstagramService/InstagramTokenProtector.cs` (ASP.NET Data Protection) |
| المزامنة الدورية | `Services/InstagramService/InstagramSyncBackgroundService.cs` |
| الـ API | `Controllers/InstagramController.cs` |
| المحتوى الموحّد (تيك توك + إنستغرام) | `Services/SocialFeedService/*` + `Controllers/SocialFeedController.cs` |
| الاختبارات | `ecommerce.Tests/Services/InstagramServiceTests.cs` و`SocialFeedServiceTests.cs` |
| الواجهة | `ShoppingPlatformFrontend/src/pages/vendor/VendorSocialAccounts.jsx` (`/vendor/social`)، والعارض `src/components/tiktok/TikTokFeedViewer.jsx` |

## الـ Endpoints

المسار `/api/integrations/instagram` يطابق الروابط المسجّلة في تطبيق Meta، فلا تغيّره دون تحديثها هناك.

| الطريقة | المسار | الصلاحية |
|---|---|---|
| GET | `/api/integrations/instagram/status` | تاجر |
| GET | `/api/integrations/instagram/connect-url` | تاجر — يعيد رابط التفويض ويضع كوكي التحقق |
| GET | `/api/integrations/instagram/callback` | عام — إنستغرام يعيد المتصفح إليه |
| POST | `/api/integrations/instagram/sync` | تاجر — مزامنة كاملة |
| GET | `/api/integrations/instagram/media` | تاجر |
| PATCH | `/api/integrations/instagram/media/{id}` | تاجر — `{ isHidden?, productId?, removeProduct? }` |
| PUT | `/api/integrations/instagram/settings` | تاجر — `{ showOnStore?, autoShowNewMedia? }` |
| DELETE | `/api/integrations/instagram/connection` | تاجر |
| POST | `/api/integrations/instagram/deauthorize` | Meta — موقّع بـ `signed_request` |
| POST | `/api/integrations/instagram/data-deletion` | Meta — موقّع بـ `signed_request`، يعيد `{ url, confirmation_code }` |

المحتوى للزوار (تيك توك وإنستغرام معاً، الأحدث أولاً حسب تاريخ النشر الأصلي):

| الطريقة | المسار | ملاحظة |
|---|---|---|
| GET | `/api/social/stores/{vendorId}/feed` | تبويب «المنشورات» في صفحة المتجر |
| POST | `/api/social/stores/{vendorId}/feed/refresh` | يجلب الجديد ثم يعيد المحتوى — محدود بـ 30 طلباً/دقيقة لكل جهاز |
| GET | `/api/social/reels?page=1&pageSize=10` | صفحة ريلز |
| POST | `/api/social/reels/refresh?pageSize=10` | محدود بـ 30 طلباً/دقيقة لكل جهاز |

## كيف يعمل الربط

نفس أسلوب تيك توك، لأن JWT لا يُرسل مع توجيه المتصفح:

1. الواجهة تطلب `connect-url` بطلب يحمل JWT. الخادم يحفظ `state` عشوائياً مرتبطاً بالمتجر (صالح 10 دقائق ولمرة واحدة) في `instagram_oauth_states`، ويضع كوكي `HttpOnly` فيه قيمة تحقق.
2. المتصفح ينتقل إلى إنستغرام، ثم يعود إلى `/callback`.
3. الخادم يتحقق من `state` والكوكي، ثم:
   - يبدّل الكود بتوكن قصير الأمد (ساعة واحدة).
   - يبدّله فوراً بتوكن طويل الأمد (60 يوماً)، ويحفظه **مشفّراً**.
   - يجلب الحساب والمنشورات، ويعيد التاجر إلى `/vendor/social?instagram=connected`.

**التوكن:** يُجدَّد تلقائياً عندما يبقى له أقل من 30 يوماً، بشرط مرور 24 ساعة على إصداره (شرط من إنستغرام)، أي مرة في الشهر تقريباً. إن انتهى أو ألغى التاجر الإذن، تظهر في الواجهة «يحتاج إعادة ربط».

**إلغاء الربط من المنصة** يحذف الحساب ومنشوراته. إنستغرام لا يوفر إلغاء التوكن عبر الـ API، فيبقى التطبيق ظاهراً في إعدادات حساب التاجر حتى يزيله بنفسه. وعندها تصلنا رسالة إلغاء التفويض، فنعلّم الحساب «يحتاج إعادة ربط».

## المزامنة

| متى | ماذا يُجلب | يحدّث |
|---|---|---|
| فتح المتجر أو ريلز (إن مضت `StoreRefreshSeconds` = 120 ثانية) | أحدث 100 منشور بطلب واحد | الجديد يظهر فوراً |
| في الخلفية (كل `SyncIntervalMinutes` = 15 دقيقة) | القائمة كاملة حتى `MaxMedia` = 1000، بصفحات من 100 | روابط الوسائط القديمة (مؤقتة من إنستغرام)، واكتشاف المحذوف |
| زر «مزامنة» أو الربط لأول مرة | القائمة كاملة | كما سبق |

كل عمليات المزامنة لنفس المتجر تمر بقفل واحد، فلا يُدرَج المنشور نفسه مرتين.

## خطوات التفعيل في Meta

1. في [Meta for Developers](https://developers.facebook.com/apps/) أنشئ تطبيقاً من نوع **Business**، وأضف منتج **Instagram**، ثم افتح **API setup with Instagram business login**.
2. انسخ **Instagram app ID** و**Instagram app secret** من أعلى الصفحة. هما غير معرّف تطبيق فيسبوك ومفتاحه.
3. في **Business login settings** أدخل الروابط الثلاثة بـ HTTPS، ومن نفس نطاق الواجهة (لأن كوكي التحقق يُكتب عليه):
   - OAuth redirect URI: `https://<نطاقك>/api/integrations/instagram/callback`
   - Deauthorize callback URL: `https://<نطاقك>/api/integrations/instagram/deauthorize`
   - Data deletion request URL: `https://<نطاقك>/api/integrations/instagram/data-deletion`
4. ضع المفاتيح (السر لا يوضع في appsettings.json):
   ```bash
   cd ShoppingPlatformAPI/ecommerce
   dotnet user-secrets set "Instagram:AppId" "..."
   dotnet user-secrets set "Instagram:AppSecret" "..."
   dotnet user-secrets set "Instagram:RedirectUri" "https://<نطاقك>/api/integrations/instagram/callback"
   ```
   في الإنتاج: متغيرات البيئة `Instagram__AppId` و`Instagram__AppSecret` و`Instagram__RedirectUri`.
5. أعد تشغيل الـ API. يظهر زر «ربط» بجانب Instagram في `/vendor/social`، وقبل ضبط المفاتيح يظهر «غير مفعّل».

**الصلاحية الوحيدة المطلوبة:** `instagram_business_basic`. رابط التضمين الجاهز في لوحة Meta يطلب صلاحيات إضافية (النشر، والتعليقات، والرسائل، والإحصاءات) لا تحتاجها المنصة، والكود يبني رابط الربط بنفسه، فلا تستخدم ذلك الرابط.

### وضع التطوير والمراجعة

- **التطبيق في وضع «تطوير»:** لا يستطيع الربط إلا حسابات إنستغرام المضافة بدور **Instagram Tester** (App roles ← Roles). صاحب الحساب يقبل الدعوة من إنستغرام: الإعدادات ← Apps and websites ← Tester invites.
- **لكي يربط أي تاجر:** اطلب الصلاحية `instagram_business_basic` (Advanced Access) في **App Review**، ثم حوّل التطبيق إلى **Live**. المراجعة تطلب عادةً فيديو يوضح خطوات الربط والعرض، وسياسة خصوصية، ورابط حذف البيانات (موجود).
- **App secret:** إن انكشف في أي مكان، فأعد تعيينه من صفحة الإعداد وحدّث user-secrets أو متغيرات البيئة.

## حدود من جهة إنستغرام

- **جودة الفيديو:** الـ API يعطي نسخة واحدة لكل فيديو، بدقة 720p وترميز baseline، وغالباً بين 0.5 و3 Mbps. التطبيق نفسه يعرض جودة أعلى، ولا يوجد خيار لجلبها.
- **الفيديو ذو الموسيقى المحمية** يصل بلا رابط تشغيل: لا يظهر في ريلز، ويظهر في صفحة المتجر بغلافه مع زر «شاهد على Instagram».
- **عدد المشاهدات** غير متاح بالصلاحية الأساسية (يحتاج `instagram_business_manage_insights`)، فتُعرض الإعجابات.
- **روابط الوسائط مؤقتة:** تجددها المزامنة الدورية، لذلك يجب أن تعمل خدمة المزامنة في الخلفية على الخادم.

## ملاحظات النشر

- طبّق الـ migrations على قاعدة الإنتاج: `AddInstagramIntegration` ثم `InstagramFullSyncTimestamp`.
- **مفاتيح Data Protection** التي تشفّر التوكنات تُحفظ في `App_Data/DataProtection-Keys`، أو في المسار المحدد بـ `DataProtection:KeysPath`. على ويندوز تُشفَّر بـ DPAPI مرتبطة بالجهاز. عند نقل الخادم انقل هذا المجلد معه، وإلا سيُطلب من كل التجار إعادة ربط حساباتهم (تيك توك وإنستغرام). المجلد مستثنى من git.
- سجلات HttpClient معطّلة لعميل إنستغرام عمداً، لأن إنستغرام يضع `access_token` و`client_secret` في رابط الطلب. لا تُعِد تفعيلها.
