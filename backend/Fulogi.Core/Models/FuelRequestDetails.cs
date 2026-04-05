using Fulogi.Core.Enums;
using System.Collections.Generic; // Додано для використання List

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
        
        public List<FuelRequestItem> Items { get; init; } = new(); 
        
        public Priority Priority { get; init; }
        public Status Status { get; init; }
        public DateTime CreatedAt { get; init; }
        public double? DistanceKm { get; init; }
    }
}