using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace DynamicConstruction.Api.Features.Identity;

[ApiController, Route("api/auth/recovery")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class RecoveryController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    AppDbContext db,
    Access access
) : ControllerBase
{
    public record CodesInput(string Password, string? Code);

    [Authorize, HttpPost("codes")]
    public async Task<IActionResult> Codes(CodesInput input)
    {
        var user = (await users.GetUserAsync(User))!;
        var check = await signIn.CheckPasswordSignInAsync(user, input.Password, true);
        Guard.Require(check.Succeeded, "Invalid credentials or account temporarily locked.", 401);
        if (user.TwoFactorEnabled)
        {
            var valid =
                !string.IsNullOrWhiteSpace(input.Code)
                && await users.VerifyTwoFactorTokenAsync(
                    user,
                    TokenOptions.DefaultAuthenticatorProvider,
                    input.Code.Replace(" ", "")
                );
            if (!valid)
            {
                await users.AccessFailedAsync(user);
                throw new AppError(401, "A valid authenticator code is required.");
            }
        }
        await using var tx = await db.Database.BeginTransactionAsync();
        var recoveryCodes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);
        Guard.Require(recoveryCodes != null, "Unable to generate recovery codes.");
        await users.ResetAccessFailedCountAsync(user);
        access.Audit("Account.RecoveryCodesReplaced", user.Id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(new { recoveryCodes });
    }

    public record RecoverInput(string Email, string RecoveryCode, string NewPassword);

    [HttpPost]
    public async Task<IActionResult> Recover(RecoverInput input)
    {
        const string invalid = "Invalid recovery details or account temporarily unavailable.";
        var user = await users.FindByEmailAsync(input.Email.Trim());
        Guard.Require(
            user != null && !user.Suspended && !await users.IsLockedOutAsync(user),
            invalid,
            400
        );
        await using var tx = await db.Database.BeginTransactionAsync();
        var redeemed = await users.RedeemTwoFactorRecoveryCodeAsync(
            user!,
            input.RecoveryCode.Trim()
        );
        if (!redeemed.Succeeded)
        {
            await users.AccessFailedAsync(user!);
            await tx.CommitAsync();
            throw new AppError(400, invalid);
        }

        var token = await users.GeneratePasswordResetTokenAsync(user!);
        // Identity's password reset rotates the security stamp, invalidating old device-trust tickets too.
        // Unlike ordinary logout, recovery must not reissue trust for the browser making this request.
        var reset = await users.ResetPasswordAsync(user!, token, input.NewPassword);
        Guard.Require(reset.Succeeded, string.Join(" ", reset.Errors.Select(x => x.Description)));
        Guard.Require(
            (await users.SetTwoFactorEnabledAsync(user!, false)).Succeeded,
            "Unable to reset MFA."
        );
        Guard.Require(
            (await users.ResetAuthenticatorKeyAsync(user!)).Succeeded,
            "Unable to reset authenticator."
        );
        // Recovery revokes every old code and session. Privileged users must enrol MFA again.
        Guard.Require(
            await users.GenerateNewTwoFactorRecoveryCodesAsync(user!, 0) != null,
            "Unable to revoke recovery codes."
        );
        await users.ResetAccessFailedCountAsync(user!);
        db.Audit.Add(
            new AuditEntry
            {
                ActorId = user!.Id,
                Action = "Account.Recovered",
                EntityId = user.Id,
                CorrelationId = HttpContext.TraceIdentifier,
            }
        );
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await signIn.SignOutAsync();
        return NoContent();
    }
}
