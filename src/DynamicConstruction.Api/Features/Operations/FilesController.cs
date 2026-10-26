using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Operations;

[ApiController, Authorize, Route("api/projects/{projectId:guid}/files")]
public class FilesController(AppDbContext db, Access access, IFileStore store) : ControllerBase
{
    [HttpGet]
    public async Task<object> List(Guid projectId)
    {
        await access.Project(projectId);
        return await db
            .Files.AsNoTracking()
            .Where(x => x.ProjectId == projectId && (access.Staff || x.Published))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Category,
                x.Size,
                x.ContentType,
                x.Published,
                x.Version,
            })
            .ToListAsync();
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid projectId, Guid id)
    {
        await access.Project(projectId);
        var f =
            await db.Files.SingleOrDefaultAsync(x =>
                x.Id == id && x.ProjectId == projectId && (access.Staff || x.Published)
            ) ?? throw new AppError(404, "File not found.");
        return File(await store.Open(f.StorageKey), f.ContentType, f.Name);
    }

    [Authorize(Policy = "Staff"), HttpPost, RequestSizeLimit(11000000)]
    public async Task<IActionResult> Upload(
        Guid projectId,
        IFormFile file,
        [FromForm] string category,
        [FromForm] bool published
    )
    {
        await access.Project(projectId);
        Guard.Require(
            file.Length is > 0 and <= 10000000,
            "Files must be between 1 byte and 10 MB."
        );
        Guard.Require(
            new[] { "Document", "Photo", "Plan", "Invoice" }.Contains(category),
            "Invalid category."
        );
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var types = new Dictionary<string, string>
        {
            { ".pdf", "application/pdf" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
        };
        Guard.Require(types.ContainsKey(extension), "Only PDF, PNG and JPEG files are allowed.");
        await using var data = file.OpenReadStream();
        var bytes = new byte[8];
        var length = await data.ReadAtLeastAsync(bytes, bytes.Length, throwOnEndOfStream: false);
        var signature = bytes.AsSpan(0, length);
        var valid =
            extension == ".pdf" ? signature.StartsWith("%PDF-"u8)
            : extension == ".png"
                ? signature.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
            : signature.StartsWith(new byte[] { 255, 216, 255 });
        Guard.Require(valid, "File content does not match its extension.");
        var f = new ProjectFile
        {
            ProjectId = projectId,
            Name = Guard.Text(Path.GetFileName(file.FileName), "File name", 1, 200),
            StorageKey = Guid.NewGuid().ToString("N"),
            Size = file.Length,
            ContentType = types[extension],
            Category = category,
            Published = published,
        };
        data.Position = 0;
        await store.Put(f.StorageKey, data);
        try
        {
            db.Files.Add(f);
            access.Audit("File.Upload", f.Id);
            await db.SaveChangesAsync();
        }
        catch
        {
            await store.Delete(f.StorageKey);
            throw;
        }
        return Ok(new { f.Id, f.Name });
    }

    public record PublishInput(Guid Version, bool Published);

    [Authorize(Policy = "Staff"), HttpPut("{id:guid}")]
    public async Task<IActionResult> Publish(Guid projectId, Guid id, PublishInput input)
    {
        await access.Project(projectId);
        var f =
            await db.Files.SingleOrDefaultAsync(x => x.Id == id && x.ProjectId == projectId)
            ?? throw new AppError(404, "File not found.");
        Guard.Version(f, input.Version);
        f.Published = input.Published;
        access.Audit("File.Publish", id, input.Published.ToString());
        await db.SaveChangesAsync();
        return NoContent();
    }
}
