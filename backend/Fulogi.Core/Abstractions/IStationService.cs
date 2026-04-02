using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IStationService
    {
        Task<Guid> CreateStation(Station station);
        Task<Guid> DeleteStation(Guid id);
        Task<List<Station>> GetAllStations();
        Task<Guid> UpdateStation(Guid id, string name, double latitude, double longitude);
    }
}