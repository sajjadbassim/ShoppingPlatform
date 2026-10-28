# الخادم التجريبي (Contabo) — مرجع التشغيل

خادم تجريبي مؤقت سيُحذف ويُستبدل لاحقاً. **لا أسرار في هذا الملف**: كلمات المرور والمفاتيح على الخادم نفسه فقط، ولا تُلصق في المحادثات أو git.

- **العنوان:** `https://84-46-251-145.sslip.io` (نطاق sslip.io مبني على الـIP، بلا دومين حقيقي). الـIP `84.46.251.145`، والدخول بـSSH كـ`root`.
- **النظام:** Ubuntu 24.04، 6 أنوية، 12GB. الجدار الناري يفتح 22 و80 و443 فقط، وfail2ban يعمل.
- **كلمة مرور root** ظهرت في محادثة سابقة ولم تُغيَّر بقرار المستخدم (الخادم تجريبي). لا تُعد استعمالها في مكان آخر.

## المكوّنات وأماكنها
| المكوّن | المكان |
|---|---|
| الشيفرة (نسخة git) | `/opt/wasit` (من GitHub `sajjadbassim/ShoppingPlatform`، الفرع `main`) |
| الـAPI المنشور | `/opt/wasit-api` (الإصدار السابق في `/opt/wasit-api-prev`) |
| خدمة الـAPI | `systemctl status wasit-api` (يستمع على `127.0.0.1:5010`) |
| الواجهة (ويب) | `/var/www/wasit-web` (ملفات `dist` ثابتة) |
| nginx | `/etc/nginx/sites-available/wasit`: يخدم الواجهة، ويمرّر `/api` و`/hubs` و`/uploads` و`/swagger` إلى الـAPI، ويحوّل HTTP إلى HTTPS |
| الشهادة | Let's Encrypt بتجديد تلقائي (`certbot.timer`) |
| إعدادات الـAPI وأسراره | `/etc/wasit/api.env` (للجذر فقط، 600) |
| مفتاح Firebase | `/etc/wasit/firebase.json` (للخدمة فقط، 600). المجلد `/etc/wasit` بصلاحية 750 لمجموعة `wasit` كي تقرأه الخدمة |
| كلمات مرور SQL | `/root/secrets/sa.txt` و`app.txt` (للجذر فقط) |
| الصور المرفوعة | `/opt/wasit-api/wwwroot/uploads` |

## قاعدة البيانات
- SQL Server 2025 Express على Ubuntu، قاعدة `ShoppingPlatformDemoDb` (مستعادة من نسخة التطوير بتاريخ 2026-10-28).
- الـAPI يدخل بحساب `wasit_app` (صلاحية `db_owner` على القاعدة فقط)، لا بـ`sa`. المنفذ 1433 **مغلق من الخارج**.
- **للدخول من جهازك (SSMS/Azure Data Studio):** `ssh -N -L 14330:localhost:1433 root@84.46.251.145` ثم الاتصال بـ`localhost,14330` بـSQL Authentication، وكلمة المرور من `/root/secrets/` على الخادم.
- **نسخة احتياطية ليلية** الساعة 3:30 في `/var/backups/wasit` (تُحفظ 7 أيام) عبر `/usr/local/bin/wasit-backup.sh`. Express لا يدعم الضغط.

