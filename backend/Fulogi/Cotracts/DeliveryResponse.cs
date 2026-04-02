using Fulogi.Core.Enums;

namespace Fulogi.Cotracts
{
    public record DeliveryResponse(
        Guid Id,
        Guid RequestId,
        Guid StorageId,
        double DeliveredAmount,
        Status Status,
        DateTime CreatedAt);
}
