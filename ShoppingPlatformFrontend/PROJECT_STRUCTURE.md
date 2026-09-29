# Project Directory Structure

This document outlines the folder and file structure of the **wasit-platform** frontend project.

```text
wasit-platform/
├── public/                     # Static assets served directly
│   └── favicon.svg             # Application icon
├── src/                        # Main React application source code
│   ├── api/                    # API client configurations
│   │   ├── axios.js            # Axios instance with interceptors
│   │   ├── endpoints.js        # API endpoint path constants
│   │   └── index.js            # Exports for API clients
│   ├── components/             # Reusable UI components
│   │   ├── auth/               # Authentication-related components
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── index.js
│   │   ├── common/             # Shared/Generic UI design components
│   │   │   ├── Badge.jsx
│   │   │   ├── Breadcrumb.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Dropdown.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── FormControls.jsx
│   │   │   ├── GlobalSearch.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Loading.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── Pagination.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Tabs.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── index.js
│   │   ├── layouts/            # Layout wrappers
│   │   │   ├── DashboardLayout.jsx
│   │   │   └── MainLayout.jsx
│   │   └── vendor/             # Vendor specific helper components
│   │       └── VendorVariantsManager.jsx
│   ├── hooks/                  # Custom React hooks (React Query integrations)
│   │   ├── index.js
│   │   ├── useAddresses.js
│   │   ├── useAdmin.js
│   │   ├── useCategories.js
│   │   ├── useOpsNotifications.js
│   │   ├── useOrders.js
│   │   ├── useProducts.js
│   │   ├── useReviews.js
│   │   ├── useVariants.js
│   │   └── useVendors.js
│   ├── pages/                  # Page-level components mapped to routes
│   │   ├── admin/              # Admin pages
│   │   │   ├── AdminCategories.jsx
│   │   │   ├── AdminCoupons.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminLoyalty.jsx
│   │   │   ├── AdminOrderDetails.jsx
│   │   │   ├── AdminOrders.jsx
│   │   │   ├── AdminReports.jsx
│   │   │   ├── AdminReturns.jsx
│   │   │   ├── AdminReviews.jsx
│   │   │   ├── AdminSettings.jsx
│   │   │   ├── AdminStores.jsx
│   │   │   └── AdminUsers.jsx
│   │   ├── auth/               # Login, Register and Password Recovery
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── customer/           # Store front customer pages
│   │   │   ├── CartPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── LoyaltyPage.jsx
│   │   │   ├── OrderDetailsPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── ProductDetailsPage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── ReturnsPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── StoreDetailsPage.jsx
│   │   │   ├── StoresPage.jsx
│   │   │   └── WishlistPage.jsx
│   │   ├── errors/             # Error pages
│   │   │   ├── NetworkErrorPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── UnauthorizedPage.jsx
│   │   │   └── index.js
│   │   ├── operations/         # Delivery and logistics dashboard pages
│   │   │   ├── OperationsDashboard.jsx
│   │   │   ├── OperationsDrivers.jsx
│   │   │   └── OperationsOrders.jsx
│   │   └── vendor/             # Vendor store dashboard pages
│   │       ├── VendorDashboard.jsx
│   │       ├── VendorOrders.jsx
│   │       ├── VendorProductForm.jsx
│   │       ├── VendorProducts.jsx
│   │       ├── VendorReports.jsx
│   │       ├── VendorReviews.jsx
│   │       ├── VendorSettings.jsx
│   │       └── VendorVariantsManager.jsx
│   ├── providers/              # Context and Query Providers
│   │   ├── QueryProvider.jsx
│   │   └── index.js
│   ├── services/               # API service calls
│   │   ├── addressService.js
│   │   ├── adminService.js
│   │   ├── authService.js
│   │   ├── cartService.js
│   │   ├── categoryService.js
│   │   ├── index.js
│   │   ├── opsService.js
│   │   ├── orderService.js
│   │   ├── productService.js
│   │   ├── reviewsService.js
│   │   ├── userService.js
│   │   ├── variantsService.js
│   │   ├── vendorService.js
│   │   └── wishlistService.js
│   ├── stores/                 # Zustand global stores
│   │   ├── authStore.js
│   │   ├── cartStore.js
│   │   ├── index.js
│   │   ├── notificationsStore.js
│   │   ├── uiStore.js
│   │   └── wishlistStore.js
│   ├── styles/                 # Styling
│   │   └── index.css           # Global stylesheet with Tailwind imports
│   ├── utils/                  # Helper utilities
│   │   └── imageHelper.js
│   ├── App.jsx                 # Application routes and main layout orchestration
│   └── main.jsx                # DOM entry point
├── .env                        # Local environment variables
├── .gitignore                  # Git ignored files list
├── API_REFERENCE.md            # API documentation and endpoints
├── DOCUMENTATION.md            # Internal platform documentation
├── README.md                   # Getting started and setup guide
├── eCommerce_API_Analysis.docx # Original API analysis document
├── index.html                  # Main HTML template
├── package.json                # Project dependencies and npm scripts
├── panfone-data-transfer-setup.exe # Setup executable
├── postcss.config.js           # PostCSS compiler configuration
├── swagger.json                # Swagger/OpenAPI definition
├── tailwind.config.js          # Tailwind CSS layout configuration
└── vite.config.js              # Vite compiler configuration
```
