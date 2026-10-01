// Controllers/DriversController.cs
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "OpsOrAdmin")]
    public class DriversController : ControllerBase
    {
        private readonly IDriverService _driverService;
        private readonly ecommerce.Services.DriverAppService.IDriverAppService _driverApp;

        public DriversController(IDriverService driverService, ecommerce.Services.DriverAppService.IDriverAppService driverApp)
        {
            _driverService = driverService;
            _driverApp = driverApp;
        }

        // GET: api/drivers/paged
        [HttpGet("paged")]
        public async Task<IActionResult> GetDriversPaged(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? workStatus = null)
        {
            try
            {
                var result = await _driverService.GetDriversPagedAsync(
                    pageNumber, pageSize, status, workStatus);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/drivers/available
        [HttpGet("available")]
        public async Task<IActionResult> GetAvailableDrivers()
        {
            try
            {
                var drivers = await _driverService.GetAvailableDriversAsync();
                return Ok(new { success = true, data = drivers });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/drivers/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDriverById(Guid id)
        {
            try
            {
                var driver = await _driverService.GetDriverByIdAsync(id);
                return Ok(new { success = true, data = driver });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // POST: api/drivers
        [HttpPost]
        public async Task<IActionResult> CreateDriver([FromBody] CreateDriverDto dto)
        {
            try
            {
                var driver = await _driverService.CreateDriverAsync(dto);
                if (!string.IsNullOrWhiteSpace(dto.Password))
                    driver = await _driverApp.SetAccountAsync(driver.Id, dto.Password);
                return Ok(new { success = true, data = driver, message = "تم إضافة السائق بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/drivers/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDriver(Guid id, [FromBody] UpdateDriverDto dto)
        {
            try
            {
                var driver = await _driverService.UpdateDriverAsync(id, dto);
                return Ok(new { success = true, data = driver, message = "تم تعديل بيانات السائق بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/drivers/{id}/toggle-status
        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleDriverStatus(Guid id)
        {
            try
            {
                var driver = await _driverService.ToggleDriverStatusAsync(id);
                return Ok(new { success = true, data = driver, message = "تم تغيير حالة السائق بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/drivers/{id}/work-status
        [HttpPut("{id}/work-status")]
        public async Task<IActionResult> UpdateWorkStatus(Guid id, [FromBody] UpdateDriverWorkStatusDto dto)
        {
            try
            {
                var driver = await _driverService.UpdateDriverWorkStatusAsync(id, dto);
                return Ok(new { success = true, data = driver, message = "تم تحديث حالة السائق بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/drivers/{id}/orders
        [HttpGet("{id}/orders")]
        public async Task<IActionResult> GetDriverOrders(
            Guid id,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? filter = null) // active | completed | null = الكل
        {
            try
            {
                var result = await _driverService.GetDriverOrdersAsync(id, pageNumber, pageSize, filter);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/drivers/{id}/stats
        [HttpGet("{id}/stats")]
        public async Task<IActionResult> GetDriverStats(Guid id)
        {
            try
            {
                var stats = await _driverService.GetDriverStatsAsync(id);
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }





    }
}