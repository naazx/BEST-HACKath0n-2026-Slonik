using Fulogi.Core.Models;

namespace Fulogi.Core.Abstractions
{
    public interface IStorageService
    {
        Task<Guid> CreateStorage(Storage storage);
        Task<Guid> DeleteStorage(Guid id);
        Task<List<Storage>> GetAllStorages();
        Task<Guid> UpdateStorage(Guid id, string name, double latitude, double longitude, double fuelAvailable);
    }
}
