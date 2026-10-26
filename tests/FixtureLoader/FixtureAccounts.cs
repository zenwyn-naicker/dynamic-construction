using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Fixtures;

public static class FixtureAccounts
{
    public static async Task Identity(
        IServiceProvider services,
        IConfiguration config,
        IWebHostEnvironment env
    )
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Client", "Staff", "Admin" })
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
        if (!env.IsDevelopment())
            return;
        var password = config["Fixture:Password"];
        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "Set Fixture__Password to seed development accounts."
            );
        var users = services.GetRequiredService<UserManager<AppUser>>();
        foreach (
            var (email, name, role) in new[]
            {
                ("thandi@example.test", "Thandi Mokoena", "Client"),
                ("lindi@example.test", "Lindi Naidoo", "Client"),
                ("new@example.test", "New Client", "Client"),
                ("staff@example.test", "Thabo Ndlovu", "Staff"),
                ("admin@example.test", "Reference Administrator", "Admin"),
            }
        )
        {
            if (await users.FindByEmailAsync(email) is AppUser existing)
            {
                if (role == "Client")
                {
                    var existingDb = services.GetRequiredService<AppDbContext>();
                    if (!await existingDb.ClientProfiles.AnyAsync(x => x.UserId == existing.Id))
                    {
                        existingDb.ClientProfiles.Add(new ClientProfile { UserId = existing.Id });
                        await existingDb.SaveChangesAsync();
                    }
                }
                continue;
            }
            var user = new AppUser
            {
                UserName = email,
                Email = email,
                FullName = name,
            };
            var result = await users.CreateAsync(user, password);
            if (!result.Succeeded)
                throw new InvalidOperationException(
                    string.Join(" ", result.Errors.Select(x => x.Description))
                );
            await users.AddToRoleAsync(user, role);
            if (role == "Client")
            {
                var db = services.GetRequiredService<AppDbContext>();
                db.ClientProfiles.Add(new ClientProfile { UserId = user.Id });
                await db.SaveChangesAsync();
            }
        }
    }
}
