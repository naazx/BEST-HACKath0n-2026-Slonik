using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.Cotracts;
using Microsoft.AspNetCore.Mvc;

namespace Fulogi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StationController : ControllerBase
    {
        private readonly IStationService _stationService;

        public StationController(IStationService stationService)
        {
            _stationService = stationService;
        }

        [HttpGet]
        public async Task<ActionResult<List<StationResponse>>> GetAllStations()
        {
            var stations = await _stationService.GetAllStations();

            var response = stations.Select(s => new StationResponse(s.Id, s.Name, s.Latitude, s.Longitude));

            return Ok(response);
        }
        [HttpPost]
        public async Task<ActionResult> CreateStation([FromBody] StationRequest request)
        {
            var (station, errors) = Station.Create(
                Guid.NewGuid(),
                request.Name,
                request.Latitude,
                request.Longitude
                );

            if (!string.IsNullOrEmpty(errors))
            { 
                return BadRequest(errors);
            }
            var id = await _stationService.CreateStation(station);
            return Ok(id);
        }
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<Guid>> UpdateStation(Guid id, [FromBody] StationRequest request)
        {
            try
            {
                var stationId = await _stationService.UpdateStation(id, request.Name, request.Latitude, request.Longitude);
                return Ok(stationId);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }
        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<Guid>> DeleteStation(Guid id)
        {
            try
            {
                return Ok(await _stationService.DeleteStation(id));
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
    }
}
