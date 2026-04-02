using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class DeliveryService : IDeliveryService
    {
        private readonly IDeliveriesRepository _deliveriesRepository;

        public DeliveryService(IDeliveriesRepository deliveriesRepository)
        {
            _deliveriesRepository = deliveriesRepository;
        }

        public async Task<Guid> CreateDelivery(Delivery delivery)
        {
            return await _deliveriesRepository.Create(delivery);
        }

        public async Task<List<Delivery>> GetAllDeliveries()
        {
            return await _deliveriesRepository.Get();
        }

        public async Task<Guid> UpdateDelivery(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt)
        {
            return await _deliveriesRepository.Update(id, requestId, storageId, deliveredAmount, status, createdAt);
        }

        public async Task<Guid> DeleteDelivery(Guid id)
        {
            return await _deliveriesRepository.Delete(id);
        }
    }
}
