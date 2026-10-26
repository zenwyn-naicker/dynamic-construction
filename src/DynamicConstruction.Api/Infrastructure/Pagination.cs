using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Infrastructure;

public record Page<T>(IReadOnlyList<T> Items, int Number, int PageSize, int Total);

public static class Pagination
{
    public static async Task<Page<T>> ToPageAsync<T>(
        this IQueryable<T> query,
        int page,
        CancellationToken ct = default,
        int size = 25
    )
    {
        Guard.Require(page is >= 1 and <= 1000000, "Invalid page number.");
        Guard.Require(size is >= 1 and <= 100, "Invalid page size.");
        return new(
            await query.Skip((page - 1) * size).Take(size).ToListAsync(ct),
            page,
            size,
            await query.CountAsync(ct)
        );
    }
}
