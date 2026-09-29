namespace ecommerce.Core.DTO.Drivers
{
    public class DriversPagedResultDto
    {
        public List<DriverDto> Items { get; set; }
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    }
}
