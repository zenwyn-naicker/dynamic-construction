using System.Security.Claims;
using DynamicConstruction.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Infrastructure;

public class AppError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public static class Guard
{
    public static void Require(bool condition, string message, int status = 400)
    {
        if (!condition)
            throw new AppError(status, message);
    }

    public static string Text(string? value, string name, int min = 1, int max = 2000)
    {
        var s = value?.Trim() ?? "";
        Require(s.Length >= min && s.Length <= max, $"{name} must contain {min}–{max} characters.");
        return s;
    }

    public static void Version(Record record, Guid version) =>
        Require(
            record.Version == version,
            "This record changed. Reload and review before saving.",
            409
        );
}

public class Access(AppDbContext db, IHttpContextAccessor accessor)
{
    public string UserId =>
        accessor.HttpContext!.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";
    public bool Staff =>
        accessor.HttpContext!.User.IsInRole("Staff") || accessor.HttpContext.User.IsInRole("Admin");
    public IQueryable<Project> Projects =>
        Staff ? db.Projects : db.Projects.Where(x => x.ClientId == UserId);

    public async Task<Project> Project(Guid id) =>
        await Projects.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id)
        ?? throw new AppError(404, "Project not found.");

    public async Task<Project> ProjectDetails(Guid id) =>
        await Projects
            .AsSplitQuery()
            .Include(x => x.Milestones)
            .Include(x => x.Updates)
            .SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppError(404, "Project not found.");

    public void Audit(
        string action,
        object entity,
        string reason = "",
        string outcome = "Success"
    ) =>
        db.Audit.Add(
            new AuditEntry
            {
                ActorId = UserId,
                Action = action,
                EntityId = entity.ToString() ?? "",
                Reason = reason,
                Outcome = outcome,
                CorrelationId = accessor.HttpContext?.TraceIdentifier ?? "system",
            }
        );

    public void Notify(string recipient, string message, Guid? project = null) =>
        db.Notifications.Add(
            new Notification
            {
                RecipientId = recipient,
                Message = message,
                ProjectId = project,
            }
        );
}
