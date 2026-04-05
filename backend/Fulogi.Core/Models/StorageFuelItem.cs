using System.Text.Json.Serialization;
using Fulogi.Core.Enums;
namespace Fulogi.Core.Models;
public class StorageFuelItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StorageId { get; set; }
    
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public FuelType FuelType { get; set; } 
    
    public double Amount { get; set; }
}