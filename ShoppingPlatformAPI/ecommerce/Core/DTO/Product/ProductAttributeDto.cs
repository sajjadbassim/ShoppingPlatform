using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Product
{
    // ===================================
    // Response DTOs
    // ===================================
    public class ProductAttributeDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string? NameAr { get; set; }
        public int DisplayOrder { get; set; }
        public List<ProductAttributeValueDto> Values { get; set; } = new();
    }

    public class ProductAttributeValueDto
    {
        public Guid Id { get; set; }
        public string Value { get; set; }
        public string? ValueAr { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class ProductVariantDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string? Sku { get; set; }
        public decimal BasePrice { get; set; }        // سعر المنتج الأساسي
        public decimal PriceAdjustment { get; set; }  // الفرق
        public decimal FinalPrice { get; set; }        // السعر النهائي
        public int StockQuantity { get; set; }
        public bool IsAvailable { get; set; }
        public string? ImageUrl { get; set; }
        public int DisplayOrder { get; set; }
        public List<VariantAttributeValueDto> Attributes { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class VariantAttributeValueDto
    {
        public Guid AttributeId { get; set; }
        public string AttributeName { get; set; }
        public string? AttributeNameAr { get; set; }
        public Guid ValueId { get; set; }
        public string Value { get; set; }
        public string? ValueAr { get; set; }
    }

    // ===================================
    // Create DTOs
    // ===================================
    public class CreateProductAttributeDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [MaxLength(100)]
        public string? NameAr { get; set; }

        public int DisplayOrder { get; set; } = 0;

        [Required]
        public List<CreateAttributeValueDto> Values { get; set; } = new();
    }

    public class CreateAttributeValueDto
    {
        [Required]
        [MaxLength(100)]
        public string Value { get; set; }

        [MaxLength(100)]
        public string? ValueAr { get; set; }

        public int DisplayOrder { get; set; } = 0;
    }

    public class CreateProductVariantDto
    {
        public string? Sku { get; set; }
        public decimal PriceAdjustment { get; set; } = 0;
        public int StockQuantity { get; set; } = 0;
        public bool IsAvailable { get; set; } = true;
        public string? ImageUrl { get; set; }
        public int DisplayOrder { get; set; } = 0;

        [Required]
        public List<Guid> AttributeValueIds { get; set; } = new(); // IDs من ProductAttributeValue
    }

    // ===================================
    // Update DTOs
    // ===================================
    public class UpdateProductAttributeDto
    {
        [MaxLength(100)]
        public string? Name { get; set; }

        [MaxLength(100)]
        public string? NameAr { get; set; }

        public int? DisplayOrder { get; set; }
    }

    public class UpdateProductVariantDto
    {
        public string? Sku { get; set; }
        public decimal? PriceAdjustment { get; set; }
        public int? StockQuantity { get; set; }
        public bool? IsAvailable { get; set; }
        public string? ImageUrl { get; set; }
        public int? DisplayOrder { get; set; }
    }
}