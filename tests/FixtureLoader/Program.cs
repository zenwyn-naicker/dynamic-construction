using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using DynamicConstruction.Fixtures;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

if (Environment.GetEnvironmentVariable("FIXTURE_DATABASE_CONFIRMATION") != "isolated-test-database")
    throw new InvalidOperationException(
        "Set FIXTURE_DATABASE_CONFIRMATION=isolated-test-database. This command creates fictional test records."
    );
var builder = WebApplication.CreateBuilder(args);
builder.Environment.EnvironmentName = "Development";
var connection =
    builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("ConnectionStrings__Database required.");
var sqlite = builder.Configuration["Database:Provider"] == "Sqlite";
builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (sqlite)
        o.UseSqlite(connection);
    else
        o.UseSqlServer(connection);
});
builder
    .Services.AddIdentity<AppUser, IdentityRole>(o => o.Password.RequiredLength = 12)
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
using var app = builder.Build();
using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
if (sqlite)
    await db.Database.EnsureCreatedAsync();
await FixtureAccounts.Identity(scope.ServiceProvider, builder.Configuration, builder.Environment);
foreach (
    var (type, finish, rate) in new[]
    {
        ("Boundary wall", "Standard", 3000m),
        ("Deck", "Standard", 2250m),
        ("Pool", "Standard", 7200m),
        ("Room addition", "Standard", 5500m),
    }
)
    if (!await db.EstimateRates.AnyAsync(x => x.Type == type && x.Finish == finish))
        db.EstimateRates.Add(
            new EstimateRate
            {
                Type = type,
                Finish = finish,
                UnitRate = rate,
                Published = true,
                Assumptions =
                    "Test rate schedule; subject to site assessment and formal quotation.",
            }
        );
await db.SaveChangesAsync();
if (args.Contains("--projects"))
    await SiteFixtures.Create(scope.ServiceProvider);
Console.WriteLine("Test fixtures loaded.");
