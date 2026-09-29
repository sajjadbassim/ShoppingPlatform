# 📚 توثيق منصة واسط التجارية
## Wasit E-Commerce Platform Documentation

---

## 📋 فهرس المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [هيكل المشروع](#هيكل-المشروع)
3. [التقنيات المستخدمة](#التقنيات-المستخدمة)
4. [إعداد المشروع](#إعداد-المشروع)
5. [طبقة API](#طبقة-api)
6. [الخدمات (Services)](#الخدمات-services)
7. [المتاجر (Stores)](#المتاجر-stores)
8. [الـ Hooks](#الـ-hooks)
9. [الصفحات والمكونات](#الصفحات-والمكونات)
10. [جدول ربط API](#جدول-ربط-api)
11. [أدوار المستخدمين](#أدوار-المستخدمين)
12. [التدفقات الرئيسية](#التدفقات-الرئيسية)

---

## 🌐 نظرة عامة

**منصة واسط** هي منصة تجارة إلكترونية متعددة البائعين (Multi-vendor) مصممة للسوق العراقي، تدعم:

- **العملاء**: تصفح وشراء المنتجات
- **البائعين**: إدارة متاجرهم ومنتجاتهم
- **الإدارة**: إدارة المنصة بالكامل
- **العمليات**: إدارة التوصيل والطلبات

### المميزات الرئيسية:
- ✅ واجهة عربية RTL كاملة
- ✅ نظام مصادقة JWT
- ✅ إدارة السلة والمفضلة (Zustand)
- ✅ تخزين مؤقت ذكي (React Query)
- ✅ لوحات تحكم متعددة
- ✅ نظام إشعارات
- ✅ تصميم متجاوب (Responsive)

---

## 📁 هيكل المشروع

```
wasit-platform/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/                      # طبقة الاتصال بالـ API
│   │   ├── axios.js              # إعداد Axios + Interceptors
│   │   ├── endpoints.js          # جميع نقاط النهاية
│   │   └── index.js              # تصدير موحد
│   │
│   ├── services/                 # طبقة الخدمات
│   │   ├── authService.js        # خدمة المصادقة
│   │   ├── userService.js        # خدمة المستخدمين
│   │   ├── productService.js     # خدمة المنتجات
│   │   ├── categoryService.js    # خدمة الفئات
│   │   ├── vendorService.js      # خدمة المتاجر
│   │   ├── orderService.js       # خدمة الطلبات
│   │   ├── addressService.js     # خدمة العناوين
│   │   ├── cartService.js        # خدمة السلة
│   │   ├── adminService.js       # خدمة الإدارة
│   │   ├── opsService.js         # خدمة العمليات
│   │   └── index.js              # تصدير موحد
│   │
│   ├── stores/                   # إدارة الحالة (Zustand)
│   │   ├── authStore.js          # حالة المصادقة
│   │   ├── cartStore.js          # حالة السلة
│   │   ├── wishlistStore.js      # حالة المفضلة
│   │   ├── uiStore.js            # حالة الواجهة
│   │   ├── notificationsStore.js # حالة الإشعارات
│   │   └── index.js              # تصدير موحد
│   │
│   ├── hooks/                    # React Query Hooks
│   │   ├── useProducts.js        # hooks المنتجات
│   │   ├── useCategories.js      # hooks الفئات
│   │   ├── useVendors.js         # hooks المتاجر
│   │   ├── useOrders.js          # hooks الطلبات
│   │   ├── useAddresses.js       # hooks العناوين
│   │   ├── useAdmin.js           # hooks الإدارة
│   │   └── index.js              # تصدير موحد
│   │
│   ├── components/               # المكونات
│   │   ├── common/               # مكونات مشتركة
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── Notifications.jsx
│   │   │   └── ...
│   │   ├── auth/                 # مكونات المصادقة
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── index.js
│   │   └── layouts/              # التخطيطات
│   │       ├── MainLayout.jsx
│   │       └── DashboardLayout.jsx
│   │
│   ├── pages/                    # الصفحات
│   │   ├── auth/                 # صفحات المصادقة
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── ForgotPasswordPage.jsx
│   │   ├── customer/             # صفحات العميل
│   │   │   ├── HomePage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── ProductDetailsPage.jsx
│   │   │   ├── CartPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── OrderDetailsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── WishlistPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── StoresPage.jsx
│   │   │   └── StoreDetailsPage.jsx
│   │   ├── vendor/               # صفحات البائع
│   │   │   ├── VendorDashboard.jsx
│   │   │   ├── VendorProducts.jsx
│   │   │   ├── VendorProductForm.jsx
│   │   │   └── VendorOrders.jsx
│   │   ├── admin/                # صفحات الإدارة
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   ├── AdminStores.jsx
│   │   │   └── AdminCategories.jsx
│   │   ├── operations/           # صفحات العمليات
│   │   │   ├── OperationsDashboard.jsx
│   │   │   ├── OperationsOrders.jsx
│   │   │   └── OperationsDrivers.jsx
│   │   └── errors/               # صفحات الأخطاء
│   │       ├── NotFoundPage.jsx
│   │       ├── UnauthorizedPage.jsx
│   │       └── NetworkErrorPage.jsx
│   │
│   ├── providers/                # Providers
│   │   └── QueryProvider.jsx     # React Query Provider
│   │
│   ├── styles/                   # الأنماط
│   │   └── index.css             # Tailwind + Custom CSS
│   │
│   ├── App.jsx                   # المكون الرئيسي
│   └── main.jsx                  # نقطة الدخول
│
├── .env.example                  # متغيرات البيئة
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 🛠 التقنيات المستخدمة

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| React | 18.x | إطار العمل الأساسي |
| Vite | 5.x | أداة البناء |
| React Router | 6.x | التوجيه |
| Zustand | 4.x | إدارة الحالة |
| TanStack Query | 5.x | إدارة البيانات والتخزين المؤقت |
| Axios | 1.x | طلبات HTTP |
| Tailwind CSS | 3.x | التصميم |
| Lucide React | - | الأيقونات |

---

## ⚙️ إعداد المشروع

### 1. المتطلبات
```bash
Node.js >= 18.x
npm >= 9.x
```

### 2. التثبيت
```bash
# استنساخ المشروع
git clone [repository-url]
cd wasit-platform

# تثبيت المكتبات
npm install

# إعداد متغيرات البيئة
cp .env.example .env
```

### 3. متغيرات البيئة (.env)
```env
# API Configuration
VITE_API_URL=https://your-api-domain.com/api
VITE_API_TIMEOUT=30000

# App Configuration
VITE_APP_NAME=واسط
VITE_APP_VERSION=1.0.0
```

### 4. التشغيل
```bash
# وضع التطوير
npm run dev

# البناء للإنتاج
npm run build

# معاينة البناء
npm run preview
```

---

## 🔌 طبقة API

### ملف axios.js - إعداد Axios

```javascript
// الموقع: src/api/axios.js

// الوظائف المتاحة:
- apiGet(url, params)      // طلب GET
- apiPost(url, data)       // طلب POST
- apiPut(url, data)        // طلب PUT
- apiPatch(url, data)      // طلب PATCH
- apiDelete(url)           // طلب DELETE
- apiPostForm(url, data)   // طلب POST مع FormData
- apiPutForm(url, data)    // طلب PUT مع FormData

// الميزات:
- إضافة Token تلقائياً من localStorage
- تحديث Token عند 401 (Refresh Token)
- Timeout قابل للتعديل
- معالجة الأخطاء موحدة
```

### ملف endpoints.js - نقاط النهاية

```javascript
// الموقع: src/api/endpoints.js

export const API_ENDPOINTS = {
  // المصادقة
  AUTH: {
    LOGIN: '/Auth/login',
    REGISTER: '/Auth/register',
    REFRESH: '/Auth/refresh-token',
    LOGOUT: '/Auth/logout',
    FORGOT_PASSWORD: '/Auth/forgot-password',
    RESET_PASSWORD: '/Auth/reset-password',
    CHANGE_PASSWORD: '/Auth/change-password',
  },

  // المستخدمين
  USERS: {
    BASE: '/Users',
    PAGED: '/Users/paged',
    BY_ID: (id) => `/Users/${id}`,
    BY_PHONE: (phone) => `/Users/phone/${phone}`,
    PROFILE: '/Users/profile',
  },

  // المنتجات
  PRODUCTS: {
    BASE: '/Products',
    PAGED: '/Products/paged',
    BY_ID: (id) => `/Products/${id}`,
    BY_CATEGORY: (id) => `/Products/category/${id}`,
    BY_VENDOR: (id) => `/Products/vendor/${id}`,
    SEARCH: '/Products/search',
    FEATURED: '/Products/featured',
  },

  // الفئات
  CATEGORIES: {
    BASE: '/Categories',
    BY_ID: (id) => `/Categories/${id}`,
    ROOT: '/Categories/root',
    CHILDREN: (id) => `/Categories/${id}/children`,
  },

  // المتاجر
  VENDORS: {
    BASE: '/Vendors',
    PAGED: '/Vendors/paged',
    BY_ID: (id) => `/Vendors/${id}`,
    BY_PHONE: (phone) => `/Vendors/phone/${phone}`,
    LOGO: (id) => `/Vendors/${id}/logo`,
  },

  // الطلبات
  ORDERS: {
    BASE: '/Orders',
    PAGED: '/Orders/paged',
    BY_ID: (id) => `/Orders/${id}`,
    BY_CUSTOMER: (id) => `/Orders/customer/${id}`,
    BY_VENDOR: (id) => `/Orders/vendor/${id}`,
  },

  // العناوين
  ADDRESSES: {
    BASE: '/Addresses',
    BY_ID: (id) => `/Addresses/${id}`,
    BY_USER: (userId) => `/Addresses/user/${userId}`,
  },

  // السلة
  CART: {
    BASE: '/Cart',
    BY_USER: (userId) => `/Cart/user/${userId}`,
    ADD: '/Cart/add',
    UPDATE: '/Cart/update',
    REMOVE: '/Cart/remove',
    CLEAR: '/Cart/clear',
  },

  // الإدارة
  ADMIN: {
    DASHBOARD: '/Admin/dashboard',
    STATS: '/Admin/stats',
    USERS: '/Admin/users',
    VENDORS: '/Admin/vendors',
    ORDERS: '/Admin/orders',
    PRODUCTS: '/Admin/products',
  },
};
```

---

## 📦 الخدمات (Services)

### 1. authService.js - خدمة المصادقة

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `login(credentials)` | تسجيل الدخول | `/Auth/login` | POST |
| `register(userData)` | إنشاء حساب | `/Auth/register` | POST |
| `logout()` | تسجيل الخروج | `/Auth/logout` | POST |
| `refreshToken()` | تحديث Token | `/Auth/refresh-token` | POST |
| `forgotPassword(email)` | طلب استعادة كلمة المرور | `/Auth/forgot-password` | POST |
| `resetPassword(data)` | إعادة تعيين كلمة المرور | `/Auth/reset-password` | POST |
| `changePassword(data)` | تغيير كلمة المرور | `/Auth/change-password` | POST |
| `getCurrentUser()` | الحصول على المستخدم الحالي | `/Users/profile` | GET |

```javascript
// مثال الاستخدام:
import { authService } from './services';

// تسجيل الدخول
const result = await authService.login({
  phone: '+9647701234567',
  password: 'password123'
});
// Response: { token, refreshToken, user }

// إنشاء حساب
const newUser = await authService.register({
  fullName: 'أحمد محمد',
  phone: '+9647701234567',
  password: 'password123',
  email: 'ahmed@email.com' // اختياري
});
```

---

### 2. userService.js - خدمة المستخدمين

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll()` | جلب جميع المستخدمين | `/Users` | GET |
| `getPaged(params)` | جلب المستخدمين مع التصفح | `/Users/paged` | GET |
| `getById(id)` | جلب مستخدم بالمعرف | `/Users/{id}` | GET |
| `getByPhone(phone)` | جلب مستخدم برقم الهاتف | `/Users/phone/{phone}` | GET |
| `getProfile()` | جلب الملف الشخصي | `/Users/profile` | GET |
| `create(userData)` | إنشاء مستخدم | `/Users` | POST |
| `update(id, userData)` | تحديث مستخدم | `/Users/{id}` | PUT |
| `delete(id)` | حذف مستخدم | `/Users/{id}` | DELETE |
| `updateStatus(id, status)` | تحديث حالة المستخدم | `/Users/{id}/status` | PATCH |

```javascript
// مثال الاستخدام:
import { userService } from './services';

// جلب المستخدمين مع التصفح
const users = await userService.getPaged({
  pageNumber: 1,
  pageSize: 10,
  role: 'Customer',
  search: 'أحمد'
});

// تحديث المستخدم
await userService.update(userId, {
  fullName: 'أحمد محمد علي',
  email: 'new@email.com'
});
```

---

### 3. productService.js - خدمة المنتجات

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll(onlyActive)` | جلب جميع المنتجات | `/Products` | GET |
| `getPaged(params)` | جلب المنتجات مع التصفح | `/Products/paged` | GET |
| `getById(id)` | جلب منتج بالمعرف | `/Products/{id}` | GET |
| `getByCategory(categoryId, params)` | جلب منتجات فئة | `/Products/category/{id}` | GET |
| `getByVendor(vendorId, params)` | جلب منتجات متجر | `/Products/vendor/{id}` | GET |
| `search(params)` | البحث في المنتجات | `/Products/search` | GET |
| `getFeatured(count)` | جلب المنتجات المميزة | `/Products/featured` | GET |
| `create(productData)` | إنشاء منتج | `/Products` | POST |
| `update(id, productData)` | تحديث منتج | `/Products/{id}` | PUT |
| `delete(id)` | حذف منتج | `/Products/{id}` | DELETE |
| `uploadImages(productId, images)` | رفع صور المنتج | `/Products/{id}/images` | POST |

```javascript
// مثال الاستخدام:
import { productService } from './services';

// جلب المنتجات مع فلاتر
const products = await productService.getPaged({
  pageNumber: 1,
  pageSize: 20,
  categoryId: 5,
  minPrice: 10000,
  maxPrice: 500000,
  sortBy: 'price',
  sortOrder: 'asc'
});

// إنشاء منتج جديد
const newProduct = await productService.create({
  nameAr: 'آيفون 15 برو',
  nameEn: 'iPhone 15 Pro',
  descriptionAr: 'أحدث هاتف من أبل',
  price: 1500000,
  categoryId: 3,
  vendorId: 'vendor-id',
  stockQuantity: 50,
  isActive: true
});
```

---

### 4. categoryService.js - خدمة الفئات

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll(onlyActive)` | جلب جميع الفئات | `/Categories` | GET |
| `getById(id)` | جلب فئة بالمعرف | `/Categories/{id}` | GET |
| `getRoot()` | جلب الفئات الرئيسية | `/Categories/root` | GET |
| `getChildren(parentId)` | جلب الفئات الفرعية | `/Categories/{id}/children` | GET |
| `create(categoryData)` | إنشاء فئة | `/Categories` | POST |
| `update(id, categoryData)` | تحديث فئة | `/Categories/{id}` | PUT |
| `delete(id)` | حذف فئة | `/Categories/{id}` | DELETE |

```javascript
// مثال الاستخدام:
import { categoryService } from './services';

// جلب جميع الفئات
const categories = await categoryService.getAll(true); // النشطة فقط

// إنشاء فئة فرعية
await categoryService.create({
  nameAr: 'هواتف ذكية',
  nameEn: 'Smartphones',
  parentId: 'electronics-category-id',
  isActive: true,
  displayOrder: 1
});
```

---

### 5. vendorService.js - خدمة المتاجر

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll(onlyActive)` | جلب جميع المتاجر | `/Vendors` | GET |
| `getPaged(params)` | جلب المتاجر مع التصفح | `/Vendors/paged` | GET |
| `getById(id)` | جلب متجر بالمعرف | `/Vendors/{id}` | GET |
| `create(vendorData, logo)` | إنشاء متجر | `/Vendors` | POST |
| `update(id, vendorData, logo)` | تحديث متجر | `/Vendors/{id}` | PUT |
| `delete(id)` | حذف متجر | `/Vendors/{id}` | DELETE |
| `uploadLogo(vendorId, logo)` | رفع شعار المتجر | `/Vendors/{id}/logo` | POST |
| `approve(vendorId)` | قبول متجر | `/Vendors/{id}/approve` | POST |
| `reject(vendorId)` | رفض متجر | `/Vendors/{id}/reject` | POST |
| `suspend(vendorId)` | تعليق متجر | `/Vendors/{id}/suspend` | POST |

```javascript
// مثال الاستخدام:
import { vendorService } from './services';

// جلب المتاجر مع فلاتر
const vendors = await vendorService.getPaged({
  pageNumber: 1,
  pageSize: 10,
  status: 'Active',
  categoryId: 5
});

// قبول متجر جديد
await vendorService.approve(vendorId);
```

---

### 6. orderService.js - خدمة الطلبات

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll()` | جلب جميع الطلبات | `/Orders` | GET |
| `getPaged(params)` | جلب الطلبات مع التصفح | `/Orders/paged` | GET |
| `getById(id)` | جلب طلب بالمعرف | `/Orders/{id}` | GET |
| `getByCustomer(customerId, params)` | جلب طلبات العميل | `/Orders/customer/{id}` | GET |
| `getByVendor(vendorId, params)` | جلب طلبات المتجر | `/Orders/vendor/{id}` | GET |
| `create(orderData)` | إنشاء طلب | `/Orders` | POST |
| `updateStatus(id, status)` | تحديث حالة الطلب | `/Orders/{id}/status` | PATCH |
| `cancel(id)` | إلغاء طلب | `/Orders/{id}/cancel` | PATCH |

```javascript
// مثال الاستخدام:
import { orderService } from './services';

// إنشاء طلب جديد
const order = await orderService.create({
  items: [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1 }
  ],
  shippingAddress: {
    recipientName: 'أحمد محمد',
    phone: '+9647701234567',
    city: 'بغداد',
    area: 'المنصور',
    street: 'شارع الأميرات',
    building: '15'
  },
  paymentMethod: 'cash'
});

// تحديث حالة الطلب
await orderService.updateStatus(orderId, 'Shipped');
```

---

### 7. addressService.js - خدمة العناوين

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getAll()` | جلب جميع العناوين | `/Addresses` | GET |
| `getById(id)` | جلب عنوان بالمعرف | `/Addresses/{id}` | GET |
| `getByUser(userId)` | جلب عناوين المستخدم | `/Addresses/user/{userId}` | GET |
| `create(addressData)` | إنشاء عنوان | `/Addresses` | POST |
| `update(id, addressData)` | تحديث عنوان | `/Addresses/{id}` | PUT |
| `delete(id)` | حذف عنوان | `/Addresses/{id}` | DELETE |
| `setDefault(id)` | تعيين كعنوان افتراضي | `/Addresses/{id}/default` | PATCH |

```javascript
// مثال الاستخدام:
import { addressService } from './services';

// إنشاء عنوان جديد
await addressService.create({
  userId: 'user-id',
  title: 'المنزل',
  recipientName: 'أحمد محمد',
  phone: '+9647701234567',
  city: 'بغداد',
  area: 'الكرادة',
  street: 'شارع فلسطين',
  building: '25',
  isDefault: true
});
```

---

### 8. adminService.js - خدمة الإدارة

| الدالة | الوصف | API Endpoint | Method |
|--------|-------|--------------|--------|
| `getDashboardStats()` | إحصائيات لوحة التحكم | `/Admin/stats` | GET |
| `getUsers(params)` | جلب المستخدمين | `/Admin/users` | GET |
| `getVendors(params)` | جلب المتاجر | `/Admin/vendors` | GET |
| `getOrders(params)` | جلب الطلبات | `/Admin/orders` | GET |
| `getProducts(params)` | جلب المنتجات | `/Admin/products` | GET |
| `getSalesReport(params)` | تقرير المبيعات | `/Admin/reports/sales` | GET |
| `getTopVendors(count)` | أفضل البائعين | `/Admin/reports/top-vendors` | GET |
| `getTopProducts(count)` | أفضل المنتجات | `/Admin/reports/top-products` | GET |

```javascript
// مثال الاستخدام:
import { adminService } from './services';

// جلب إحصائيات لوحة التحكم
const stats = await adminService.getDashboardStats();
// Response: { totalSales, totalOrders, totalUsers, activeVendors, ... }
```

---

## 🗄 المتاجر (Stores)

### 1. authStore.js - متجر المصادقة

```javascript
// الموقع: src/stores/authStore.js

const useAuthStore = create(persist((set, get) => ({
  // الحالة
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,

  // الدوال
  login: async (credentials) => { ... },
  register: async (userData) => { ... },
  logout: () => { ... },
  updateUser: (userData) => { ... },
  setTokens: (token, refreshToken) => { ... },
})));

// الاستخدام في المكونات:
const { user, isAuthenticated, login, logout } = useAuthStore();
```

### 2. cartStore.js - متجر السلة

```javascript
// الموقع: src/stores/cartStore.js

const useCartStore = create(persist((set, get) => ({
  // الحالة
  items: [],
  coupon: null,
  discount: 0,

  // الدوال
  addItem: (product, quantity) => { ... },
  removeItem: (productId) => { ... },
  updateQuantity: (productId, quantity) => { ... },
  clearCart: () => { ... },
  applyCoupon: (code) => { ... },
  removeCoupon: () => { ... },
  
  // الحسابات
  getItemsCount: () => { ... },
  getTotal: () => { ... },
  getSubtotal: () => { ... },
})));

// الاستخدام:
const { items, addItem, getTotal } = useCartStore();
```

### 3. wishlistStore.js - متجر المفضلة

```javascript
// الموقع: src/stores/wishlistStore.js

const useWishlistStore = create(persist((set, get) => ({
  // الحالة
  items: [],

  // الدوال
  addItem: (product) => { ... },
  removeItem: (productId) => { ... },
  clearWishlist: () => { ... },
  isInWishlist: (productId) => { ... },
  toggleItem: (product) => { ... },
})));
```

### 4. notificationsStore.js - متجر الإشعارات

```javascript
// الموقع: src/stores/notificationsStore.js

const useNotificationsStore = create(persist((set, get) => ({
  // الحالة
  notifications: [],
  unreadCount: 0,

  // الدوال
  addNotification: (notification) => { ... },
  markAsRead: (notificationId) => { ... },
  markAllAsRead: () => { ... },
  removeNotification: (notificationId) => { ... },
  clearAll: () => { ... },
})));
```

### 5. uiStore.js - متجر الواجهة

```javascript
// الموقع: src/stores/uiStore.js

const useUIStore = create(persist((set) => ({
  // الحالة
  theme: 'light',
  language: 'ar',
  sidebarOpen: true,

  // الدوال
  setTheme: (theme) => { ... },
  setLanguage: (language) => { ... },
  toggleSidebar: () => { ... },
})));
```

---

## 🎣 الـ Hooks

### 1. useProducts.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useProducts(onlyActive)` | جلب جميع المنتجات | `onlyActive: boolean` |
| `useProductsPaged(params)` | جلب المنتجات مع التصفح | `{ pageNumber, pageSize, categoryId, ... }` |
| `useProduct(id)` | جلب منتج واحد | `id: string` |
| `useProductsByCategory(categoryId, params)` | جلب منتجات فئة | `categoryId, params` |
| `useProductsByVendor(vendorId, params)` | جلب منتجات متجر | `vendorId, params` |
| `useCreateProduct()` | إنشاء منتج | - |
| `useUpdateProduct()` | تحديث منتج | - |
| `useDeleteProduct()` | حذف منتج | - |

```javascript
// مثال الاستخدام:
import { useProductsPaged, useProduct } from './hooks';

// في المكون:
const { data, isLoading, error } = useProductsPaged({
  pageNumber: 1,
  pageSize: 20,
  categoryId: 5
});

const { data: product } = useProduct(productId);
```

### 2. useCategories.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useCategories(onlyActive)` | جلب جميع الفئات | `onlyActive: boolean` |
| `useCategory(id)` | جلب فئة واحدة | `id: string` |
| `useRootCategories()` | جلب الفئات الرئيسية | - |
| `useSubcategories(parentId)` | جلب الفئات الفرعية | `parentId: string` |
| `useCreateCategory()` | إنشاء فئة | - |
| `useUpdateCategory()` | تحديث فئة | - |
| `useDeleteCategory()` | حذف فئة | - |

### 3. useVendors.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useVendors(onlyActive)` | جلب جميع المتاجر | `onlyActive: boolean` |
| `useVendorsPaged(params)` | جلب المتاجر مع التصفح | `params: object` |
| `useVendor(id)` | جلب متجر واحد | `id: string` |

### 4. useOrders.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useOrders(params)` | جلب الطلبات مع التصفح | `params: object` |
| `useOrder(id)` | جلب طلب واحد | `id: string` |
| `useCustomerOrders(customerId, params)` | جلب طلبات العميل | `customerId, params` |
| `useVendorOrders(vendorId, params)` | جلب طلبات المتجر | `vendorId, params` |
| `useCreateOrder()` | إنشاء طلب | - |
| `useCancelOrder()` | إلغاء طلب | - |

### 5. useAddresses.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useAddresses(userId)` | جلب عناوين المستخدم | `userId: string` |
| `useCreateAddress()` | إنشاء عنوان | - |
| `useUpdateAddress()` | تحديث عنوان | - |
| `useDeleteAddress()` | حذف عنوان | - |

### 6. useAdmin.js

| Hook | الوصف | Parameters |
|------|-------|------------|
| `useAdminStats()` | إحصائيات لوحة التحكم | - |
| `useAdminUsers(params)` | جلب المستخدمين | `params: object` |
| `useAdminVendors(params)` | جلب المتاجر | `params: object` |
| `useAdminOrders(params)` | جلب الطلبات | `params: object` |
| `useUpdateUserStatus()` | تحديث حالة المستخدم | - |
| `useDeleteUser()` | حذف مستخدم | - |
| `useApproveVendor()` | قبول متجر | - |
| `useRejectVendor()` | رفض متجر | - |
| `useSuspendVendor()` | تعليق متجر | - |

---

## 📄 الصفحات والمكونات

### صفحات العميل (Customer)

| الصفحة | المسار | الوصف | API المستخدم |
|--------|--------|-------|--------------|
| HomePage | `/` | الصفحة الرئيسية | `useCategories`, `useProductsPaged` |
| ProductsPage | `/products` | قائمة المنتجات | `useProductsPaged`, `useCategories` |
| ProductDetailsPage | `/products/:id` | تفاصيل المنتج | `useProduct`, `useProductsByCategory` |
| CategoriesPage | `/categories` | الفئات | `useCategories` |
| StoresPage | `/stores` | المتاجر | `useVendorsPaged` |
| StoreDetailsPage | `/stores/:id` | تفاصيل المتجر | `useVendor`, `useProductsByVendor` |
| CartPage | `/cart` | السلة | `cartStore` |
| CheckoutPage | `/checkout` | إتمام الطلب | `useAddresses`, `useCreateOrder` |
| OrdersPage | `/orders` | طلباتي | `useOrders` |
| OrderDetailsPage | `/orders/:id` | تفاصيل الطلب | `useOrder`, `useCancelOrder` |
| ProfilePage | `/profile` | الملف الشخصي | `authStore`, `useAddresses` |
| WishlistPage | `/wishlist` | المفضلة | `wishlistStore` |
| SettingsPage | `/settings` | الإعدادات | `uiStore` |
| NotificationsPage | `/notifications` | الإشعارات | `notificationsStore` |

### صفحات البائع (Vendor)

| الصفحة | المسار | الوصف | API المستخدم |
|--------|--------|-------|--------------|
| VendorDashboard | `/vendor` | لوحة التحكم | `useProductsByVendor`, `useOrders` |
| VendorProducts | `/vendor/products` | المنتجات | `useProductsByVendor`, `useDeleteProduct` |
| VendorProductForm | `/vendor/products/new` | إضافة منتج | `useCategories`, `useCreateProduct` |
| VendorProductForm | `/vendor/products/:id/edit` | تعديل منتج | `useProduct`, `useUpdateProduct` |
| VendorOrders | `/vendor/orders` | الطلبات | `useOrders`, `orderService.updateStatus` |

### صفحات الإدارة (Admin)

| الصفحة | المسار | الوصف | API المستخدم |
|--------|--------|-------|--------------|
| AdminDashboard | `/admin` | لوحة التحكم | `useAdminStats`, `useAdminOrders`, `useAdminVendors` |
| AdminUsers | `/admin/users` | المستخدمين | `useAdminUsers`, `useUpdateUserStatus`, `useDeleteUser` |
| AdminStores | `/admin/stores` | المتاجر | `useAdminVendors`, `useApproveVendor`, `useRejectVendor` |
| AdminCategories | `/admin/categories` | الفئات | `useCategories`, `useCreateCategory`, `useUpdateCategory` |

### صفحات العمليات (Operations)

| الصفحة | المسار | الوصف | API المستخدم |
|--------|--------|-------|--------------|
| OperationsDashboard | `/operations` | لوحة التحكم | `useOrders` |
| OperationsOrders | `/operations/orders` | الطلبات | `useOrders`, `orderService.updateStatus` |
| OperationsDrivers | `/operations/drivers` | السائقين | بيانات تجريبية |

---

## 📊 جدول ربط API الكامل

### المصادقة (Authentication)

| العملية | Endpoint | Method | Request Body | Response |
|---------|----------|--------|--------------|----------|
| تسجيل الدخول | `/Auth/login` | POST | `{ phone, password }` | `{ token, refreshToken, user }` |
| إنشاء حساب | `/Auth/register` | POST | `{ fullName, phone, password, email? }` | `{ token, refreshToken, user }` |
| تحديث Token | `/Auth/refresh-token` | POST | `{ refreshToken }` | `{ token, refreshToken }` |
| تسجيل الخروج | `/Auth/logout` | POST | - | `{ success }` |
| استعادة كلمة المرور | `/Auth/forgot-password` | POST | `{ phone }` | `{ success, message }` |
| تغيير كلمة المرور | `/Auth/change-password` | POST | `{ currentPassword, newPassword }` | `{ success }` |

### المنتجات (Products)

| العملية | Endpoint | Method | Query Params | Response |
|---------|----------|--------|--------------|----------|
| جلب الكل | `/Products` | GET | `onlyActive` | `Product[]` |
| جلب مع تصفح | `/Products/paged` | GET | `pageNumber, pageSize, categoryId, vendorId, minPrice, maxPrice, sortBy, sortOrder, search` | `{ items, totalCount, totalPages }` |
| جلب واحد | `/Products/{id}` | GET | - | `Product` |
| جلب حسب الفئة | `/Products/category/{id}` | GET | `pageNumber, pageSize` | `Product[]` |
| جلب حسب المتجر | `/Products/vendor/{id}` | GET | `pageNumber, pageSize` | `Product[]` |
| إنشاء | `/Products` | POST | Body: `ProductData` | `Product` |
| تحديث | `/Products/{id}` | PUT | Body: `ProductData` | `Product` |
| حذف | `/Products/{id}` | DELETE | - | `{ success }` |

### الطلبات (Orders)

| العملية | Endpoint | Method | Query/Body | Response |
|---------|----------|--------|------------|----------|
| جلب مع تصفح | `/Orders/paged` | GET | `pageNumber, pageSize, status, customerId, vendorId` | `{ items, totalCount, totalPages }` |
| جلب واحد | `/Orders/{id}` | GET | - | `Order` |
| إنشاء | `/Orders` | POST | Body: `OrderData` | `Order` |
| تحديث الحالة | `/Orders/{id}/status` | PATCH | Body: `{ status }` | `Order` |
| إلغاء | `/Orders/{id}/cancel` | PATCH | - | `Order` |

### الفئات (Categories)

| العملية | Endpoint | Method | Body | Response |
|---------|----------|--------|------|----------|
| جلب الكل | `/Categories` | GET | - | `Category[]` |
| جلب واحدة | `/Categories/{id}` | GET | - | `Category` |
| إنشاء | `/Categories` | POST | `CategoryData` | `Category` |
| تحديث | `/Categories/{id}` | PUT | `CategoryData` | `Category` |
| حذف | `/Categories/{id}` | DELETE | - | `{ success }` |

### المتاجر (Vendors)

| العملية | Endpoint | Method | Body | Response |
|---------|----------|--------|------|----------|
| جلب مع تصفح | `/Vendors/paged` | GET | Query params | `{ items, totalCount, totalPages }` |
| جلب واحد | `/Vendors/{id}` | GET | - | `Vendor` |
| قبول | `/Vendors/{id}/approve` | POST | - | `Vendor` |
| رفض | `/Vendors/{id}/reject` | POST | - | `Vendor` |
| تعليق | `/Vendors/{id}/suspend` | POST | - | `Vendor` |

### العناوين (Addresses)

| العملية | Endpoint | Method | Body | Response |
|---------|----------|--------|------|----------|
| جلب عناوين المستخدم | `/Addresses/user/{userId}` | GET | - | `Address[]` |
| إنشاء | `/Addresses` | POST | `AddressData` | `Address` |
| تحديث | `/Addresses/{id}` | PUT | `AddressData` | `Address` |
| حذف | `/Addresses/{id}` | DELETE | - | `{ success }` |
| تعيين افتراضي | `/Addresses/{id}/default` | PATCH | - | `Address` |

---

## 👥 أدوار المستخدمين

| الدور | الوصف | الصلاحيات |
|-------|-------|-----------|
| **Customer** | العميل | تصفح، شراء، إدارة الطلبات والملف الشخصي |
| **Vendor** | البائع | إدارة المتجر والمنتجات والطلبات |
| **Admin** | المدير | إدارة المنصة بالكامل |
| **Ops** | العمليات | إدارة التوصيل والطلبات |

### حماية المسارات (Route Guards)

```javascript
// ProtectedRoute - يتطلب تسجيل دخول
<ProtectedRoute>
  <ProfilePage />
</ProtectedRoute>

// ProtectedRoute مع أدوار محددة
<ProtectedRoute allowedRoles={['Vendor']}>
  <VendorDashboard />
</ProtectedRoute>

<ProtectedRoute allowedRoles={['Admin']}>
  <AdminDashboard />
</ProtectedRoute>

// GuestRoute - للزوار فقط
<GuestRoute>
  <LoginPage />
</GuestRoute>
```

---

## 🔄 التدفقات الرئيسية

### 1. تدفق تسجيل الدخول

```
1. المستخدم يدخل رقم الهاتف وكلمة المرور
2. يتم استدعاء authStore.login()
3. authService.login() يرسل طلب POST إلى /Auth/login
4. عند النجاح:
   - يتم حفظ token و refreshToken في localStorage
   - يتم تحديث حالة authStore
   - يتم توجيه المستخدم للصفحة المناسبة حسب دوره
```

### 2. تدفق إنشاء طلب

```
1. المستخدم يضيف منتجات للسلة (cartStore.addItem)
2. المستخدم يذهب لصفحة Checkout
3. يختار/يضيف عنوان التوصيل
4. يختار طريقة الدفع
5. يضغط "تأكيد الطلب"
6. orderService.create() يرسل الطلب للـ API
7. عند النجاح:
   - يتم مسح السلة
   - إضافة إشعار
   - توجيه لصفحة تفاصيل الطلب
```

### 3. تدفق إدارة الطلب (البائع/العمليات)

```
1. الطلب الجديد يكون بحالة "Pending"
2. البائع/المشغل يقبل الطلب → "Confirmed"
3. يبدأ التحضير → "Processing"
4. يتم التسليم للسائق → "Shipped"
5. يتم التوصيل للعميل → "Delivered"

في كل تغيير:
- orderService.updateStatus(orderId, newStatus)
- يتم تحديث البيانات في الواجهة
- يمكن إرسال إشعار للعميل
```

### 4. تدفق إضافة منتج (البائع)

```
1. البائع يذهب لصفحة VendorProductForm
2. يملأ بيانات المنتج
3. يرفع الصور
4. يضغط "حفظ"
5. productService.create() أو productService.update()
6. عند النجاح:
   - يتم invalidate لـ queries المنتجات
   - توجيه لصفحة قائمة المنتجات
```

---

## 📝 ملاحظات مهمة

### 1. التخزين المؤقت (Caching)

```javascript
// إعدادات React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 دقائق
      gcTime: 1000 * 60 * 10,       // 10 دقائق
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 2. معالجة الأخطاء

```javascript
// في axios interceptor
if (error.response?.status === 401) {
  // محاولة تحديث Token
  // أو تسجيل خروج المستخدم
}

// في المكونات
const { data, error, isLoading } = useProducts();
if (error) {
  return <ErrorMessage message={error.message} />;
}
```

### 3. التحقق من البيانات

```javascript
// مثال على التحقق في النماذج
const validateForm = () => {
  const errors = {};
  if (!formData.nameAr?.trim()) {
    errors.nameAr = 'الاسم مطلوب';
  }
  if (!formData.price || formData.price <= 0) {
    errors.price = 'السعر يجب أن يكون أكبر من صفر';
  }
  return errors;
};
```

---

## 🚀 التطوير المستقبلي

### المراحل القادمة المقترحة:

1. **التقارير والإحصائيات** - صفحات تقارير متقدمة
2. **نظام المراجعات** - تقييم المنتجات والمتاجر
3. **نظام الكوبونات** - إدارة كوبونات الخصم
4. **الدردشة** - محادثة مع البائع/الدعم
5. **PWA** - تحويل لتطبيق Progressive
6. **Dark Mode** - دعم الوضع الداكن
7. **تعدد اللغات** - دعم الإنجليزية والكردية
8. **الفواتير PDF** - طباعة وتصدير الفواتير
9. **خريطة التتبع** - تتبع الطلب على الخريطة

---

## 📞 الدعم والمساعدة

للأسئلة أو المشاكل التقنية، يرجى:
1. مراجعة هذا التوثيق
2. فحص Console للأخطاء
3. التأكد من إعدادات .env
4. التأكد من عمل الـ API Backend

---

**آخر تحديث:** فبراير 2026
**الإصدار:** 1.0.0
