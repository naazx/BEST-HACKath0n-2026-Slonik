using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class FuelRequest
    {
        public Guid Id { get; }
        public Guid StationId { get; }
        public double FuelAmount { get; }
        public Priority Priority { get; }
        public Status Status { get; }
        public DateTime CreatedAt { get; }

        private FuelRequest(Guid id, Guid stationId, double fuelAmount, Priority priority, Status status, DateTime createdAt)
        {
            Id = id;
            StationId = stationId;
            FuelAmount = fuelAmount;
            Priority = priority;
            Status = status;
            CreatedAt = createdAt;
        }

        public static (FuelRequest FuelRequest, string Error) Create(
            Guid id,
            Guid stationId,
            double fuelAmount,
            Priority priority,
            Status status,
            DateTime createdAt)
        {
            var errors = new List<string>();
            if (stationId == Guid.Empty)
                errors.Add("StationId is required.");
            if (fuelAmount <= 0)
                errors.Add("Fuel amount must be greater than zero.");

            var fuelRequest = new FuelRequest(id, stationId, fuelAmount, priority, status, createdAt);
            return (fuelRequest, string.Join("; ", errors));
        }
    }
}
