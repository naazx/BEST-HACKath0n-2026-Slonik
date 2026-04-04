namespace Fulogi.DataAccess.Entities
{
    public class StorageEntity
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double FuelAvailable { get; set; }
    }
}
