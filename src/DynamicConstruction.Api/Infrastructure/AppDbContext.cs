using DynamicConstruction.Api.Domain;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    public DbSet<ClientProfile> ClientProfiles => Set<ClientProfile>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<ProgressUpdate> Updates => Set<ProgressUpdate>();
    public DbSet<ProjectFile> Files => Set<ProjectFile>();
    public DbSet<ChangeRequest> Changes => Set<ChangeRequest>();
    public DbSet<BudgetItem> Budgets => Set<BudgetItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditEntry> Audit => Set<AuditEntry>();
    public DbSet<PublicContent> Content => Set<PublicContent>();
    public DbSet<EstimateRate> EstimateRates => Set<EstimateRate>();
    public DbSet<PortfolioEntry> Portfolio => Set<PortfolioEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<EstimateRate>().Property(x => x.Type).HasMaxLength(40);
        b.Entity<EstimateRate>().Property(x => x.Finish).HasMaxLength(40);
        b.Entity<EstimateRate>().HasIndex(x => new { x.Type, x.Finish }).IsUnique();
        b.Entity<PortfolioEntry>()
            .HasIndex(x => new
            {
                x.Published,
                x.CompletedAt,
                x.Id,
            });
        b.Entity<Quote>().HasIndex(x => new { x.CreatedAt, x.Id });
        b.Entity<Project>()
            .HasIndex(x => new
            {
                x.ClientId,
                x.CreatedAt,
                x.Id,
            });
        b.Entity<ClientProfile>().HasKey(x => x.UserId);
        b.Entity<ClientProfile>().Property(x => x.UserId).HasMaxLength(450);
        b.Entity<ClientProfile>()
            .HasOne(x => x.User)
            .WithOne()
            .HasForeignKey<ClientProfile>(x => x.UserId);
        b.Entity<ClientProfile>().HasIndex(x => x.Reference).IsUnique();
        b.Entity<ClientProfile>().Property(x => x.Reference).HasMaxLength(40);
        b.Entity<Quote>()
            .ToTable(t =>
                t.HasCheckConstraint(
                    "CK_Quote_Status",
                    "[Status] IN ('Submitted','Under Review','Quoted','Accepted','Declined','Expired','Rejected')"
                )
            );
        b.Entity<Project>()
            .ToTable(t =>
                t.HasCheckConstraint(
                    "CK_Project_Status",
                    "[Status] IN ('Planned','Active','On Hold','At Risk','Completed','Archived')"
                )
            );
        b.Entity<ChangeRequest>()
            .ToTable(t =>
                t.HasCheckConstraint(
                    "CK_Change_Status",
                    "[Status] IN ('Submitted','Under Review','Approved','Rejected','Implemented','Closed')"
                )
            );
        b.Entity<Invoice>()
            .ToTable(t =>
                t.HasCheckConstraint(
                    "CK_Invoice_Amounts",
                    Database.IsSqlite()
                        ? "CAST([Amount] AS NUMERIC) > 0 AND CAST([Paid] AS NUMERIC) >= 0 AND CAST([Paid] AS NUMERIC) <= CAST([Amount] AS NUMERIC)"
                        : "[Amount] > 0 AND [Paid] >= 0 AND [Paid] <= [Amount]"
                )
            );
        b.Entity<BudgetItem>()
            .ToTable(t =>
                t.HasCheckConstraint(
                    "CK_Budget_Amount",
                    Database.IsSqlite() ? "CAST([Amount] AS NUMERIC) > 0" : "[Amount] > 0"
                )
            );
        b.Entity<AppUser>().HasIndex(x => x.NormalizedEmail).IsUnique();
        b.Entity<AppUser>().Property(x => x.FullName).HasMaxLength(160);
        b.Entity<Quote>().Property(x => x.Reference).HasMaxLength(40);
        b.Entity<Project>().Property(x => x.Reference).HasMaxLength(40);
        b.Entity<Invoice>().Property(x => x.Number).HasMaxLength(50);
        b.Entity<PublicContent>().Property(x => x.Key).HasMaxLength(50);
        b.Entity<Quote>().Property(x => x.ClientId).HasMaxLength(450);
        b.Entity<Project>().Property(x => x.ClientId).HasMaxLength(450);
        b.Entity<Notification>().Property(x => x.RecipientId).HasMaxLength(450);
        b.Entity<Quote>().HasIndex(x => x.Reference).IsUnique();
        b.Entity<Quote>().HasIndex(x => x.SubmissionKey).IsUnique();
        b.Entity<Project>().HasIndex(x => x.Reference).IsUnique();
        b.Entity<Project>().HasIndex(x => x.QuoteId).IsUnique();
        b.Entity<Project>().HasIndex(x => x.ClientId);
        b.Entity<Invoice>().HasIndex(x => x.Number).IsUnique();
        b.Entity<PublicContent>().HasIndex(x => x.Key).IsUnique();
        b.Entity<Notification>().HasIndex(x => new { x.RecipientId, x.CreatedAt });
        b.Entity<Quote>().HasMany(x => x.Items).WithOne().HasForeignKey(x => x.QuoteId);
        b.Entity<Project>().HasMany(x => x.Milestones).WithOne().HasForeignKey(x => x.ProjectId);
        b.Entity<Project>().HasMany(x => x.Updates).WithOne().HasForeignKey(x => x.ProjectId);
        b.Entity<ChangeRequest>()
            .HasMany(x => x.History)
            .WithOne()
            .HasForeignKey(x => x.ChangeRequestId);
        foreach (
            var t in new[]
            {
                typeof(ProjectFile),
                typeof(ChangeRequest),
                typeof(BudgetItem),
                typeof(Invoice),
            }
        )
            b.Entity(t).HasOne(typeof(Project)).WithMany().HasForeignKey("ProjectId");
        foreach (var e in b.Model.GetEntityTypes())
        {
            foreach (var fk in e.GetForeignKeys())
                fk.DeleteBehavior = DeleteBehavior.Restrict;
            foreach (var p in e.GetProperties())
            {
                if (p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?))
                {
                    p.SetPrecision(18);
                    p.SetScale(2);
                }
                if (
                    typeof(Record).IsAssignableFrom(e.ClrType)
                    && p.ClrType == typeof(string)
                    && p.GetMaxLength() == null
                )
                    p.SetMaxLength(4000);
            }
            if (typeof(Record).IsAssignableFrom(e.ClrType))
            {
                b.Entity(e.ClrType).Property("Version").IsConcurrencyToken();
                b.Entity(e.ClrType).Property("Id").ValueGeneratedNever();
            }
        }
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (
            var e in ChangeTracker.Entries<Record>().Where(x => x.State == EntityState.Modified)
        )
        {
            if (e.Entity is AuditEntry)
                throw new InvalidOperationException("Audit records are immutable.");
            e.Entity.Version = Guid.NewGuid();
        }
        if (ChangeTracker.Entries<AuditEntry>().Any(x => x.State == EntityState.Deleted))
            throw new InvalidOperationException("Audit records are immutable.");
        return base.SaveChangesAsync(ct);
    }
}
