using ecommerce.Services;
using ecommerce.Services.InvoiceService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class InvoiceController : ControllerBase
    {
        private readonly IInvoiceService _invoiceService;

        public InvoiceController(IInvoiceService invoiceService)
        {
            _invoiceService = invoiceService;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private bool IsAdmin() =>
            User.IsInRole("ADMIN");

        // ===================================
        // GET: api/invoice/{orderId}
        // تحميل فاتورة PDF للطلب
        // ===================================
        [HttpGet("{orderId}")]
        public async Task<IActionResult> GetInvoice(Guid orderId)
        {
            try
            {
                var pdfBytes = await _invoiceService.GenerateInvoiceAsync(
                    orderId,
                    GetCurrentUserId(),
                    IsAdmin()
                );

                return File(
                    pdfBytes,
                    "application/pdf",
                    $"invoice-{orderId}.pdf"
                );
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/invoice/{orderId}/preview
        // عرض الفاتورة في المتصفح (inline بدون تحميل)
        // ===================================
        [HttpGet("{orderId}/preview")]
        public async Task<IActionResult> PreviewInvoice(Guid orderId)
        {
            try
            {
                var pdfBytes = await _invoiceService.GenerateInvoiceAsync(
                    orderId,
                    GetCurrentUserId(),
                    IsAdmin()
                );

                return new FileContentResult(pdfBytes, "application/pdf");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}