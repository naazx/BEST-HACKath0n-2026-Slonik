using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IDeliveryService
    {
        Task<Guid> CreateDelivery(Delivery delivery);
        Task<Guid> DeleteDelivery(Guid id);
        Task<List<Delivery>> GetAllDeliveries();
        Task<Guid> UpdateDelivery(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt);
    }
}
