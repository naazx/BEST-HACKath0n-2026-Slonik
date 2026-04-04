using Fulogi.Core.Enums;
using System.Collections.Generic;

namespace Fulogi.Cotracts
{
    public record FuelItemResponse(Guid Id, FuelType FuelType, double Amount);

    public record FuelRequestResponse(
        Guid Id,
        Guid StationId,
        string StationName,
        Guid? StorageId,
        string? StorageName,
        Guid? DeliveryId,
        List<FuelItemResponse> Items,
        Priority Priority,
        Status Status,
        DateTime CreatedAt,
        double? DistanceKm);
}