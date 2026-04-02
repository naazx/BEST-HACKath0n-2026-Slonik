using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class StationService : IStationService
    {
        private readonly IStationsRepository _stationsRepository;

        public StationService(IStationsRepository stationsRepository)
        {
            _stationsRepository = stationsRepository;
        }
        public async Task<Guid> CreateStation(Station station)
        {
            return await _stationsRepository.Create(station);
        }
        public async Task<List<Station>> GetAllStations()
        {
            return await _stationsRepository.Get();
        }
        public async Task<Guid> UpdateStation(Guid id, string name, double latitude, double longitude)
        {
            return await _stationsRepository.Update(id, name, latitude, longitude);
        }
        public async Task<Guid> DeleteStation(Guid id)
        {
            return await _stationsRepository.Delete(id);

        }
    }
}
