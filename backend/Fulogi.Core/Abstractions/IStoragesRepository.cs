using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IStoragesRepository
    {
        Task<Guid> Create(Storage storage);
        Task<Guid> Delete(Guid id);
        Task<List<Storage>> Get();
        Task<Guid> Update(Guid id, string name, double latitude, double longitude, List<StorageFuelItem> fuelItems);
    }
}