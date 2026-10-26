using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Identity;

public static class IdentityBootstrap
{
    public static async Task EnsureRoles(IServiceProvider services)
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Client", "Staff", "Admin" })
            if (!await roles.RoleExistsAsync(role))
                Guard.Require(
                    (await roles.CreateAsync(new IdentityRole(role))).Succeeded,
                    "Unable to initialise account roles."
                );
    }

    public static async Task Bootstrap(IServiceProvider services, IConfiguration config)
    {
        var db = services.GetRequiredService<AppDbContext>();
        await using var tx = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable
        );
        var users = services.GetRequiredService<UserManager<AppUser>>();
        Guard.Require(
            (await users.GetUsersInRoleAsync("Admin")).Count == 0,
            "An administrator already exists. Use the protected administrator workflow."
        );
        var email =
            config["Bootstrap:Email"]
            ?? throw new InvalidOperationException("Bootstrap:Email required");
        var password =
            config["Bootstrap:Password"]
            ?? throw new InvalidOperationException("Bootstrap:Password required");
        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FullName = "System Administrator",
        };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                string.Join(" ", result.Errors.Select(x => x.Description))
            );
        Guard.Require(
            (await users.AddToRoleAsync(user, "Admin")).Succeeded,
            "Unable to assign administrator role."
        );
        db.Audit.Add(
            new AuditEntry
            {
                ActorId = "bootstrap",
                Action = "Account.BootstrapAdmin",
                EntityId = user.Id,
            }
        );
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }
}
