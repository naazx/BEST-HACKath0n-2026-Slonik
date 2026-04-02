using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IStationsRepository
    {
        Task<Guid> Create(Station station);
        Task<Guid> Delete(Guid id);
        Task<List<Station>> Get();
        Task<Guid> Update(Guid id, string name, double latitude, double longitude);
    }
}