using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Fixtures;

/// <summary>Explicit development-only fixtures; never run against production.</summary>
public static class SiteFixtures
{
    public static async Task Create(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        if (await db.Projects.AnyAsync(x => x.Reference == "PRJ-2026-014"))
            return;
        var users = services.GetRequiredService<UserManager<AppUser>>();
        var client = (await users.FindByEmailAsync("thandi@example.test"))!;
        var other = (await users.FindByEmailAsync("lindi@example.test"))!;
        var q = new Quote
        {
            Reference = "QR-2026-0087",
            SubmissionKey = Guid.NewGuid(),
            Name = client.FullName,
            Email = client.Email!,
            Phone = "082 555 0142",
            Site = "Test site, Durban North",
            Type = "Deck",
            Length = 6,
            Width = 4,
            Finish = "Standard",
            Estimate = 48000,
            FormalAmount = 48000,
            Status = "Accepted",
            AcceptedAt = DateTime.UtcNow.AddDays(-30),
            ValidUntil = DateTime.UtcNow.AddDays(-20),
            ClientId = client.Id,
            Assumptions = "Test fixture; indicative rates, non-binding.",
            Reason = "Test acceptance evidence.",
        };
        q.Items.Add(
            new QuoteItem
            {
                Description = "Standard deck",
                Quantity = 24,
                UnitRate = 2000,
                Amount = 48000,
            }
        );
        var p = new Project
        {
            Reference = "PRJ-2026-014",
            Name = "Mokoena Residence Deck",
            ClientId = client.Id,
            QuoteId = q.Id,
            ContractValue = 48000,
            Status = "Active",
        };
        foreach (
            var (title, day, done) in new[]
            {
                ("Site assessment & scope", -14, true),
                ("Foundations & preparation", -7, true),
                ("Deck installation", 7, false),
                ("Inspection & handover", 14, false),
            }
        )
            p.Milestones.Add(
                new Milestone
                {
                    Title = title,
                    DueAt = DateTime.UtcNow.Date.AddDays(day),
                    Complete = done,
                    Published = true,
                }
            );
        p.Updates.Add(
            new ProgressUpdate
            {
                Message =
                    "Foundations complete. The next phase is the deck installation, followed by inspection and handover.",
                Published = true,
            }
        );
        db.Quotes.Add(q);
        db.Projects.Add(p);
        db.Budgets.AddRange(
            new BudgetItem
            {
                ProjectId = p.Id,
                Description = "Materials",
                Amount = 28000,
                Published = true,
            },
            new BudgetItem
            {
                ProjectId = p.Id,
                Description = "Labour & installation",
                Amount = 16000,
                Published = true,
            },
            new BudgetItem
            {
                ProjectId = p.Id,
                Description = "Site preparation",
                Amount = 4000,
                Published = true,
            }
        );
        db.Invoices.Add(
            new Invoice
            {
                ProjectId = p.Id,
                Number = "INV-2026-031",
                Description = "Stage 1 deposit",
                Amount = 24000,
                Paid = 24000,
                DueAt = DateTime.UtcNow.Date.AddDays(-14),
                Published = true,
            }
        );
        var c = new ChangeRequest
        {
            ProjectId = p.Id,
            Description = "Add a wider step at the garden entrance.",
            Status = "Under Review",
        };
        c.History.Add(new ChangeHistory { Status = "Submitted", ActorId = client.Id });
        c.History.Add(
            new ChangeHistory
            {
                Status = "Under Review",
                ActorId = "demo",
                Reason = "Reviewing the site dimensions and material impact.",
            }
        );
        db.Changes.Add(c);
        db.Notifications.Add(
            new Notification
            {
                RecipientId = client.Id,
                ProjectId = p.Id,
                Message =
                    "Your project workspace is ready. Foundations are complete and your change request is under review.",
            }
        );
        var q2 = new Quote
        {
            SubmissionKey = Guid.NewGuid(),
            Reference = "QR-2026-0088",
            Name = other.FullName,
            Email = other.Email!,
            Type = "Boundary wall",
            Length = 10,
            Width = 2,
            Estimate = 33000,
            ClientId = other.Id,
            Status = "Submitted",
            Site = "Test site, Westville",
            Assumptions = "Test rates; subject to site assessment.",
        };
        q2.Items.Add(
            new QuoteItem
            {
                Description = "Standard boundary wall",
                Quantity = 20,
                UnitRate = 1650,
                Amount = 33000,
            }
        );
        db.Quotes.Add(q2);
        db.Audit.Add(
            new AuditEntry
            {
                ActorId = "demo",
                Action = "Demo.Seed",
                EntityId = p.Id.ToString(),
                Reason = "Fictional development records.",
            }
        );
        await db.SaveChangesAsync();
    }
}
