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

            var stations = entities.Select(s => Station.Create(s.Id, s.Name ?? string.Empty, s.Latitude, s.Longitude).Station).ToList();

            return stations;
        }
        public async Task<Guid> Update(Guid id, string name, double latitude, double longitude)
        {
            await _context.Stations.Where(s => s.Id == id)
                .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.Name, b => name)
                .SetProperty(b => b.Latitude, b => latitude)
                .SetProperty(b => b.Longitude, b => longitude)
            );
            return id;
        }
        public async Task<Guid> Delete(Guid id)
        {
            await _context.Stations.Where(s => s.Id == id)
                .ExecuteDeleteAsync();
            return id;
        }
    }
}