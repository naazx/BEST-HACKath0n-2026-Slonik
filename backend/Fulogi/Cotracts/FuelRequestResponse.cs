using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record FuelRequestResponse(
        Guid Id,
        Guid StationId,
        string StationName,
        Guid? StorageId,
        string? StorageName,
        Guid? DeliveryId,
        double FuelAmount,
        Priority Priority,
        Status Status,
        DateTime CreatedAt,
        double? DistanceKm);
}
