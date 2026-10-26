using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Communications;

[ApiController, Authorize(Policy = "Admin"), Route("api/audit")]
public class AuditController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(string? search = null, int page = 1, CancellationToken ct = default)
    {
        Guard.Require(page is >= 1 and <= 1000000, "Invalid page number.");
        var q = db.Audit.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(x =>
                x.Action.Contains(search)
                || x.EntityId.Contains(search)
                || x.ActorId.Contains(search)
            );
        return new
        {
            total = await q.CountAsync(ct),
            items = await q.OrderByDescending(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .Skip((page - 1) * 50)
                .Take(50)
                .ToListAsync(ct),
        };
    }
}
