using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.Cotracts;
using Microsoft.AspNetCore.Mvc;

namespace Fulogi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FuelRequestController : ControllerBase
    {
        private readonly IFuelRequestService _fuelRequestService;

        public FuelRequestController(IFuelRequestService fuelRequestService)
        {
            _fuelRequestService = fuelRequestService;
        }

        [HttpGet]
        public async Task<ActionResult<List<FuelRequestResponse>>> GetAllFuelRequests()
        {
            var fuelRequests = await _fuelRequestService.GetAllFuelRequests();
            var response = fuelRequests.Select(f => new FuelRequestResponse(
                f.Id,
                f.StationId,
                f.FuelAmount,
                f.Priority,
                f.Status,
                f.CreatedAt));

            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult> CreateFuelRequest([FromBody] FuelRequestRequest request)
        {
            var (fuelRequest, errors) = FuelRequest.Create(
                Guid.NewGuid(),
                request.StationId,
                request.FuelAmount,
                request.Priority,
                request.Status,
                request.CreatedAt);

            if (!string.IsNullOrEmpty(errors))
            {
                return BadRequest(errors);
            }

            var id = await _fuelRequestService.CreateFuelRequest(fuelRequest);
            return Ok(id);
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<Guid>> UpdateFuelRequest(Guid id, [FromBody] FuelRequestRequest request)
        {
            var fuelRequestId = await _fuelRequestService.UpdateFuelRequest(
                id,
                request.StationId,
                request.FuelAmount,
                request.Priority,
                request.Status,
                request.CreatedAt);

            return Ok(fuelRequestId);
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<Guid>> DeleteFuelRequest(Guid id)
        {
            return Ok(await _fuelRequestService.DeleteFuelRequest(id));
        }
    }
}
