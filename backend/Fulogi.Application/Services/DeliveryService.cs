using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class DeliveryService : IDeliveryService
    {
        private readonly IDeliveriesRepository _deliveriesRepository;
        private readonly IStoragesRepository _storagesRepository;

        public DeliveryService(IDeliveriesRepository deliveriesRepository, IStoragesRepository storagesRepository)
        {
            _deliveriesRepository = deliveriesRepository;
            _storagesRepository = storagesRepository;
        }

        public async Task<Guid> CreateDelivery(Delivery delivery)
        {
            await EnsureStorageHasEnoughFuel(delivery.StorageId, delivery.DeliveredAmount);
            return await _deliveriesRepository.Create(delivery);
        }

        public async Task<List<Delivery>> GetAllDeliveries()
        {
            return await _deliveriesRepository.Get();
        }

        public async Task<Guid> UpdateDelivery(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt)
        {
            await EnsureStorageHasEnoughFuel(storageId, deliveredAmount);
            return await _deliveriesRepository.Update(id, requestId, storageId, deliveredAmount, status, createdAt);
        }

        public async Task<Guid> DeleteDelivery(Guid id)
        {
            return await _deliveriesRepository.Delete(id);
        }

        private async Task EnsureStorageHasEnoughFuel(Guid storageId, double requiredAmount)
        {
            var storages = await _storagesRepository.Get();
            var storage = storages.FirstOrDefault(s => s.Id == storageId);

            if (storage is null)
            {
                throw new InvalidOperationException("Selected storage was not found.");
            }

            if (storage.FuelAvailable < requiredAmount)
            {
                throw new InvalidOperationException(
                    $"Not enough fuel in storage \"{storage.Name}\". Available: {storage.FuelAvailable:N0} L, required: {requiredAmount:N0} L.");
            }
        }
    }
}
