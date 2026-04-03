using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IFuelRequestsRepository
    {
        Task<Guid> Create(FuelRequest fuelRequest);
        Task<Guid> Delete(Guid id);
        Task<List<FuelRequest>> Get();
        Task<Guid> Update(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt);
    }
}
