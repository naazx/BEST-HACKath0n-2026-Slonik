using Fulogi.DataAccess;
using Fulogi.DataAccess.Entities;
using Fulogi.DataAccess.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fulogi.Seeder;

internal static class DatabaseSeeder
{
    internal static async Task RecreateAndSeedAsync(string databasePath, SeederOptions seedOptions)
    {
        var directory = Path.GetDirectoryName(databasePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (File.Exists(databasePath))
        {
            File.Delete(databasePath);
        }

        var dbOptions = new DbContextOptionsBuilder<FulogiDbContext>()
            .UseSqlite($"Data Source={databasePath}")
            .Options;

        await using var dbContext = new FulogiDbContext(dbOptions);
        await dbContext.Database.MigrateAsync();

        var random = new Random(seedOptions.Seed);

        var stations = SeedDataGenerator.GenerateStations(seedOptions.StationCount, random);
        await dbContext.Stations.AddRangeAsync(stations);

        var storages = SeedDataGenerator.GenerateStorages(seedOptions.StorageCount, random);
        await dbContext.Storages.AddRangeAsync(storages);

        var fuelRequests = SeedDataGenerator.GenerateFuelRequests(seedOptions.FuelRequestCount, stations, random);
        await dbContext.FuelRequests.AddRangeAsync(fuelRequests);

        var deliveries = SeedDataGenerator.GenerateDeliveries(fuelRequests, storages, random);
        await dbContext.Deliveries.AddRangeAsync(deliveries);

        await dbContext.SaveChangesAsync();
    }
}