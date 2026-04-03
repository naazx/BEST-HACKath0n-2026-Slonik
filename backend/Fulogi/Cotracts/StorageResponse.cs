namespace Fulogi.Cotracts
{
    public record StorageResponse(
        Guid Id,
        string Name,
        double Latitude,
        double Longitude,
        double FuelAvailable);
}
