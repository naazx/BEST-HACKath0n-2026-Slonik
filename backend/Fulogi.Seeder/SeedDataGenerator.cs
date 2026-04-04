using Fulogi.DataAccess.Entities;
using Fulogi.DataAccess.Enums;

namespace Fulogi.Seeder;

internal static class SeedDataGenerator
{
    private static readonly (string Name, double Latitude, double Longitude)[] StationTemplates =
    [
        ("Downtown Station", 50.4501, 30.5234),
        ("Airport Station", 50.4019, 30.4497),
        ("Suburban Station", 50.4733, 30.6100),
        ("Highway Station", 50.5200, 30.5500),
        ("River Point Station", 50.4700, 30.6400),
        ("North Gate Station", 50.5500, 30.5800),
        ("South Park Station", 50.3800, 30.5200),
        ("West End Station", 50.4555, 30.4300)
    ];

    private static readonly (string Name, double Latitude, double Longitude, double FuelAvailable)[] StorageTemplates =
    [
        ("Central Warehouse", 50.4550, 30.5150, 85000),
        ("North Depot", 50.5205, 30.6001, 42000),
        ("East Storage", 50.4705, 30.7004, 39000),
        ("South Terminal", 50.3508, 30.5202, 61000),
        ("West Reserve", 50.4400, 30.3600, 28000),
        ("City Backup", 50.4900, 30.4700, 51000)
    ];

    internal static List<StationEntity> GenerateStations(int count, Random random)
    {
        return PickTemplateRange(count, StationTemplates)
            .Select(template => new StationEntity
            {
                Id = Guid.NewGuid(),
                Name = template.Name,
                Latitude = Jitter(template.Latitude, random, 0.02),
                Longitude = Jitter(template.Longitude, random, 0.02)
            })
            .ToList();
    }

    internal static List<StorageEntity> GenerateStorages(int count, Random random)
    {
        return PickTemplateRange(count, StorageTemplates)
            .Select(template => new StorageEntity
            {
                Id = Guid.NewGuid(),
                Name = template.Name,
                Latitude = Jitter(template.Latitude, random, 0.02),
                Longitude = Jitter(template.Longitude, random, 0.02),
                FuelAvailable = Math.Round(template.FuelAvailable + random.Next(-6000, 6001), 2)
            })
            .ToList();
    }

    internal static List<FuelRequestEntity> GenerateFuelRequests(int count, IReadOnlyList<StationEntity> stations, Random random)
    {
        if (count <= 0 || stations.Count == 0)
        {
            return [];
        }

        var priorities = Enum.GetValues<Priority>();
        var statuses = Enum.GetValues<Status>();
        var requests = new List<FuelRequestEntity>(count);

        for (var index = 0; index < count; index++)
        {
            requests.Add(new FuelRequestEntity
            {
                Id = Guid.NewGuid(),
                StationId = stations[random.Next(stations.Count)].Id,
                FuelAmount = random.Next(800, 12000),
                Priority = priorities[random.Next(priorities.Length)],
                Status = statuses[random.Next(statuses.Length)],
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(0, 14)).AddMinutes(-random.Next(0, 1440))
            });
        }

        return requests;
    }

    internal static List<DeliveryEntity> GenerateDeliveries(IReadOnlyList<FuelRequestEntity> requests, IReadOnlyList<StorageEntity> storages, Random random)
    {
        if (requests.Count == 0 || storages.Count == 0)
        {
            return [];
        }

        var deliveries = new List<DeliveryEntity>();

        foreach (var request in requests)
        {
            if (random.NextDouble() < 0.25)
            {
                continue;
            }

            var isCompleted = request.Status == Status.Done;
            var deliveredAmount = isCompleted
                ? request.FuelAmount
                : Math.Max(200, request.FuelAmount * (0.4 + random.NextDouble() * 0.6));

            deliveries.Add(new DeliveryEntity
            {
                Id = Guid.NewGuid(),
                RequestId = request.Id,
                StorageId = storages[random.Next(storages.Count)].Id,
                DeliveredAmount = deliveredAmount,
                Status = isCompleted ? Status.Done : RandomDeliveryStatus(random),
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(0, 10)).AddMinutes(-random.Next(0, 1440))
            });
        }

        return deliveries;
    }

    private static IEnumerable<TTemplate> PickTemplateRange<TTemplate>(int count, IReadOnlyList<TTemplate> templates)
    {
        if (count <= 0 || templates.Count == 0)
        {
            return [];
        }

        return Enumerable.Range(0, count)
            .Select(index => templates[index % templates.Count]);
    }

    private static double Jitter(double value, Random random, double range)
    {
        return Math.Round(value + (random.NextDouble() * 2 - 1) * range, 6);
    }

    private static Status RandomDeliveryStatus(Random random)
    {
        var statuses = new[] { Status.Await, Status.InProgress, Status.Done };
        return statuses[random.Next(statuses.Length)];
    }
}