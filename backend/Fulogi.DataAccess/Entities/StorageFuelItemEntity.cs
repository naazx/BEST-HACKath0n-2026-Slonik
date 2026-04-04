using Fulogi.Core.Enums;

namespace Fulogi.DataAccess.Entities
{
    public class StorageFuelItemEntity
    {
        public Guid Id { get; set; }
        public Guid StorageId { get; set; }
        public FuelType FuelType { get; set; }
        public double Amount { get; set; }
    }
}