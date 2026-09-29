using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ecommerce.Core.DTO.Common
{
    public class PaginationParams
    {
        private const int MaxPageSize = 100;
        private int _pageSize = 20;

        [Range(1, int.MaxValue, ErrorMessage = "رقم الصفحة يجب أن يكون أكبر من 0")]
        public int PageNumber { get; set; } = 1;

        [Range(1, 100, ErrorMessage = "حجم الصفحة يجب أن يكون بين 1 و 100")]
        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = value > MaxPageSize ? MaxPageSize : value;
        }
        [BindNever]
        public int Skip => (PageNumber - 1) * PageSize;
    }
}
