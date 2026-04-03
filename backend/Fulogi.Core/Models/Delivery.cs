using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class Delivery
    {
        public Guid Id { get; }
        public Guid RequestId { get; }
        public Guid StorageId { get; }
        public double DeliveredAmount { get; }
        public Status Status { get; }
        public DateTime CreatedAt { get; }

        private Delivery(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt)
        {
            Id = id;
            RequestId = requestId;
            StorageId = storageId;
            DeliveredAmount = deliveredAmount;
            Status = status;
            CreatedAt = createdAt;
        }
        public static (Delivery Delivery, string Error) Create(Guid id, Guid requestId, Guid storageId, double deliveredAmount, Status status, DateTime createdAt)
        {
            var errors = new List<string>();
            if (deliveredAmount <= 0)
                errors.Add("Delivered amount must be greater than zero.");

            var delivery = new Delivery(id, requestId, storageId, deliveredAmount, status, createdAt);

            return (delivery, string.Join("; ", errors));
        }
    }
}
