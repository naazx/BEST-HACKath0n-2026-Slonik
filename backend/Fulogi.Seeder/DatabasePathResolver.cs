namespace Fulogi.Seeder;

internal static class DatabasePathResolver
{
    internal static string GetDatabasePath()
    {
        var baseDirectory = AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(baseDirectory, "..", "..", "..", "..", "..", "data", "fuel-management-dev.sqlite"));
    }
}