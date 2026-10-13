using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class DeliveryZoneConfiguration : IEntityTypeConfiguration<DeliveryZone>
    {
        public void Configure(EntityTypeBuilder<DeliveryZone> entity)
        {
            entity.HasIndex(e => e.Name).IsUnique().HasDatabaseName("idx_delivery_zones_name");
        }
    }

    // ===================================
    // تكوين جدول Orders
    // ===================================
    public class OrderConfiguration : IEntityTypeConfiguration<Order>
    {
        public void Configure(EntityTypeBuilder<Order> entity)
        {
            entity.ToTable("orders");
            entity.HasKey(e => e.Id);

            // العلاقات
            entity.HasOne(e => e.Customer)
                .WithMany(u => u.Orders)
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Address)
                .WithMany(a => a.Orders)
                .HasForeignKey(e => e.AddressId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(e => e.SubOrders)
                .WithOne(so => so.Order)
                .HasForeignKey(so => so.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // الـ Indexes
            entity.HasIndex(e => e.OrderNumber)
                .IsUnique()
                .HasDatabaseName("idx_orders_number");

            entity.HasIndex(e => e.CustomerId)
                .HasDatabaseName("idx_orders_customer");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("idx_orders_status");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("idx_orders_created");

            // القيود
            entity.Property(e => e.OrderNumber)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasMaxLength(50)
                .HasDefaultValue("PENDING_CONFIRMATION");

            entity.Property(e => e.Subtotal)
                .IsRequired()
                .HasColumnType("decimal(10,2)");

            entity.Property(e => e.DeliveryFees)
                .HasColumnType("decimal(10,2)")
                .HasDefaultValue(0);

            entity.Property(e => e.TotalAmount)
                .IsRequired()
                .HasColumnType("decimal(10,2)");

            entity.Property(e => e.PaymentMethod)
                .HasMaxLength(50)
                .HasDefaultValue("COD");

            entity.Property(e => e.PaymentStatus)
                .HasMaxLength(50)
                .HasDefaultValue("PENDING");

            entity.HasIndex(o => new { o.CashCollectedByDriverId, o.CashSettledAt })
                .HasDatabaseName("idx_orders_driver_cash");
        }
    }

    public class DriverCashEntryConfiguration : IEntityTypeConfiguration<DriverCashEntry>
    {
        public void Configure(EntityTypeBuilder<DriverCashEntry> entity)
        {
            entity.HasIndex(e => new { e.DriverId, e.SettledAt }).HasDatabaseName("idx_driver_cash_driver_settled");
            entity.HasIndex(e => e.OrderId).HasDatabaseName("idx_driver_cash_order");
            entity.HasOne(e => e.Order).WithMany().HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Driver).WithMany().HasForeignKey(e => e.DriverId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    // ===================================
    // تكوين جدول SubOrders
    // ===================================
    public class VendorLedgerEntryConfiguration : IEntityTypeConfiguration<VendorLedgerEntry>
    {
        public void Configure(EntityTypeBuilder<VendorLedgerEntry> entity)
        {
            entity.HasIndex(e => new { e.VendorId, e.CreatedAt }).HasDatabaseName("idx_ledger_vendor_date");
            // كل حركة تلقائية مرة واحدة: لكل طلب فرعي، ولكل إرجاع ومتجر
            entity.HasIndex(e => new { e.SubOrderId, e.Type }).IsUnique()
                .HasFilter("[sub_order_id] IS NOT NULL AND [return_id] IS NULL").HasDatabaseName("idx_ledger_suborder_type");
            entity.HasIndex(e => new { e.ReturnId, e.VendorId, e.Type }).IsUnique()
                .HasFilter("[return_id] IS NOT NULL").HasDatabaseName("idx_ledger_return_type");
            entity.HasOne(e => e.Vendor).WithMany().HasForeignKey(e => e.VendorId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class OrderDriverRatingConfiguration : IEntityTypeConfiguration<OrderDriverRating>
    {
        public void Configure(EntityTypeBuilder<OrderDriverRating> entity)
        {
            entity.HasIndex(r => new { r.OrderRatingId, r.DriverId }).IsUnique().HasDatabaseName("idx_order_driver_ratings_unique");
            entity.HasIndex(r => r.DriverId).HasDatabaseName("idx_order_driver_ratings_driver");
            entity.HasOne(r => r.OrderRating).WithMany(o => o.DriverRatings).HasForeignKey(r => r.OrderRatingId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(r => r.Driver).WithMany().HasForeignKey(r => r.DriverId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class DriverConfiguration : IEntityTypeConfiguration<Driver>
    {
        public void Configure(EntityTypeBuilder<Driver> entity)
        {
            // حساب واحد لكل سائق
            entity.HasIndex(d => d.UserId)
                .IsUnique()
                .HasFilter("[user_id] IS NOT NULL")
                .HasDatabaseName("idx_drivers_user_id");

            entity.HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class SubOrderConfiguration : IEntityTypeConfiguration<SubOrder>
    {
        public void Configure(EntityTypeBuilder<SubOrder> entity)
        {
            entity.ToTable("sub_orders");
            entity.HasKey(e => e.Id);

            // العلاقات
            entity.HasOne(e => e.Order)
                .WithMany(o => o.SubOrders)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Vendor)
                .WithMany(v => v.SubOrders)
                .HasForeignKey(e => e.VendorId)
                .OnDelete(DeleteBehavior.Restrict);

            // ✅ الحل: تغيير من SetNull إلى NoAction
            entity.HasOne(e => e.ConfirmedByUser)
                .WithMany()
                .HasForeignKey(e => e.ConfirmedBy)
                .OnDelete(DeleteBehavior.NoAction);  // ⬅️ هنا التغيير

            entity.HasOne(e => e.CancelledByUser)
                .WithMany()
                .HasForeignKey(e => e.CancelledBy)
                .OnDelete(DeleteBehavior.NoAction);  // ⬅️ هنا التغيير

            entity.HasMany(e => e.Items)
                .WithOne(i => i.SubOrder)
                .HasForeignKey(i => i.SubOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // الـ Indexes
            entity.HasIndex(e => e.OrderId)
                .HasDatabaseName("idx_sub_orders_order");

            entity.HasIndex(e => e.VendorId)
                .HasDatabaseName("idx_sub_orders_vendor");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("idx_sub_orders_status");

            entity.HasIndex(e => e.ConfirmationDeadline)
                .HasDatabaseName("idx_sub_orders_deadline");

            entity.HasIndex(e => e.SubOrderNumber)
                .HasDatabaseName("idx_sub_orders_number");

            // القيود
            entity.Property(e => e.SubOrderNumber)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasMaxLength(50)
                .HasDefaultValue("PENDING_CONFIRMATION");

            entity.Property(e => e.Subtotal)
                .IsRequired()
                .HasColumnType("decimal(10,2)");

            entity.Property(e => e.DeliveryFee)
                .HasColumnType("decimal(10,2)")
                .HasDefaultValue(0);
        }
    }

    // ===================================
    // تكوين جدول SubOrderItems
    // ===================================
    public class SubOrderItemConfiguration : IEntityTypeConfiguration<SubOrderItem>
    {
        public void Configure(EntityTypeBuilder<SubOrderItem> entity)
        {
            entity.ToTable("sub_order_items");
            entity.HasKey(e => e.Id);

            // العلاقات
            entity.HasOne(e => e.SubOrder)
                .WithMany(so => so.Items)
                .HasForeignKey(e => e.SubOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Product)
                .WithMany(p => p.SubOrderItems)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // الـ Indexes
            entity.HasIndex(e => e.SubOrderId)
                .HasDatabaseName("idx_sub_order_items_sub_order");

            entity.HasIndex(e => e.ProductId)
                .HasDatabaseName("idx_sub_order_items_product");

            // القيود
            entity.Property(e => e.ProductName)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(e => e.UnitPrice)
                .IsRequired()
                .HasColumnType("decimal(10,2)");

            entity.Property(e => e.Quantity)
                .IsRequired();

            entity.Property(e => e.Subtotal)
                .IsRequired()
                .HasColumnType("decimal(10,2)");
        }
    }

    public class OrderStatusLogConfiguration : IEntityTypeConfiguration<OrderStatusLog>
    {
        public void Configure(EntityTypeBuilder<OrderStatusLog> entity)
        {
            entity.ToTable("order_status_logs");
            entity.HasKey(e => e.Id);

            // العلاقات
            entity.HasOne(e => e.Order)
                .WithMany(o => o.StatusLogs)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.NoAction);  // ⬅️ غيّر من Cascade إلى NoAction

            entity.HasOne(e => e.SubOrder)
                .WithMany(so => so.StatusLogs)
                .HasForeignKey(e => e.SubOrderId)
                .OnDelete(DeleteBehavior.NoAction);  // ⬅️ غيّر من Cascade إلى NoAction

            entity.HasOne(e => e.ChangedByUser)
                .WithMany(u => u.StatusChanges)
                .HasForeignKey(e => e.ChangedBy)
                .OnDelete(DeleteBehavior.NoAction);  // ⬅️ NoAction

            // الـ Indexes
            entity.HasIndex(e => e.OrderId)
                .HasDatabaseName("idx_logs_order");

            entity.HasIndex(e => e.SubOrderId)
                .HasDatabaseName("idx_logs_sub_order");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("idx_logs_created");

            // القيود
            entity.Property(e => e.NewStatus)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.OldStatus)
                .IsRequired(false)
                .HasMaxLength(50);

            entity.Property(e => e.Reason)
                .IsRequired(false);

            entity.Property(e => e.Notes)
                .IsRequired(false);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("GETDATE()");
        }
    }

    // ===================================
    // تكوين جدول SubOrderRating 
    // ===================================
    public class SubOrderRatingConfiguration : IEntityTypeConfiguration<SubOrderRating>
    {
        public void Configure(EntityTypeBuilder<SubOrderRating> entity)
        {
            entity.HasOne(sr => sr.SubOrder)
                  .WithMany()
                  .HasForeignKey(sr => sr.SubOrderId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(sr => sr.Vendor)
                  .WithMany()
                  .HasForeignKey(sr => sr.VendorId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(sr => sr.Driver)
                  .WithMany()
                  .HasForeignKey(sr => sr.DriverId)
                  .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
