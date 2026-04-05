using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record StorageFuelItemDto(
        FuelType FuelType, 
        double Amount);
}