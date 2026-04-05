using Fulogi.Core.Enums;

namespace Fulogi.Core.Models
{
    public class FuelRequest
    {
        public Guid Id { get; init; }
        public Guid StationId { get; init; }
        public Priority Priority { get; init; }
        public Status Status { get; init; }
        public DateTime CreatedAt { get; init; }

        private readonly List<FuelRequestItem> _items = new();
        public IReadOnlyCollection<FuelRequestItem> Items => _items.AsReadOnly();

        private FuelRequest(Guid id, Guid stationId, Priority priority, Status status, DateTime createdAt)
        {
            Id = id;
            StationId = stationId;
            Priority = priority;
            Status = status;
            CreatedAt = createdAt;
        }

        public record RequestItemDto(FuelType FuelType, double Amount);

        /// <summary>
        /// Creates a new FuelRequest instance with validation.
        /// </summary>
        /// <param name="id">The unique identifier for the fuel request.</param>
        /// <param name="stationId">The identifier of the station making the request.</param>
        /// <param name="priority">The priority of the request.</param>
        /// <param name="status">The status of the request.</param>
        /// <param name="createdAt">The creation date and time of the request.</param>
        /// <param name="requestedItems">A list of requested fuel items.</param>
        /// <returns>
        /// A tuple containing the created FuelRequest (or null if validation fails) and an error message if any.
        /// </returns>
        public static (FuelRequest? FuelRequest, string Error) Create(
            Guid id,
            Guid stationId,
            Priority priority,
            Status status,
            DateTime createdAt,
            List<RequestItemDto> requestedItems) 
        {
            var errors = new List<string>();

            if (stationId == Guid.Empty)
                errors.Add("StationId is required.");

            if (requestedItems == null || !requestedItems.Any())
            {
                errors.Add("Request must contain at least one fuel item.");
            }
            else
            {
                // ВИПРАВЛЕНО: тут має додаватися помилка, а не починатися цикл
                if (requestedItems.Any(i => i.Amount <= 0))
                    errors.Add("All fuel amounts must be greater than zero.");
                var duplicates = requestedItems.GroupBy(i => i.FuelType).Where(g => g.Count() > 1);
                if (duplicates.Any())
                    errors.Add("Duplicate fuel types in a single request are not allowed.");
            }

            if (errors.Any())
                return (null, string.Join("; ", errors));

            var fuelRequest = new FuelRequest(id, stationId, priority, status, createdAt);

            foreach (var item in requestedItems!)
            {
                var requestItem = new FuelRequestItem(Guid.NewGuid(), id, item.FuelType, item.Amount);
                fuelRequest._items.Add(requestItem);
            }

            return (fuelRequest, string.Empty);
        }
    }
}