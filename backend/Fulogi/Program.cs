using Fulogi.Application.Services;
using Fulogi.Core.Abstractions;
using Fulogi.DataAccess;
using Fulogi.DataAccess.Repositories;
using Fulogi.Serialization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);


builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new PriorityJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new StatusJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new PriorityJsonConverter());
    options.SerializerOptions.Converters.Add(new StatusJsonConverter());
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});


var dataDir = ResolveDataDirectory(builder.Environment.ContentRootPath);
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "fuel-management-dev.sqlite");

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

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseCors("AllowAll");
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<FulogiDbContext>();
    await DevelopmentDatabaseBootstrapper.InitializeAsync(dbContext, dbPath, app.Environment.IsDevelopment());
}


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

static string ResolveDataDirectory(string contentRootPath)
{
    foreach (var startPath in new[] { contentRootPath, AppContext.BaseDirectory })
    {
        var current = new DirectoryInfo(Path.GetFullPath(startPath));

        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "data");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }
    }

    return Path.Combine(contentRootPath, "data");
}
