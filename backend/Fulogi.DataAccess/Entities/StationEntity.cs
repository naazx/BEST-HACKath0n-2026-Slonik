namespace Fulogi.DataAccess.Entities
{
    public class StationEntity
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}
