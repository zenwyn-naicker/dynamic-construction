using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DynamicConstruction.Api.Infrastructure;

public class DesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(
                    Environment.GetEnvironmentVariable("ConnectionStrings__Database")
                        ?? "Server=localhost;Database=DynamicConstruction;Integrated Security=true;TrustServerCertificate=true"
                )
                .Options
        );
}
