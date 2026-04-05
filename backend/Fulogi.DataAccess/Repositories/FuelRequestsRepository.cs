using Fulogi.Core.Abstractions;
using Fulogi.Core.Enums;
using Fulogi.Core.Models;
using Fulogi.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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
                Priority = (DataPriority)fuelRequest.Priority,
                Status = (DataStatus)fuelRequest.Status,
                CreatedAt = fuelRequest.CreatedAt,
                Items = fuelRequest.Items.Select(i => new FuelRequestItemEntity
                {
                    Id = Guid.NewGuid(),
                    FuelRequestId = fuelRequest.Id,
                    FuelType = i.FuelType,
                    Amount = i.Amount
                }).ToList()
            };

            await _context.FuelRequests.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }

        public async Task<List<FuelRequest>> Get()
        {
            var entities = await _context.FuelRequests
                .Include(f => f.Items)
                .AsNoTracking()
                .ToListAsync();

            return entities
                .Select(f => FuelRequest.Create(
                    f.Id,
                    f.StationId,
                    (Priority)f.Priority,
                    (Status)f.Status,
                    f.CreatedAt,
                    f.Items.Select(i => new FuelRequest.RequestItemDto(i.FuelType, i.Amount)).ToList()
                ).FuelRequest!)
                .ToList();
        }

        public async Task<Guid> Update(Guid id, Guid stationId, List<FuelRequest.RequestItemDto> items, Priority priority, Status status, DateTime createdAt)
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

            var entity = await _context.FuelRequests
                .FirstOrDefaultAsync(f => f.Id == id);

            if (entity == null)
            {
                return id;
            }

            entity.StationId = stationId;
            entity.Priority = (DataPriority)priority;
            entity.Status = (DataStatus)status;
            entity.CreatedAt = createdAt;

            await using var transaction = await _context.Database.BeginTransactionAsync();

            await _context.FuelRequestItems
                .Where(item => item.FuelRequestId == id)
                .ExecuteDeleteAsync();

            var itemEntities = items.Select(item => new FuelRequestItemEntity
                {
                    Id = Guid.NewGuid(),
                    FuelRequestId = id,
                    FuelType = item.FuelType,
                    Amount = item.Amount
                })
                .ToList();

            await _context.FuelRequestItems.AddRangeAsync(itemEntities);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

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
