using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Communications;

[ApiController, Authorize, Route("api/notifications")]
public class NotificationsController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(int page = 1) =>
        await db
            .Notifications.Where(x => x.RecipientId == access.UserId)
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .ToPageAsync(page);

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id)
    {
        var n =
            await db.Notifications.SingleOrDefaultAsync(x =>
                x.Id == id && x.RecipientId == access.UserId
            ) ?? throw new AppError(404, "Notification not found.");
        if (n.ReadAt == null)
        {
            n.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    public record ComposeInput(string[] Recipients, string Message, Guid? ProjectId);

    [Authorize(Policy = "Staff"), HttpPost]
    public async Task<IActionResult> Compose(ComposeInput input)
    {
        Guard.Require(input.Recipients.Length is > 0 and <= 100, "Select 1–100 recipients.");
        var message = Guard.Text(input.Message, "Message", 3, 2000);
        var recipients = input.Recipients.Distinct().ToArray();
        var eligible = await db.Users
            .Where(u => recipients.Contains(u.Id) && !u.Suspended
                && (from membership in db.UserRoles
                    join role in db.Roles on membership.RoleId equals role.Id
                    where membership.UserId == u.Id && role.Name == "Client"
                    select membership).Any())
            .Select(u => u.Id)
            .ToListAsync();
        Guard.Require(eligible.Count == recipients.Length, "Recipient unavailable.");
        if (input.ProjectId.HasValue)
        {
            var p = await access.Project(input.ProjectId.Value);
            Guard.Require(recipients.All(id => p.ClientId == id), "Project does not belong to recipient.");
        }
        foreach (var id in recipients)
            access.Notify(id, message, input.ProjectId);
        access.Audit("Notification.Compose", input.ProjectId?.ToString() ?? "Recipients");
        await db.SaveChangesAsync();
        return NoContent();
    }
}
