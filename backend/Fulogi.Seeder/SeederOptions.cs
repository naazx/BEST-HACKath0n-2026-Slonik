namespace Fulogi.Seeder;

internal sealed class SeederOptions
{
    internal const int DefaultStationCount = 4;
    internal const int DefaultStorageCount = 4;
    internal const int DefaultFuelRequestCount = 12;
    internal const int DefaultSeed = 20260404;

    internal int StationCount { get; set; } = DefaultStationCount;
    internal int StorageCount { get; set; } = DefaultStorageCount;
    internal int FuelRequestCount { get; set; } = DefaultFuelRequestCount;
    internal int Seed { get; set; } = DefaultSeed;

    internal static SeederOptions Parse(string[] args)
    {
        var options = new SeederOptions();

        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];

            if (argument == "--stations" && index + 1 < args.Length && int.TryParse(args[++index], out var stationCount))
            {
                options.StationCount = Math.Max(0, stationCount);
                continue;
            }

            if (argument == "--storages" && index + 1 < args.Length && int.TryParse(args[++index], out var storageCount))
            {
                options.StorageCount = Math.Max(0, storageCount);
                continue;
            }

            if (argument == "--requests" && index + 1 < args.Length && int.TryParse(args[++index], out var requestCount))
            {
                options.FuelRequestCount = Math.Max(0, requestCount);
                continue;
            }

            if (argument == "--seed" && index + 1 < args.Length && int.TryParse(args[++index], out var seed))
            {
                options.Seed = seed;
            }
        }

        return options;
    }
}