using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fulogi.DataAccess.Repositories
{
    public class StoragesRepository : IStoragesRepository
    {
        private readonly FulogiDbContext _context;

        public StoragesRepository(FulogiDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Create(Storage storage)
        {
            var entity = new StorageEntity
            {
                Id = storage.Id,
                Name = storage.Name,
                Latitude = storage.Latitude,
                Longitude = storage.Longitude,
                FuelItems = storage.FuelItems.Select(f => new StorageFuelItemEntity
                {
                    Id = f.Id,
                    StorageId = storage.Id,
                    FuelType = f.FuelType,
                    Amount = f.Amount
                }).ToList()
            };

            await _context.Storages.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }

        public async Task<List<Storage>> Get()
        {
            var entities = await _context.Storages.Include(s => s.FuelItems).AsNoTracking().ToListAsync();

            return entities
                .Select(s => Storage.Create(
                    s.Id, 
                    s.Name ?? string.Empty, 
                    s.Latitude, 
                    s.Longitude, 
                    s.FuelItems.Select(f => new StorageFuelItem { Id = f.Id, StorageId = f.StorageId, FuelType = f.FuelType, Amount = f.Amount }).ToList()
                ).Storage)
                .ToList();
        }

        public async Task<Guid> Update(Guid id, string name, double latitude, double longitude, List<StorageFuelItem> fuelItems)
        {
            var updatedCount = await _context.Storages
                .Where(s => s.Id == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(b => b.Name, _ => name)
                    .SetProperty(b => b.Latitude, _ => latitude)
                    .SetProperty(b => b.Longitude, _ => longitude));

            var existingItems = await _context.Set<StorageFuelItemEntity>().Where(f => f.StorageId == id).ToListAsync();
            _context.Set<StorageFuelItemEntity>().RemoveRange(existingItems);

            var newItems = fuelItems.Select(f => new StorageFuelItemEntity
            {
                Id = f.Id,
                StorageId = id,
                FuelType = f.FuelType,
                Amount = f.Amount
            });
            await _context.Set<StorageFuelItemEntity>().AddRangeAsync(newItems);
            
            await _context.SaveChangesAsync();

            if (updatedCount == 0)
            {
                throw new KeyNotFoundException("Storage was not found.");
            }

            return id;
        }

        public async Task<Guid> Delete(Guid id)
        {
            var storageExists = await _context.Storages
                .AsNoTracking()
                .AnyAsync(s => s.Id == id);

            if (!storageExists)
            {
                throw new KeyNotFoundException("Storage was not found.");
            }

            await _context.Deliveries
                .Where(d => d.StorageId == id)
                .ExecuteDeleteAsync();

            var deletedCount = await _context.Storages
                .Where(s => s.Id == id)
                .ExecuteDeleteAsync();

            if (deletedCount == 0)
            {
                throw new KeyNotFoundException("Storage was not found.");
            }

            return id;
        }
    }
}