using System;
using Fulogi.Core.Enums; 

namespace Fulogi.DataAccess.Entities
{
    public class FuelRequestItemEntity
    {
        public Guid Id { get; set; }
        
        public Guid FuelRequestId { get; set; }
        public FuelRequestEntity FuelRequest { get; set; } = null!;
        
        public FuelType FuelType { get; set; }
        public double Amount { get; set; }
    }
}