using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;
using Fulogi.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fulogi.DataAccess.Repositories
{
    public class StationsRepository : IStationsRepository
    {
        private readonly FulogiDbContext _context;
        public StationsRepository(FulogiDbContext context)
        {
            _context = context;
        }
        public async Task<Guid> Create(Station station)
        {
            var entity = new StationEntity
            {
                Id = station.Id,
                Name = station.Name,
                Latitude = station.Latitude,
                Longitude = station.Longitude
            };
            await _context.Stations.AddAsync(entity);
            await _context.SaveChangesAsync();

            return entity.Id;
        }
        public async Task<List<Station>> Get()
        {
            var entities = await _context.Stations.AsNoTracking().ToListAsync();

            var stations = entities.Select(s => Station.Create(s.Id, s.Name, s.Latitude, s.Longitude).Station).ToList();

            return stations;
        }
        public async Task<Guid> Update(Guid id, string name, double latitude, double longitude)
        {
            var updatedCount = await _context.Stations.Where(s => s.Id == id)
                .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.Name, b => name)
                .SetProperty(b => b.Latitude, b => latitude)
                .SetProperty(b => b.Longitude, b => longitude)
            );

            if (updatedCount == 0)
            {
                throw new KeyNotFoundException("Station was not found.");
            }

            return id;
        }
        public async Task<Guid> Delete(Guid id)
        {
            var stationExists = await _context.Stations
                .AsNoTracking()
                .AnyAsync(s => s.Id == id);

            if (!stationExists)
            {
                throw new KeyNotFoundException("Station was not found.");
            }

            var fuelRequestIds = await _context.FuelRequests
                .AsNoTracking()
                .Where(f => f.StationId == id)
                .Select(f => f.Id)
                .ToListAsync();

            if (fuelRequestIds.Count > 0)
            {
                await _context.Deliveries
                    .Where(d => fuelRequestIds.Contains(d.RequestId))
                    .ExecuteDeleteAsync();

                await _context.FuelRequests
                    .Where(f => f.StationId == id)
                    .ExecuteDeleteAsync();
            }

            var deletedCount = await _context.Stations
                .Where(s => s.Id == id)
                .ExecuteDeleteAsync();

            if (deletedCount == 0)
            {
                throw new KeyNotFoundException("Station was not found.");
            }

            return id;
        }
    }
}
