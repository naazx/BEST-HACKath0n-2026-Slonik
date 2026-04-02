using Fulogi.DataAccess.Enums;

namespace Fulogi.DataAccess.Entities
{
    public class FuelRequestEntity
    {
        public Guid Id { get; set; }
        public Guid StationId { get; set; }
        public double FuelAmount { get; set; }
        public Priority Priority { get; set; }
        public Status Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
