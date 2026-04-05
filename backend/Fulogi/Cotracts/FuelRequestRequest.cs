using Fulogi.Core.Enums;

namespace Fulogi.Cotracts 
{
    public record FuelItemRequest(FuelType FuelType, double Amount);

    public record FuelRequestRequest(
        Guid StationId,
        Priority Priority,
        Status Status,
        DateTime CreatedAt,
        List<FuelItemRequest> Items
    );
}