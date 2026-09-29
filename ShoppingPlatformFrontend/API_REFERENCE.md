# 🔌 API Reference - مرجع API

## منصة واسط التجارية

---

## 📋 المحتويات

1. [معلومات عامة](#معلومات-عامة)
2. [المصادقة](#المصادقة-authentication)
3. [المستخدمين](#المستخدمين-users)
4. [المنتجات](#المنتجات-products)
5. [الفئات](#الفئات-categories)
6. [المتاجر](#المتاجر-vendors)
7. [الطلبات](#الطلبات-orders)
8. [العناوين](#العناوين-addresses)
9. [السلة](#السلة-cart)
10. [الإدارة](#الإدارة-admin)
11. [رموز الحالة](#رموز-الحالة)
12. [نماذج البيانات](#نماذج-البيانات)

---

## 🌐 معلومات عامة

### Base URL
```
https://your-api-domain.com/api
```

### Headers المطلوبة
```http
Content-Type: application/json
Authorization: Bearer {token}  # للطلبات المحمية
```

### تنسيق الاستجابة
```json
{
  "success": true,
  "data": { ... },
  "message": "Success"
}

// أو عند الخطأ
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### التصفح (Pagination)
```json
// الطلب
GET /api/Products/paged?pageNumber=1&pageSize=20

// الاستجابة
{
  "items": [...],
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 150,
  "totalPages": 8,
  "hasPreviousPage": false,
  "hasNextPage": true
}
```

---

## 🔐 المصادقة (Authentication)

### POST /Auth/login
تسجيل الدخول

**Request:**
```json
{
  "phone": "+9647701234567",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2...",
  "expiresIn": 3600,
  "user": {
    "id": "user-uuid",
    "fullName": "أحمد محمد",
    "phone": "+9647701234567",
    "email": "ahmed@email.com",
    "role": "Customer",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `401` - بيانات الدخول غير صحيحة
- `403` - الحساب موقوف

---

### POST /Auth/register
إنشاء حساب جديد

**Request:**
```json
{
  "fullName": "أحمد محمد",
  "phone": "+9647701234567",
  "password": "password123",
  "email": "ahmed@email.com",  // اختياري
  "role": "Customer"           // Customer | Vendor
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2...",
  "user": {
    "id": "new-user-uuid",
    "fullName": "أحمد محمد",
    "phone": "+9647701234567",
    "role": "Customer"
  }
}
```

**Errors:**
- `400` - بيانات غير صالحة
- `409` - رقم الهاتف مسجل مسبقاً

---

### POST /Auth/refresh-token
تحديث Token

**Request:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2..."
}
```

**Response (200):**
```json
{
  "token": "new-jwt-token...",
  "refreshToken": "new-refresh-token...",
  "expiresIn": 3600
}
```

---

### POST /Auth/logout
تسجيل الخروج

**Headers:**
```http
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "تم تسجيل الخروج بنجاح"
}
```

---

### POST /Auth/forgot-password
طلب استعادة كلمة المرور

**Request:**
```json
{
  "phone": "+9647701234567"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "تم إرسال رمز التحقق"
}
```

---

### POST /Auth/change-password
تغيير كلمة المرور

**Headers:**
```http
Authorization: Bearer {token}
```

**Request:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "تم تغيير كلمة المرور بنجاح"
}
```

---

## 👤 المستخدمين (Users)

### GET /Users
جلب جميع المستخدمين (Admin فقط)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| onlyActive | boolean | النشطين فقط |

**Response (200):**
```json
[
  {
    "id": "user-uuid",
    "fullName": "أحمد محمد",
    "phone": "+9647701234567",
    "email": "ahmed@email.com",
    "role": "Customer",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### GET /Users/paged
جلب المستخدمين مع التصفح

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| pageNumber | int | 1 | رقم الصفحة |
| pageSize | int | 20 | حجم الصفحة |
| role | string | - | فلتر حسب الدور |
| status | string | - | فلتر حسب الحالة |
| search | string | - | بحث بالاسم أو الهاتف |

**Response (200):**
```json
{
  "items": [...],
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 100,
  "totalPages": 5
}
```

---

### GET /Users/{id}
جلب مستخدم بالمعرف

**Response (200):**
```json
{
  "id": "user-uuid",
  "fullName": "أحمد محمد",
  "phone": "+9647701234567",
  "email": "ahmed@email.com",
  "role": "Customer",
  "isActive": true,
  "ordersCount": 15,
  "totalSpent": 5000000,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### GET /Users/profile
جلب الملف الشخصي للمستخدم الحالي

**Response (200):**
```json
{
  "id": "user-uuid",
  "fullName": "أحمد محمد",
  "phone": "+9647701234567",
  "email": "ahmed@email.com",
  "role": "Customer",
  "vendorId": null,  // للبائعين فقط
  "isActive": true,
  "ordersCount": 15,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### PUT /Users/{id}
تحديث مستخدم

**Request:**
```json
{
  "fullName": "أحمد محمد علي",
  "email": "new@email.com"
}
```

**Response (200):**
```json
{
  "id": "user-uuid",
  "fullName": "أحمد محمد علي",
  "email": "new@email.com",
  ...
}
```

---

### PATCH /Users/{id}/status
تحديث حالة المستخدم (Admin فقط)

**Request:**
```json
{
  "status": "Suspended"  // Active | Suspended | Inactive
}
```

---

### DELETE /Users/{id}
حذف مستخدم (Admin فقط)

**Response (204):** No Content

---

## 📦 المنتجات (Products)

### GET /Products
جلب جميع المنتجات

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| onlyActive | boolean | النشطة فقط |

---

### GET /Products/paged
جلب المنتجات مع التصفح والفلاتر

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| pageNumber | int | 1 | رقم الصفحة |
| pageSize | int | 20 | حجم الصفحة |
| categoryId | string | - | فلتر حسب الفئة |
| vendorId | string | - | فلتر حسب المتجر |
| minPrice | decimal | - | الحد الأدنى للسعر |
| maxPrice | decimal | - | الحد الأقصى للسعر |
| inStock | boolean | - | المتوفرة فقط |
| search | string | - | بحث بالاسم |
| sortBy | string | createdAt | حقل الترتيب |
| sortOrder | string | desc | اتجاه الترتيب (asc/desc) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "product-uuid",
      "nameAr": "آيفون 15 برو",
      "nameEn": "iPhone 15 Pro",
      "descriptionAr": "أحدث هاتف من أبل...",
      "price": 1500000,
      "originalPrice": 1700000,
      "stockQuantity": 50,
      "sku": "IPH15PRO-256",
      "isActive": true,
      "isAvailable": true,
      "primaryImageUrl": "https://...",
      "images": [
        { "id": "img-1", "url": "https://...", "isPrimary": true }
      ],
      "category": {
        "id": "cat-uuid",
        "nameAr": "هواتف ذكية"
      },
      "vendor": {
        "id": "vendor-uuid",
        "nameAr": "متجر التقنية"
      },
      "rating": 4.5,
      "reviewsCount": 120,
      "soldCount": 500,
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 150,
  "totalPages": 8
}
```

---

### GET /Products/{id}
جلب منتج بالمعرف

**Response (200):**
```json
{
  "id": "product-uuid",
  "nameAr": "آيفون 15 برو",
  "nameEn": "iPhone 15 Pro",
  "descriptionAr": "أحدث هاتف من أبل مع شريحة A17 Pro...",
  "descriptionEn": "Latest iPhone from Apple with A17 Pro chip...",
  "price": 1500000,
  "originalPrice": 1700000,
  "costPrice": 1200000,
  "stockQuantity": 50,
  "sku": "IPH15PRO-256",
  "isActive": true,
  "isAvailable": true,
  "trackInventory": true,
  "allowBackorder": false,
  "primaryImageUrl": "https://...",
  "images": [
    { "id": "img-1", "url": "https://...", "isPrimary": true },
    { "id": "img-2", "url": "https://...", "isPrimary": false }
  ],
  "specifications": [
    { "key": "الذاكرة", "value": "256GB" },
    { "key": "الرام", "value": "8GB" }
  ],
  "tags": ["آيفون", "أبل", "هواتف"],
  "category": {
    "id": "cat-uuid",
    "nameAr": "هواتف ذكية",
    "nameEn": "Smartphones"
  },
  "vendor": {
    "id": "vendor-uuid",
    "nameAr": "متجر التقنية",
    "logoUrl": "https://..."
  },
  "rating": 4.5,
  "reviewsCount": 120,
  "soldCount": 500,
  "viewsCount": 5000,
  "createdAt": "2024-01-10T08:00:00Z",
  "updatedAt": "2024-01-15T12:00:00Z"
}
```

---

### GET /Products/category/{categoryId}
جلب منتجات فئة معينة

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| pageNumber | int | 1 |
| pageSize | int | 20 |

---

### GET /Products/vendor/{vendorId}
جلب منتجات متجر معين

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| pageNumber | int | 1 |
| pageSize | int | 20 |

---

### GET /Products/featured
جلب المنتجات المميزة

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| count | int | 10 |

---

### POST /Products
إنشاء منتج جديد (Vendor فقط)

**Request:**
```json
{
  "nameAr": "آيفون 15 برو",
  "nameEn": "iPhone 15 Pro",
  "descriptionAr": "أحدث هاتف من أبل...",
  "descriptionEn": "Latest iPhone...",
  "price": 1500000,
  "originalPrice": 1700000,
  "costPrice": 1200000,
  "stockQuantity": 50,
  "sku": "IPH15PRO-256",
  "categoryId": "cat-uuid",
  "vendorId": "vendor-uuid",
  "isActive": true,
  "trackInventory": true,
  "allowBackorder": false,
  "specifications": [
    { "key": "الذاكرة", "value": "256GB" }
  ],
  "tags": ["آيفون", "أبل"]
}
```

**Response (201):** Product object

---

### PUT /Products/{id}
تحديث منتج

**Request:** Same as POST

**Response (200):** Updated Product object

---

### DELETE /Products/{id}
حذف منتج

**Response (204):** No Content

---

### POST /Products/{id}/images
رفع صور للمنتج (Multipart Form)

**Request:**
```
Content-Type: multipart/form-data

images: [File1, File2, ...]
```

**Response (200):**
```json
{
  "images": [
    { "id": "img-uuid", "url": "https://...", "isPrimary": false }
  ]
}
```

---

## 📂 الفئات (Categories)

### GET /Categories
جلب جميع الفئات

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| onlyActive | boolean | النشطة فقط |

**Response (200):**
```json
[
  {
    "id": "cat-uuid",
    "nameAr": "إلكترونيات",
    "nameEn": "Electronics",
    "iconUrl": "https://...",
    "imageUrl": "https://...",
    "parentId": null,
    "isActive": true,
    "displayOrder": 1,
    "productsCount": 150,
    "children": [
      {
        "id": "subcat-uuid",
        "nameAr": "هواتف ذكية",
        "parentId": "cat-uuid",
        "productsCount": 50
      }
    ]
  }
]
```

---

### GET /Categories/{id}
جلب فئة بالمعرف

---

### GET /Categories/root
جلب الفئات الرئيسية فقط (بدون parent)

---

### GET /Categories/{id}/children
جلب الفئات الفرعية لفئة معينة

---

### POST /Categories
إنشاء فئة (Admin فقط)

**Request:**
```json
{
  "nameAr": "إلكترونيات",
  "nameEn": "Electronics",
  "iconUrl": "https://...",
  "imageUrl": "https://...",
  "parentId": null,
  "isActive": true,
  "displayOrder": 1
}
```

---

### PUT /Categories/{id}
تحديث فئة

---

### DELETE /Categories/{id}
حذف فئة

---

## 🏪 المتاجر (Vendors)

### GET /Vendors/paged
جلب المتاجر مع التصفح

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| pageNumber | int | رقم الصفحة |
| pageSize | int | حجم الصفحة |
| status | string | Active / Pending / Suspended |
| categoryId | string | فلتر حسب الفئة |
| search | string | بحث بالاسم |

**Response (200):**
```json
{
  "items": [
    {
      "id": "vendor-uuid",
      "nameAr": "متجر التقنية",
      "nameEn": "Tech Store",
      "description": "متجر متخصص في الإلكترونيات...",
      "logoUrl": "https://...",
      "coverImageUrl": "https://...",
      "phone": "+9647701234567",
      "email": "store@email.com",
      "address": "بغداد، المنصور",
      "city": "بغداد",
      "workingHours": "9:00 AM - 10:00 PM",
      "isActive": true,
      "isVerified": true,
      "status": "Active",
      "rating": 4.8,
      "reviewsCount": 250,
      "productsCount": 150,
      "ordersCount": 1200,
      "followersCount": 500,
      "category": {
        "id": "cat-uuid",
        "nameAr": "إلكترونيات"
      },
      "owner": {
        "id": "user-uuid",
        "fullName": "أحمد محمد"
      },
      "createdAt": "2023-06-15T10:00:00Z"
    }
  ],
  "totalCount": 50,
  "totalPages": 3
}
```

---

### GET /Vendors/{id}
جلب متجر بالمعرف

---

### POST /Vendors
إنشاء متجر (Multipart Form)

**Request:**
```
Content-Type: multipart/form-data

name: "Tech Store"
nameAr: "متجر التقنية"
description: "..."
phone: "+9647701234567"
categoryId: "cat-uuid"
logo: [File]
```

---

### PUT /Vendors/{id}
تحديث متجر

---

### POST /Vendors/{id}/approve
قبول متجر (Admin فقط)

**Response (200):**
```json
{
  "id": "vendor-uuid",
  "status": "Active",
  ...
}
```

---

### POST /Vendors/{id}/reject
رفض متجر (Admin فقط)

---

### POST /Vendors/{id}/suspend
تعليق متجر (Admin فقط)

---

### POST /Vendors/{id}/logo
رفع شعار المتجر (Multipart Form)

---

## 📋 الطلبات (Orders)

### GET /Orders/paged
جلب الطلبات مع التصفح

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| pageNumber | int | رقم الصفحة |
| pageSize | int | حجم الصفحة |
| status | string | فلتر حسب الحالة |
| customerId | string | فلتر حسب العميل |
| vendorId | string | فلتر حسب المتجر |
| fromDate | date | من تاريخ |
| toDate | date | إلى تاريخ |

**Response (200):**
```json
{
  "items": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-54321",
      "status": "Pending",
      "paymentMethod": "cash",
      "paymentStatus": "Pending",
      "subtotal": 1500000,
      "shippingFee": 15000,
      "discount": 0,
      "totalAmount": 1515000,
      "notes": "...",
      "customer": {
        "id": "user-uuid",
        "fullName": "أحمد محمد",
        "phone": "+9647701234567"
      },
      "shippingAddress": {
        "recipientName": "أحمد محمد",
        "phone": "+9647701234567",
        "city": "بغداد",
        "area": "المنصور",
        "street": "شارع الأميرات",
        "building": "15"
      },
      "items": [
        {
          "id": "item-uuid",
          "productId": "prod-uuid",
          "productName": "آيفون 15 برو",
          "quantity": 1,
          "unitPrice": 1500000,
          "totalPrice": 1500000,
          "primaryImageUrl": "https://..."
        }
      ],
      "itemsCount": 1,
      "createdAt": "2024-01-20T09:30:00Z",
      "updatedAt": "2024-01-20T09:30:00Z"
    }
  ],
  "totalCount": 100,
  "totalPages": 10
}
```

---

### GET /Orders/{id}
جلب طلب بالمعرف

---

### GET /Orders/customer/{customerId}
جلب طلبات عميل معين

---

### GET /Orders/vendor/{vendorId}
جلب طلبات متجر معين

---

### POST /Orders
إنشاء طلب جديد

**Request:**
```json
{
  "items": [
    {
      "productId": "prod-uuid",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "recipientName": "أحمد محمد",
    "phone": "+9647701234567",
    "city": "بغداد",
    "area": "المنصور",
    "street": "شارع الأميرات",
    "building": "15",
    "notes": "بجانب مطعم..."
  },
  "paymentMethod": "cash",
  "couponCode": "SAVE10",  // اختياري
  "notes": "..."
}
```

**Response (201):**
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD-54321",
  "status": "Pending",
  ...
}
```

---

### PATCH /Orders/{id}/status
تحديث حالة الطلب

**Request:**
```json
{
  "status": "Confirmed"  // Pending | Confirmed | Processing | Shipped | Delivered | Cancelled
}
```

**Response (200):** Updated Order

**حالات الطلب:**
| الحالة | الوصف | من يغيرها |
|--------|-------|-----------|
| Pending | جديد | - |
| Confirmed | تم التأكيد | البائع/العمليات |
| Processing | قيد التحضير | البائع |
| Shipped | تم الشحن | البائع/العمليات |
| Delivered | تم التوصيل | السائق/العمليات |
| Cancelled | ملغي | العميل/البائع/الإدارة |

---

### PATCH /Orders/{id}/cancel
إلغاء طلب

**Response (200):** Cancelled Order

---

## 📍 العناوين (Addresses)

### GET /Addresses/user/{userId}
جلب عناوين المستخدم

**Response (200):**
```json
[
  {
    "id": "addr-uuid",
    "title": "المنزل",
    "recipientName": "أحمد محمد",
    "phone": "+9647701234567",
    "city": "بغداد",
    "area": "المنصور",
    "street": "شارع الأميرات",
    "building": "15",
    "notes": "الطابق الثالث",
    "isDefault": true,
    "userId": "user-uuid"
  }
]
```

---

### POST /Addresses
إنشاء عنوان جديد

**Request:**
```json
{
  "userId": "user-uuid",
  "title": "المنزل",
  "recipientName": "أحمد محمد",
  "phone": "+9647701234567",
  "city": "بغداد",
  "area": "المنصور",
  "street": "شارع الأميرات",
  "building": "15",
  "notes": "الطابق الثالث",
  "isDefault": true
}
```

---

### PUT /Addresses/{id}
تحديث عنوان

---

### DELETE /Addresses/{id}
حذف عنوان

---

### PATCH /Addresses/{id}/default
تعيين كعنوان افتراضي

---

## 🛒 السلة (Cart)


### POST /Cart/add
إضافة للسلة

**Request:**
```json
{
  "userId": "user-uuid",
  "productId": "prod-uuid",
  "quantity": 1
}
```

---

### PUT /Cart/update
تحديث الكمية

**Request:**
```json
{
  "userId": "user-uuid",
  "productId": "prod-uuid",
  "quantity": 3
}
```

---

### DELETE /Cart/remove
إزالة من السلة

**Request:**
```json
{
  "userId": "user-uuid",
  "productId": "prod-uuid"
}
```

---

### DELETE /Cart/clear
مسح السلة

**Request:**
```json
{
  "userId": "user-uuid"
}
```

---

## 👨‍💼 الإدارة (Admin)

### GET /Admin/stats
إحصائيات لوحة التحكم

**Response (200):**
```json
{
  "totalSales": 150000000,
  "salesChange": 12.5,
  "totalOrders": 1500,
  "ordersChange": 8.3,
  "totalUsers": 5000,
  "usersChange": 15.2,
  "activeVendors": 50,
  "vendorsChange": 5.0,
  "todayOrders": 45,
  "pendingVendors": 3,
  "openComplaints": 5,
  "lowStockProducts": 12
}
```

---

### GET /Admin/users
جلب المستخدمين (مع فلاتر)

---

### GET /Admin/vendors
جلب المتاجر (مع فلاتر)

---

### GET /Admin/orders
جلب الطلبات (مع فلاتر)

---

### GET /Admin/reports/sales
تقرير المبيعات

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| fromDate | date | من تاريخ |
| toDate | date | إلى تاريخ |
| groupBy | string | day / week / month |

---

### GET /Admin/reports/top-vendors
أفضل البائعين

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| count | int | 10 |

---

### GET /Admin/reports/top-products
أفضل المنتجات

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| count | int | 10 |

---

## ⚠️ رموز الحالة (Status Codes)

| الرمز | الوصف |
|-------|-------|
| 200 | نجاح |
| 201 | تم الإنشاء |
| 204 | نجاح بدون محتوى |
| 400 | طلب غير صالح |
| 401 | غير مصرح |
| 403 | ممنوع |
| 404 | غير موجود |
| 409 | تعارض |
| 422 | خطأ في التحقق |
| 500 | خطأ في الخادم |

---

## 📐 نماذج البيانات (Data Models)

### User
```typescript
interface User {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: 'Customer' | 'Vendor' | 'Admin' | 'Ops';
  vendorId?: string;
  isActive: boolean;
  status?: 'Active' | 'Suspended' | 'Inactive';
  ordersCount?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt?: string;
}
```

### Product
```typescript
interface Product {
  id: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  originalPrice?: number;
  costPrice?: number;
  stockQuantity: number;
  sku?: string;
  isActive: boolean;
  isAvailable: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  primaryImageUrl?: string;
  images: ProductImage[];
  specifications?: Specification[];
  tags?: string[];
  categoryId: string;
  category?: Category;
  vendorId: string;
  vendor?: Vendor;
  rating?: number;
  reviewsCount?: number;
  soldCount?: number;
  createdAt: string;
  updatedAt?: string;
}
```

### Order
```typescript
interface Order {
  id: string;
  orderNumber: string;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  paymentMethod: 'cash' | 'zaincash' | 'card';
  paymentStatus: 'Pending' | 'Paid' | 'Failed';
  subtotal: number;
  shippingFee: number;
  discount: number;
  totalAmount: number;
  notes?: string;
  customerId: string;
  customer?: User;
  vendorId?: string;
  vendor?: Vendor;
  shippingAddress: Address;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}
```

### Category
```typescript
interface Category {
  id: string;
  nameAr: string;
  nameEn?: string;
  iconUrl?: string;
  imageUrl?: string;
  parentId?: string;
  isActive: boolean;
  displayOrder: number;
  productsCount?: number;
  children?: Category[];
}
```

### Vendor
```typescript
interface Vendor {
  id: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  workingHours?: string;
  isActive: boolean;
  isVerified: boolean;
  status: 'Active' | 'Pending' | 'Suspended' | 'Inactive';
  rating?: number;
  reviewsCount?: number;
  productsCount?: number;
  ordersCount?: number;
  categoryId?: string;
  category?: Category;
  ownerId: string;
  owner?: User;
  createdAt: string;
}
```

### Address
```typescript
interface Address {
  id?: string;
  title?: string;
  recipientName: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  building?: string;
  notes?: string;
  isDefault?: boolean;
  userId?: string;
}
```

---

**آخر تحديث:** فبراير 2026
