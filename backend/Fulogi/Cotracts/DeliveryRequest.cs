using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record DeliveryRequest(
        Guid RequestId,
        Guid StorageId,
        double DeliveredAmount,
        Status Status,
        DateTime CreatedAt);
}
