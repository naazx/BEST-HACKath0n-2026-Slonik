namespace Fulogi.Cotracts
{
    public record StorageRequest(
        string Name,
        double Latitude,
        double Longitude,
        List<StorageFuelItemDto> FuelItems);
}