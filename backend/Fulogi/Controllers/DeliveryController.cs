using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.Cotracts;
using Microsoft.AspNetCore.Mvc;

namespace Fulogi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DeliveryController : ControllerBase
    {
        private readonly IDeliveryService _deliveryService;

        public DeliveryController(IDeliveryService deliveryService)
        {
            _deliveryService = deliveryService;
        }

        [HttpGet]
        public async Task<ActionResult<List<DeliveryResponse>>> GetAllDeliveries()
        {
            var deliveries = await _deliveryService.GetAllDeliveries();
            var response = deliveries.Select(d => new DeliveryResponse(
                d.Id,
                d.RequestId,
                d.StorageId,
                d.DeliveredAmount,
                d.Status,
                d.CreatedAt));

            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult> CreateDelivery([FromBody] DeliveryRequest request)
        {
            var (delivery, errors) = Delivery.Create(
                Guid.NewGuid(),
                request.RequestId,
                request.StorageId,
                request.DeliveredAmount,
                request.Status,
                request.CreatedAt);

            if (!string.IsNullOrEmpty(errors))
            {
                return BadRequest(errors);
            }

            try
            {
                var id = await _deliveryService.CreateDelivery(delivery);
                return Ok(id);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<Guid>> UpdateDelivery(Guid id, [FromBody] DeliveryRequest request)
        {
            try
            {
                var deliveryId = await _deliveryService.UpdateDelivery(
                    id,
                    request.RequestId,
                    request.StorageId,
                    request.DeliveredAmount,
                    request.Status,
                    request.CreatedAt);

                return Ok(deliveryId);
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
        public async Task<ActionResult<Guid>> DeleteDelivery(Guid id)
        {
            try
            {
                return Ok(await _deliveryService.DeleteDelivery(id));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}
