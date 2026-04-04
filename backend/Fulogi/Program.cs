using Fulogi.Application.Services;
using Fulogi.Core.Abstractions;
using Fulogi.DataAccess;
using Fulogi.DataAccess.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var dataDir = Path.Combine(builder.Environment.ContentRootPath, "..", "..", "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "fuel-management-dev.sqliteф");

builder.Services.AddDbContext<FulogiDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddScoped<IStationService, StationService>();
builder.Services.AddScoped<IStationsRepository, StationsRepository>();
builder.Services.AddScoped<IStorageService, StorageService>();
builder.Services.AddScoped<IStoragesRepository, StoragesRepository>();
builder.Services.AddScoped<IFuelRequestService, FuelRequestService>();
builder.Services.AddScoped<IFuelRequestsRepository, FuelRequestsRepository>();
builder.Services.AddScoped<IDeliveryService, DeliveryService>();
builder.Services.AddScoped<IDeliveriesRepository, DeliveriesRepository>();

var app = builder.Build();

await EnsureDatabaseSchemaAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

static async Task EnsureDatabaseSchemaAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<FulogiDbContext>();

    await dbContext.Database.EnsureCreatedAsync();
    await using var connection = dbContext.Database.GetDbConnection();
    await connection.OpenAsync();

    await EnsureStationsTableAsync(dbContext, connection);
    await EnsureStoragesTableAsync(dbContext, connection);
    await EnsureFuelRequestsTableAsync(dbContext, connection); // Оновлений метод
    await EnsureDeliveriesTableAsync(dbContext, connection);
}

static async Task EnsureFuelRequestsTableAsync(FulogiDbContext dbContext, DbConnection connection)
{

    if (!await TableExistsAsync(connection, "FuelRequests"))
    {
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE "FuelRequests" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_FuelRequests" PRIMARY KEY,
                "StationId" TEXT NOT NULL,
                "Priority" INTEGER NOT NULL,
                "Status" INTEGER NOT NULL,
                "CreatedAt" TEXT NOT NULL
            );
            CREATE INDEX "IX_FuelRequests_StationId" ON "FuelRequests" ("StationId");
            """);
    }

    if (!await TableExistsAsync(connection, "FuelRequestItems"))
    {
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE "FuelRequestItems" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_FuelRequestItems" PRIMARY KEY,
                "FuelRequestId" TEXT NOT NULL,
                "FuelType" INTEGER NOT NULL,
                "Amount" REAL NOT NULL,
                CONSTRAINT "FK_FuelRequestItems_FuelRequests_FuelRequestId" 
                    FOREIGN KEY ("FuelRequestId") REFERENCES "FuelRequests" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX "IX_FuelRequestItems_FuelRequestId" ON "FuelRequestItems" ("FuelRequestId");
            """);
    }
}

static async Task EnsureStationsTableAsync(FulogiDbContext dbContext, DbConnection connection)
{
    if (await TableExistsAsync(connection, "Stations")) return;
    await dbContext.Database.ExecuteSqlRawAsync("""
        CREATE TABLE "Stations" (
            "Id" TEXT NOT NULL CONSTRAINT "PK_Stations" PRIMARY KEY,
            "Name" TEXT NULL,
            "Latitude" REAL NOT NULL,
            "Longitude" REAL NOT NULL
        );
        """);
}

static async Task EnsureStoragesTableAsync(FulogiDbContext dbContext, DbConnection connection)
{
    if (await TableExistsAsync(connection, "Storages")) return;
    await dbContext.Database.ExecuteSqlRawAsync("""
        CREATE TABLE "Storages" (
            "Id" TEXT NOT NULL CONSTRAINT "PK_Storages" PRIMARY KEY,
            "Name" TEXT NULL,
            "Latitude" REAL NOT NULL,
            "Longitude" REAL NOT NULL,
            "FuelAvailable" REAL NOT NULL
        );
        """);
}

static async Task EnsureDeliveriesTableAsync(FulogiDbContext dbContext, DbConnection connection)
{
    if (await TableExistsAsync(connection, "Deliveries")) return;
    await dbContext.Database.ExecuteSqlRawAsync("""
        CREATE TABLE "Deliveries" (
            "Id" TEXT NOT NULL CONSTRAINT "PK_Deliveries" PRIMARY KEY,
            "RequestId" TEXT NOT NULL,
            "StorageId" TEXT NOT NULL,
            "DeliveredAmount" REAL NOT NULL,
            "Status" INTEGER NOT NULL,
            "CreatedAt" TEXT NOT NULL
        );
        """);
}

static async Task<bool> TableExistsAsync(DbConnection connection, string tableName)
{
    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $name LIMIT 1;";
    var parameter = command.CreateParameter();
    parameter.ParameterName = "$name";
    parameter.Value = tableName;
    command.Parameters.Add(parameter);
    var result = await command.ExecuteScalarAsync();
    return result is not null;
}