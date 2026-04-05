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


var dataDir = ResolveDataDirectory(builder.Environment.ContentRootPath);
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "fuel-management-dev.sqlite");
var allowedCorsOrigins = ResolveCorsOrigins(builder.Configuration, builder.Environment);

builder.Services.AddDbContext<FulogiDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedCorsOrigins.Length > 0)
        {
            policy
                .WithOrigins(allowedCorsOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
            return;
        }

        if (builder.Environment.IsDevelopment())
        {
            policy
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

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
app.Logger.LogInformation("Using SQLite database at {DatabasePath}", dbPath);
if (allowedCorsOrigins.Length > 0)
{
    app.Logger.LogInformation("Configured CORS origins: {Origins}", string.Join(", ", allowedCorsOrigins));
}
else
{
    app.Logger.LogInformation("No explicit production CORS origins configured.");
}
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
app.UseCors("Frontend");
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

static string[] ResolveCorsOrigins(IConfiguration configuration, IWebHostEnvironment environment)
{
    var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    var rawOrigins = configuration["Cors:AllowedOrigins"];
    var splitOrigins = string.IsNullOrWhiteSpace(rawOrigins)
        ? []
        : rawOrigins.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    return configuredOrigins
        .Concat(splitOrigins)
        .Concat(environment.IsDevelopment()
            ?
            [
                "http://localhost:5173",
                "https://localhost:5173",
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173"
            ]
            : [])
        .Where(origin => Uri.TryCreate(origin, UriKind.Absolute, out _))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
}
