namespace ecommerce.Services.InvoiceService
{
    public interface IInvoiceService
    {
        /// <summary>
        /// يُولّد فاتورة PDF للطلب ويُرجعها كـ byte[]
        /// </summary>
        Task<byte[]> GenerateInvoiceAsync(Guid orderId, Guid requestingUserId, bool isAdmin = false);
    }
}
