using Fulogi.Core.Enums;
using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IDeliveriesRepository
    {
        Task<Guid> Create(Delivery delivery);
        Task<Guid> Delete(Guid id);
        Task<List<Delivery>> Get();
        Task<Guid> Update(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt);
    }
}
