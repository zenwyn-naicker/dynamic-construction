using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Operations;

[ApiController, Authorize, Route("api/projects")]
public class ProjectsController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(int page = 1) =>
        await access
            .Projects.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.Reference,
                x.Name,
                x.Status,
                x.ContractValue,
                x.Version,
                Progress = x.Milestones.Count(m => m.Published) == 0
                    ? 0
                    : 100
                        * x.Milestones.Count(m => m.Published && m.Complete)
                        / x.Milestones.Count(m => m.Published),
            })
            .ToPageAsync(page);

    [HttpGet("{id:guid}")]
    public async Task<object> Get(Guid id)
    {
        var p = await access.ProjectDetails(id);
        return new
        {
            p.Id,
            p.Reference,
            p.Name,
            p.Status,
            p.Reason,
            p.ContractValue,
            p.Version,
            Milestones = p.Milestones.Where(x => access.Staff || x.Published).OrderBy(x => x.DueAt),
            Updates = p
                .Updates.Where(x => access.Staff || x.Published)
                .OrderByDescending(x => x.CreatedAt),
        };
    }

    public record StateInput(Guid Version, string Status, string Reason);

    [Authorize(Policy = "Staff"), HttpPost("{id:guid}/state")]
    public async Task<IActionResult> State(Guid id, StateInput input)
    {
        var p = await access.ProjectDetails(id);
        Guard.Version(p, input.Version);
        Lifecycle.Project(
            p.Status,
            input.Status,
            p.Milestones.Count > 0 && p.Milestones.All(x => x.Complete),
            input.Reason
        );
        p.Status = input.Status;
        p.Reason = input.Reason;
        access.Audit("Project." + p.Status, p.Id, p.Reason);
        access.Notify(p.ClientId, $"{p.Name}: {p.Status}", p.Id);
        await db.SaveChangesAsync();
        return Ok(new { p.Version });
    }

    public record MilestoneInput(
        Guid? Id,
        Guid Version,
        string Title,
        DateTime DueAt,
        bool Complete,
        bool Published
    );

    [Authorize(Policy = "Staff"), HttpPost("{id:guid}/milestones")]
    public async Task<IActionResult> Milestone(Guid id, MilestoneInput input)
    {
        var p = await access.ProjectDetails(id);
        Guard.Require(p.Status is not ("Completed" or "Archived"), "This project is read-only.");
        Guard.Version(p, input.Version);
        var m = input.Id.HasValue
            ? p.Milestones.SingleOrDefault(x => x.Id == input.Id)
                ?? throw new AppError(404, "Milestone not found.")
            : new Milestone { ProjectId = id };
        m.Title = Guard.Text(input.Title, "Title", 3, 180);
        Guard.Require(
            input.DueAt.Year >= 2020 && input.DueAt.Year <= 2100,
            "Enter a valid due date."
        );
        m.DueAt = input.DueAt;
        m.Complete = input.Complete;
        m.Published = input.Published;
        if (!input.Id.HasValue)
            db.Milestones.Add(m);
        db.Entry(p).Property(x => x.Reason).IsModified = true;
        access.Audit("Milestone.Save", m.Id);
        await db.SaveChangesAsync();
        return Ok(m);
    }

    public record UpdateInput(string Message, bool Published);

    [Authorize(Policy = "Staff"), HttpPost("{id:guid}/updates")]
    public async Task<IActionResult> Update(Guid id, UpdateInput input)
    {
        var p = await access.Project(id);
        Guard.Require(p.Status != "Archived", "Archived projects are read-only.");
        var u = new ProgressUpdate
        {
            ProjectId = id,
            Message = Guard.Text(input.Message, "Update", 5),
            Published = input.Published,
        };
        db.Updates.Add(u);
        access.Audit("Progress.Publish", u.Id);
        if (u.Published)
            access.Notify(p.ClientId, $"New progress update: {p.Name}", id);
        await db.SaveChangesAsync();
        return Ok(u);
    }
}
