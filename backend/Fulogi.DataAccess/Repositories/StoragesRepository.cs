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
                FuelAvailable = storage.FuelAvailable
            };

            await _context.Storages.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }

        public async Task<List<Storage>> Get()
        {
            var entities = await _context.Storages.AsNoTracking().ToListAsync();

            return entities
                .Select(s => Storage.Create(s.Id, s.Name ?? string.Empty, s.Latitude, s.Longitude, s.FuelAvailable).Storage)
                .ToList();
        }

        public async Task<Guid> Update(Guid id, string name, double latitude, double longitude, double fuelAvailable)
        {
            await _context.Storages
                .Where(s => s.Id == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(b => b.Name, _ => name)
                    .SetProperty(b => b.Latitude, _ => latitude)
                    .SetProperty(b => b.Longitude, _ => longitude)
                    .SetProperty(b => b.FuelAvailable, _ => fuelAvailable));

            return id;
        }

        public async Task<Guid> Delete(Guid id)
        {
            await _context.Storages
                .Where(s => s.Id == id)
                .ExecuteDeleteAsync();

            return id;
        }
    }
}
