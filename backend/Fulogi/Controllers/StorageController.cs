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
                s.FuelItems.Select(f => new StorageFuelItemDto(f.FuelType, f.Amount)).ToList()));

            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult> CreateStorage([FromBody] StorageRequest request)
        {
            var fuelItems = request.FuelItems.Select(f => new StorageFuelItem 
            { 
                Id = Guid.NewGuid(), 
                FuelType = f.FuelType, 
                Amount = f.Amount 
            }).ToList();

            var (storage, errors) = Storage.Create(
                Guid.NewGuid(),
                request.Name,
                request.Latitude,
                request.Longitude,
                fuelItems);

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
            var fuelItems = request.FuelItems.Select(f => new StorageFuelItem 
            { 
                Id = Guid.NewGuid(), 
                StorageId = id,
                FuelType = f.FuelType, 
                Amount = f.Amount 
            }).ToList();

            var storageId = await _storageService.UpdateStorage(
                id,
                request.Name,
                request.Latitude,
                request.Longitude,
                fuelItems);

            return Ok(storageId);
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<Guid>> DeleteStorage(Guid id)
        {
            return Ok(await _storageService.DeleteStorage(id));
        }
    }
}