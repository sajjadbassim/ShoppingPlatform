# ربط Instagram

ربط متجر التاجر بحساب إنستغرام **احترافي** (Business أو Creator) عبر **Instagram API with Instagram Login**. المنصة تجلب منشورات الحساب (ريلز، فيديو، صور، ألبومات) وتعرضها في صفحة المتجر وصفحة ريلز، مع زر «اشترِ الآن» للمنشور المربوط بمنتج. ويستطيع التاجر أيضاً **نشر منتجاته على حسابه** من المنصة (صورة أو ألبوم، الآن أو بموعد) — انظر [النشر من المنصة](#النشر-من-المنصة).

> خطوات الحصول على موافقة Meta (App Review) في [APP_REVIEW.md](APP_REVIEW.md).

> الحسابات الشخصية لا يمكن ربطها: أوقفت Meta واجهة Basic Display في ديسمبر 2024. يستطيع التاجر تحويل حسابه إلى احترافي مجاناً من إعدادات إنستغرام.

## الملفات في المشروع

| الجزء | الملف |
|---|---|
| الجداول | `ecommerce/Core/Models/Instagram.cs` + `Data/Configurations/InstagramConfiguration.cs` + migrations `AddInstagramIntegration` و`InstagramFullSyncTimestamp` و`InstagramPublishing` |
| الإعدادات | `Core/Models/InstagramOptions.cs` (القسم `Instagram` في appsettings) |
| استدعاءات Instagram API | `Services/InstagramService/InstagramApiClient.cs` |
| المنطق | `Services/InstagramService/InstagramService.cs` |
| تشفير التوكنات | `Services/InstagramService/InstagramTokenProtector.cs` (ASP.NET Data Protection) |
| المزامنة الدورية | `Services/InstagramService/InstagramSyncBackgroundService.cs` |
| النشر | `Services/InstagramService/InstagramPublishService.cs` + `InstagramImagePreparer.cs` (SkiaSharp) + `InstagramPublishBackgroundService.cs` (المجدول) |
| الـ API | `Controllers/InstagramController.cs` |
| المحتوى الموحّد (تيك توك + إنستغرام) | `Services/SocialFeedService/*` + `Controllers/SocialFeedController.cs` |
| الاختبارات | `ecommerce.Tests/Services/InstagramServiceTests.cs` و`InstagramPublishServiceTests.cs` و`SocialFeedServiceTests.cs` |
| الواجهة | `ShoppingPlatformFrontend/src/pages/vendor/VendorSocialAccounts.jsx` (`/vendor/social`، وفيها سجل المنشورات)، شاشة النشر الموحّدة `VendorPublish.jsx` (`/vendor/products/:id/publish`: اختيار الحسابات ومعاينة إنستغرام وتيك توك وفيسبوك)، والعارض `src/components/tiktok/TikTokFeedViewer.jsx` |

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
| GET | `/api/integrations/instagram/publish/options?productId=` | تاجر — الحساب، صور المنتج، نص مقترح، حصة النشر اليومية |
| GET | `/api/integrations/instagram/posts` | تاجر — آخر 50 منشوراً من المنصة |
| POST | `/api/integrations/instagram/posts` | تاجر — `{ productId, images[1–10], caption, scheduledAt? }` (فارغ = الآن) |
| POST | `/api/integrations/instagram/posts/{id}/retry` | تاجر — للمنشور الفاشل |
| POST | `/api/integrations/instagram/posts/{id}/cancel` | تاجر — للمنشور المجدول |
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

**إلغاء الربط من المنصة** يحذف الحساب ومنشوراته وسجل النشر (والمجدول منه). إنستغرام لا يوفر إلغاء التوكن عبر الـ API، فيبقى التطبيق ظاهراً في إعدادات حساب التاجر حتى يزيله بنفسه. وعندها تصلنا رسالة إلغاء التفويض، فنعلّم الحساب «يحتاج إعادة ربط».

## المزامنة

| متى | ماذا يُجلب | يحدّث |
|---|---|---|
| فتح المتجر أو ريلز (إن مضت `StoreRefreshSeconds` = 120 ثانية) | أحدث 100 منشور بطلب واحد | الجديد يظهر فوراً |
| في الخلفية (كل `SyncIntervalMinutes` = 15 دقيقة) | القائمة كاملة حتى `MaxMedia` = 1000، بصفحات من 100 | روابط الوسائط القديمة (مؤقتة من إنستغرام)، واكتشاف المحذوف |
| زر «مزامنة» أو الربط لأول مرة | القائمة كاملة | كما سبق |

كل عمليات المزامنة لنفس المتجر تمر بقفل واحد، فلا يُدرَج المنشور نفسه مرتين.

## النشر من المنصة

التاجر يفتح منتجاً ← «نشر» ← يحدد حساب إنستغرام (تيك توك وفيسبوك «قريباً» مع معاينة شكل المنشور) ← يختار الصور (حتى 10، بالترتيب) ويعدّل النص المقترح ← يرى معاينة ← يختار «الآن» أو «جدولة» (حتى 30 يوماً) ← يؤكد في نافذة تذكر اسم الحساب. **لا يوجد نشر تلقائي** دون هذا التأكيد.

خطوات الخادم لكل منشور:

1. **تجهيز الصور:** إنستغرام يقبل JPEG فقط بنسبة بين 4:5 و1.91:1، وصور المنتجات غالباً PNG/WebP شفافة. لذلك تُرسم كل صورة وسط مربع 1080×1080 أبيض بهامش 6% وتُحفظ في `wwwroot/uploads/social/` (تُحذف بعد النشر).
2. **الحاوية:** `POST /{ig-user-id}/media` بـ `image_url` (رابط عام من `PublicBaseUrl`)، أو حاويات أبناء ثم `media_type=CAROUSEL` للألبوم.
3. **الانتظار** حتى `status_code=FINISHED` (حتى ~30 ثانية).
4. **النشر:** `POST /{ig-user-id}/media_publish`، ثم جلب `permalink`، وتسجيل المنشور في منشورات المتجر مربوطاً بالمنتج وظاهراً.

الحماية من الأخطاء:

- **الحد اليومي** (100 منشور/24 ساعة من إنستغرام): يُفحص `content_publishing_limit` قبل النشر؛ إن امتلأ يؤجَّل ساعة.
- **أخطاء مؤقتة** (رموز 1، 2، 4، 17، 32، 613، 9007، و5xx وانقطاع الشبكة): إعادة محاولة تلقائية حتى 3 مرات. انتهاء التوكن أو سحب الإذن: يفشل المنشور مع رسالة «أعد الربط».
- **عدم النشر مرتين:** المنشور يُحجز بقفل وفحص حالة، ومعرّف الحاوية يُحفظ؛ عند إعادة المحاولة إن كانت الحاوية `PUBLISHED` يُعلَّم المنشور منشوراً دون نشر جديد. منشور علِق في «جارٍ النشر» 10 دقائق (توقف الخادم) يعود للجدولة.
- القفل داخل عملية الخادم: عند تشغيل أكثر من نسخة من الـ API يجب تشغيل خدمة الجدولة في نسخة واحدة فقط.

**التفعيل:** ضع `Instagram:PublicBaseUrl` = عنوان الخادم العام بـ HTTPS الذي تُخدم منه `/uploads` (مثال `https://api.<نطاقك>`). فارغ = النشر معطّل وتظهر للتاجر رسالة «غير متاح بعد». إنستغرام يجلب الصور من هذا العنوان، فلا يعمل `localhost`.

**الحسابات المربوطة قبل إضافة النشر** لا تملك صلاحية النشر؛ تظهر لها رسالة «أعد الربط ووافق على نشر المحتوى».

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
   dotnet user-secrets set "Instagram:PublicBaseUrl" "https://<عنوان الـ API العام>"
   ```
   في الإنتاج: متغيرات البيئة `Instagram__AppId` و`Instagram__AppSecret` و`Instagram__RedirectUri` و`Instagram__PublicBaseUrl`.
5. أعد تشغيل الـ API. يظهر زر «ربط» بجانب Instagram في `/vendor/social`، وقبل ضبط المفاتيح يظهر «غير مفعّل».

**الصلاحيات المطلوبة:** `instagram_business_basic` (العرض) و`instagram_business_content_publish` (النشر)، وهي القيمة الافتراضية لـ `Instagram:Scopes`. رابط التضمين الجاهز في لوحة Meta يطلب صلاحيات إضافية (التعليقات، والرسائل، والإحصاءات) لا تحتاجها المنصة — وطلب صلاحية غير مستخدمة سبب شائع لرفض المراجعة. الكود يبني رابط الربط بنفسه، فلا تستخدم ذلك الرابط.

### وضع التطوير والمراجعة

- **التطبيق في وضع «تطوير»:** لا يستطيع الربط إلا حسابات إنستغرام المضافة بدور **Instagram Tester** (App roles ← Roles). صاحب الحساب يقبل الدعوة من إنستغرام: الإعدادات ← Apps and websites ← Tester invites.
- **لكي يربط أي تاجر:** اطلب الصلاحيتين (Advanced Access) في **App Review**، ثم حوّل التطبيق إلى **Live**. الخطوات كاملة مع نص الفيديو والمبررات في [APP_REVIEW.md](APP_REVIEW.md).
- **App secret:** إن انكشف في أي مكان، فأعد تعيينه من صفحة الإعداد وحدّث user-secrets أو متغيرات البيئة.

## حدود من جهة إنستغرام

- **جودة الفيديو:** الـ API يعطي نسخة واحدة لكل فيديو، بدقة 720p وترميز baseline، وغالباً بين 0.5 و3 Mbps. التطبيق نفسه يعرض جودة أعلى، ولا يوجد خيار لجلبها.
- **الفيديو ذو الموسيقى المحمية** يصل بلا رابط تشغيل: لا يظهر في ريلز، ويظهر في صفحة المتجر بغلافه مع زر «شاهد على Instagram».
- **عدد المشاهدات** غير متاح بالصلاحية الأساسية (يحتاج `instagram_business_manage_insights`)، فتُعرض الإعجابات.
- **روابط الوسائط مؤقتة:** تجددها المزامنة الدورية، لذلك يجب أن تعمل خدمة المزامنة في الخلفية على الخادم.

## ملاحظات النشر

- طبّق الـ migrations على قاعدة الإنتاج: `AddInstagramIntegration` ثم `InstagramFullSyncTimestamp` ثم `InstagramPublishing`.
- **SkiaSharp على لينكس:** الحزمة `SkiaSharp.NativeAssets.Linux.NoDependencies` مضافة، فلا يلزم تثبيت مكتبات نظام إضافية.
- مجلد `wwwroot/uploads/social` يجب أن يكون قابلاً للكتابة ومخدوماً للعامة عبر `PublicBaseUrl`.
- **مفاتيح Data Protection** التي تشفّر التوكنات تُحفظ في `App_Data/DataProtection-Keys`، أو في المسار المحدد بـ `DataProtection:KeysPath`. على ويندوز تُشفَّر بـ DPAPI مرتبطة بالجهاز. عند نقل الخادم انقل هذا المجلد معه، وإلا سيُطلب من كل التجار إعادة ربط حساباتهم (تيك توك وإنستغرام). المجلد مستثنى من git.
- سجلات HttpClient معطّلة لعميل إنستغرام عمداً، لأن إنستغرام يضع `access_token` و`client_secret` في رابط الطلب. لا تُعِد تفعيلها.
