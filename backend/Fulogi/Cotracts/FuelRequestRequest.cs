using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record FuelRequestRequest(
        Guid StationId,
        double FuelAmount,
        Priority Priority,
        Status Status,
        DateTime CreatedAt);
}
