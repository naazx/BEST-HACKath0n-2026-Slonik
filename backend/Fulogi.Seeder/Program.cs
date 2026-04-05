using Fulogi.Seeder;

var databasePath = DatabasePathResolver.GetDatabasePath();
var options = SeederOptions.Parse(args);

await DatabaseSeeder.RecreateAndSeedAsync(databasePath, options);