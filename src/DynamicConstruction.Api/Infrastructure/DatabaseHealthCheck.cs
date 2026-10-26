using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DynamicConstruction.Api.Infrastructure;

public class DatabaseHealthCheck(IServiceScopeFactory factory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken ct = default
    )
    {
        using var scope = factory.CreateScope();
        return await scope
            .ServiceProvider.GetRequiredService<AppDbContext>()
            .Database.CanConnectAsync(ct)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy();
    }
}
