using Fulogi.DataAccess.Enums;
using System.Collections.Generic;

namespace Fulogi.DataAccess.Entities
{
    public class FuelRequestEntity
    {
        public Guid Id { get; set; }
        public Guid StationId { get; set; }
        
        public ICollection<FuelRequestItemEntity> Items { get; set; } = new List<FuelRequestItemEntity>();
        
        public Priority Priority { get; set; }
        public Status Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}