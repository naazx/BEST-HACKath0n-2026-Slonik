namespace Fulogi.Core.Models
{
    public class Storage
    {
        public const int MAX_NAME_LENGTH = 100;
        public Guid Id { get; }
        public string Name { get; }
        public double Latitude { get; }
        public double Longitude { get; }
        public double FuelAvailable { get; }

        private Storage(Guid id, string name, double latitude, double longitude, double fuelAvailable)
        {
            Id = id;
            Name = name;
            Latitude = latitude;
            Longitude = longitude;
            FuelAvailable = fuelAvailable;
        }

        public static (Storage Storage, string Error) Create(Guid id, string name, double latitude, double longitude, double fuelAvailable)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(name) || name.Length > MAX_NAME_LENGTH)
                errors.Add($"Name must be between 1 and {MAX_NAME_LENGTH} characters.");

            if (latitude < -90 || latitude > 90)
                errors.Add("Latitude must be between -90 and 90.");

            if (longitude < -180 || longitude > 180)
                errors.Add("Longitude must be between -180 and 180.");
            if(fuelAvailable < 0)
                errors.Add("Fuel available cannot be negative.");

            var storage = new Storage(id, name, latitude, longitude, fuelAvailable);

            return (storage, string.Join("; ", errors));
        }
    }
}
