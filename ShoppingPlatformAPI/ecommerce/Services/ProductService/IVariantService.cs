using ecommerce.Core.DTO.Product;

namespace ecommerce.Services.ProductService
{
    public interface IVariantService
    {
        // ===================================
        // Attributes
        // ===================================
        Task<List<ProductAttributeDto>> GetAttributesAsync(Guid productId);
        Task<ProductAttributeDto> CreateAttributeAsync(Guid productId, CreateProductAttributeDto dto);
        Task<ProductAttributeDto> UpdateAttributeAsync(Guid attributeId, UpdateProductAttributeDto dto);
        Task<bool> DeleteAttributeAsync(Guid attributeId);

        // ===================================
        // Attribute Values
        // ===================================
        Task<ProductAttributeValueDto> AddAttributeValueAsync(Guid attributeId, CreateAttributeValueDto dto);
        Task<bool> DeleteAttributeValueAsync(Guid valueId);

        // ===================================
        // Variants
        // ===================================
        Task<List<ProductVariantDto>> GetVariantsAsync(Guid productId);
        Task<ProductVariantDto> GetVariantByIdAsync(Guid variantId);
        Task<ProductVariantDto> CreateVariantAsync(Guid productId, CreateProductVariantDto dto);
        Task<ProductVariantDto> UpdateVariantAsync(Guid variantId, UpdateProductVariantDto dto);
        Task<bool> DeleteVariantAsync(Guid variantId);
    }
}