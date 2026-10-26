using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Quotes;

public record EstimateInput(string Type, decimal Length, decimal Width, string Finish);

public record EstimateResult(
    decimal Area,
    decimal UnitRate,
    decimal Total,
    string Assumptions,
    string RateVersion
);

public static class EstimateService
{
    public static readonly string[] Types = ["Boundary wall", "Deck", "Pool", "Room addition"];

    // Custom requests are described in words and priced after a site assessment.
    public const string OtherType = "Other";

    public const string UnpricedAssumptions =
        "No online rate applies to this request. We will price it after a site assessment and formal quotation.";

    public static void ValidateOption(string type, string finish)
    {
        Guard.Require(Types.Contains(type), "Choose a supported project type.");
        // Each project type has a single published rate, recorded under the standard finish.
        Guard.Require(finish == "Standard", "Choose a supported finish.");
    }

    public static decimal Area(EstimateInput input)
    {
        ValidateOption(input.Type, input.Finish);
        Guard.Require(input.Length is >= 1 and <= 100, "Length must be between 1 and 100 metres.");
        Guard.Require(
            input.Width >= .5m && input.Width <= (input.Type == "Boundary wall" ? 3m : 100m),
            "Enter valid width or wall height in metres."
        );
        var area = decimal.Round(input.Length * input.Width, 2, MidpointRounding.AwayFromZero);
        Guard.Require(area <= 1000, "Area cannot exceed 1,000 m².");
        return area;
    }

    public static EstimateResult Calculate(EstimateInput input, EstimateRate rate)
    {
        var area = Area(input);
        Guard.Require(
            rate.Type == input.Type && rate.Finish == input.Finish && rate.UnitRate > 0,
            "A valid rate is required."
        );
        return new(
            area,
            rate.UnitRate,
            decimal.Round(area * rate.UnitRate, 2, MidpointRounding.AwayFromZero),
            rate.Assumptions,
            rate.Version.ToString()
        );
    }
}

public class QuotePricingService(AppDbContext db)
{
    // Null means no published rate offers an online price; nothing is fabricated in its place.
    public async Task<EstimateResult?> Calculate(EstimateInput input)
    {
        EstimateService.Area(input);
        var rate = await db
            .EstimateRates.AsNoTracking()
            .SingleOrDefaultAsync(x =>
                x.Type == input.Type && x.Finish == input.Finish && x.Published
            );
        return rate == null ? null : EstimateService.Calculate(input, rate);
    }
}
