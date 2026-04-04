using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.Cotracts;
using Microsoft.AspNetCore.Mvc;

namespace Fulogi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StorageController : ControllerBase
    {
        private readonly IStorageService _storageService;

        public StorageController(IStorageService storageService)
        {
            _storageService = storageService;
        }

        [HttpGet]
        public async Task<ActionResult<List<StorageResponse>>> GetAllStorages()
        {
            var storages = await _storageService.GetAllStorages();
            var response = storages.Select(s => new StorageResponse(
                s.Id,
                s.Name,
                s.Latitude,
                s.Longitude,
                s.FuelAvailable));

            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult> CreateStorage([FromBody] StorageRequest request)
        {
            var (storage, errors) = Storage.Create(
                Guid.NewGuid(),
                request.Name,
                request.Latitude,
                request.Longitude,
                request.FuelAvailable);

            if (!string.IsNullOrEmpty(errors))
            {
                return BadRequest(errors);
            }

            var id = await _storageService.CreateStorage(storage);
            return Ok(id);
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<Guid>> UpdateStorage(Guid id, [FromBody] StorageRequest request)
        {
            try
            {
                var storageId = await _storageService.UpdateStorage(
                    id,
                    request.Name,
                    request.Latitude,
                    request.Longitude,
                    request.FuelAvailable);

                return Ok(storageId);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<Guid>> DeleteStorage(Guid id)
        {
            try
            {
                return Ok(await _storageService.DeleteStorage(id));
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
