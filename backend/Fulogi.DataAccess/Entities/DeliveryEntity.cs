using Fulogi.DataAccess.Enums;

namespace Fulogi.DataAccess.Entities
{
    public class DeliveryEntity
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid StorageId { get; set; }
        public double DeliveredAmount { get; set; }
        public Status Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
