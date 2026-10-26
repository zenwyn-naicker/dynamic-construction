using Microsoft.AspNetCore.Identity;

namespace DynamicConstruction.Api.Domain;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = "";
    public bool Suspended { get; set; }
}

public class ClientProfile
{
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public string Reference { get; set; } =
        $"CL-{Guid.NewGuid().ToString("N")[..10].ToUpperInvariant()}";
}

public abstract class Record
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid Version { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Quote : Record
{
    public string Reference { get; set; } =
        $"QR-{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}";
    public Guid SubmissionKey { get; set; }
    public string PayloadHash { get; set; } = "";
    public string Type { get; set; } = "Deck";
    public decimal Length { get; set; }
    public decimal Width { get; set; }
    public string Finish { get; set; } = "Standard";
    public string Description { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Site { get; set; } = "";
    public string Notes { get; set; } = "";
    public decimal? Estimate { get; set; }
    public string Assumptions { get; set; } = "";
    public string RateVersion { get; set; } = "";
    public string Status { get; set; } = "Submitted";
    public decimal? FormalAmount { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public string? ClientId { get; set; }
    public ClientProfile? Client { get; set; }
    public string Reason { get; set; } = "";
    public List<QuoteItem> Items { get; set; } = [];
}

public class QuoteItem : Record
{
    public Guid QuoteId { get; set; }
    public string Description { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal Amount { get; set; }
}

public class Project : Record
{
    public string Reference { get; set; } =
        $"PRJ-{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}";
    public string Name { get; set; } = "";
    public string ClientId { get; set; } = "";
    public ClientProfile Client { get; set; } = null!;
    public Guid? QuoteId { get; set; }
    public Quote? Quote { get; set; }
    public string Status { get; set; } = "Planned";
    public string Reason { get; set; } = "";
    public decimal ContractValue { get; set; }
    public List<Milestone> Milestones { get; set; } = [];
    public List<ProgressUpdate> Updates { get; set; } = [];
}

public class Milestone : Record
{
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = "";
    public DateTime DueAt { get; set; }
    public bool Complete { get; set; }
    public bool Published { get; set; }
}

public class ProgressUpdate : Record
{
    public Guid ProjectId { get; set; }
    public string Message { get; set; } = "";
    public bool Published { get; set; }
}

public class ProjectFile : Record
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public string Category { get; set; } = "Document";
    public bool Published { get; set; }
}

public class ChangeRequest : Record
{
    public Guid ProjectId { get; set; }
    public string Description { get; set; } = "";
    public string Status { get; set; } = "Submitted";
    public string Reason { get; set; } = "";
    public string Decision { get; set; } = "";
    public decimal CostImpact { get; set; }
    public int DaysImpact { get; set; }
    public List<ChangeHistory> History { get; set; } = [];
}

public class ChangeHistory : Record
{
    public Guid ChangeRequestId { get; set; }
    public string Status { get; set; } = "";
    public string Reason { get; set; } = "";
    public string ActorId { get; set; } = "";
}

public class BudgetItem : Record
{
    public Guid ProjectId { get; set; }
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
    public bool Published { get; set; }
}

public class Invoice : Record
{
    public Guid ProjectId { get; set; }
    public string Number { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
    public decimal Paid { get; set; }
    public DateTime DueAt { get; set; }
    public bool Published { get; set; }
}

public class Notification : Record
{
    public string RecipientId { get; set; } = "";
    public AppUser Recipient { get; set; } = null!;
    public string Message { get; set; } = "";
    public Guid? ProjectId { get; set; }
    public DateTime? ReadAt { get; set; }
}

public class AuditEntry : Record
{
    public string ActorId { get; set; } = "";
    public string Action { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Outcome { get; set; } = "Success";
    public string Reason { get; set; } = "";
    public string CorrelationId { get; set; } = "";
}

public class PublicContent : Record
{
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool Published { get; set; }
}

public class EstimateRate : Record
{
    public string Type { get; set; } = "";
    public string Finish { get; set; } = "";
    public decimal UnitRate { get; set; }
    public string Assumptions { get; set; } = "";
    public bool Published { get; set; }
}

public class PortfolioEntry : Record
{
    public string Title { get; set; } = "";
    public string Location { get; set; } = "";
    public string ProjectType { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTime CompletedAt { get; set; }
    public int DurationDays { get; set; }
    public bool Published { get; set; }
}
