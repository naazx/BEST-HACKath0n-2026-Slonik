using Microsoft.EntityFrameworkCore;
using Fulogi.DataAccess.Entities;

namespace Fulogi.DataAccess
{
    public class FulogiDbContext : DbContext
    {
        public FulogiDbContext(DbContextOptions<FulogiDbContext> options) : base(options) {}

        public DbSet<StationEntity> Stations { get; set; }
        public DbSet<StorageEntity> Storages { get; set; }
        public DbSet<DeliveryEntity> Deliveries { get; set; }
        public DbSet<FuelRequestEntity> FuelRequests { get; set; }
        public DbSet<FuelRequestItemEntity> FuelRequestItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<FuelRequestEntity>()
                .HasMany(r => r.Items)
                .WithOne(i => i.FuelRequest)
                .HasForeignKey(i => i.FuelRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}