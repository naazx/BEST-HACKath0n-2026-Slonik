using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.Cotracts;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
            var fuelRequests = await _fuelRequestService.GetAllFuelRequestDetails();
            
            var response = fuelRequests.Select(f => new FuelRequestResponse(
                f.Id,
                f.StationId,
                f.StationName,
                f.StorageId,
                f.StorageName,
                f.DeliveryId,
                f.Items.Select(i => new FuelItemResponse(i.Id, i.FuelType, i.Amount)).ToList(), 
                f.Priority,
                f.Status,
                f.CreatedAt,
                f.DistanceKm)).ToList();

            return Ok(response);
        }

        [HttpGet("sorted-by-priority-and-status")]
        public async Task<ActionResult<List<FuelRequestResponse>>> GetSortedFuelRequests()
        {
            var sortedFuelRequests = await _fuelRequestService.GetSortedFuelRequestDetails();

            var response = sortedFuelRequests.Select(f => new FuelRequestResponse(
                f.Id,
                f.StationId,
                f.StationName,
                f.StorageId,
                f.StorageName,
                f.DeliveryId,
                f.Items.Select(i => new FuelItemResponse(i.Id, i.FuelType, i.Amount)).ToList(),
                f.Priority,
                f.Status,
                f.CreatedAt,
                f.DistanceKm)).ToList();

            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult> CreateFuelRequest([FromBody] FuelRequestRequest request)
        {
            var domainItems = request.Items
                .Select(i => new FuelRequest.RequestItemDto(i.FuelType, i.Amount))
                .ToList();

            var (fuelRequest, errors) = FuelRequest.Create(
                Guid.NewGuid(),
                request.StationId,
                request.Priority, 
                request.Status,
                request.CreatedAt,
                domainItems); 

            if (!string.IsNullOrEmpty(errors))
            {
                return BadRequest(errors);
            }

            try
            {
                var id = await _fuelRequestService.CreateFuelRequest(fuelRequest);
                return Ok(id);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<Guid>> UpdateFuelRequest(Guid id, [FromBody] FuelRequestRequest request)
        {
            try
            {
            var domainItems = request.Items
                .Select(i => new FuelRequest.RequestItemDto(i.FuelType, i.Amount))
                .ToList();

                var fuelRequestId = await _fuelRequestService.UpdateFuelRequest(
                    id,
                    request.StationId,
                    domainItems,
                    request.Priority,
                    request.Status,
                    request.CreatedAt);

                return Ok(fuelRequestId);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<Guid>> DeleteFuelRequest(Guid id)
        {
            try
            {
                return Ok(await _fuelRequestService.DeleteFuelRequest(id));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpGet("urgent")]
        public async Task<ActionResult<List<FuelRequest>>> GetUrgentFuelRequests()
        {
            var urgentRequests = await _fuelRequestService.GetUrgentFuelRequests();
            return Ok(urgentRequests);
        }
    }
}