## الأوامر على الخادم
- **`wasit-deploy`:** يسحب من git، ويبني الـAPI، ويحمل صور `uploads` القديمة، ثم يبدّل الإصدار ويعيد التشغيل. **ضروري استعماله بدل النشر اليدوي** لأن `ecommerce.csproj` يستبعد `wwwroot/uploads/vendors/**` من النشر (شعارات المتاجر)، وأن النشر العادي يضيّع الصور المرفوعة وقت التشغيل.
- **`wasit-set-keys`:** يسأل (بإدخال مخفي) عن مفاتيح تيك توك وإنستغرام وفيسبوك ويكتبها في `api.env` ثم يعيد التشغيل. الإدخال الفارغ يبقي القيمة الحالية. يضبط تلقائياً روابط إعادة التوجيه.
- **نشر الواجهة:** تُبنى محلياً بـ`VITE_API_URL` فارغ (فتستعمل النطاق نفسه)، وتُضغط وتُرفع إلى `/var/www/wasit-web` (يُستبدل المجلد كاملاً). **مجلد `ShoppingPlatformFrontend/dist` مُتتبَّع في git**: بعد أي بناء محلي نفّذ `git checkout -- ShoppingPlatformFrontend/dist` و`git clean -fd` عليه كي لا يدخل كوميتاً.
- **سجل الـAPI:** `journalctl -u wasit-api -f`. **سجل الطلبات:** `/var/log/nginx/access.log`. ملاحظة: سجلات الخادم بتوقيت CET (UTC+1) وقاعدة البيانات بـUTC وبغداد UTC+3.

## الإعدادات الحالية للمنصات
- **تيك توك:** مفتاح وسر **Sandbox** من تطبيق واحد (يجب أن يكونا من التطبيق نفسه وإلا `invalid_client`). الرابط `https://84-46-251-145.sslip.io/api/tiktok/callback` مضاف في لوحة تيك توك. في وضع Sandbox يجب أن يكون الحساب ضمن Target users. ظهر مرة `refresh_expired` وأُعيد الربط؛ يُراقَب.
- **إنستغرام وفيسبوك:** مفاتيح من لوحة Meta، وروابط `/api/integrations/{instagram|facebook}/callback` مضافة. فيسبوك يحتاج `ConfigId` من «Facebook Login for Business ← Configurations». الحسابات يجب أن تكون Testers ما دام التطبيق في وضع التطوير.
- **الإشعارات الفورية (FCM):** مشروع Firebase `wasitplatform`، ومفتاح الخدمة على الخادم. تطبيق البائع الإنتاجي `com.wasit.seller` **غير مسجّل** في Firebase بعد (المسجّل `com.wasit.seller.dev`). الباك يرسل إلى القناة `default`؛ تطبيق السائق ينشئ `orders` فيذهب إشعاره للقناة الاحتياطية (لم يُعدَّل).
- **دخول Google (ويب):** لا يعمل على هذا الرابط حتى يُضاف `https://84-46-251-145.sslip.io` إلى **Authorized JavaScript origins** في عميل OAuth. لم يصل أي طلب Google إلى الخادم في الاختبار، فالمشكلة عند Google لا في الشيفرة. قد ترفض Google نطاق `sslip.io`، فيلزم نطاق حقيقي.

## التطبيقات
- تطبيقات الجوال التطويرية تتصل بهذا الخادم عبر `EXPO_PUBLIC_API_URL` في `mobile/apps/*/.env.local` (خارج git).
- تطبيق البائع: `google-services.json` خارج git (مصدره `google-services-vendor.json` في جذر المشروع، مستثنى محلياً). يلزم عند كل بناء أندرويد.

## ما يلزم عند حذف الخادم أو استبداله
1. نسخ `/etc/wasit/api.env` و`firebase.json` و`/opt/wasit-api/wwwroot/uploads` (وقاعدة البيانات من `/var/backups/wasit`) قبل الحذف.
2. إعادة التثبيت: Ubuntu، .NET 8، SQL Server Express، nginx، certbot، ثم الـAPI من git، وإعادة ضبط الجدار والنسخ الاحتياطي.
3. تغيير النطاق يعني تحديث **كل** روابط إعادة التوجيه (تيك توك وإنستغرام وفيسبوك) وأصول Google، و`TikTok__PublicBaseUrl` و`Instagram__PublicBaseUrl`، و`EXPO_PUBLIC_API_URL`. ويُفضَّل نطاق حقيقي ثابت.
4. الدخول بالمفتاح (SSH key) وتعطيل كلمة المرور في الخادم الجديد.
