using System.Collections.Generic;
using System;

namespace ecommerce.Core.Models
{
    public class PagedResult<T>
    {
        public List<T> Items { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPreviousPage { get; set; }
        public bool HasNextPage { get; set; }

        public PagedResult(List<T> items, int count, int pageNumber, int pageSize)
        {
            Items = items;
            PageNumber = pageNumber;
            PageSize = pageSize;
            TotalCount = count;
            TotalPages = (int)Math.Ceiling(count / (double)pageSize);
            HasPreviousPage = pageNumber > 1;
            HasNextPage = pageNumber < TotalPages;
        }

        public static PagedResult<T> Create(List<T> items, int count, int pageNumber, int pageSize)
        {
            return new PagedResult<T>(items, count, pageNumber, pageSize);
        }
    }
}

