using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DynamicConstruction.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ManagedPublications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EstimateRates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(
                        type: "nvarchar(40)",
                        maxLength: 40,
                        nullable: false
                    ),
                    Finish = table.Column<string>(
                        type: "nvarchar(40)",
                        maxLength: 40,
                        nullable: false
                    ),
                    UnitRate = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    Assumptions = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EstimateRates", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Portfolio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    Location = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    ProjectType = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    Summary = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    Details = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DurationDays = table.Column<int>(type: "int", nullable: false),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Portfolio", x => x.Id);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Quotes_CreatedAt_Id",
                table: "Quotes",
                columns: new[] { "CreatedAt", "Id" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ClientId_CreatedAt_Id",
                table: "Projects",
                columns: new[] { "ClientId", "CreatedAt", "Id" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_EstimateRates_Type_Finish",
                table: "EstimateRates",
                columns: new[] { "Type", "Finish" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Portfolio_Published_CompletedAt_Id",
                table: "Portfolio",
                columns: new[] { "Published", "CompletedAt", "Id" }
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "EstimateRates");

            migrationBuilder.DropTable(name: "Portfolio");

            migrationBuilder.DropIndex(name: "IX_Quotes_CreatedAt_Id", table: "Quotes");

            migrationBuilder.DropIndex(
                name: "IX_Projects_ClientId_CreatedAt_Id",
                table: "Projects"
            );
        }
    }
}
