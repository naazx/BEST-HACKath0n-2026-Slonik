using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class FuelRequestDetails
    {
        public Guid Id { get; init; }
        public Guid StationId { get; init; }
        public string StationName { get; init; } = string.Empty;
        public Guid? StorageId { get; init; }
        public string? StorageName { get; init; }
        public Guid? DeliveryId { get; init; }
        public double FuelAmount { get; init; }
        public Priority Priority { get; init; }
        public Status Status { get; init; }
        public DateTime CreatedAt { get; init; }
        public double? DistanceKm { get; init; }
    }
}
