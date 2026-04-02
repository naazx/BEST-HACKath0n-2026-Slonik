using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record FuelRequestResponse(
        Guid Id,
        Guid StationId,
        double FuelAmount,
        Priority Priority,
        Status Status,
        DateTime CreatedAt);
}
