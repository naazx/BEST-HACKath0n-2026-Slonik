using Fulogi.Core.Enums;
using Fulogi.Core.Models;
using System.Collections.Generic;

namespace Fulogi.Core.Abstractions
{
    public interface IFuelRequestsRepository
    {
        Task<Guid> Create(FuelRequest fuelRequest);
        Task<Guid> Delete(Guid id);
        Task<List<FuelRequest>> Get();
        Task<Guid> Update(
            Guid id, 
            Guid stationId, 
            List<FuelRequest.RequestItemDto> items, 
            Priority priority, 
            Status status, 
            DateTime createdAt);
    }
}