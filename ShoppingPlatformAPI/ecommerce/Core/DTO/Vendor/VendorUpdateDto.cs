using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Vendor
{
    public class VendorUpdateDto
    {
        [MaxLength(255)]
        public string? Name { get; set; }

        [MaxLength(255)]
        public string? NameAr { get; set; }

        // نص فارغ = مسح الحقل (الربط الافتراضي يحوّله null فيُتجاهل ولا يمكن مسحه)
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string? Description { get; set; }

        public IFormFile? NewLogo { get; set; }

        public IFormFile? NewCover { get; set; }

        [MaxLength(20)]
        public string? Phone { get; set; }

        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string? Address { get; set; }

        public bool? IsActive { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MinOrderAmount { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? DeliveryFee { get; set; }

        public int? EstimatedPrepTime { get; set; }

        public bool? IsAcceptingOrders { get; set; }

        // JSON الجدول الأسبوعي؛ نص فارغ = إلغاء الجدول (مفتوح دائماً)
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string? WorkingHours { get; set; }
    }
}
