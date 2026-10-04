# الحصول على موافقة Meta لصلاحيات إنستغرام

هذا الدليل لطلب **Advanced Access** للصلاحيتين التي تستخدمهما المنصة، حتى يستطيع أي تاجر (لا المختبرون فقط) ربط حسابه والنشر عليه:

| الصلاحية | ماذا تفعل في المنصة |
|---|---|
| `instagram_business_basic` | قراءة اسم الحساب والصورة والمنشورات لعرضها في صفحة المتجر وصفحة ريلز |
| `instagram_business_content_publish` | نشر صور منتج يختاره التاجر على حسابه، بعد تأكيده |

لا تطلب أي صلاحية أخرى. طلب صلاحية لا يظهر استخدامها في الفيديو سبب شائع للرفض.

---

## 1. قبل التقديم (المتطلبات)

### على الخادم
- [ ] المنصة منشورة على نطاق حقيقي بـ **HTTPS** ويمكن فتحها من خارج جهازك (المراجع يفتحها من عنده). `localhost` لا يكفي.
- [ ] المفاتيح مضبوطة في متغيرات البيئة: `Instagram__AppId` و`Instagram__AppSecret` و`Instagram__RedirectUri` و`Instagram__PublicBaseUrl`.
- [ ] الـ migrations مطبقة على قاعدة الإنتاج (آخرها `InstagramPublishing`).
- [ ] رابط صورة منتج من `PublicBaseUrl` يفتح من الهاتف عبر بيانات الجوال (لا من شبكة البيت)، مثل `https://api.<نطاقك>/uploads/products/...`. إنستغرام يجلب الصور من هذا الرابط.

