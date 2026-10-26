using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Quotes;

[ApiController, Route("api/quotes")]
public class QuoteSubmissionController(AppDbContext db, Access access, QuotePricingService pricing)
    : ControllerBase
{
    [HttpPost("estimate")]
    public async Task<object> Estimate(EstimateInput input) =>
        (object?)await pricing.Calculate(input) ?? Unpriced(EstimateService.Area(input));

    public record SubmitInput(
        Guid SubmissionKey,
        string Type,
        decimal Length,
        decimal Width,
        string Finish,
        string Name,
        string Email,
        string Phone,
        string Site,
        string Notes,
        string? Description,
        bool Consent
    );

    [HttpPost]
    public async Task<IActionResult> Submit(SubmitInput input)
    {
        Guard.Require(input.SubmissionKey != Guid.Empty, "A submission key is required.");
        Guard.Require(input.Consent, "Consent is required to process the quote request.");
        var hash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(input)))
        );
        var existing = await db
            .Quotes.AsNoTracking()
            .SingleOrDefaultAsync(x => x.SubmissionKey == input.SubmissionKey);
        if (existing != null)
        {
            Guard.Require(
                existing.PayloadHash == hash,
                "This submission key was already used. Start a new request.",
                409
            );
            return Ok(Confirmation(existing));
        }
        var other = input.Type == EstimateService.OtherType;
        var result = other
            ? null
            : await pricing.Calculate(new(input.Type, input.Length, input.Width, input.Finish));
        var q = new Quote
        {
            SubmissionKey = input.SubmissionKey,
            PayloadHash = hash,
            Type = input.Type,
            Length = other ? 0 : input.Length,
            Width = other ? 0 : input.Width,
            Finish = other ? "" : input.Finish,
            Description = other
                ? Guard.Text(input.Description, "Project description", 10, 500)
                : "",
            Name = Guard.Text(input.Name, "Name", 2, 160),
            Email = Guard.Text(input.Email, "Email", 5, 254),
            Phone = Guard.Text(input.Phone, "Phone", 7, 30),
            Site = Guard.Text(input.Site, "Site address", 5, 500),
            Notes = Guard.Text(input.Notes, "Notes", 0, 2000),
            Estimate = result?.Total,
            Assumptions = result?.Assumptions ?? EstimateService.UnpricedAssumptions,
            RateVersion = result?.RateVersion ?? "",
        };
        Guard.Require(
            new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(q.Email),
            "Enter a valid email address."
        );
        if (result != null)
            q.Items.Add(
                new QuoteItem
                {
                    Description = $"{q.Type} / {q.Finish}",
                    Quantity = result.Area,
                    UnitRate = result.UnitRate,
                    Amount = result.Total,
                }
            );
        db.Quotes.Add(q);
        access.Audit("Quote.Submit", q.Id);
        await db.SaveChangesAsync();
        return Ok(Confirmation(q));
    }

    private static object Unpriced(decimal area) =>
        new
        {
            Area = area,
            UnitRate = (decimal?)null,
            Total = (decimal?)null,
            Assumptions = EstimateService.UnpricedAssumptions,
            RateVersion = "",
        };

    private static object Confirmation(Quote q) =>
        new
        {
            q.Id,
            q.Reference,
            q.Estimate,
            q.Assumptions,
            q.RateVersion,
            q.Status,
        };
}
