using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Identity;

[ApiController, Route("api/auth")]
public class IdentityController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    AppDbContext db,
    Access access,
    IWebHostEnvironment env,
    TrustedDevice trustedDevice
) : ControllerBase
{
    public record RegisterInput(string FullName, string Email, string Password);

    public record LoginInput(string Email, string Password, string? Code, bool RememberDevice = false);

    public record LoginResult(bool RequiresMfaCode, bool RequiresMfaSetup);

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterInput input)
    {
        var email = Guard.Text(input.Email, "Email", 5, 254);
        Guard.Require(
            new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email),
            "Enter a valid email address."
        );
        var u = new AppUser
        {
            UserName = email,
            Email = email,
            FullName = IdentityValidation.FullName(input.FullName),
        };
        await using var tx = await db.Database.BeginTransactionAsync();
        var r = await users.CreateAsync(u, input.Password);
        Guard.Require(r.Succeeded, string.Join(" ", r.Errors.Select(x => x.Description)));
        var role = await users.AddToRoleAsync(u, "Client");
        Guard.Require(role.Succeeded, "Unable to create client role.");
        db.ClientProfiles.Add(new ClientProfile { UserId = u.Id });
        access.Audit("Account.Register", u.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(new { message = "Account created. You can now sign in." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginInput input)
    {
        var u = await users.FindByEmailAsync(input.Email.Trim());
        Guard.Require(u != null && !u.Suspended, "Email or password is incorrect.", 401);
        var check = await signIn.CheckPasswordSignInAsync(u!, input.Password, true);
        Guard.Require(
            check.Succeeded,
            "Email or password is incorrect, or the account is temporarily locked.",
            401
        );
        if (u!.TwoFactorEnabled && trustedDevice.Read(HttpContext, u.Id, u.SecurityStamp!) == null)
        {
            if (string.IsNullOrWhiteSpace(input.Code))
                return Ok(new LoginResult(true, false));

            var validCode =
                await users.VerifyTwoFactorTokenAsync(
                    u,
                    TokenOptions.DefaultAuthenticatorProvider,
                    input.Code.Replace(" ", "")
                );
            if (!validCode)
            {
                await users.AccessFailedAsync(u);
                throw new AppError(401, "A valid authenticator code is required.");
            }
            await users.ResetAccessFailedCountAsync(u);
            if (input.RememberDevice)
                trustedDevice.Remember(HttpContext, u.Id, u.SecurityStamp!);
        }
        var privileged =
            await users.IsInRoleAsync(u, "Staff") || await users.IsInRoleAsync(u, "Admin");
        // A restricted setup session lets newly provisioned privileged users enrol MFA before accessing operational data.
        await signIn.SignInAsync(u, false);
        db.Audit.Add(
            new AuditEntry
            {
                ActorId = u.Id,
                Action = "Account.Login",
                EntityId = u.Id,
                CorrelationId = HttpContext.TraceIdentifier,
            }
        );
        await db.SaveChangesAsync();
        return Ok(new LoginResult(false, privileged && !u.TwoFactorEnabled && !env.IsDevelopment()));
    }

    [Authorize, HttpGet("me")]
    public async Task<object> Me()
    {
        var u = (await users.GetUserAsync(User))!;
        var roles = await users.GetRolesAsync(u);
        return new
        {
            u.Id,
            u.Email,
            u.FullName,
            Roles = roles,
            RequiresMfaSetup = !env.IsDevelopment() && !u.TwoFactorEnabled
                && roles.Any(role => role is "Staff" or "Admin"),
            u.TwoFactorEnabled,
        };
    }

    /**************************************************************************************************************
     * Author: Microsoft
     * Date: n.d.
     * Title: UserManager<TUser>.UpdateSecurityStampAsync(TUser) Method
     * Type: [API documentation]
     * Available at: <https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.identity.usermanager-1.updatesecuritystampasync?view=aspnetcore-10.0> [Accessed 18 October 2026]
     **************************************************************************************************************/
    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var current = await users.GetUserAsync(User);
        if (current != null)
        {
            // Preserve this browser's verified trust while retaining logout's existing session revocation.
            // Reissue against the new stamp with the original expiry so logout never extends the seven days.
            var expiry = trustedDevice.Read(HttpContext, current.Id, current.SecurityStamp!);
            var updated = await users.UpdateSecurityStampAsync(current);
            Guard.Require(updated.Succeeded, "Unable to sign out securely.");
            if (expiry != null)
                trustedDevice.Remember(HttpContext, current.Id, current.SecurityStamp!, expiry);
        }
        await signIn.SignOutAsync();
        return NoContent();
    }

    [Authorize, HttpPost("mfa/forget-device")]
    public IActionResult ForgetDevice()
    {
        trustedDevice.Forget(HttpContext, users.GetUserId(User)!);
        return NoContent();
    }

    [Authorize, HttpPut("profile")]
    public async Task<IActionResult> Profile(ProfileInput input)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var u = (await users.GetUserAsync(User))!;
        u.FullName = IdentityValidation.FullName(input.FullName);
        Guard.Require(
            (await users.UpdateAsync(u)).Succeeded,
            "Account changed. Reload before saving.",
            409
        );
        access.Audit("Account.Profile", u.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    public record ProfileInput(string FullName);

    [Authorize, HttpPost("password")]
    public async Task<IActionResult> Password(PasswordInput input)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var u = (await users.GetUserAsync(User))!;
        var r = await users.ChangePasswordAsync(u, input.Current, input.New);
        Guard.Require(r.Succeeded, string.Join(" ", r.Errors.Select(x => x.Description)));
        access.Audit("Account.PasswordChanged", u.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await signIn.SignOutAsync();
        return NoContent();
    }

    public record PasswordInput(string Current, string New);

    [Authorize, HttpPost("mfa/setup")]
    public async Task<object> Setup()
    {
        var u = (await users.GetUserAsync(User))!;
        Guard.Require(!u.TwoFactorEnabled, "MFA is already enabled.");
        var key = await users.GetAuthenticatorKeyAsync(u);
        if (key == null)
        {
            Guard.Require(
                (await users.ResetAuthenticatorKeyAsync(u)).Succeeded,
                "Unable to initialise authenticator."
            );
            key = await users.GetAuthenticatorKeyAsync(u);
            await signIn.RefreshSignInAsync(u);
        }
        return new
        {
            key,
            issuer = "Dynamic Construction",
            account = u.Email,
        };
    }

    public record CodeInput(string Code);

    [Authorize, HttpPost("mfa/enable")]
    public async Task<IActionResult> Enable(CodeInput input)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var u = (await users.GetUserAsync(User))!;
        Guard.Require(!u.TwoFactorEnabled, "MFA is already enabled.");
        Guard.Require(
            await users.VerifyTwoFactorTokenAsync(
                u,
                TokenOptions.DefaultAuthenticatorProvider,
                input.Code.Replace(" ", "")
            ),
            "Invalid authenticator code."
        );
        Guard.Require(
            (await users.SetTwoFactorEnabledAsync(u, true)).Succeeded,
            "Unable to enable authenticator."
        );
        var recoveryCodes = await users.GenerateNewTwoFactorRecoveryCodesAsync(u, 10);
        Guard.Require(recoveryCodes != null, "Unable to generate recovery codes.");
        access.Audit("Account.MfaEnabled", u.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await signIn.RefreshSignInAsync(u);
        Response.Headers.CacheControl = "no-store";
        return Ok(new { recoveryCodes });
    }
}
