using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class FixVendorTextColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "banners",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    title_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    subtitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    subtitle_ar = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    image_url = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    link_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    link_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    link_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    starts_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ends_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_banners", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "nvarchar(800)", maxLength: 800, nullable: false),
                    icon_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    parent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_categories_categories_parent_id",
                        column: x => x.parent_id,
                        principalTable: "categories",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "drivers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    vehicle_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    work_area = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    work_status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    rating = table.Column<decimal>(type: "decimal(3,2)", nullable: false),
                    total_deliveries = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_drivers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "home_sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    title_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    subtitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    subtitle_ar = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    max_items = table.Column<int>(type: "int", nullable: false, defaultValue: 10),
                    filter_category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    filter_vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_home_sections", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    points_per_currency_unit = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    point_value = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    min_redemption_points = table.Column<int>(type: "int", nullable: false),
                    max_redemption_percentage = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    points_expiry_days = table.Column<int>(type: "int", nullable: false),
                    silver_threshold = table.Column<int>(type: "int", nullable: false),
                    gold_threshold = table.Column<int>(type: "int", nullable: false),
                    platinum_threshold = table.Column<int>(type: "int", nullable: false),
                    silver_multiplier = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    gold_multiplier = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    platinum_multiplier = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loyalty_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "promotions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    target_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    discount_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    discount_value = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    max_discount_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    starts_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_promotions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    last_login = table.Column<DateTime>(type: "datetime2", nullable: true),
                    role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vendors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    logo_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    min_order_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    delivery_fee = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    estimated_prep_time = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vendors", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "home_section_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    section_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_home_section_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_home_section_items_home_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "home_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "addresses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    label = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    street_address = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    area = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    building_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    floor_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    apartment_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_default = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    latitude = table.Column<decimal>(type: "decimal(10,8)", nullable: true),
                    longitude = table.Column<decimal>(type: "decimal(11,8)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_addresses", x => x.id);
                    table.ForeignKey(
                        name: "FK_addresses_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "carts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_carts", x => x.id);
                    table.ForeignKey(
                        name: "FK_carts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    balance = table.Column<int>(type: "int", nullable: false),
                    total_earned = table.Column<int>(type: "int", nullable: false),
                    total_redeemed = table.Column<int>(type: "int", nullable: false),
                    tier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loyalty_accounts", x => x.id);
                    table.ForeignKey(
                        name: "FK_loyalty_accounts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    data = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_read = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    read_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.id);
                    table.ForeignKey(
                        name: "FK_notifications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coupons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    discount_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    discount_value = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    min_order_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    max_discount_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    usage_limit = table.Column<int>(type: "int", nullable: true),
                    usage_count = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    user_usage_limit = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    starts_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coupons", x => x.id);
                    table.ForeignKey(
                        name: "FK_coupons_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_coupons_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    price = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    original_price = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    stock_quantity = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    is_available = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => x.id);
                    table.ForeignKey(
                        name: "FK_products_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_products_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    address_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "PENDING_CONFIRMATION"),
                    subtotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    delivery_fees = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    total_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    payment_method = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "COD"),
                    payment_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "PENDING"),
                    customer_notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    cancellation_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    discount_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    coupon_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_orders_addresses_address_id",
                        column: x => x.address_id,
                        principalTable: "addresses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_users_customer_id",
                        column: x => x.customer_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_attributes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_attributes", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_attributes_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    is_primary = table.Column<bool>(type: "bit", nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_images_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_variants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    price_adjustment = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    stock_quantity = table.Column<int>(type: "int", nullable: false),
                    is_available = table.Column<bool>(type: "bit", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_variants", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_variants_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wishlists",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wishlists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wishlists_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_wishlists_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coupon_usages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    coupon_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    discount_amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coupon_usages", x => x.id);
                    table.ForeignKey(
                        name: "FK_coupon_usages_coupons_coupon_id",
                        column: x => x.coupon_id,
                        principalTable: "coupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coupon_usages_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coupon_usages_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_transactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    account_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    points = table.Column<int>(type: "int", nullable: false),
                    balance_after = table.Column<int>(type: "int", nullable: false),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    description_ar = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loyalty_transactions", x => x.id);
                    table.ForeignKey(
                        name: "FK_loyalty_transactions_loyalty_accounts_account_id",
                        column: x => x.account_id,
                        principalTable: "loyalty_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_loyalty_transactions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "order_ratings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    delivery_rating = table.Column<int>(type: "int", nullable: false),
                    delivery_comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    speed_rating = table.Column<int>(type: "int", nullable: true),
                    packaging_rating = table.Column<int>(type: "int", nullable: true),
                    would_recommend = table.Column<bool>(type: "bit", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_ratings", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_ratings_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_ratings_users_customer_id",
                        column: x => x.customer_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "returns",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    return_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    customer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "PENDING"),
                    reason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    details = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    rejection_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_returns", x => x.id);
                    table.ForeignKey(
                        name: "FK_returns_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_returns_users_customer_id",
                        column: x => x.customer_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_returns_users_reviewed_by",
                        column: x => x.reviewed_by,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "reviews",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    rating = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    helpful_count = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    is_verified_purchase = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    is_approved = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    vendor_reply = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    vendor_reply_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reviews", x => x.id);
                    table.ForeignKey(
                        name: "FK_reviews_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_reviews_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_reviews_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sub_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sub_order_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "PENDING_CONFIRMATION"),
                    subtotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    delivery_fee = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    confirmed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    confirmation_deadline = table.Column<DateTime>(type: "datetime2", nullable: true),
                    cancellation_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    cancelled_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    driver_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    assigned_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sub_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_sub_orders_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_orders_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sub_orders_users_cancelled_by",
                        column: x => x.cancelled_by,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_orders_users_confirmed_by",
                        column: x => x.confirmed_by,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_orders_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_attribute_values",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    attribute_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    value = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    value_ar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_attribute_values", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_attribute_values_product_attributes_attribute_id",
                        column: x => x.attribute_id,
                        principalTable: "product_attributes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cart_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    cart_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    variant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    quantity = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cart_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_cart_items_carts_cart_id",
                        column: x => x.cart_id,
                        principalTable: "carts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_cart_items_product_variants_variant_id",
                        column: x => x.variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_cart_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "return_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    return_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_return_images_returns_return_id",
                        column: x => x.return_id,
                        principalTable: "returns",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "return_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    return_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    quantity = table.Column<int>(type: "int", nullable: false),
                    unit_price = table.Column<decimal>(type: "decimal(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_return_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_return_items_returns_return_id",
                        column: x => x.return_id,
                        principalTable: "returns",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "review_helpfuls",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    review_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_review_helpfuls", x => x.id);
                    table.ForeignKey(
                        name: "FK_review_helpfuls_reviews_review_id",
                        column: x => x.review_id,
                        principalTable: "reviews",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_review_helpfuls_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "review_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    review_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_review_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_review_images_reviews_review_id",
                        column: x => x.review_id,
                        principalTable: "reviews",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "review_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    review_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    details = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_review_reports", x => x.id);
                    table.ForeignKey(
                        name: "FK_review_reports_reviews_review_id",
                        column: x => x.review_id,
                        principalTable: "reviews",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_review_reports_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_status_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sub_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    new_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    changed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_status_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_status_logs_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_order_status_logs_sub_orders_sub_order_id",
                        column: x => x.sub_order_id,
                        principalTable: "sub_orders",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_order_status_logs_users_changed_by",
                        column: x => x.changed_by,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "sub_order_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sub_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    product_name_ar = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    product_image_url = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    unit_price = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    quantity = table.Column<int>(type: "int", nullable: false),
                    subtotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    variant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sub_order_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_sub_order_items_product_variants_variant_id",
                        column: x => x.variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_order_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sub_order_items_sub_orders_sub_order_id",
                        column: x => x.sub_order_id,
                        principalTable: "sub_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sub_order_ratings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_rating_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sub_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_rating = table.Column<int>(type: "int", nullable: false),
                    vendor_comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    driver_rating = table.Column<int>(type: "int", nullable: true),
                    driver_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sub_order_ratings", x => x.id);
                    table.ForeignKey(
                        name: "FK_sub_order_ratings_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_order_ratings_order_ratings_order_rating_id",
                        column: x => x.order_rating_id,
                        principalTable: "order_ratings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sub_order_ratings_sub_orders_sub_order_id",
                        column: x => x.sub_order_id,
                        principalTable: "sub_orders",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_sub_order_ratings_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "product_variant_attribute_values",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    variant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    attribute_value_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_variant_attribute_values", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_variant_attribute_values_product_attribute_values_attribute_value_id",
                        column: x => x.attribute_value_id,
                        principalTable: "product_attribute_values",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_product_variant_attribute_values_product_variants_variant_id",
                        column: x => x.variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_addresses_city",
                table: "addresses",
                column: "city");

            migrationBuilder.CreateIndex(
                name: "idx_addresses_user_default",
                table: "addresses",
                columns: new[] { "user_id", "is_default" });

            migrationBuilder.CreateIndex(
                name: "idx_addresses_user_id",
                table: "addresses",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_cart_items_cart_id",
                table: "cart_items",
                column: "cart_id");

            migrationBuilder.CreateIndex(
                name: "IX_cart_items_product_id",
                table: "cart_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_cart_items_variant_id",
                table: "cart_items",
                column: "variant_id");

            migrationBuilder.CreateIndex(
                name: "IX_carts_user_id",
                table: "carts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_categories_is_active",
                table: "categories",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "idx_categories_name",
                table: "categories",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "idx_categories_parent_id",
                table: "categories",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "idx_coupon_usages_coupon_order_unique",
                table: "coupon_usages",
                columns: new[] { "coupon_id", "order_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_coupon_usages_coupon_user",
                table: "coupon_usages",
                columns: new[] { "coupon_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "IX_coupon_usages_order_id",
                table: "coupon_usages",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_coupon_usages_user_id",
                table: "coupon_usages",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_coupons_code",
                table: "coupons",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_coupons_expires_at",
                table: "coupons",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "idx_coupons_is_active",
                table: "coupons",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "IX_coupons_category_id",
                table: "coupons",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "IX_coupons_vendor_id",
                table: "coupons",
                column: "vendor_id");

            migrationBuilder.CreateIndex(
                name: "IX_home_section_items_section_id",
                table: "home_section_items",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "IX_loyalty_accounts_user_id",
                table: "loyalty_accounts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_loyalty_transactions_account_id",
                table: "loyalty_transactions",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "IX_loyalty_transactions_order_id",
                table: "loyalty_transactions",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_notifications_created_at",
                table: "notifications",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "idx_notifications_user_id",
                table: "notifications",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_notifications_user_unread",
                table: "notifications",
                columns: new[] { "user_id", "is_read" });

            migrationBuilder.CreateIndex(
                name: "IX_order_ratings_customer_id",
                table: "order_ratings",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_ratings_order_id",
                table: "order_ratings",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_logs_created",
                table: "order_status_logs",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "idx_logs_order",
                table: "order_status_logs",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_logs_sub_order",
                table: "order_status_logs",
                column: "sub_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_status_logs_changed_by",
                table: "order_status_logs",
                column: "changed_by");

            migrationBuilder.CreateIndex(
                name: "idx_orders_created",
                table: "orders",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "idx_orders_customer",
                table: "orders",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "idx_orders_number",
                table: "orders",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_orders_status",
                table: "orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_orders_address_id",
                table: "orders",
                column: "address_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_attribute_values_attribute_id",
                table: "product_attribute_values",
                column: "attribute_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_attributes_product_id",
                table: "product_attributes",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_images_product_id",
                table: "product_images",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_variant_attribute_values_attribute_value_id",
                table: "product_variant_attribute_values",
                column: "attribute_value_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_variant_attribute_values_variant_id",
                table: "product_variant_attribute_values",
                column: "variant_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_variants_product_id",
                table: "product_variants",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "idx_products_active_available",
                table: "products",
                columns: new[] { "is_active", "is_available" });

            migrationBuilder.CreateIndex(
                name: "idx_products_category",
                table: "products",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "idx_products_sku",
                table: "products",
                column: "sku");

            migrationBuilder.CreateIndex(
                name: "idx_products_vendor",
                table: "products",
                column: "vendor_id");

            migrationBuilder.CreateIndex(
                name: "idx_promotions_expires_at",
                table: "promotions",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "idx_promotions_is_active",
                table: "promotions",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "idx_promotions_target",
                table: "promotions",
                columns: new[] { "target_type", "target_id" });

            migrationBuilder.CreateIndex(
                name: "idx_promotions_target_type",
                table: "promotions",
                column: "target_type");

            migrationBuilder.CreateIndex(
                name: "IX_return_images_return_id",
                table: "return_images",
                column: "return_id");

            migrationBuilder.CreateIndex(
                name: "idx_return_items_return_id",
                table: "return_items",
                column: "return_id");

            migrationBuilder.CreateIndex(
                name: "IX_return_items_product_id",
                table: "return_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "idx_returns_created_at",
                table: "returns",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "idx_returns_customer_id",
                table: "returns",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "idx_returns_number",
                table: "returns",
                column: "return_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_returns_order_id",
                table: "returns",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_returns_status",
                table: "returns",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_returns_reviewed_by",
                table: "returns",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "idx_review_helpfuls_review_user_unique",
                table: "review_helpfuls",
                columns: new[] { "review_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_review_helpfuls_user_id",
                table: "review_helpfuls",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_review_images_review_id",
                table: "review_images",
                column: "review_id");

            migrationBuilder.CreateIndex(
                name: "idx_review_reports_review_user_unique",
                table: "review_reports",
                columns: new[] { "review_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_review_reports_user_id",
                table: "review_reports",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_reviews_created_at",
                table: "reviews",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "idx_reviews_is_approved",
                table: "reviews",
                column: "is_approved");

            migrationBuilder.CreateIndex(
                name: "idx_reviews_product_id",
                table: "reviews",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "idx_reviews_product_user_unique",
                table: "reviews",
                columns: new[] { "product_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_reviews_rating",
                table: "reviews",
                column: "rating");

            migrationBuilder.CreateIndex(
                name: "idx_reviews_user_id",
                table: "reviews",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_reviews_order_id",
                table: "reviews",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_sub_order_items_product",
                table: "sub_order_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "idx_sub_order_items_sub_order",
                table: "sub_order_items",
                column: "sub_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_order_items_variant_id",
                table: "sub_order_items",
                column: "variant_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_order_ratings_driver_id",
                table: "sub_order_ratings",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_order_ratings_order_rating_id",
                table: "sub_order_ratings",
                column: "order_rating_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_order_ratings_sub_order_id",
                table: "sub_order_ratings",
                column: "sub_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_order_ratings_vendor_id",
                table: "sub_order_ratings",
                column: "vendor_id");

            migrationBuilder.CreateIndex(
                name: "idx_sub_orders_deadline",
                table: "sub_orders",
                column: "confirmation_deadline");

            migrationBuilder.CreateIndex(
                name: "idx_sub_orders_number",
                table: "sub_orders",
                column: "sub_order_number");

            migrationBuilder.CreateIndex(
                name: "idx_sub_orders_order",
                table: "sub_orders",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "idx_sub_orders_status",
                table: "sub_orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_sub_orders_vendor",
                table: "sub_orders",
                column: "vendor_id");

            migrationBuilder.CreateIndex(
                name: "IX_sub_orders_cancelled_by",
                table: "sub_orders",
                column: "cancelled_by");

            migrationBuilder.CreateIndex(
                name: "IX_sub_orders_confirmed_by",
                table: "sub_orders",
                column: "confirmed_by");

            migrationBuilder.CreateIndex(
                name: "IX_sub_orders_driver_id",
                table: "sub_orders",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "idx_users_email",
                table: "users",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "idx_users_phone",
                table: "users",
                column: "phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_users_role",
                table: "users",
                column: "role");

            migrationBuilder.CreateIndex(
                name: "idx_vendors_is_active",
                table: "vendors",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "idx_vendors_name",
                table: "vendors",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "idx_vendors_phone",
                table: "vendors",
                column: "phone");

            migrationBuilder.CreateIndex(
                name: "idx_wishlists_created_at",
                table: "wishlists",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "idx_wishlists_product_id",
                table: "wishlists",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "idx_wishlists_user_id",
                table: "wishlists",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "idx_wishlists_user_product_unique",
                table: "wishlists",
                columns: new[] { "UserId", "ProductId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "banners");

            migrationBuilder.DropTable(
                name: "cart_items");

            migrationBuilder.DropTable(
                name: "coupon_usages");

            migrationBuilder.DropTable(
                name: "home_section_items");

            migrationBuilder.DropTable(
                name: "loyalty_settings");

            migrationBuilder.DropTable(
                name: "loyalty_transactions");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "order_status_logs");

            migrationBuilder.DropTable(
                name: "product_images");

            migrationBuilder.DropTable(
                name: "product_variant_attribute_values");

            migrationBuilder.DropTable(
                name: "promotions");

            migrationBuilder.DropTable(
                name: "return_images");

            migrationBuilder.DropTable(
                name: "return_items");

            migrationBuilder.DropTable(
                name: "review_helpfuls");

            migrationBuilder.DropTable(
                name: "review_images");

            migrationBuilder.DropTable(
                name: "review_reports");

            migrationBuilder.DropTable(
                name: "sub_order_items");

            migrationBuilder.DropTable(
                name: "sub_order_ratings");

            migrationBuilder.DropTable(
                name: "wishlists");

            migrationBuilder.DropTable(
                name: "carts");

            migrationBuilder.DropTable(
                name: "coupons");

            migrationBuilder.DropTable(
                name: "home_sections");

            migrationBuilder.DropTable(
                name: "loyalty_accounts");

            migrationBuilder.DropTable(
                name: "product_attribute_values");

            migrationBuilder.DropTable(
                name: "returns");

            migrationBuilder.DropTable(
                name: "reviews");

            migrationBuilder.DropTable(
                name: "product_variants");

            migrationBuilder.DropTable(
                name: "order_ratings");

            migrationBuilder.DropTable(
                name: "sub_orders");

            migrationBuilder.DropTable(
                name: "product_attributes");

            migrationBuilder.DropTable(
                name: "drivers");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "addresses");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "vendors");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
