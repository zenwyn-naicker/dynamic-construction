using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Operations;

[ApiController, Authorize(Policy = "Staff"), Route("api/operations/quotes")]
public class QuoteOperationsController(AppDbContext db, Access access, UserManager<AppUser> users)
    : ControllerBase
{
    [HttpGet]
    public async Task<object> List(string? status = null, string? search = null, int page = 1, CancellationToken ct = default)
    {
        var q = db.Quotes.AsNoTracking().Include(x => x.Items).AsQueryable();
        if (status != null)
            q = q.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(x =>
                x.Reference.Contains(search) || x.Name.Contains(search) || x.Status.Contains(search)
            );
        return await q.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).ToPageAsync(page, ct);
    }

    public record DecisionInput(
        Guid Version,
        string Status,
        string Reason,
        decimal? FormalAmount,
        DateTime? ValidUntil,
        string? ClientId
    );

    [HttpPost("{id:guid}/decision")]
    public async Task<IActionResult> Decision(Guid id, DecisionInput input)
    {
        var q = await db.Quotes.FindAsync(id) ?? throw new AppError(404, "Quote not found.");
        Guard.Version(q, input.Version);
        Lifecycle.Quote(q.Status, input.Status, q.ValidUntil, DateTime.UtcNow);
        q.Reason = Guard.Text(input.Reason, "Decision reason / acceptance evidence", 5);
        if (input.Status == "Quoted")
        {
            Guard.Require(
                input.FormalAmount.HasValue
                    && decimal.Round(input.FormalAmount.Value, 2) == input.FormalAmount.Value,
                "Formal amount must have at most two decimal places."
            );
            Guard.Require(
                input.FormalAmount is > 0 and <= 100000000,
                "Enter a valid formal amount."
            );
            Guard.Require(input.ValidUntil > DateTime.UtcNow, "Enter a future validity date.");
            q.FormalAmount = input.FormalAmount;
            q.ValidUntil = input.ValidUntil;
        }
        var clientId = input.ClientId ?? q.ClientId;
        Guard.Require(
            input.Status != "Accepted" || clientId != null,
            "Link a verified client account before accepting the quote."
        );
        if (clientId != null)
        {
            var u = await users.FindByIdAsync(clientId);
            Guard.Require(
                u != null && !u.Suspended && await users.IsInRoleAsync(u, "Client"),
                "Select an active client account after verifying the client identity."
            );
            q.ClientId = clientId;
        }
        q.Status = input.Status;
        if (q.Status == "Accepted")
            q.AcceptedAt = DateTime.UtcNow;
        access.Audit("Quote." + q.Status, q.Id, q.Reason);
        if (q.ClientId != null)
            access.Notify(q.ClientId, $"Quote {q.Reference}: {q.Status}. {q.Reason}");
        await db.SaveChangesAsync();
        return Ok(q);
    }

    public record ConvertInput(Guid Version, string Name);

    [HttpPost("{id:guid}/project")]
    public async Task<IActionResult> Convert(Guid id, ConvertInput input)
    {
        var q = await db.Quotes.FindAsync(id) ?? throw new AppError(404, "Quote not found.");
        Guard.Version(q, input.Version);
        Guard.Require(
            q.Status == "Accepted" && q.ClientId != null && q.FormalAmount.HasValue,
            "An accepted quote linked to a verified client is required."
        );
        var existing = await db.Projects.SingleOrDefaultAsync(x => x.QuoteId == id);
        if (existing != null)
            return Ok(new { existing.Id, existing.Reference });
        var p = new Project
        {
            Name = Guard.Text(input.Name, "Project name", 3, 180),
            ClientId = q.ClientId!,
            QuoteId = id,
            ContractValue = q.FormalAmount!.Value,
        };
        db.Projects.Add(p);
        access.Audit("Project.Create", p.Id, q.Reference);
        access.Notify(p.ClientId, $"Project {p.Reference} is ready to follow.", p.Id);
        await db.SaveChangesAsync();
        return Ok(new { p.Id, p.Reference });
    }

    [HttpGet("clients")]
    public async Task<object> Clients() =>
        (await users.GetUsersInRoleAsync("Client"))
            .Where(x => !x.Suspended)
            .Select(x => new
            {
                x.Id,
                x.FullName,
                x.Email,
            });
}
