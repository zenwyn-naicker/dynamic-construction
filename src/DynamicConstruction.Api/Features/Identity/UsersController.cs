using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Identity;

[ApiController, Authorize(Policy = "Admin"), Route("api/users")]
public class UsersController(UserManager<AppUser> users, AppDbContext db, Access access)
    : ControllerBase
{
    [HttpGet]
    public async Task<object> List(int page = 1, string? search = null, CancellationToken ct = default)
    {
        var query = users.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.FullName.Contains(search) || x.Email!.Contains(search));
        var records = await query.OrderBy(x => x.FullName).ThenBy(x => x.Id).ToPageAsync(page, ct);
        var ids = records.Items.Select(x => x.Id).ToArray();
        var memberships = await (
            from membership in db.UserRoles
            join role in db.Roles on membership.RoleId equals role.Id
            where ids.Contains(membership.UserId)
            select new { membership.UserId, role.Name }
        ).ToListAsync(ct);
        return new
        {
            records.Number,
            records.PageSize,
            records.Total,
            Items = records.Items.Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.Suspended,
                u.ConcurrencyStamp,
                Roles = memberships.Where(x => x.UserId == u.Id).Select(x => x.Name),
            }),
        };
    }

    public record CreateInput(string FullName, string Email, string Password, string Role);

    [HttpPost]
    public async Task<IActionResult> Create(CreateInput input)
    {
        Guard.Require(new[] { "Client", "Staff", "Admin" }.Contains(input.Role), "Invalid role.");
        var u = new AppUser
        {
            UserName = input.Email,
            Email = input.Email,
            FullName = Guard.Text(input.FullName, "Full name", 2, 160),
        };
        Guard.Require(
            new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(input.Email),
            "Invalid email."
        );
        await using var tx = await db.Database.BeginTransactionAsync();
        var r = await users.CreateAsync(u, input.Password);
        Guard.Require(r.Succeeded, string.Join(" ", r.Errors.Select(x => x.Description)));
        Guard.Require(
            (await users.AddToRoleAsync(u, input.Role)).Succeeded,
            "Unable to assign account role."
        );
        if (input.Role == "Client")
            db.ClientProfiles.Add(new ClientProfile { UserId = u.Id });
        access.Audit("Account.Create", u.Id, input.Role);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(new { u.Id });
    }

    public record EditInput(string FullName, bool Suspended, string ConcurrencyStamp);

    [HttpPut("{id}")]
    public async Task<IActionResult> Edit(string id, EditInput input)
    {
        await using var tx = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable
        );
        var u = await users.FindByIdAsync(id) ?? throw new AppError(404, "Account not found.");
        Guard.Require(
            u.ConcurrencyStamp == input.ConcurrencyStamp,
            "Account changed. Reload before saving.",
            409
        );
        Guard.Require(
            id != access.UserId || !input.Suspended,
            "You cannot suspend your own administrator account."
        );
        if (input.Suspended && await users.IsInRoleAsync(u, "Admin"))
            Guard.Require(
                (await users.GetUsersInRoleAsync("Admin")).Count(x => !x.Suspended) > 1,
                "Keep at least one active administrator."
            );
        u.FullName = Guard.Text(input.FullName, "Full name", 2, 160);
        u.Suspended = input.Suspended;
        Guard.Require(
            (await users.UpdateAsync(u)).Succeeded,
            "Account changed. Reload before saving.",
            409
        );
        Guard.Require(
            (await users.UpdateSecurityStampAsync(u)).Succeeded,
            "Unable to revoke account sessions."
        );
        access.Audit(input.Suspended ? "Account.Suspend" : "Account.Update", id);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }
}
