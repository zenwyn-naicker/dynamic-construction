using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace DynamicConstruction.Api.Features.Identity;

/**************************************************************************************************************
 * Author: Microsoft
 * Date: 2024
 * Title: Consumer APIs overview for ASP.NET Core
 * Type: [Documentation and sample code]
 * Available at: <https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/consumer-apis/overview?view=aspnetcore-10.0> [Accessed 18 October 2026]
 **************************************************************************************************************/
public sealed class TrustedDevice(IDataProtectionProvider protection, TimeProvider clock, IHostEnvironment environment)
{
    // ASP.NET Core Data Protection encrypts and authenticates tickets with a purpose specific to device trust.
    private readonly IDataProtector protector = protection.CreateProtector("TrustedDevice.v1");
    private sealed record Ticket(string UserId, string Stamp, DateTimeOffset Expires);

    // Separate cookie names let accounts share a browser without replacing one another's trust.
    private static string CookieName(string userId) =>
        "dc.trust." + Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(userId)));

    public DateTimeOffset? Read(HttpContext context, string userId, string stamp)
    {
        var cookie = context.Request.Cookies[CookieName(userId)];
        if (cookie == null) return null;
        try
        {
            var ticket = JsonSerializer.Deserialize<Ticket>(protector.Unprotect(cookie));
            // Check the protected expiry server-side; a browser cookie expiry alone cannot enforce trust.
            return ticket != null && ticket.UserId == userId && ticket.Stamp == stamp
                && ticket.Expires > clock.GetUtcNow() ? ticket.Expires : null;
        }
        catch (Exception error) when (error is CryptographicException or JsonException)
        {
            return null;
        }
    }

    /**************************************************************************************************************
     * Author: Microsoft (Rick Anderson)
     * Date: n.d.
     * Title: Work with SameSite cookies in ASP.NET Core
     * Type: [Documentation and sample code]
     * Available at: <https://learn.microsoft.com/en-us/aspnet/core/security/samesite?view=aspnetcore-10.0> [Accessed 18 October 2026]
     **************************************************************************************************************/
    public void Remember(HttpContext context, string userId, string stamp, DateTimeOffset? expires = null)
    {
        var expiry = expires ?? clock.GetUtcNow().AddDays(7);
        context.Response.Cookies.Append(CookieName(userId),
            protector.Protect(JsonSerializer.Serialize(new Ticket(userId, stamp, expiry))),
            new CookieOptions
            {
                HttpOnly = true,
                Secure = !environment.IsDevelopment() || context.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth",
                Expires = expiry,
                IsEssential = true,
            });
    }

    public void Forget(HttpContext context, string userId) =>
        context.Response.Cookies.Delete(CookieName(userId), new CookieOptions { Path = "/api/auth" });
}
