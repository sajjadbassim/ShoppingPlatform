using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Data;
using ecommerce.Services.FinanceService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // مستحقات المتاجر — للإدارة فقط
    [ApiController]
    [Route("api/finance")]
    [Authorize(Policy = PolicyNames.AdminOnly)]
    public class FinanceController : ControllerBase
    {
        private readonly IFinanceService _finance;

        public FinanceController(IFinanceService finance) => _finance = finance;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/finance/vendors — رصيد كل متجر
        [HttpGet("vendors")]
        public async Task<ActionResult<ApiResponse<List<VendorBalanceDto>>>> Balances(CancellationToken ct)
            => Ok(ApiResponse<List<VendorBalanceDto>>.Ok(await _finance.GetBalancesAsync(ct)));

        // GET: api/finance/vendors/{id}/statement — كشف الحساب
        [HttpGet("vendors/{vendorId:guid}/statement")]
        public async Task<ActionResult<ApiResponse<VendorStatementDto>>> Statement(Guid vendorId, CancellationToken ct)
            => Ok(ApiResponse<VendorStatementDto>.Ok(await _finance.GetStatementAsync(vendorId, ct: ct)));

        // POST: api/finance/vendors/{id}/payouts — تسجيل دفعة حُوّلت للمتجر
        [HttpPost("vendors/{vendorId:guid}/payouts")]
        public async Task<ActionResult<ApiResponse<LedgerEntryDto>>> Payout(Guid vendorId, [FromBody] PayoutDto dto, CancellationToken ct)
            => Ok(ApiResponse<LedgerEntryDto>.Ok(await _finance.RecordPayoutAsync(vendorId, dto.Amount, dto.Reference, dto.Note, UserId, ct), "تم تسجيل الدفعة"));

        // POST: api/finance/vendors/{id}/adjustments — تسوية يدوية (+ للمتجر / − عليه)
        [HttpPost("vendors/{vendorId:guid}/adjustments")]
        public async Task<ActionResult<ApiResponse<LedgerEntryDto>>> Adjust(Guid vendorId, [FromBody] AdjustmentDto dto, CancellationToken ct)
            => Ok(ApiResponse<LedgerEntryDto>.Ok(await _finance.RecordAdjustmentAsync(vendorId, dto.Amount, dto.Note, UserId, ct), "تم تسجيل التسوية"));

        // PUT: api/finance/vendors/{id}/commission — عمولة خاصة بالمتجر (null = الإعداد العام)
        [HttpPut("vendors/{vendorId:guid}/commission")]
        public async Task<ActionResult<ApiResponse<CommissionDto>>> VendorCommission(Guid vendorId, [FromBody] VendorCommissionDto dto, CancellationToken ct)
            => Ok(ApiResponse<CommissionDto>.Ok(await _finance.SetVendorCommissionAsync(vendorId,
                dto.UseDefault ? null : new CommissionDto { Type = dto.Type, Value = dto.Value }, ct), "تم حفظ العمولة"));

        // GET/PUT: api/finance/commission — العمولة العامة
        [HttpGet("commission")]
        public async Task<ActionResult<ApiResponse<CommissionDto>>> GetDefault(CancellationToken ct)
            => Ok(ApiResponse<CommissionDto>.Ok(await _finance.GetDefaultCommissionAsync(ct)));

        [HttpPut("commission")]
        public async Task<ActionResult<ApiResponse<CommissionDto>>> SetDefault([FromBody] CommissionDto dto, CancellationToken ct)
            => Ok(ApiResponse<CommissionDto>.Ok(await _finance.SetDefaultCommissionAsync(dto, UserId, ct), "تم حفظ العمولة العامة"));

        // POST: api/finance/backfill — احتساب الطلبات السابقة (آمن للتكرار)
        [HttpPost("backfill")]
        public async Task<ActionResult<ApiResponse<object>>> Backfill(CancellationToken ct)
            => Ok(ApiResponse<object>.Ok(new { processed = await _finance.BackfillAsync(ct) }, "تم احتساب الطلبات السابقة"));
    }

    // «أرباحي» — صاحب المتجر يرى حساب متجره فقط
    [ApiController]
    [Route("api/vendor-finance")]
    [Authorize(Policy = PolicyNames.VendorOnly)]
    public class VendorFinanceController : ControllerBase
    {
        private readonly IFinanceService _finance;
        private readonly AppDbContext _context;

        public VendorFinanceController(IFinanceService finance, AppDbContext context)
        {
            _finance = finance;
            _context = context;
        }

        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<VendorStatementDto>>> Me(CancellationToken ct)
        {
            var userId = Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;
            var vendorId = await _context.Vendors.Where(v => v.OwnerId == userId).Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct);
            if (vendorId == null) return NotFound(ApiResponse<VendorStatementDto>.Fail("لا يوجد متجر مرتبط بحسابك"));
            return Ok(ApiResponse<VendorStatementDto>.Ok(await _finance.GetStatementAsync(vendorId.Value, ct: ct)));
        }
    }

    public class PayoutDto
    {
        [Range(1, 1_000_000_000, ErrorMessage = "المبلغ غير صالح")] public decimal Amount { get; set; }
        [MaxLength(100)] public string? Reference { get; set; }
        [MaxLength(300)] public string? Note { get; set; }
    }

    public class AdjustmentDto
    {
        public decimal Amount { get; set; }
        [Required(ErrorMessage = "اكتب سبب التسوية"), MaxLength(300)] public string Note { get; set; } = "";
    }

    public class VendorCommissionDto
    {
        public bool UseDefault { get; set; }
        public string Type { get; set; } = CommissionType.Percentage;
        public decimal Value { get; set; }
    }
}
