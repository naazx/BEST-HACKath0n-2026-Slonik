using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;
using Fulogi.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;
using DataPriority = Fulogi.DataAccess.Enums.Priority;
using DataStatus = Fulogi.DataAccess.Enums.Status;

namespace Fulogi.DataAccess.Repositories
{
    public class FuelRequestsRepository : IFuelRequestsRepository
    {
        private readonly FulogiDbContext _context;

        public FuelRequestsRepository(FulogiDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Create(FuelRequest fuelRequest)
        {
            var stationExists = await _context.Stations
                .AsNoTracking()
                .AnyAsync(s => s.Id == fuelRequest.StationId);

            if (!stationExists)
            {
                throw new InvalidOperationException("Cannot create fuel request because station does not exist.");
            }

            var entity = new FuelRequestEntity
            {
                Id = fuelRequest.Id,
                StationId = fuelRequest.StationId,
                FuelAmount = fuelRequest.FuelAmount,
                Priority = (DataPriority)fuelRequest.Priority,
                Status = (DataStatus)fuelRequest.Status,
                CreatedAt = fuelRequest.CreatedAt
            };

            await _context.FuelRequests.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }

        public async Task<List<FuelRequest>> Get()
        {
            var entities = await _context.FuelRequests.AsNoTracking().ToListAsync();

            return entities
                .Select(f => FuelRequest.Create(
                    f.Id,
                    f.StationId,
                    f.FuelAmount,
                    (Priority)f.Priority,
                    (Status)f.Status,
                    f.CreatedAt).FuelRequest)
                .ToList();
        }

        public async Task<Guid> Update(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt)
        {
            var fuelRequestExists = await _context.FuelRequests
                .AsNoTracking()
                .AnyAsync(f => f.Id == id);

            if (!fuelRequestExists)
            {
                throw new KeyNotFoundException("Fuel request was not found.");
            }

            var stationExists = await _context.Stations
                .AsNoTracking()
                .AnyAsync(s => s.Id == stationId);

            if (!stationExists)
            {
                throw new InvalidOperationException("Cannot update fuel request because station does not exist.");
            }

            await _context.FuelRequests
                .Where(f => f.Id == id)
                .ExecuteUpdateAsync(f => f
                    .SetProperty(b => b.StationId, _ => stationId)
                    .SetProperty(b => b.FuelAmount, _ => fuelAmount)
                    .SetProperty(b => b.Priority, _ => (DataPriority)priority)
                    .SetProperty(b => b.Status, _ => (DataStatus)status)
                    .SetProperty(b => b.CreatedAt, _ => createdAt));

            return id;
        }

        public async Task<Guid> Delete(Guid id)
        {
            var fuelRequestExists = await _context.FuelRequests
                .AsNoTracking()
                .AnyAsync(f => f.Id == id);

            if (!fuelRequestExists)
            {
                throw new KeyNotFoundException("Fuel request was not found.");
            }

            await _context.Deliveries
                .Where(d => d.RequestId == id)
                .ExecuteDeleteAsync();

            await _context.FuelRequests
                .Where(f => f.Id == id)
                .ExecuteDeleteAsync();

            return id;
        }
    }
}
