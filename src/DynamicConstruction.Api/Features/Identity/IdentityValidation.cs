using System.Text.RegularExpressions;
using DynamicConstruction.Api.Infrastructure;

namespace DynamicConstruction.Api.Features.Identity;

public static class IdentityValidation
{
    public static string FullName(string value)
    {
        var name = Guard.Text(value, "Full name", 2, 160);
        Guard.Require(
            Regex.IsMatch(name, @"^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$"),
            "Full name must use letters, spaces, hyphens or apostrophes. Numbers are not allowed."
        );
        return name;
    }
}
