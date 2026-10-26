using DynamicConstruction.Api.Domain;
using Microsoft.EntityFrameworkCore;
using DynamicConstruction.Api.Features.Finance;
using DynamicConstruction.Api.Features.Operations;
using DynamicConstruction.Api.Features.Quotes;
using DynamicConstruction.Api.Infrastructure;
using Xunit;

namespace DynamicConstruction.Tests;

public class BusinessRulesTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PricingUsesOnlyPublishedDatabaseRates(bool published)
    {
        await using var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.EstimateRates.Add(new EstimateRate { Type = "Deck", Finish = "Standard", UnitRate = 25, Published = published });
        await db.SaveChangesAsync();
        var service = new QuotePricingService(db);
        if (published)
            Assert.Equal(100, (await service.Calculate(new("Deck", 2, 2, "Standard")))!.Total);
        else
            Assert.Null(await service.Calculate(new("Deck", 2, 2, "Standard")));
    }

    [Fact]
    public async Task UnpricedOptionsStillValidateDimensions()
    {
        await using var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        await Assert.ThrowsAsync<AppError>(() => new QuotePricingService(db).Calculate(new("Pool", 0, 4, "Standard")));
    }
    [Theory]
    [InlineData("2026-09-14T14:00:00+02:00")]
    [InlineData("2026-09-14T12:00:00Z")]
    [InlineData("2026-09-14T12:00:00")]
    public void ApiDatesNormalizeToUtc(string timestamp)
    {
        var options = new System.Text.Json.JsonSerializerOptions();
        options.Converters.Add(new UtcDateTimeConverter());
        var value = System.Text.Json.JsonSerializer.Deserialize<DateTime>("\"" + timestamp + "\"", options);
        Assert.Equal(new DateTime(2026, 9, 14, 12, 0, 0, DateTimeKind.Utc), value);
        Assert.Equal(DateTimeKind.Utc, value.Kind);
        Assert.Equal("\"2026-09-14T12:00:00Z\"", System.Text.Json.JsonSerializer.Serialize(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), options));
    }
    [Fact]
    public void EstimateRetainsConfiguredRateVersionAndAssumptions()
    {
        var rate = new EstimateRate { Type = "Deck", Finish = "Standard", UnitRate = 1234.56m, Assumptions = "Site access excluded." };
        var result = EstimateService.Calculate(new("Deck", 2, 2, "Standard"), rate);
        Assert.Equal(4938.24m, result.Total);
        Assert.Equal(rate.Version.ToString(), result.RateVersion);
        Assert.Equal(rate.Assumptions, result.Assumptions);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void InvalidConfiguredRateFails(decimal amount) => Assert.Throws<AppError>(() => EstimateService.Calculate(new("Deck", 2, 2, "Standard"), new EstimateRate { Type = "Deck", Finish = "Standard", UnitRate = amount }));

    [Fact]
    public void MismatchedConfiguredRateFails() => Assert.Throws<AppError>(() => EstimateService.Calculate(new("Deck", 2, 2, "Standard"), new EstimateRate { Type = "Pool", Finish = "Standard", UnitRate = 100 }));

    [Theory]
    [InlineData(1.001, 0)]
    [InlineData(100, 1.001)]
    public void FractionalCentsFail(decimal amount, decimal paid) => Assert.Throws<AppError>(() => FinanceRules.Amount(amount, paid));

    private static EstimateResult Calculate(EstimateInput input) =>
        EstimateService.Calculate(
            input,
            new EstimateRate
            {
                Type = input.Type,
                Finish = input.Finish,
                UnitRate =
                    input.Type == "Pool" ? 7200
                    : input.Type == "Room addition" ? 5500
                    : input.Type == "Boundary wall" ? 3000
                    : 2250,
                Assumptions = "Test rate schedule",
            }
        );

    [Theory]
    [InlineData("Deck", 54000)]
    [InlineData("Pool", 172800)]
    [InlineData("Room addition", 132000)]
    public void EstimatesUseSuppliedRates(string type, decimal total) =>
        Assert.Equal(total, Calculate(new(type, 6, 4, "Standard")).Total);

    [Fact]
    public void WallUsesLengthTimesHeight() =>
        Assert.Equal(36000, Calculate(new("Boundary wall", 6, 2, "Standard")).Total);

    [Theory]
    [InlineData("Unknown", 6, 4, "Standard")]
    [InlineData("Deck", 0, 4, "Standard")]
    [InlineData("Deck", 101, 4, "Standard")]
    [InlineData("Deck", 6, 0, "Standard")]
    [InlineData("Deck", 100, 100, "Standard")]
    [InlineData("Boundary wall", 6, 4, "Standard")]
    [InlineData("Pool", 6, 4, "Premium")]
    [InlineData("Concrete slab", 6, 4, "Standard")]
    [InlineData("Other", 6, 4, "Standard")]
    [InlineData("Deck", 6, 4, "Invalid")]
    [InlineData("Deck", 6, 4, "Essential")]
    [InlineData("Deck", 6, 4, "Premium")]
    public void InvalidEstimatesFail(string type, decimal length, decimal width, string finish) =>
        Assert.Throws<AppError>(() => Calculate(new(type, length, width, finish)));

    [Theory]
    [InlineData("Submitted", "Under Review")]
    [InlineData("Under Review", "Quoted")]
    [InlineData("Under Review", "Rejected")]
    [InlineData("Quoted", "Declined")]
    [InlineData("Quoted", "Accepted")]
    public void QuoteTransitions(string from, string to) =>
        Lifecycle.Quote(from, to, DateTime.UtcNow.AddDays(1), DateTime.UtcNow);

    [Theory]
    [InlineData("Submitted", "Accepted")]
    [InlineData("Accepted", "Quoted")]
    [InlineData("Rejected", "Under Review")]
    public void InvalidQuoteTransitionsFail(string from, string to) =>
        Assert.Throws<AppError>(() =>
            Lifecycle.Quote(from, to, DateTime.UtcNow.AddDays(1), DateTime.UtcNow)
        );

    [Fact]
    public void ExpiredAcceptanceFails() =>
        Assert.Throws<AppError>(() =>
            Lifecycle.Quote("Quoted", "Accepted", DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow)
        );

    [Fact]
    public void PrematureExpiryFails() =>
        Assert.Throws<AppError>(() =>
            Lifecycle.Quote("Quoted", "Expired", DateTime.UtcNow.AddDays(1), DateTime.UtcNow)
        );

    [Fact]
    public void ExpiryWorks() =>
        Lifecycle.Quote("Quoted", "Expired", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow);

    [Theory]
    [InlineData("Planned", "Active")]
    [InlineData("Active", "On Hold")]
    [InlineData("On Hold", "Active")]
    [InlineData("Active", "At Risk")]
    [InlineData("At Risk", "Active")]
    [InlineData("Active", "Completed")]
    [InlineData("Completed", "Archived")]
    public void ProjectTransitions(string from, string to) =>
        Lifecycle.Project(from, to, true, "Recorded reason and approved variance.");

    [Fact]
    public void IncompleteProjectCannotComplete() =>
        Assert.Throws<AppError>(() => Lifecycle.Project("Active", "Completed", false, ""));

    [Fact]
    public void AtRiskCompletionNeedsVariance() =>
        Assert.Throws<AppError>(() => Lifecycle.Project("At Risk", "Completed", false, ""));

    [Fact]
    public void ApprovedVariancePermitsCompletion() =>
        Lifecycle.Project(
            "At Risk",
            "Completed",
            false,
            "Variance approved by client and site manager."
        );

    [Fact]
    public void ArchiveCannotReopen() =>
        Assert.Throws<AppError>(() => Lifecycle.Project("Archived", "Active", true, ""));

    [Theory]
    [InlineData("Submitted", "Under Review")]
    [InlineData("Submitted", "Withdrawn")]
    [InlineData("Under Review", "Approved")]
    [InlineData("Under Review", "Rejected")]
    [InlineData("Under Review", "Withdrawn")]
    [InlineData("Approved", "Implemented")]
    [InlineData("Implemented", "Closed")]
    [InlineData("Rejected", "Closed")]
    public void ChangeTransitions(string from, string to) => Lifecycle.Change(from, to);

    [Theory]
    [InlineData("Submitted", "Approved")]
    [InlineData("Approved", "Withdrawn")]
    [InlineData("Closed", "Under Review")]
    public void InvalidChangesFail(string from, string to) =>
        Assert.Throws<AppError>(() => Lifecycle.Change(from, to));

    [Theory]
    [InlineData(0, 0)]
    [InlineData(-1, 0)]
    [InlineData(100, 101)]
    [InlineData(100, -1)]
    [InlineData(100000001, 0)]
    public void InvalidMoneyFails(decimal amount, decimal paid) =>
        Assert.Throws<AppError>(() => FinanceRules.Amount(amount, paid));

    [Theory]
    [InlineData(1, 0)]
    [InlineData(100, 100)]
    [InlineData(100, 50)]
    public void ValidMoney(decimal amount, decimal paid) => FinanceRules.Amount(amount, paid);
}
