using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Quotes;

[ApiController, Authorize(Policy = "Staff"), Route("api/pricing")]
public class PricingController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> List() =>
        await db
            .EstimateRates.AsNoTracking()
            .OrderBy(x => x.Type)
            .ThenBy(x => x.Finish)
            .ToListAsync();

    public record Input(
        string Type,
        string Finish,
        Guid Version,
        decimal UnitRate,
        string Assumptions,
        bool Published
    );

    [HttpPut]
    public async Task<object> Save(Input input)
    {
        EstimateService.ValidateOption(input.Type, input.Finish);
        Guard.Require(
            input.UnitRate is > 0 and <= 100000
                && decimal.Round(input.UnitRate, 2) == input.UnitRate,
            "Enter a positive unit rate with at most two decimal places."
        );
        var rate = await db.EstimateRates.SingleOrDefaultAsync(x =>
            x.Type == input.Type && x.Finish == input.Finish
        );
        if (rate == null)
        {
            Guard.Require(input.Version == Guid.Empty, "Rate changed. Reload.", 409);
            rate = new EstimateRate { Type = input.Type, Finish = input.Finish };
            db.EstimateRates.Add(rate);
        }
        else
            Guard.Version(rate, input.Version);
        rate.UnitRate = input.UnitRate;
        rate.Assumptions = Guard.Text(input.Assumptions, "Estimate assumptions", 10, 2000);
        rate.Published = input.Published;
        access.Audit("Pricing.Save", rate.Id, rate.Type + "/" + rate.Finish);
        await db.SaveChangesAsync();
        return rate;
    }
}
