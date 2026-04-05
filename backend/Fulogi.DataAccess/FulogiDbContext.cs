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
        

        public DbSet<StorageFuelItemEntity> StorageFuelItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Entities.StationEntity>(entity =>
            {
                entity.ToTable("Station");
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired();
                entity.Property(x => x.Latitude).IsRequired();
                entity.Property(x => x.Longitude).IsRequired();
            });

            modelBuilder.Entity<Entities.StorageEntity>(entity =>
            {
                entity.ToTable("Storage");
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired();
                entity.Property(x => x.Latitude).IsRequired();
                entity.Property(x => x.Longitude).IsRequired();
                entity.Property(x => x.FuelAvailable).IsRequired();
            });

            modelBuilder.Entity<Entities.FuelRequestEntity>(entity =>
            {
                entity.ToTable("FuelRequest");
                entity.HasKey(x => x.Id);
                entity.HasIndex(x => x.StationId);
                entity.Property(x => x.FuelAmount).IsRequired();
                entity.Property(x => x.Priority).IsRequired();
                entity.Property(x => x.Status).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.HasOne<Entities.StationEntity>()
                    .WithMany()
                    .HasForeignKey(x => x.StationId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Entities.DeliveryEntity>(entity =>
            {
                entity.ToTable("Delivery");
                entity.HasKey(x => x.Id);
                entity.HasIndex(x => x.RequestId);
                entity.HasIndex(x => x.StorageId);
                entity.Property(x => x.DeliveredAmount).IsRequired();
                entity.Property(x => x.Status).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.HasOne<Entities.FuelRequestEntity>()
                    .WithMany()
                    .HasForeignKey(x => x.RequestId)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<Entities.StorageEntity>()
                    .WithMany()
                    .HasForeignKey(x => x.StorageId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<FuelRequestEntity>()
                .HasMany(r => r.Items)
                .WithOne(i => i.FuelRequest)
                .HasForeignKey(i => i.FuelRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<StorageEntity>()
                .HasMany(s => s.FuelItems)
                .WithOne()           
                .HasForeignKey(i => i.StorageId)
                .OnDelete(DeleteBehavior.Cascade); 
        }
    }
}