### في لوحة تطبيق Meta (App settings ← Basic)
- [ ] **App icon** بمقاس 1024×1024.
- [ ] **Privacy Policy URL:** `https://<نطاقك>/privacy`. فيها الآن قسم «ربط حسابات إنستغرام وتيك توك» بالعربية مع فقرة بالإنجليزية، ويشرح ما نجمعه، والنشر بموافقة التاجر فقط، والحذف.
- [ ] **Terms of Service URL:** `https://<نطاقك>/terms`.
- [ ] **User data deletion:** اختر «Data deletion callback URL» وضع `https://<نطاقك>/api/integrations/instagram/data-deletion`.
- [ ] **Category:** Shopping. **Contact email:** بريد تتابعه، فرسائل المراجعة تصل إليه.
- [ ] في **Instagram ← API setup with Instagram business login ← Business login settings**: روابط الـ callback والـ deauthorize والـ data deletion الثلاثة (انظر [README.md](README.md#خطوات-التفعيل-في-meta)).

### التحقق من النشاط التجاري (Business Verification)
- [ ] اربط التطبيق بـ **Business Portfolio** في Meta Business Suite، وأكمل التحقق: الاسم القانوني، والعنوان، ووثيقة رسمية مثل السجل التجاري أو فاتورة باسم النشاط. Meta تطلبه عادةً قبل منح Advanced Access، وقد يستغرق أياماً، فابدأ به أولاً.

### اختبار حقيقي لكل صلاحية (شرط في لوحة Meta)
لوحة App Review تطلب **استدعاءً ناجحاً واحداً على الأقل لكل صلاحية** خلال آخر 30 يوماً، وتعرض «0 of 1 API call(s) required» حتى يتم.
1. **App roles ← Roles ← Instagram Testers:** أضف حساب إنستغرام احترافياً (حسابك أو حساب متجر تجريبي)، ثم اقبل الدعوة من إنستغرام: الإعدادات ← Apps and websites ← Tester invites.
2. من حساب تاجر على المنصة: `/vendor/social` ← ربط Instagram ← وافق على الصلاحيتين.
3. افتح منتجاً ← «نشر» ← اختر حساب Instagram ← انشر منشوراً واحداً بصورة، وآخر كألبوم.
4. تأكد أن المنشور ظهر على إنستغرام وفي سجل «منشورات من المنصة»، وأن عداد الاستدعاءات في لوحة App Review أصبح ✓ للصلاحيتين.

### حساب للمراجع
- [ ] أنشئ حساب **تاجر** تجريبياً على المنصة بمتجر مفعّل و3–5 منتجات بصور جيدة (عطر، حقيبة…). سيستخدمه المراجع للدخول.
- [ ] الدخول بالبريد وكلمة المرور فقط، دون رمز تحقق أو خطوة إضافية. المراجع لا يستطيع استقبال رموز.
- [ ] لا تغيّر كلمة المرور ولا تحذف الحساب حتى تصدر النتيجة.

---

## 2. نص طلب المراجعة (انسخه كما هو بالإنجليزية)

المراجعون يقرؤون الإنجليزية، فاكتب الطلب بها.

### App description / How the app uses Instagram
```
Wasit is a multi-vendor e-commerce marketplace. Sellers (store owners) can connect their own Instagram
professional account to their store on the platform. Once connected:
1) The seller's public posts and reels are displayed on their store page inside the marketplace, and the
   seller can link each post to one of their products so shoppers can tap "Buy now".
2) The seller can publish a product to their Instagram account directly from the platform: they open a
   product, choose which product photos to include (single image or carousel), edit the suggested caption,
   preview the post, choose "Publish now" or schedule a time, and explicitly confirm. Nothing is ever
   published automatically or without the seller's explicit confirmation.
Sellers can disconnect at any time, which immediately deletes their token and stored media.
```

### `instagram_business_basic`
```
We use instagram_business_basic to read the connected seller's profile (username, name, profile picture,
followers and media count) and their published media (images, videos, carousels, captions, permalinks,
like and comment counts). This is shown in two places: the seller's "Social accounts" settings page, where
they can hide posts or link a post to a product, and the seller's public store page / reels page, where
shoppers watch the seller's posts and tap "Buy now" on the linked product. We only access the account of the
seller who connected it, store the access token encrypted, and refresh it before it expires.
```

### `instagram_business_content_publish`
```
We use instagram_business_content_publish so a seller can post their own product to their own Instagram
account from our platform. The seller opens one of their products and taps "Publish" and selects
their connected Instagram account as the destination. They select one or more of the product's photos (up to 10, in the order they choose), edit the caption (we
pre-fill the product name, price and store name, which they can change), see a live preview, choose
"Now" or a scheduled time (up to 30 days ahead), and confirm in a dialog that names the account the post
will be published to. Our server converts the photos to 1080x1080 JPEG, creates the media container
(single image or carousel), waits until it is FINISHED, calls media_publish and shows the seller the
permalink. We check content_publishing_limit before publishing. Scheduled posts can be cancelled by the
seller before they go out. We never publish anything automatically, never publish content the seller did not
select, and never publish to accounts other than the seller's own connected account.
```

### Testing instructions (for the reviewer)
```
1. Open https://<YOUR-DOMAIN>/login and sign in with the seller test account:
   Email: <TEST-VENDOR-EMAIL>   Password: <TEST-VENDOR-PASSWORD>
   (The interface is in Arabic; the screencast has English captions for every step.)
2. Go to https://<YOUR-DOMAIN>/vendor/social ("ربط حسابات التواصل" = Social accounts).
3. Tap "ربط" (Connect) next to Instagram, then "متابعة" (Continue). Log in with any Instagram
   professional (Business or Creator) account and approve the permissions.
4. You return to the Social accounts page: the account and its posts are listed (instagram_business_basic).
   Tap a post to link it to a product or hide it. The posts appear on the public store page:
   https://<YOUR-DOMAIN>/stores/<STORE-ID> (tab "المنشورات" = Posts).
5. Go to https://<YOUR-DOMAIN>/vendor/products ("منتجاتي" = My products), open the "⋮" menu of any product
   and choose "نشر" (Publish).
6. Under "انشر على" (Publish to) make sure the Instagram account is checked (TikTok and Facebook are marked
   "قريباً" = coming soon and cannot be selected). Select one or more photos, edit the caption, check the
   Instagram preview, keep "الآن" (Now) selected and tap "نشر على Instagram". Confirm with "نشر" (Publish)
   in the dialog. The result screen shows a link to the new post
   (instagram_business_content_publish). The post history is at the bottom of /vendor/social.
7. Optional: choose "جدولة" (Schedule), pick a time, confirm, then cancel it from the post history.
```

---

## 3. فيديو الشرح (Screencast)

القواعد التي يرفض المراجعون بسببها غالباً:
- يُظهر **كل الخطوات من البداية**: تسجيل الدخول إلى المنصة، ثم صفحة دخول إنستغرام، ثم **شاشة الموافقة على الصلاحيات** واضحة، ثم استخدام كل صلاحية.
- **الواجهة عربية، فأضف ترجمة إنجليزية** على الشاشة لكل خطوة (أو تعليقاً صوتياً بالإنجليزية). المراجع يجب أن يفهم ما يحدث دون أن يقرأ العربية.
- تصوير شاشة حقيقي (لا عرض شرائح)، بدقة جيدة، ومدته 2–4 دقائق. استخدم عرض هاتف أو متصفحاً بنافذة عادية.
- أظهر المنشور **على إنستغرام نفسه** بعد النشر، لإثبات أن الاستدعاء حقيقي.

| الوقت | ما يظهر | الترجمة على الشاشة |
|---|---|---|
| 0:00 | الصفحة الرئيسية للمنصة | Wasit — multi-vendor marketplace |
| 0:08 | تسجيل الدخول بحساب التاجر | Seller logs in to their store dashboard |
| 0:18 | `/vendor/social` | Social accounts page — seller connects their own Instagram professional account |
| 0:25 | زر «ربط» ← نافذة الصلاحيات في المنصة | Our consent screen lists what we access, including publishing only when the seller confirms |
| 0:35 | صفحة دخول إنستغرام ثم **شاشة الموافقة** | Instagram Login — seller approves instagram_business_basic and instagram_business_content_publish |
| 0:55 | العودة: الحساب والمنشورات | instagram_business_basic: profile and media are shown to the seller |
| 1:05 | ربط منشور بمنتج | Seller links a post to a product |
| 1:15 | صفحة المتجر العامة ← تبويب المنشورات ← «اشترِ الآن» | Shoppers see the seller's posts on the store page with a Buy now button |
| 1:35 | «منتجاتي» ← ⋮ ← «نشر» ← تحديد حساب Instagram | instagram_business_content_publish: seller chooses a product and selects their Instagram account |
| 1:45 | اختيار صورتين، تعديل النص، معاينة Instagram | Seller selects photos (carousel), edits the caption and previews how the post will look on Instagram |
| 2:00 | «نشر» ← نافذة التأكيد ← «نشر» | Explicit confirmation naming the target account — nothing is posted automatically |
| 2:10 | شاشة النتيجة ← «عرض على إنستغرام» | Published — permalink returned by the API |
| 2:20 | المنشور في تطبيق/موقع إنستغرام | The post on the seller's Instagram account |
| 2:30 | سجل «منشورات من المنصة» | Post history with status |
| 2:40 | (اختياري) جدولة ثم إلغاء | Scheduled posts can be cancelled before publishing |
| 2:50 | إعدادات الحساب ← «إلغاء ربط الحساب» | Seller can disconnect at any time — token and data are deleted |

ارفع **فيديو منفصلاً لكل صلاحية** إن طلب النموذج ذلك. يمكن استخدام نفس الفيديو مع ذكر وقت البداية لكل صلاحية في الوصف.

---

## 4. بعد التقديم

- المراجعة تستغرق عادةً من عدة أيام إلى أسبوعين. تابع البريد ولوحة **App Review ← Requests**.
- **إن رُفض الطلب:** اقرأ السبب بدقة. غالباً يكون خطوة لم تظهر في الفيديو، أو ترجمة ناقصة، أو حساب مراجع لا يعمل. أصلح السبب فقط ثم أعد التقديم.
- **بعد الموافقة:** حوّل التطبيق من **Development** إلى **Live** (أعلى لوحة التطبيق). بعدها يستطيع أي تاجر الربط.
- التجار الذين ربطوا حساباتهم قبل إضافة صلاحية النشر تظهر لهم رسالة «أعد الربط ووافق على نشر المحتوى». هذا متوقع.

## 5. أسباب الرفض الشائعة وكيف تتجنبها

| السبب | الحل في المنصة |
|---|---|
| طلب صلاحيات لا تُستخدم | الكود يطلب الصلاحيتين فقط (`Instagram:Scopes`). لا تضف غيرهما |
| النشر دون موافقة صريحة من المستخدم | التاجر يحدد الحساب والصور والنص ويؤكد في نافذة تذكر الحساب. الجدولة يحددها التاجر بنفسه ويمكن إلغاؤها |
| سياسة الخصوصية لا تذكر بيانات إنستغرام | قسم «ربط حسابات إنستغرام وتيك توك» في `/privacy` |
| لا توجد طريقة لحذف البيانات | إلغاء الربط يحذف التوكن والمنشورات وسجل النشر. رابط الحذف ورابط إلغاء التفويض من Meta موجودان |
| المراجع لم يستطع الدخول أو التجربة | حساب تاجر بلا رمز تحقق، ورابط عام يعمل، وتعليمات خطوة بخطوة |
| الفيديو لا يُظهر شاشة الموافقة أو النتيجة على إنستغرام | اتبع جدول الفيديو أعلاه |
| واجهة بلغة لا يفهمها المراجع | ترجمة إنجليزية على الشاشة، والأسماء الإنجليزية بين قوسين في التعليمات |
