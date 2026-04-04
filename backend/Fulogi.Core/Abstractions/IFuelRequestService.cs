using Fulogi.Core.Enums;
using Fulogi.Core.Models;
using System.Collections.Generic;
namespace Fulogi.Core.Abstractions
{
    public interface IFuelRequestService
    {
        Task<Guid> CreateFuelRequest(FuelRequest fuelRequest);
        Task<Guid> DeleteFuelRequest(Guid id);
        Task<List<FuelRequest>> GetAllFuelRequests();
        Task<List<FuelRequestDetails>> GetAllFuelRequestDetails();
        Task<Guid> UpdateFuelRequest(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt);
        Task<List<FuelRequest>> GetSortedFuelRequests();
        Task<List<FuelRequestDetails>> GetSortedFuelRequestDetails();
        Task<List<FuelRequest>> GetUrgentFuelRequests();
    }
}
