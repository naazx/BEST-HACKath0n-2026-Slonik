using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fulogi.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class ConvertToMultiFuelSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StorageFuelItem",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    StorageId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FuelType = table.Column<int>(type: "INTEGER", nullable: false),
                    Amount = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorageFuelItem", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StorageFuelItem_Storage_StorageId",
                        column: x => x.StorageId,
                        principalTable: "Storage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FuelRequestItem",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FuelRequestId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FuelType = table.Column<int>(type: "INTEGER", nullable: false),
                    Amount = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelRequestItem", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FuelRequestItem_FuelRequest_FuelRequestId",
                        column: x => x.FuelRequestId,
                        principalTable: "FuelRequest",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FuelRequestItem_FuelRequestId",
                table: "FuelRequestItem",
                column: "FuelRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_StorageFuelItem_StorageId",
                table: "StorageFuelItem",
                column: "StorageId");

            migrationBuilder.Sql("""
                INSERT INTO "StorageFuelItem" ("Id", "StorageId", "FuelType", "Amount")
                SELECT
                    lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(6))),
                    "Id",
                    1,
                    "FuelAvailable"
                FROM "Storage";
                """);

            migrationBuilder.Sql("""
                INSERT INTO "FuelRequestItem" ("Id", "FuelRequestId", "FuelType", "Amount")
                SELECT
                    lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(6))),
                    "Id",
                    1,
                    "FuelAmount"
                FROM "FuelRequest";
                """);

            migrationBuilder.DropColumn(
                name: "FuelAvailable",
                table: "Storage");

            migrationBuilder.DropColumn(
                name: "FuelAmount",
                table: "FuelRequest");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "FuelAvailable",
                table: "Storage",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "FuelAmount",
                table: "FuelRequest",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.Sql("""
                UPDATE "Storage"
                SET "FuelAvailable" = COALESCE((
                    SELECT SUM("Amount")
                    FROM "StorageFuelItem"
                    WHERE "StorageFuelItem"."StorageId" = "Storage"."Id"
                ), 0);
                """);

            migrationBuilder.Sql("""
                UPDATE "FuelRequest"
                SET "FuelAmount" = COALESCE((
                    SELECT SUM("Amount")
                    FROM "FuelRequestItem"
                    WHERE "FuelRequestItem"."FuelRequestId" = "FuelRequest"."Id"
                ), 0);
                """);

            migrationBuilder.DropTable(
                name: "FuelRequestItem");

            migrationBuilder.DropTable(
                name: "StorageFuelItem");
        }
    }
}
