using Microsoft.EntityFrameworkCore;

namespace Fulogi.DataAccess
{
    public class FulogiDbContext : DbContext
    {
        public FulogiDbContext(DbContextOptions<FulogiDbContext> options) : base(options) {}

        public DbSet<Entities.StationEntity> Stations { get; set; }
        public DbSet<Entities.StorageEntity> Storages { get; set; }
        public DbSet<Entities.DeliveryEntity> Deliveries { get; set; }
        public DbSet<Entities.FuelRequestEntity> FuelRequests { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }
}
