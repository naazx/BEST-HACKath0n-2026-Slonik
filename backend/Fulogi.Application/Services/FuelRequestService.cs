using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class FuelRequestService : IFuelRequestService
    {
        private readonly IFuelRequestsRepository _fuelRequestsRepository;

        public FuelRequestService(IFuelRequestsRepository fuelRequestsRepository)
        {
            _fuelRequestsRepository = fuelRequestsRepository;
        }

        public async Task<Guid> CreateFuelRequest(FuelRequest fuelRequest)
        {
            return await _fuelRequestsRepository.Create(fuelRequest);
        }

        public async Task<List<FuelRequest>> GetAllFuelRequests()
        {
            return await _fuelRequestsRepository.Get();
        }

        public async Task<Guid> UpdateFuelRequest(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt)
        {
            return await _fuelRequestsRepository.Update(id, stationId, fuelAmount, priority, status, createdAt);
        }

        public async Task<Guid> DeleteFuelRequest(Guid id)
        {
            return await _fuelRequestsRepository.Delete(id);
        }
    }
}
