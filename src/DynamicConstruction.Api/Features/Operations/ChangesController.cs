using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Operations;

[ApiController, Authorize, Route("api/projects/{projectId:guid}/changes")]
public class ChangesController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(Guid projectId)
    {
        await access.Project(projectId);
        return await db
            .Changes.AsNoTracking()
            .Include(x => x.History)
            .Where(x => x.ProjectId == projectId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public record CreateInput(string Description);

    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, CreateInput input)
    {
        var p = await access.Project(projectId);
        Guard.Require(
            p.Status is not ("Completed" or "Archived"),
            "This project no longer accepts changes."
        );
        var c = new ChangeRequest
        {
            ProjectId = projectId,
            Description = Guard.Text(input.Description, "Description", 10),
        };
        c.History.Add(new ChangeHistory { Status = "Submitted", ActorId = access.UserId });
        db.Changes.Add(c);
        access.Audit("Change.Submit", c.Id);
        await db.SaveChangesAsync();
        return Ok(c);
    }

    public record DecisionInput(
        Guid Version,
        string Status,
        string Reason,
        decimal CostImpact,
        int DaysImpact
    );

    [HttpPost("{id:guid}/decision")]
    public async Task<IActionResult> Decide(Guid projectId, Guid id, DecisionInput input)
    {
        var p = await access.Project(projectId);
        var c =
            await db
                .Changes.Include(x => x.History)
                .SingleOrDefaultAsync(x => x.ProjectId == projectId && x.Id == id)
            ?? throw new AppError(404, "Change not found.");
        Guard.Version(c, input.Version);
        Guard.Require(
            access.Staff || input.Status == "Withdrawn",
            "Staff permission is required.",
            403
        );
        Lifecycle.Change(c.Status, input.Status);
        c.Reason = Guard.Text(input.Reason, "Decision reason", 5);
        Guard.Require(
            Math.Abs(input.CostImpact) <= 100000000 && Math.Abs(input.DaysImpact) <= 3650,
            "Impacts exceed allowed limits."
        );
        if (input.Status is "Approved" or "Rejected")
        {
            c.Decision = input.Status;
            c.CostImpact = input.CostImpact;
            c.DaysImpact = input.DaysImpact;
        }
        c.Status = input.Status == "Withdrawn" ? "Closed" : input.Status;
        c.History.Add(
            new ChangeHistory
            {
                Status = input.Status,
                Reason = c.Reason,
                ActorId = access.UserId,
            }
        );
        access.Audit("Change." + input.Status, c.Id, c.Reason);
        access.Notify(p.ClientId, $"Change request: {input.Status}. {c.Reason}", projectId);
        await db.SaveChangesAsync();
        return Ok(c);
    }
}
