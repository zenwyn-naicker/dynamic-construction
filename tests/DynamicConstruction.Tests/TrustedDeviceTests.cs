using DynamicConstruction.Api.Features.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace DynamicConstruction.Tests;

public class TrustedDeviceTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class Environment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static string Cookie(DefaultHttpContext context) =>
        context.Response.Headers.SetCookie.ToString().Split(';')[0];

    private static DefaultHttpContext Request(string cookie)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = cookie;
        return context;
    }

    [Fact]
    public void TrustExpiresAfterSevenDaysAndCannotBeUsedForAnotherAccountOrStamp()
    {
        var clock = new Clock();
        var service = new TrustedDevice(new EphemeralDataProtectionProvider(), clock, new Environment());
        var response = new DefaultHttpContext();
        service.Remember(response, "admin", "stamp");
        var request = Request(Cookie(response));
        Assert.Equal(clock.Now.AddDays(7), service.Read(request, "admin", "stamp"));
        Assert.Null(service.Read(request, "staff", "stamp"));
        Assert.Null(service.Read(request, "admin", "recovered-stamp"));
        Assert.Contains("secure", response.Response.Headers.SetCookie.ToString());
        Assert.Contains("httponly", response.Response.Headers.SetCookie.ToString());
        clock.Now = clock.Now.AddDays(7);
        Assert.Null(service.Read(request, "admin", "stamp"));
    }

    [Fact]
    public void LogoutCanRotateStampWithoutExtendingTrustAndAccountsCanCoexist()
    {
        var clock = new Clock();
        var service = new TrustedDevice(new EphemeralDataProtectionProvider(), clock, new Environment());
        var admin = new DefaultHttpContext();
        var staff = new DefaultHttpContext();
        service.Remember(admin, "admin", "old");
        service.Remember(staff, "staff", "staff-stamp");
        var request = Request(Cookie(admin) + "; " + Cookie(staff));
        var expiry = service.Read(request, "admin", "old");
        Assert.NotNull(service.Read(request, "staff", "staff-stamp"));
        clock.Now = clock.Now.AddDays(3);
        var logout = new DefaultHttpContext();
        service.Remember(logout, "admin", "new", expiry);
        Assert.Equal(expiry, service.Read(Request(Cookie(logout)), "admin", "new"));
        Assert.Null(service.Read(Request(Cookie(logout)), "admin", "old"));
        clock.Now = clock.Now.AddDays(4);
        Assert.Null(service.Read(Request(Cookie(logout)), "admin", "new"));
    }

    [Fact]
    public void TamperedCookieIsRejectedAndForgetDeletesOnlySelectedAccount()
    {
        var service = new TrustedDevice(new EphemeralDataProtectionProvider(), new Clock(), new Environment());
        var response = new DefaultHttpContext();
        service.Remember(response, "admin", "stamp");
        var name = Cookie(response).Split('=')[0];
        Assert.Null(service.Read(Request(name + "=invalid"), "admin", "stamp"));
        var forgotten = new DefaultHttpContext();
        service.Forget(forgotten, "admin");
        Assert.StartsWith(name + "=;", forgotten.Response.Headers.SetCookie.ToString());
        Assert.Contains("path=/api/auth", forgotten.Response.Headers.SetCookie.ToString());
    }
}
