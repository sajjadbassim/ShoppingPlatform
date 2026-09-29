namespace ecommerce.Core.DTO.Ops
{
    public class AssignDriverToOrderDto
    {
        public Guid DriverId { get; set; }
        public Guid OpsUserId { get; set; }
    }
}