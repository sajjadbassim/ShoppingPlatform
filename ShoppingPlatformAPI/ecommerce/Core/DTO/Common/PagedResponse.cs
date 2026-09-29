namespace ecommerce.Core.DTO.Common
{
    public class PagedResponse<T>
    {
        public List<T> Data { get; set; }
        public PaginationMetadata Pagination { get; set; }

        public PagedResponse(List<T> data, int totalCount, int pageNumber, int pageSize)
        {
            Data = data;
            Pagination = new PaginationMetadata
            {
                CurrentPage = pageNumber,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = (int)System.Math.Ceiling(totalCount / (double)pageSize),
                HasPrevious = pageNumber > 1,
                HasNext = pageNumber < (int)System.Math.Ceiling(totalCount / (double)pageSize)
            };
        }
    }
    public class PaginationMetadata
    {
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPrevious { get; set; }
        public bool HasNext { get; set; }
    }
}
