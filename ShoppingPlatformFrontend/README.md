# 🛍️ منصة واسط التجارية
## Wasit E-Commerce Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)
![Tailwind](https://img.shields.io/badge/Tailwind-3.x-38B2AC.svg)

**منصة تجارة إلكترونية متعددة البائعين للسوق العراقي**

[التوثيق](./DOCUMENTATION.md) • [مرجع API](./API_REFERENCE.md)

</div>

---

## 📋 نظرة عامة

منصة واسط هي نظام تجارة إلكترونية متكامل يدعم:

- 🛒 **العملاء** - تصفح وشراء المنتجات
- 🏪 **البائعين** - إدارة المتاجر والمنتجات
- 👨‍💼 **الإدارة** - إدارة المنصة بالكامل
- 🚚 **العمليات** - إدارة التوصيل والطلبات

---

## ✨ المميزات

| الميزة | الوصف |
|--------|-------|
| 🌐 RTL كامل | واجهة عربية من اليمين لليسار |
| 🔐 JWT Auth | نظام مصادقة آمن مع تحديث Token تلقائي |
| 📦 Zustand | إدارة حالة خفيفة وسريعة |
| ⚡ React Query | تخزين مؤقت ذكي وتحديث تلقائي |
| 🎨 Tailwind CSS | تصميم متجاوب وقابل للتخصيص |
| 🔔 الإشعارات | نظام إشعارات متكامل |
| 📱 Responsive | يعمل على جميع الأجهزة |

---

## 🚀 البدء السريع

### المتطلبات

```bash
Node.js >= 18.x
npm >= 9.x
```

### التثبيت

```bash
# استنساخ المشروع
git clone [repository-url]
cd wasit-platform

# تثبيت المكتبات
npm install

# إعداد البيئة
cp .env.example .env
# عدّل VITE_API_URL في ملف .env

# تشغيل التطوير
npm run dev

# البناء للإنتاج
npm run build
```

---

## 📁 هيكل المشروع

```
# منصة وسيط (Wasit Platform)

منصة وسيط هي نظام متكامل لإدارة العمليات والخدمات، تهدف إلى تسهيل التفاعل بين المسؤولين، الموردين، والعملاء.

## هيكلة المشروع التفصيلية

يتبع المشروع هيكلة منظمة تفصل بين المنطق البرمجي (Logic)، الواجهات (Components)، والخدمات (Services). فيما يلي توضيح شامل لكافة الملفات والمجلدات:

```text
wasit-platform/
├── public/                     # الملفات العامة والثابتة
├── src/                        # المجلد الرئيسي للكود المصدري
│   ├── api/                    # إعدادات API و Axios
│   │   ├── axios.js            # إعداد instance لـ Axios
│   │   ├── endpoints.js        # مسارات الـ API (endpoints)
│   │   └── index.js            # ملف التصدير للـ API
│   ├── components/             # المكونات البرمجية القابلة لإعادة الاستخدام
│   │   ├── auth/               # مكونات المصادقة (Login, Register)
│   │   ├── common/             # مكونات عامة (Button, Input, Modal, Table...)
│   │   └── layouts/  
│   │   ├── vindor/      
# الخطافات المخصصة
│   │   ├── VendorVariantsManager.jsx      # تخطيطات الصفحات (Navbar, Sidebar, Layouts)
│   ├── hooks/                  # الخطافات المخصصة
│   │   ├── index.js
│   │   ├── useAddresses.js
│   │   ├── useAdmin.js
│   │   ├── useCategories.js
│   │   ├── useOpsNotifications.js
│   │   ├── useOrders.js
│   │   ├── useProducts.js
│   │   └── useVendors.js
│   ├── pages/                  # صفحات التطبيق مقسمة حسب الأدوار
│   │   ├── admin/              # لوحة تحكم المسؤول
│   │   │   ├── AdminCategories.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminStores.jsx
│   │   │   └── AdminUsers.jsx
│   │   ├── auth/               # صفحات تسجيل الدخول والتسجيل
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── customer/           # واجهة العميل
│   │   │   ├── CartPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── OrderDetailsPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── ProductDetailsPage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── StoreDetailsPage.jsx
│   │   │   ├── StoresPage.jsx
│   │   │   └── WishlistPage.jsx
│   │   ├── vendor/             # واجهة المورد
│   │   │   ├── VendorDashboard.jsx
│   │   │   ├── VendorOrders.jsx
│   │   │   ├── VendorProductForm.jsx
│   │   │   └── VendorProducts.jsx
│   │   ├── operations/         # صفحات العمليات
│   │   └── errors/             # صفحات الخطأ (404, 500)
│   ├── providers/              # مزودي السياق (Context Providers)
│   ├── services/               # الخدمات (Services)
│   │   ├── addressService.js
│   │   ├── adminService.js
│   │   ├── authService.js
│   │   ├── cartService.js
│   │   ├── categoryService.js
│   │   ├── index.js
│   │   ├── opsService.js
│   │   ├── orderService.js
│   │   ├── productService.js
│   │   ├── userService.js
│   │   ├── vendorService.js
│   │   └── wishlistService.js
│   ├── stores/                 # إدارة الحالة (State Management)
│   │   ├── authStore.js
│   │   ├── cartStore.js
│   │   ├── index.js
│   │   ├── notificationsStore.js
│   │   ├── uiStore.js
│   │   └── wishlistStore.js
│   ├── styles/                 # ملفات التنسيق CSS/Tailwind
│   ├── utils/                  # الدوال المساعدة العامة
│   ├── App.jsx                 # المكون الرئيسي للتطبيق
│   └── main.jsx                # نقطة الدخول للتطبيق
├── package.json                # ملف إدارة الاعتمادات
├── vite.config.js              # إعدادات Vite
├── tailwind.config.js          # إعدادات Tailwind CSS
└── .env                        # ملف متغيرات البيئة
```

## المجلدات بالتفصيل

*   **src/pages**: تحتوي على المنطق الخاص بكل صفحة. تم تقسيمها لتسهيل الوصول لكل دور (Admin, Vendor, Customer).
*   **src/components**: تحتوي على العناصر المرئية الصغيرة (Buttons, Modals, Tables) التي تُستخدم في عدة صفحات.
*   **src/services**: هنا يتم تعريف كافة الدوال التي تقوم بطلبات HTTP إلى الخادم.
*   **src/hooks**: تحتوي على منطق برمجي مشترك بين المكونات.
*   **src/stores**: تستخدم لـ Zustand أو Redux لإدارة الحالة العامة للتطبيق.

## كيفية التشغيل

لشغيل المشروع محلياً، اتبع الخطوات التالية:

1. قم بتثبيت الاعتمادات:
   ```bash
   npm install
   ```

2. قم بتشغيل خادم التطوير:
   ```bash
   npm run dev
   ```

---

## 📄 الصفحات

### صفحات العميل (14 صفحة)
| الصفحة | المسار | الوصف |
|--------|--------|-------|
| الرئيسية | `/` | الصفحة الرئيسية |
| المنتجات | `/products` | قائمة المنتجات |
| تفاصيل المنتج | `/products/:id` | تفاصيل منتج |
| الفئات | `/categories` | جميع الفئات |
| المتاجر | `/stores` | قائمة المتاجر |
| تفاصيل المتجر | `/stores/:id` | تفاصيل متجر |
| السلة | `/cart` | سلة التسوق |
| الدفع | `/checkout` | إتمام الطلب |
| طلباتي | `/orders` | قائمة الطلبات |
| تفاصيل الطلب | `/orders/:id` | تفاصيل طلب |
| الملف الشخصي | `/profile` | الملف الشخصي |
| المفضلة | `/wishlist` | المنتجات المفضلة |
| الإعدادات | `/settings` | إعدادات الحساب |
| الإشعارات | `/notifications` | الإشعارات |

### صفحات البائع (4 صفحات)
| الصفحة | المسار |
|--------|--------|
| لوحة التحكم | `/vendor` |
| المنتجات | `/vendor/products` |
| إضافة/تعديل منتج | `/vendor/products/new` |
| الطلبات | `/vendor/orders` |

### صفحات الإدارة (4 صفحات)
| الصفحة | المسار |
|--------|--------|
| لوحة التحكم | `/admin` |
| المستخدمين | `/admin/users` |
| المتاجر | `/admin/stores` |
| الفئات | `/admin/categories` |

### صفحات العمليات (3 صفحات)
| الصفحة | المسار |
|--------|--------|
| لوحة التحكم | `/operations` |
| الطلبات | `/operations/orders` |
| السائقين | `/operations/drivers` |

---

## 🔌 الخدمات (Services)

| الخدمة | الملف | الوظائف |
|--------|-------|---------|
| المصادقة | `authService.js` | login, register, logout, refresh |
| المستخدمين | `userService.js` | CRUD, profile |
| المنتجات | `productService.js` | CRUD, search, filter |
| الفئات | `categoryService.js` | CRUD, tree |
| المتاجر | `vendorService.js` | CRUD, approve, reject |
| الطلبات | `orderService.js` | CRUD, status update |
| العناوين | `addressService.js` | CRUD |
| السلة | `cartService.js` | add, remove, update |
| الإدارة | `adminService.js` | stats, reports |
| العمليات | `opsService.js` | delivery management |

---

## 🗄 المتاجر (Stores)

| المتجر | الملف | الوظيفة |
|--------|-------|---------|
| Auth | `authStore.js` | المصادقة وبيانات المستخدم |
| Cart | `cartStore.js` | سلة التسوق |
| Wishlist | `wishlistStore.js` | المفضلة |
| UI | `uiStore.js` | اللغة والثيم |
| Notifications | `notificationsStore.js` | الإشعارات |

---

## 📚 التوثيق

للتفاصيل الكاملة، راجع:

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** - التوثيق الشامل
- **[API_REFERENCE.md](./API_REFERENCE.md)** - مرجع API كامل

---

## 🛠 التقنيات

- **React 18** - إطار العمل
- **Vite 5** - أداة البناء
- **React Router 6** - التوجيه
- **Zustand** - إدارة الحالة
- **TanStack Query** - إدارة البيانات
- **Axios** - طلبات HTTP
- **Tailwind CSS** - التصميم
- **Lucide React** - الأيقونات

---

## 📝 المراحل المكتملة

- [x] المرحلة 1 - البنية التحتية
- [x] المرحلة 2 - المصادقة
- [x] المرحلة 3 - صفحات العميل
- [x] المرحلة 4 - السلة والطلبات
- [x] المرحلة 5 - الملف الشخصي
- [x] المرحلة 6 - لوحة البائع
- [x] المرحلة 7 - لوحة الإدارة
- [x] المرحلة 8 - لوحة العمليات
- [x] المرحلة 9 - التحسينات النهائية

---

## 🔮 المراحل القادمة

- [ ] التقارير والإحصائيات
- [ ] نظام المراجعات
- [ ] نظام الكوبونات
- [ ] الدردشة والدعم
- [ ] PWA
- [ ] Dark Mode
- [ ] تعدد اللغات

---

<div align="center">

**صُنع بـ ❤️ للسوق العراقي**

</div>
