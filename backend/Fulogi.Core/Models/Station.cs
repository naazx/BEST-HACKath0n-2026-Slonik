namespace Fulogi.Core.Models
{
    public class Station
    {
        public const int MAX_NAME_LENGTH = 100;
        public Guid Id { get; }
        public string Name { get; }
        public double Latitude { get; }
        public double Longitude { get; }

        private Station(Guid id, string name, double latitude, double longitude)
        {
            Id = id;
            Name = name;
            Latitude = latitude;
            Longitude = longitude;
        }

        public static (Station Station, string Error) Create(Guid id, string name, double latitude, double longitude)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(name) || name.Length > MAX_NAME_LENGTH)
                errors.Add($"Name must be between 1 and {MAX_NAME_LENGTH} characters.");

            if (latitude < -90 || latitude > 90)
                errors.Add("Latitude must be between -90 and 90.");

            if (longitude < -180 || longitude > 180)
                errors.Add("Longitude must be between -180 and 180.");

            var station = new Station(id, name, latitude, longitude);

            return (station, string.Join("; ", errors));
        }
    }
}