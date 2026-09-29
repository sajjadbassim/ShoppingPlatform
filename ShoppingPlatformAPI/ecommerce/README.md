# ShoppingPlatformAPI (Ecommerce)

مشروع API لمنصة تسوق إلكتروني متكاملة مبني باستخدام تقنيات .NET 8 الحديثة. يوفر المشروع نظامًا لإدارة المستخدمين، المنتجات، العروض، الطلبات، والسائقين، مع دعم للإشعارات اللحظية.

## هيكل المجلدات والملفات (Project Structure)

```text
ecommerce/
├── Controllers/            # فئة المتحكمات (API Endpoints) لكل موديول
│   ├── AddressesController.cs
│   ├── AdminController.cs
│   ├── AuthController.cs
│   ├── CartController.cs
│   ├── CategoriesController.cs
│   ├── DriversController.cs
│   ├── OpsController.cs
│   ├── OrdersController.cs
│   ├── ProductsController.cs
│   ├── UsersController.cs
│   ├── VendorsController.cs
│   └── WishlistController.cs
├── Core/                   # الطبقة الجوهرية (Business Logic & Entities)
│   ├── Constants/          # الثوابت والقيم الثابتة (Enums)
│   │   ├── DriverStatus.cs
│   │   ├── OrderStatus.cs
│   │   └── ...
│   ├── DTO/                # كائنات نقل البيانات (Data Transfer Objects)
│   │   ├── Auth/           # DTOs الخاصة بالتسجيل وتسجيل الدخول
│   │   ├── Product/        # DTOs الخاصة بإدارة المنتجات
│   │   └── ... (Addresses, Admin, Cart, etc.)
│   └── Models/             # كيانات قاعدة البيانات (Database Entities)
│       ├── User.cs
│       ├── Product.cs
│       ├── Order.cs
│       ├── Vendor.cs
│       └── ...
├── Data/                   # طبقة البيانات (Entity Framework Core)
│   └── ApplicationDbContext.cs # سياق قاعدة البيانات
├── Extensions/             # ملحقات لتنظيم الخدمات (Service Collections)
├── Filters/                # فلاتر مخصصة (Custom Filters/Attributes)
├── Hubs/                   # SignalR Hubs للتواصل اللحظي
├── Migrations/             # ملفات ترحيل قاعدة البيانات (EF Core Migrations)
├── Repositories/           # نمط المستودعات (Repository Pattern) للتعامل مع البيانات
├── Services/               # طبقة الخدمات (Business Services Implementation)
├── Properties/             # إعدادات تشغيل المشروع
├── wwwroot/                # الملفات الاستاتيكية (الصور، الملفات)
├── Program.cs             # نقطة انطلاق التطبيق وإعدادات الـ Dependency Injection
├── appsettings.json       # إعدادات التطبيق (قاعدة البيانات، JWT، الخ)
└── ecommerce.csproj       # ملف تعريف المشروع والمكتبات المستخدمة
```

## المكونات الرئيسية

- **Controllers**: تحتوي على واجهات برمجة التطبيقات (API) التي يتواصل معها العميل.
- **Core (Models & DTOs)**: تحتوي على بنية البيانات والكيانات الأساسية والقواعد الخاصة بها.
- **Services & Repositories**: تفصل بين منطق الأعمال والتعامل المباشر مع قاعدة البيانات لضمان سهولة الاختبار والصيانة.
- **Hubs**: تستخدم لتوفير تحديثات حالة الطلب وغيرها بشكل لحظي.

## التقنيات المستخدمة

- **.NET 8 Web API**
- **Entity Framework Core**: لإدارة قاعدة البيانات.
- **SignalR**: للتواصل اللحظي (Real-time).
- **AutoMapper**: لتحويل البيانات بين الكيانات و DTOs.
- **JWT Authentication**: لتأمين واجهات برمجة التطبيقات.
- **Swagger/OpenAPI**: لتوثيق واختبار الـ API.
