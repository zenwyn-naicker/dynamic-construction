using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Content;

[ApiController, Route("api/content")]
public class ContentController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> Public() =>
        await db.Content.AsNoTracking().Where(x => x.Published).OrderBy(x => x.Key).ToListAsync();

    [Authorize(Policy = "Staff"), HttpGet("manage")]
    public async Task<object> Manage() => await db.Content.OrderBy(x => x.Key).ToListAsync();

    public record ContentInput(Guid Version, string Title, string Body, bool Published);

    [Authorize(Policy = "Staff"), HttpPut("{key}")]
    public async Task<IActionResult> Save(string key, ContentInput input)
    {
        Guard.Require(
            new[]
            {
                "hero",
                "services",
                "contact",
                "privacy",
                "service-wall",
                "service-deck",
                "service-pool",
                "service-room",
            }.Contains(key),
            "Unknown content location."
        );
        var c = await db.Content.SingleOrDefaultAsync(x => x.Key == key);
        if (c == null)
        {
            Guard.Require(input.Version == Guid.Empty, "Content changed. Reload.", 409);
            c = new PublicContent { Key = key };
            db.Content.Add(c);
        }
        else
            Guard.Version(c, input.Version);
        c.Title = Guard.Text(input.Title, "Title", 2, 180);
        c.Body = Guard.Text(input.Body, "Body", 5, 3000);
        c.Published = input.Published;
        access.Audit("Content.Save", c.Id, key);
        await db.SaveChangesAsync();
        return Ok(c);
    }
}
