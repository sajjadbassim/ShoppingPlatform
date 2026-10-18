using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ecommerce.Core.DTO.Common
{
    public class PaginationParams
    {
        private const int MaxPageSize = 100;
        private int _pageSize = 20;
        private int _pageNumber = 1;

        // قيمة خارج المدى تُستبدل بأقرب قيمة صالحة (مثل باقي الواجهات — PagingClampFilter) بدل رد 400
        public int PageNumber
        {
            get => _pageNumber;
            set => _pageNumber = Math.Max(1, value);
        }

        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = Math.Clamp(value, 1, MaxPageSize);
        }
        [BindNever]
        public int Skip => (PageNumber - 1) * PageSize;
    }
}
