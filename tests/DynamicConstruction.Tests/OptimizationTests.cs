using System.Data.Common;
using System.Security.Claims;
using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Features.Communications;
using DynamicConstruction.Api.Features.Finance;
using DynamicConstruction.Api.Features.Operations;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace DynamicConstruction.Tests;

public class OptimizationTests
{
    private sealed class FileStore : IFileStore
    {
        public byte[]? Content;
        public async Task Put(string key, Stream data)
        {
            using var output = new MemoryStream();
            await data.CopyToAsync(output);
            Content = output.ToArray();
        }
        public Task<Stream> Open(string key) => Task.FromResult<Stream>(new MemoryStream(Content!));
        public Task Delete(string key) { Content = null; return Task.CompletedTask; }
    }

    [Theory]
    [InlineData(".pdf", "%PDF-", true)]
    [InlineData(".jpg", "FF-D8-FF", true)]
    [InlineData(".png", "89-50-4E-47-0D-0A-1A-0A", true)]
    [InlineData(".pdf", "%PDF", false)]
    [InlineData(".png", "89-50-4E-47", false)]
    [InlineData(".jpg", "FF-D8", false)]
    public async Task UploadValidatesShortSignaturesAndStoresEveryByte(string extension, string prefix, bool valid)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var project = new Project { Client = new ClientProfile { User = new AppUser { Id = "client" }, UserId = "client" } };
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var bytes = extension == ".pdf" ? System.Text.Encoding.ASCII.GetBytes(prefix)
            : Convert.FromHexString(prefix.Replace("-", ""));
        using var stream = new MemoryStream(bytes);
        var file = new FormFile(stream, 0, bytes.Length, "file", "test" + extension);
        var store = new FileStore();
        var controller = new FilesController(db, AccessFor(db, "staff", true), store);
        if (valid)
        {
            await controller.Upload(project.Id, file, "Document", false);
            Assert.Equal(bytes, store.Content);
        }
        else
        {
            await Assert.ThrowsAsync<AppError>(() => controller.Upload(project.Id, file, "Document", false));
            Assert.Null(store.Content);
            Assert.Empty(await db.Files.ToListAsync());
        }
    }

    private sealed class Reads : DbCommandInterceptor
    {
        public int Count;
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT")) Count++;
            return ValueTask.FromResult(result);
        }
    }

    private static Access AccessFor(AppDbContext db, string id, bool staff = false) => new(db,
        new HttpContextAccessor { HttpContext = new DefaultHttpContext {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] {
                new Claim(ClaimTypes.NameIdentifier, id),
                new Claim(ClaimTypes.Role, staff ? "Staff" : "Client")
            }, "test")) } });

    [Fact]
    public async Task FinanceUsesThreeReadsWithoutTrackingProjectHistoryAndRejectsOtherClients()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var reads = new Reads();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection).AddInterceptors(reads).Options);
        await db.Database.EnsureCreatedAsync();
        var project = new Project { Client = new ClientProfile { User = new AppUser { Id = "client" }, UserId = "client" } };
        for (var i = 0; i < 100; i++)
        {
            project.Milestones.Add(new Milestone { Title = "Milestone" });
            project.Updates.Add(new ProgressUpdate { Message = "Update" });
        }
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        reads.Count = 0;
        await new FinanceController(db, AccessFor(db, "client")).Get(project.Id);
        Assert.Equal(3, reads.Count);
        Assert.Empty(db.ChangeTracker.Entries());
        Assert.Equal(404, (await Assert.ThrowsAsync<AppError>(() => AccessFor(db, "other").Project(project.Id))).Status);
        var detailed = await AccessFor(db, "staff", true).ProjectDetails(project.Id);
        Assert.Equal(100, detailed.Milestones.Count);
        Assert.Equal(100, detailed.Updates.Count);
        Assert.Equal(EntityState.Unchanged, db.Entry(detailed).State);
    }

    [Fact]
    public async Task BulkNotificationsUseOneEligibilityReadAndRejectInvalidBatchesAtomically()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var reads = new Reads();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection).AddInterceptors(reads).Options);
        await db.Database.EnsureCreatedAsync();
        db.Roles.Add(new IdentityRole { Id = "client-role", Name = "Client", NormalizedName = "CLIENT" });
        var ids = Enumerable.Range(0, 100).Select(i => "client-" + i).ToArray();
        foreach (var id in ids)
        {
            db.Users.Add(new AppUser { Id = id });
            db.UserRoles.Add(new IdentityUserRole<string> { UserId = id, RoleId = "client-role" });
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        reads.Count = 0;
        var controller = new NotificationsController(db, AccessFor(db, "staff", true));
        await controller.Compose(new(ids, "Test notification", null));
        Assert.Equal(1, reads.Count);
        Assert.Equal(100, await db.Notifications.CountAsync());
        db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<AppError>(() => controller.Compose(new([ids[0], "missing"], "Invalid batch", null)));
        Assert.Empty(db.ChangeTracker.Entries<Notification>());
        var suspended = await db.Users.SingleAsync(u => u.Id == ids[1]);
        suspended.Suspended = true;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppError>(() => controller.Compose(new([ids[0], ids[1]], "Suspended batch", null)));
        Assert.Equal(100, await db.Notifications.CountAsync());
        await controller.Compose(new([ids[0], ids[0]], "Distinct recipients", null));
        Assert.Equal(101, await db.Notifications.CountAsync());
        var project = new Project { Client = new ClientProfile { UserId = ids[0] } };
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<AppError>(() => controller.Compose(new([ids[0], ids[2]], "Wrong project", project.Id)));
        Assert.Empty(db.ChangeTracker.Entries<Notification>());
        reads.Count = 0;
        await controller.Compose(new([ids[0]], "Project notification", project.Id));
        Assert.Equal(2, reads.Count);
        Assert.Equal(102, await db.Notifications.CountAsync());
    }
}
