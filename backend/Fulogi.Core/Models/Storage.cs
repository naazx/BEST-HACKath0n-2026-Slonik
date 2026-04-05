using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class Storage
    {
        public const int MAX_NAME_LENGTH = 100;
        public Guid Id { get; }
        public string Name { get; }
        public double Latitude { get; }
        public double Longitude { get; }
        
        public List<StorageFuelItem> FuelItems { get; }

        private Storage(Guid id, string name, double latitude, double longitude, List<StorageFuelItem> fuelItems)
        {
            Id = id;
            Name = name;
            Latitude = latitude;
            Longitude = longitude;
            FuelItems = fuelItems ?? new List<StorageFuelItem>();
        }

        public static (Storage Storage, string Error) Create(Guid id, string name, double latitude, double longitude, List<StorageFuelItem> fuelItems)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(name) || name.Length > MAX_NAME_LENGTH)
                errors.Add($"Name must be between 1 and {MAX_NAME_LENGTH} characters.");

            if (latitude < -90 || latitude > 90)
                errors.Add("Latitude must be between -90 and 90.");

            if (longitude < -180 || longitude > 180)
                errors.Add("Longitude must be between -180 and 180.");

            if (fuelItems != null && fuelItems.Any())
            {
                if (fuelItems.Any(item => item.Amount < 0))
                {
                    errors.Add("Fuel amounts cannot be negative.");
                }

                var hasDuplicates = fuelItems.GroupBy(x => x.FuelType).Any(g => g.Count() > 1);
                if (hasDuplicates)
                {
                    errors.Add("Storage cannot contain duplicate fuel types in the list.");
                }
            }

            var storage = new Storage(id, name, latitude, longitude, fuelItems ?? new List<StorageFuelItem>());

            return (storage, string.Join("; ", errors));
        }
    }
}