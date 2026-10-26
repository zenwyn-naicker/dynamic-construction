using Azure.Identity;
using Azure.Storage.Blobs;

namespace DynamicConstruction.Api.Infrastructure;

public interface IFileStore
{
    Task Put(string key, Stream data);
    Task<Stream> Open(string key);
    Task Delete(string key);
}

public class LocalFileStore(IWebHostEnvironment env) : IFileStore
{
    private string PathFor(string key)
    {
        Guard.Require(Guid.TryParseExact(key, "N", out _), "Invalid storage key.");
        var root = Path.Combine(env.ContentRootPath, "App_Data", "files");
        Directory.CreateDirectory(root);
        return Path.Combine(root, key);
    }

    public async Task Put(string key, Stream data)
    {
        await using var f = File.Create(PathFor(key));
        await data.CopyToAsync(f);
    }

    public Task<Stream> Open(string key) => Task.FromResult<Stream>(File.OpenRead(PathFor(key)));

    public Task Delete(string key)
    {
        File.Delete(PathFor(key));
        return Task.CompletedTask;
    }
}

public class AzureFileStore : IFileStore
{
    private readonly BlobContainerClient container;

    public AzureFileStore(IConfiguration config)
    {
        container = new BlobContainerClient(
            new Uri(
                config["Storage:ContainerUri"]
                    ?? throw new InvalidOperationException("Storage:ContainerUri is required.")
            ),
            new DefaultAzureCredential()
        );
    }

    public async Task Put(string key, Stream data) =>
        await container.GetBlobClient(key).UploadAsync(data, overwrite: false);

    public async Task<Stream> Open(string key) =>
        await container.GetBlobClient(key).OpenReadAsync();

    public async Task Delete(string key) =>
        await container.GetBlobClient(key).DeleteIfExistsAsync();
}
