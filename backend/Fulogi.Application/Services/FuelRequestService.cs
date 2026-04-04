using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class FuelRequestService : IFuelRequestService
    {
        private readonly IFuelRequestsRepository _fuelRequestsRepository;
        private readonly IDeliveriesRepository _deliveriesRepository;
        private readonly IStationsRepository _stationsRepository;
        private readonly IStoragesRepository _storagesRepository;

        public FuelRequestService(
            IFuelRequestsRepository fuelRequestsRepository,
            IDeliveriesRepository deliveriesRepository,
            IStationsRepository stationsRepository,
            IStoragesRepository storagesRepository)
        {
            _fuelRequestsRepository = fuelRequestsRepository;
            _deliveriesRepository = deliveriesRepository;
            _stationsRepository = stationsRepository;
            _storagesRepository = storagesRepository;
        }

        public async Task<Guid> CreateFuelRequest(FuelRequest fuelRequest)
        {
            return await _fuelRequestsRepository.Create(fuelRequest);
        }

        public async Task<List<FuelRequest>> GetAllFuelRequests()
        {
            return await _fuelRequestsRepository.Get();
        }

        public async Task<List<FuelRequestDetails>> GetAllFuelRequestDetails()
        {
            var requests = await _fuelRequestsRepository.Get();
            return await BuildFuelRequestDetails(requests);
        }

        public async Task<Guid> UpdateFuelRequest(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt)
        {
            return await _fuelRequestsRepository.Update(id, stationId, fuelAmount, priority, status, createdAt);
        }

        public async Task<Guid> DeleteFuelRequest(Guid id)
        {
            return await _fuelRequestsRepository.Delete(id);
        }

        public async Task<List<FuelRequest>> GetSortedFuelRequests()
        {
            var allRequests = await _fuelRequestsRepository.Get();

            var sortedRequests = allRequests
        .OrderBy(x => (int)x.Status)
        .ThenByDescending(x => x.Priority)
        .ToList();

            return sortedRequests;
        }

        public async Task<List<FuelRequestDetails>> GetSortedFuelRequestDetails()
        {
            var sortedRequests = await GetSortedFuelRequests();
            return await BuildFuelRequestDetails(sortedRequests);
        }

        public async Task<List<FuelRequest>> GetUrgentFuelRequests()
        {
            var allRequests = await _fuelRequestsRepository.Get();

            var urgentRequests = allRequests
                .Where(x => (int)x.Priority == 3 && (int)x.Status == 1)
                .OrderBy(x => x.CreatedAt)
                .ToList();

            return urgentRequests;
        }

        private async Task<List<FuelRequestDetails>> BuildFuelRequestDetails(List<FuelRequest> requests)
        {
            var stations = await _stationsRepository.Get();
            var storages = await _storagesRepository.Get();
            var deliveries = await _deliveriesRepository.Get();

            return requests.Select(request =>
            {
                var station = stations.FirstOrDefault(s => s.Id == request.StationId);
                var delivery = request.Status == Status.Await ? null : PickDelivery(request, deliveries);
                var storage = delivery is null ? null : storages.FirstOrDefault(s => s.Id == delivery.StorageId);

                return new FuelRequestDetails
                {
                    Id = request.Id,
                    StationId = request.StationId,
                    StationName = station?.Name ?? string.Empty,
                    StorageId = storage?.Id,
                    StorageName = storage?.Name,
                    DeliveryId = delivery?.Id,
                    FuelAmount = request.FuelAmount,
                    Priority = request.Priority,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt,
                    DistanceKm = station is not null && storage is not null
                        ? CalculateDistanceKm(station.Latitude, station.Longitude, storage.Latitude, storage.Longitude)
                        : null
                };
            }).ToList();
        }

        private static Delivery? PickDelivery(FuelRequest request, List<Delivery> deliveries)
        {
            var requestDeliveries = deliveries
                .Where(d => d.RequestId == request.Id)
                .ToList();

            if (requestDeliveries.Count == 0)
            {
                return null;
            }

            if (request.Status == Status.InProgress)
            {
                return requestDeliveries
                    .FirstOrDefault(d => d.Status == Status.InProgress)
                    ?? requestDeliveries.OrderByDescending(d => d.CreatedAt).First();
            }

            return requestDeliveries
                .FirstOrDefault(d => d.Status == Status.Done)
                ?? requestDeliveries.OrderByDescending(d => d.CreatedAt).First();
        }

        private static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            const double earthRadiusKm = 6371;
            var dLat = DegreesToRadians(lat2 - lat1);
            var dLon = DegreesToRadians(lon2 - lon1);
            var a =
                Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) *
                Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) *
                Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return earthRadiusKm * c;
        }

        private static double DegreesToRadians(double degrees)
        {
            return degrees * Math.PI / 180;
        }
    }
}
