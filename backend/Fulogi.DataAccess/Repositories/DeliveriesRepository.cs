using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;
using Fulogi.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;
using DataStatus = Fulogi.DataAccess.Enums.Status;

namespace Fulogi.DataAccess.Repositories
{
    public class DeliveriesRepository : IDeliveriesRepository
    {
        private readonly FulogiDbContext _context;

        public DeliveriesRepository(FulogiDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Create(Delivery delivery)
        {
            var entity = new DeliveryEntity
            {
                Id = delivery.Id,
                RequestId = delivery.RequestId,
                StorageId = delivery.StorageId,
                DeliveredAmount = delivery.DeliveredAmount,
                Status = (DataStatus)delivery.Status,
                CreatedAt = delivery.CreatedAt
            };

            await _context.Deliveries.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }

        public async Task<List<Delivery>> Get()
        {
            var entities = await _context.Deliveries.AsNoTracking().ToListAsync();

            return entities
                .Select(d => Delivery.Create(
                    d.Id,
                    d.RequestId,
                    d.StorageId,
                    d.DeliveredAmount,
                    (Status)d.Status,
                    d.CreatedAt).Delivery)
                .ToList();
        }

        public async Task<Guid> Update(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt)
        {
            await _context.Deliveries
                .Where(d => d.Id == id)
                .ExecuteUpdateAsync(d => d
                    .SetProperty(b => b.RequestId, _ => requestId)
                    .SetProperty(b => b.StorageId, _ => storageId)
                    .SetProperty(b => b.DeliveredAmount, _ => deliveredAmount)
                    .SetProperty(b => b.Status, _ => (DataStatus)status)
                    .SetProperty(b => b.CreatedAt, _ => createdAt));

            return id;
        }

        public async Task<Guid> Delete(Guid id)
        {
            await _context.Deliveries
                .Where(d => d.Id == id)
                .ExecuteDeleteAsync();

            return id;
        }
    }
}
