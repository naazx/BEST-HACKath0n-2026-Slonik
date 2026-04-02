using Fulogi.Core.Abstractions;
using Fulogi.Core.Models;

namespace Fulogi.Application.Services
{
    public class StorageService : IStorageService
    {
        private readonly IStoragesRepository _storagesRepository;

        public StorageService(IStoragesRepository storagesRepository)
        {
            _storagesRepository = storagesRepository;
        }

        public async Task<Guid> CreateStorage(Storage storage)
        {
            return await _storagesRepository.Create(storage);
        }

        public async Task<List<Storage>> GetAllStorages()
        {
            return await _storagesRepository.Get();
        }

        public async Task<Guid> UpdateStorage(Guid id, string name, double latitude, double longitude, double fuelAvailable)
        {
            return await _storagesRepository.Update(id, name, latitude, longitude, fuelAvailable);
        }

        public async Task<Guid> DeleteStorage(Guid id)
        {
            return await _storagesRepository.Delete(id);
        }
    }
}
