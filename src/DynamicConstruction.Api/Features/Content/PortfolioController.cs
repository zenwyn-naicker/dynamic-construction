using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Content;

[ApiController, Route("api/portfolio")]
public class PortfolioController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> Public(int page = 1) =>
        await db
            .Portfolio.AsNoTracking()
            .Where(x => x.Published)
            .OrderByDescending(x => x.CompletedAt)
            .ThenBy(x => x.Id)
            .ToPageAsync(page, size: 3);

    [Authorize(Policy = "Staff"), HttpGet("manage")]
    public async Task<object> Manage(int page = 1) =>
        await db
            .Portfolio.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .ToPageAsync(page);

    public record Input(
        Guid? Id,
        Guid Version,
        string Title,
        string Location,
        string ProjectType,
        string Summary,
        string Details,
        DateTime CompletedAt,
        int DurationDays,
        bool Published
    );

    [Authorize(Policy = "Staff"), HttpPost]
    public async Task<object> Save(Input input)
    {
        Guard.Require(
            input.CompletedAt <= DateTime.UtcNow && input.CompletedAt.Year >= 1900,
            "Enter the actual completion date."
        );
        Guard.Require(input.DurationDays is >= 1 and <= 36500, "Enter a valid project duration.");
        var entry = input.Id.HasValue
            ? await db.Portfolio.FindAsync(input.Id)
                ?? throw new AppError(404, "Portfolio entry not found.")
            : new PortfolioEntry();
        if (input.Id.HasValue)
            Guard.Version(entry, input.Version);
        entry.Title = Guard.Text(input.Title, "Title", 3, 180);
        entry.Location = Guard.Text(input.Location, "Location", 2, 180);
        entry.ProjectType = Guard.Text(input.ProjectType, "Project type", 2, 100);
        entry.Summary = Guard.Text(input.Summary, "Summary", 10, 1000);
        entry.Details = Guard.Text(input.Details, "Details", 10, 3000);
        entry.CompletedAt = DateTime.SpecifyKind(input.CompletedAt, DateTimeKind.Utc);
        entry.DurationDays = input.DurationDays;
        entry.Published = input.Published;
        if (!input.Id.HasValue)
            db.Portfolio.Add(entry);
        access.Audit("Portfolio.Save", entry.Id);
        await db.SaveChangesAsync();
        return entry;
    }
}
