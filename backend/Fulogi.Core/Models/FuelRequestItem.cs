using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class FuelRequestItem
    {
        public Guid Id { get; }
        public Guid FuelRequestId { get; } 
        public FuelType FuelType { get; }
        public double Amount { get; }

        internal FuelRequestItem(Guid id, Guid fuelRequestId, FuelType fuelType, double amount)
        {
            Id = id;
            FuelRequestId = fuelRequestId;
            FuelType = fuelType;
            Amount = amount;
        }
    }
}