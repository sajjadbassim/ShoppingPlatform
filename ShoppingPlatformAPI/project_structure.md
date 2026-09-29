# Project Structure

This file provides a comprehensive overview of the folder and file structure for the **ShoppingPlatformAPI** project (excluding build artifacts like `bin`, `obj`, `.vs`, `.git`, and `.github`).

## Directory Tree

```text
ShoppingPlatformAPI/
├── .gitignore
├── README.md
├── architecture.png
├── ecommerce.sln
├── swagger.json
└── ecommerce/
    ├── ecommerce.csproj
    ├── ecommerce.csproj.user
    ├── ecommerce.http
    ├── appsettings.json
    ├── appsettings.Development.json
    ├── Program.cs
    ├── README.md
    ├── Controllers/
    │   ├── AddressesController.cs
    │   ├── AdminController.cs
    │   ├── AuthController.cs
    │   ├── CartController.cs
    │   ├── CategoriesController.cs
    │   ├── CouponsController.cs
    │   ├── DriversController.cs
    │   ├── HomeController.cs
    │   ├── InvoiceController.cs
    │   ├── LoyaltyController.cs
    │   ├── NotificationsController.cs
    │   ├── OpsController.cs
    │   ├── OrderRatingController.cs
    │   ├── OrdersController.cs
    │   ├── ProductVariantsController.cs
    │   ├── ProductsController.cs
    │   ├── PromotionsController.cs
    │   ├── ReturnsController.cs
    │   ├── ReviewsController.cs
    │   ├── UsersController.cs
    │   ├── VendorDashboardController.cs
    │   ├── VendorsController.cs
    │   └── WishlistController.cs
    ├── Core/
    │   ├── VariantAttributeInfo.cs
    │   ├── Constants/
    │   │   ├── DiscountType.cs
    │   │   ├── DriverStatus.cs
    │   │   ├── DriverWorkStatus.cs
    │   │   ├── LoyaltyTier.cs
    │   │   ├── LoyaltyTransactionType.cs
    │   │   ├── NotificationType.cs
    │   │   ├── OrderStatus.cs
    │   │   ├── PaymentMethods.cs
    │   │   ├── PaymentStatus.cs
    │   │   ├── PromotionTargetType.cs
    │   │   ├── ReturnStatus.cs
    │   │   ├── SubOrderStatus.cs
    │   │   └── UserRoles.cs
    │   ├── DTO/
    │   │   ├── Addresses/
    │   │   │   ├── AddressCreateDto.cs
    │   │   │   ├── AddressResponseDto.cs
    │   │   │   └── AddressUpdateDto.cs
    │   │   ├── Admin/
    │   │   │   ├── ChangeUserRoleDto.cs
    │   │   │   ├── CreateOpsUserDto.cs
    │   │   │   ├── DashboardStatsDto.cs
    │   │   │   └── UserManagementDto.cs
    │   │   ├── Auth/
    │   │   │   ├── ChangePasswordDto.cs
    │   │   │   ├── LoginDto.cs
    │   │   │   ├── LoginResponseDto.cs
    │   │   │   └── RegisterDto.cs
    │   │   ├── Cart/
    │   │   │   ├── AddToCartDto.cs
    │   │   │   ├── CartItemDto.cs
    │   │   │   ├── CartResponseDto.cs
    │   │   │   ├── UpdateCartItemDto.cs
    │   │   │   └── VendorCartSummary.cs
    │   │   ├── Category/
    │   │   │   ├── CategoryCreateDto.cs
    │   │   │   ├── CategoryResponseDto.cs
    │   │   │   └── CategoryUpdateDto.cs
    │   │   ├── Common/
    │   │   │   ├── PagedResponse.cs
    │   │   │   └── PaginationParams.cs
    │   │   ├── CouponDto/
    │   │   │   ├── CouponDto.cs
    │   │   │   ├── CouponValidationResultDto.cs
    │   │   │   ├── CreateCouponDto.cs
    │   │   │   ├── UpdateCouponDto.cs
    │   │   │   └── ValidateCouponDto.cs
    │   │   ├── Drivers/
    │   │   │   ├── CreateDriverDto.cs
    │   │   │   ├── DriverDto.cs
    │   │   │   ├── DriversPagedResultDto.cs
    │   │   │   └── UpdateDriverDto.cs
    │   │   ├── HomePage/
    │   │   │   ├── AddSectionItemDto.cs
    │   │   │   ├── BannerDto.cs
    │   │   │   ├── CreateBannerDto.cs
    │   │   │   ├── CreateHomeSectionDto.cs
    │   │   │   ├── HomePageDto.cs
    │   │   │   ├── HomeSectionDto.cs
    │   │   │   ├── UpdateBannerDto.cs
    │   │   │   └── UpdateHomeSectionDto.cs
    │   │   ├── Loyalty/
    │   │   │   └── LoyaltyAccountDto.cs
    │   │   ├── Notification/
    │   │   │   └── NotificationDto.cs
    │   │   ├── Ops/
    │   │   │   ├── AssignDriverDto.cs
    │   │   │   ├── CancelSubOrderDto.cs
    │   │   │   ├── ConfirmSubOrderDto.cs
    │   │   │   ├── DriverOrdersResultDto.cs
    │   │   │   ├── DriverStatsDto.cs
    │   │   │   ├── OpsDashboardStatsDto.cs
    │   │   │   ├── PendingSubOrderDto.cs
    │   │   │   ├── PendingSubOrderItemDto.cs
    │   │   │   ├── SubOrdersPagedResultDto.cs
    │   │   │   ├── UpdateDriverWorkStatusDto.cs
    │   │   │   └── UpdateSubOrderStatusDto.cs
    │   │   ├── Order/
    │   │   │   ├── CreateOrderDto.cs
    │   │   │   ├── OrderResponseDto.cs
    │   │   │   ├── OrderStatusLogDto.cs
    │   │   │   ├── SubOrderDto.cs
    │   │   │   ├── SubOrderItemDto.cs
    │   │   │   └── TrackingDtos.cs
    │   │   ├── OrderRatingDto/
    │   │   │   └── CreateOrderRatingDto.cs
    │   │   ├── Product/
    │   │   │   ├── CreateProductDto.cs
    │   │   │   ├── ProductAttributeDto.cs
    │   │   │   ├── ProductDto.cs
    │   │   │   ├── ProductFilterDto.cs
    │   │   │   ├── ProductImageDto.cs
    │   │   │   ├── UnifiedSearchResult.cs
    │   │   │   └── UpdateProductDto.cs
    │   │   ├── Promotion/
    │   │   │   ├── CreatePromotionDto.cs
    │   │   │   ├── ProductPromotionDto.cs
    │   │   │   ├── PromotionDto.cs
    │   │   │   └── UpdatePromotionDto.cs
    │   │   ├── Users/
    │   │   │   ├── LoginDto.cs
    │   │   │   ├── RegisterDto.cs
    │   │   │   ├── UpdateUserDto.cs
    │   │   │   └── UserResponseDto.cs
    │   │   ├── Vendor/
    │   │   │   ├── VendorCreateDto.cs
    │   │   │   ├── VendorDashboardDto.cs
    │   │   │   ├── VendorResponseDto.cs
    │   │   │   └── VendorUpdateDto.cs
    │   │   └── Wishlist/
    │   │       ├── AddToWishlistDto.cs
    │   │       ├── ProductWishlistDto.cs
    │   │       └── WishlistDto.cs
    │   └── Models/
    │       ├── Address.cs
    │       ├── Banner.cs
    │       ├── Cart.cs
    │       ├── CartItem.cs
    │       ├── Category.cs
    │       ├── Coupon.cs
    │       ├── Driver.cs
    │       ├── JwtSettings.cs
    │       ├── LoyaltyAccount.cs
    │       ├── Notification.cs
    │       ├── Order.cs
    │       ├── OrderRating.cs
    │       ├── OrderStatusLog.cs
    │       ├── PagedResult.cs
    │       ├── Product.cs
    │       ├── ProductAttribute.cs
    │       ├── ProductImage.cs
    │       ├── Promotion.cs
    │       ├── ReturnModels.cs
    │       ├── ReviewDtos.cs
    │       ├── ReviewModels.cs
    │       ├── SubOrder.cs
    │       ├── SubOrderItem.cs
    │       ├── User.cs
    │       ├── Vendor.cs
    │       └── Wishlist.cs
    ├── Data/
    │   └── AppDbContext.cs
    ├── Extensions/
    │   └── QueryableExtensions.cs
    ├── Filters/
    │   └── FileUploadOperationFilter.cs
    ├── Hubs/
    │   ├── NotificationHub.cs
    │   └── OpsHub.cs
    ├── Migrations/
    │   ├── 20260717020248_FixVendorTextColumns.cs
    │   ├── 20260717020248_FixVendorTextColumns.Designer.cs
    │   └── AppDbContextModelSnapshot.cs
    ├── Repositories/
    │   ├── AddressRepository .cs
    │   ├── CartRepository.cs
    │   ├── CategoryRepository.cs
    │   ├── CouponRepository.cs
    │   ├── DriverRepository.cs
    │   ├── IAddressRepository.cs
    │   ├── ICartRepository.cs
    │   ├── ICategoryRepository.cs
    │   ├── ICouponRepository.cs
    │   ├── IDriverRepository.cs
    │   ├── INotificationRepository.cs
    │   ├── IOrderRepository.cs
    │   ├── IOrderStatusLogRepository.cs
    │   ├── IProductImageRepository.cs
    │   ├── IProductRepository.cs
    │   ├── IPromotionRepository.cs
    │   ├── IReturnInterfaces.cs
    │   ├── IReviewRepository.cs
    │   ├── ISubOrderRepository.cs
    │   ├── IUserRepository.cs
    │   ├── IVendorRepository.cs
    │   ├── IWishlistRepository.cs
    │   ├── NotificationRepository.cs
    │   ├── OrderRepository.cs
    │   ├── OrderStatusLogRepository.cs
    │   ├── ProductImageRepository.cs
    │   ├── ProductRepository.cs
    │   ├── PromotionRepository.cs
    │   ├── ReturnRepository.cs
    │   ├── ReviewRepository.cs
    │   ├── SubOrderRepository.cs
    │   ├── UserRepository.cs
    │   ├── VendorRepository.cs
    │   └── WishlistRepository.cs.cs
    ├── Services/
    │   ├── AddressService .cs
    │   ├── IAddressService.cs
    │   ├── ICartService.cs
    │   ├── CartService.cs
    │   ├── ICategoryService.cs
    │   ├── CategoryService.cs
    │   ├── IOrderService.cs
    │   ├── OrderService.cs
    │   ├── IUserService.cs
    │   ├── UserService.cs
    │   ├── AdminService/
    │   │   ├── AdminService .cs
    │   │   └── IAdminService.cs
    │   ├── AuthService/
    │   │   ├── AuthService .cs
    │   │   └── IAuthService.cs
    │   ├── CouponService/
    │   │   ├── CouponService.cs
    │   │   └── ICouponService.cs
    │   ├── DriverService/
    │   │   ├── DriverService.cs
    │   │   └── IDriverService.cs
    │   ├── FileService/
    │   │   ├── FileService.cs
    │   │   └── IFileService.cs
    │   ├── HomeService/
    │   │   ├── HomeService .cs
    │   │   └── IHomeService.cs
    │   ├── InvoiceService/
    │   │   ├── IInvoiceService.cs
    │   │   └── InvoiceService .cs
    │   ├── LoyaltyService/
    │   │   ├── ILoyaltyService.cs
    │   │   └── LoyaltyService.cs
    │   ├── NotificationService/
    │   │   ├── INotificationService.cs
    │   │   └── NotificationService.cs
    │   ├── Ops Service/
    │   │   ├── IOpsService.cs
    │   │   └── OpsService.cs
    │   ├── OrderRatingService/
    │   │   ├── IOrderRatingService.cs
    │   │   └── OrderRatingService .cs
    │   ├── ProductService/
    │   │   ├── IProductService.cs
    │   │   ├── IVariantService.cs
    │   │   ├── ProductService.cs
    │   │   └── VariantService .cs
    │   ├── PromotionService/
    │   │   ├── IPromotionService.cs
    │   │   └── PromotionService.cs
    │   ├── ReturnService/
    │   │   ├── IReturnService.cs
    │   │   └── ReturnService .cs
    │   ├── ReviewService/
    │   │   ├── IReviewService.cs
    │   │   └── ReviewService.cs
    │   ├── VendorService/
    │   │   ├── IVendorDashboardService.cs
    │   │   ├── IVendorService.cs
    │   │   ├── VendorDashboardService.cs
    │   │   └── VendorService .cs
    │   └── WishlistService/
    │       ├── IWishlistService.cs
    │       └── WishlistService.cs
    └── wwwroot/
        └── uploads/
            ├── categories/
            │   ├── 241d152a-8c6f-478b-b5ac-a34d1858386e.png
            │   └── b61bbd7c-2e66-4edb-95f1-b47392226471.png
            ├── products/
            │   ├── 0e1f5d07-23b9-4bad-aeae-38d7153cfd2a.jpg
            │   ├── 5989b8f2-71cd-451c-aa4e-7d924cacc68c.jpg
            │   ├── 5ddad3e1-656a-4d0f-94c6-14c24feaee36.png
            │   ├── 8301d8cc-89cb-4f60-81de-857b87330877.jpg
            │   ├── 9642683c-c30d-412f-8492-4340371e39c2.jpeg
            │   ├── c2b14a3e-f5b1-4eef-9002-d29cbf84c2be.jpg
            │   ├── e4503563-ca6b-4b4f-81aa-36a72b80db3d.png
            │   └── f1a784c1-88c5-4eab-993d-0f6e4b655ac9.webp
            └── vendors/
                ├── 70e38053-f56b-4c88-8af1-d0ce064b2861.png
                └── afc86001-7062-48aa-8d85-c51c242eb965.png
```
