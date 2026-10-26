using DynamicConstruction.Api.Features.Identity;
using DynamicConstruction.Api.Infrastructure;
using Xunit;

namespace DynamicConstruction.Tests;

public class IdentityValidationTests
{
    [Theory]
    [InlineData("Anne-Marie O’Neill")]
    [InlineData("José da Silva")]
    [InlineData("李明")]
    [InlineData("Ame\u0301lie")]
    public void AcceptsNamesWithLettersAndNormalNameSeparators(string name) =>
        Assert.Equal(name, IdentityValidation.FullName(name));

    [Theory]
    [InlineData("Client123")]
    [InlineData("1234")]
    [InlineData("   ")]
    [InlineData("A")]
    [InlineData("Jane<script>")]
    [InlineData("-Jane")]
    public void RejectsInvalidNamesEvenWhenClientValidationIsBypassed(string name) =>
        Assert.Throws<AppError>(() => IdentityValidation.FullName(name));
}
