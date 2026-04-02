using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IFuelRequestService
    {
        Task<Guid> CreateFuelRequest(FuelRequest fuelRequest);
        Task<Guid> DeleteFuelRequest(Guid id);
        Task<List<FuelRequest>> GetAllFuelRequests();
        Task<Guid> UpdateFuelRequest(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt);
    }
}
