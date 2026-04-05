using Fulogi.DataAccess;
using Fulogi.DataAccess.Entities;
using Fulogi.DataAccess.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

internal static class DevelopmentDatabaseBootstrapper
{
    internal static async Task InitializeAsync(FulogiDbContext dbContext, string dbPath, bool isDevelopment)
    {
        if (isDevelopment && await HasLegacySchemaAsync(dbPath))
        {
            await dbContext.Database.EnsureDeletedAsync();
        }

        await dbContext.Database.MigrateAsync();

        if (isDevelopment && await IsEmptyAsync(dbContext))
        {
            await SeedAsync(dbContext);
        }
    }

    private static async Task<bool> HasLegacySchemaAsync(string dbPath)
    {
        if (!File.Exists(dbPath))
        {
            return false;
        }

        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync();

        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var tableCommand = connection.CreateCommand())
        {
            tableCommand.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table';";
            await using var reader = await tableCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                tables.Add(reader.GetString(0));
            }
        }

        if (tables.Contains("Stations") || tables.Contains("Storages") || tables.Contains("FuelRequests") || tables.Contains("Deliveries"))
        {
            return true;
        }

        if (!tables.Contains("FuelRequestItem") || !tables.Contains("StorageFuelItem"))
        {
            return true;
        }

        return await ColumnExistsAsync(connection, "Delivery", "WarehouseId")
            || await ColumnExistsAsync(connection, "Storage", "FuelAvailable")
            || await ColumnExistsAsync(connection, "FuelRequest", "FuelAmount")
            || await ColumnTypeMatchesAsync(connection, "FuelRequest", "Id", "INTEGER")
            || await ColumnTypeMatchesAsync(connection, "FuelRequest", "Priority", "TEXT")
            || await ColumnTypeMatchesAsync(connection, "FuelRequest", "Status", "TEXT");
    }

    private static async Task<bool> ColumnExistsAsync(SqliteConnection connection, string tableName, string columnName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task<bool> ColumnTypeMatchesAsync(SqliteConnection connection, string tableName, string columnName, string columnType)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return string.Equals(reader.GetString(2), columnType, StringComparison.OrdinalIgnoreCase);
            }
        }

        return false;
    }

    private static async Task<bool> IsEmptyAsync(FulogiDbContext dbContext)
    {
        return !await dbContext.Stations.AnyAsync()
            && !await dbContext.Storages.AnyAsync()
            && !await dbContext.FuelRequests.AnyAsync()
            && !await dbContext.Deliveries.AnyAsync();
    }

    private static async Task SeedAsync(FulogiDbContext dbContext)
    {
        var random = new Random(20260405);

        var stations = GenerateStations(8, random);
        var storages = GenerateStorages(4, random);
        var fuelRequests = GenerateFuelRequests(24, stations, random);
        var deliveries = GenerateDeliveries(fuelRequests, storages, random);

        await dbContext.Stations.AddRangeAsync(stations);
        await dbContext.Storages.AddRangeAsync(storages);
        await dbContext.FuelRequests.AddRangeAsync(fuelRequests);
        await dbContext.Deliveries.AddRangeAsync(deliveries);
        await dbContext.SaveChangesAsync();
    }

    private static List<StationEntity> GenerateStations(int count, Random random)
    {
        var templates = new (string Name, double Latitude, double Longitude)[]
        {
            ("Downtown Station", 50.4501, 30.5234),
            ("Airport Station", 50.4019, 30.4497),
            ("Suburban Station", 50.4733, 30.6100),
            ("Highway Station", 50.5200, 30.5500),
            ("River Point Station", 50.4700, 30.6400),
            ("North Gate Station", 50.5500, 30.5800),
            ("South Park Station", 50.3800, 30.5200),
            ("West End Station", 50.4555, 30.4300)
        };

        return Enumerable.Range(0, count)
            .Select(index => templates[index % templates.Length])
            .Select(template => new StationEntity
            {
                Id = Guid.NewGuid(),
                Name = template.Name,
                Latitude = Jitter(template.Latitude, random, 0.02),
                Longitude = Jitter(template.Longitude, random, 0.02)
            })
            .ToList();
    }

    private static List<StorageEntity> GenerateStorages(int count, Random random)
    {
        var templates = new (string Name, double Latitude, double Longitude, double FuelAvailable)[]
        {
            ("Central Warehouse", 50.4550, 30.5150, 85000),
            ("North Depot", 50.5205, 30.6001, 42000),
            ("East Storage", 50.4705, 30.7004, 39000),
            ("South Terminal", 50.3508, 30.5202, 61000),
            ("West Reserve", 50.4400, 30.3600, 28000),
            ("City Backup", 50.4900, 30.4700, 51000)
        };

        return Enumerable.Range(0, count)
            .Select(index => templates[index % templates.Length])
            .Select(template =>
            {
                var storageId = Guid.NewGuid();
                return new StorageEntity
                {
                    Id = storageId,
                    Name = template.Name,
                    Latitude = Jitter(template.Latitude, random, 0.02),
                    Longitude = Jitter(template.Longitude, random, 0.02),
                    FuelItems = GenerateStorageFuelItems(storageId, template.FuelAvailable, random)
                };
            })
            .ToList();
    }

    private static List<FuelRequestEntity> GenerateFuelRequests(int count, IReadOnlyList<StationEntity> stations, Random random)
    {
        var priorities = Enum.GetValues<Priority>();
        var statuses = Enum.GetValues<Status>();

        return Enumerable.Range(0, count)
            .Select(_ => new FuelRequestEntity
            {
                Id = Guid.NewGuid(),
                StationId = stations[random.Next(stations.Count)].Id,
                Items = GenerateFuelRequestItems(random),
                Priority = priorities[random.Next(priorities.Length)],
                Status = statuses[random.Next(statuses.Length)],
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(0, 14)).AddMinutes(-random.Next(0, 1440))
            })
            .ToList();
    }

    private static List<DeliveryEntity> GenerateDeliveries(IReadOnlyList<FuelRequestEntity> requests, IReadOnlyList<StorageEntity> storages, Random random)
    {
        var deliveries = new List<DeliveryEntity>();

        foreach (var request in requests)
        {
            if (random.NextDouble() < 0.25)
            {
                continue;
            }

            var isCompleted = request.Status == Status.Done;

            deliveries.Add(new DeliveryEntity
            {
                Id = Guid.NewGuid(),
                RequestId = request.Id,
                StorageId = storages[random.Next(storages.Count)].Id,
                DeliveredAmount = Math.Round(request.Items.Sum(item => item.Amount), 2),
                Status = isCompleted ? Status.Done : RandomDeliveryStatus(random),
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(0, 10)).AddMinutes(-random.Next(0, 1440))
            });
        }

        return deliveries;
    }

    private static List<StorageFuelItemEntity> GenerateStorageFuelItems(Guid storageId, double totalFuelAvailable, Random random)
    {
        var fuelTypes = Enum.GetValues<Fulogi.Core.Enums.FuelType>();
        var remainingAmount = totalFuelAvailable;
        var items = new List<StorageFuelItemEntity>(fuelTypes.Length);

        for (var index = 0; index < fuelTypes.Length; index++)
        {
            var isLast = index == fuelTypes.Length - 1;
            var amount = isLast
                ? remainingAmount
                : Math.Round(totalFuelAvailable * (0.2 + random.NextDouble() * 0.25), 2);

            amount = Math.Max(1500, Math.Min(amount, remainingAmount - (fuelTypes.Length - index - 1) * 1500));
            remainingAmount -= amount;

            items.Add(new StorageFuelItemEntity
            {
                Id = Guid.NewGuid(),
                StorageId = storageId,
                FuelType = fuelTypes[index],
                Amount = Math.Round(amount, 2)
            });
        }

        return items;
    }

    private static List<FuelRequestItemEntity> GenerateFuelRequestItems(Random random)
    {
        var availableFuelTypes = Enum.GetValues<Fulogi.Core.Enums.FuelType>()
            .OrderBy(_ => random.Next())
            .Take(random.Next(1, 3))
            .ToList();

        return availableFuelTypes.Select(fuelType => new FuelRequestItemEntity
        {
            Id = Guid.NewGuid(),
            FuelType = fuelType,
            Amount = Math.Round(random.Next(8, 80) * 100.0, 2)
        }).ToList();
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
