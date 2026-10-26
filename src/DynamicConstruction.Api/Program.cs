using System.Threading.RateLimiting;
using System.IO.Compression;
using Azure.Identity;
using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Features.Identity;
using DynamicConstruction.Api.Features.Quotes;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<TrustedDevice>();
var databaseProvider = builder.Configuration["Database:Provider"];
if (
    databaseProvider is not ("Sqlite" or "SqlServer")
    || string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("Database"))
)
    throw new InvalidOperationException(
        "Configure Database:Provider (SqlServer or Sqlite) and ConnectionStrings:Database."
    );
if (builder.Configuration["Storage:Provider"] is not ("Azure" or "Local"))
    throw new InvalidOperationException("Configure Storage:Provider (Azure or Local).");
foreach (
    var key in new[]
    {
        "Storage:ContainerUri",
        "DataProtection:BlobUri",
        "DataProtection:KeyIdentifier",
    }
)
    if (
        (
            !builder.Environment.IsDevelopment()
            || key == "Storage:ContainerUri" && builder.Configuration["Storage:Provider"] == "Azure"
        )
        && (
            !Uri.TryCreate(builder.Configuration[key], UriKind.Absolute, out var uri)
            || uri.Scheme != "https"
        )
    )
        throw new InvalidOperationException($"Configure {key} with an absolute HTTPS service URI.");
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
var local = builder.Configuration["Database:Provider"] == "Sqlite";
if (!builder.Environment.IsDevelopment() && local)
    throw new InvalidOperationException("Production requires SQL Server.");
builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (local)
        o.UseSqlite(builder.Configuration.GetConnectionString("Database"));
    else
        o.UseSqlServer(builder.Configuration.GetConnectionString("Database"));
});
builder
    .Services.AddIdentity<AppUser, IdentityRole>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 12;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
builder.Services.Configure<SecurityStampValidatorOptions>(o =>
    o.ValidationInterval = TimeSpan.Zero
);
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "dc.session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c =>
    {
        c.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    o.Events.OnRedirectToAccessDenied = c =>
    {
        c.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN";
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Staff", p => p.RequireRole("Staff", "Admin"));
    o.AddPolicy("Admin", p => p.RequireRole("Admin"));
});
if (builder.Environment.IsDevelopment())
{
    var keys = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "keys");
    Directory.CreateDirectory(keys);
    builder
        .Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keys))
        .SetApplicationName("DynamicConstruction");
}
if (!builder.Environment.IsDevelopment())
    builder
        .Services.AddDataProtection()
        .SetApplicationName("DynamicConstruction")
        .PersistKeysToAzureBlobStorage(
            new Uri(
                builder.Configuration["DataProtection:BlobUri"]
                    ?? throw new InvalidOperationException("DataProtection:BlobUri required")
            ),
            new DefaultAzureCredential()
        )
        .ProtectKeysWithAzureKeyVault(
            new Uri(
                builder.Configuration["DataProtection:KeyIdentifier"]
                    ?? throw new InvalidOperationException("DataProtection:KeyIdentifier required")
            ),
            new DefaultAzureCredential()
        );
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Access>();
builder.Services.AddScoped<QuotePricingService>();
if (builder.Configuration["Storage:Provider"] == "Azure")
    builder.Services.AddSingleton<IFileStore, AzureFileStore>();
else
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Production requires Azure storage.");
    builder.Services.AddSingleton<IFileStore, LocalFileStore>();
}
builder
    .Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
        o.JsonSerializerOptions.ReferenceHandler = System
            .Text
            .Json
            .Serialization
            .ReferenceHandler
            .IgnoreCycles;
    });
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ["text/css", "text/javascript", "application/javascript"];
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Optimal);
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Optimal);
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c =>
    {
        var credentialAttempt =
            HttpMethods.IsPost(c.Request.Method)
            && (
                c.Request.Path == "/api/auth/login"
                || c.Request.Path == "/api/auth/register"
                || c.Request.Path == "/api/auth/password"
                || c.Request.Path.StartsWithSegments("/api/auth/mfa")
                || c.Request.Path.StartsWithSegments("/api/auth/recovery")
            );
        return RateLimitPartition.GetFixedWindowLimiter(
            (credentialAttempt ? "credentials:" : "api:")
                + (c.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = credentialAttempt ? 30 : 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }
        );
    });
    o.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { title = "Too many requests. Please wait a minute and retry.", status = 429 },
            cancellationToken
        );
    };
});
var app = builder.Build();
app.Use(
    async (ctx, next) =>
    {
        ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
        ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        ctx.Response.Headers["X-Frame-Options"] = "DENY";
        if (ctx.Request.Path.StartsWithSegments("/api"))
            ctx.Response.Headers["Cache-Control"] = "no-store";
        ctx.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; "
            + "base-uri 'self'; form-action 'self'";
        try
        {
            await next();
            if (ctx.Response.StatusCode >= 400)
                app.Logger.LogWarning(
                    "Request rejected {CorrelationId} {Status}",
                    ctx.TraceIdentifier,
                    ctx.Response.StatusCode
                );
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // The client has gone away; do not turn cancellation into a server error.
        }
        catch (Exception ex)
        {
            var status = ex switch
            {
                AppError e => e.Status,
                DbUpdateConcurrencyException => 409,
                DbUpdateException => 409,
                AntiforgeryValidationException => 400,
                _ => 500,
            };
            var message = ex switch
            {
                AppError e => e.Message,
                DbUpdateConcurrencyException => "This record changed. Reload before saving.",
                DbUpdateException =>
                    "The write conflicts with existing data. Reload and review before retrying.",
                AntiforgeryValidationException =>
                    "Your session form token expired. Refresh and retry.",
                _ => "The request could not be completed. Please retry.",
            };
            app.Logger.LogWarning(
                "Request failure {CorrelationId} {Status} {ExceptionType}",
                ctx.TraceIdentifier,
                status,
                ex.GetType().Name
            );
            if (!ctx.Response.HasStarted)
            {
                ctx.Response.StatusCode = status;
                await ctx.Response.WriteAsJsonAsync(
                    new
                    {
                        title = message,
                        status,
                        traceId = ctx.TraceIdentifier,
                    }
                );
            }
        }
    }
);
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
// Compression is limited to public build assets, never authenticated API responses.
app.UseWhen(
    ctx => ctx.Request.Path.StartsWithSegments("/assets"),
    assets => assets.UseResponseCompression()
);
app.UseStaticFiles(
    new StaticFileOptions
    {
        OnPrepareResponse = context =>
        {
            context.Context.Response.Headers["Cache-Control"] =
                context.Context.Request.Path.StartsWithSegments("/assets")
                    ? "public,max-age=31536000,immutable"
                    : "no-cache";
        },
    }
);
app.UseRateLimiter();
app.UseAuthentication();
app.Use(
    async (ctx, next) =>
    {
        if (
            ctx.Request.Path.StartsWithSegments("/api")
            && ctx.User.Identity?.IsAuthenticated == true
        )
        {
            var manager = ctx.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var u = await manager.GetUserAsync(ctx.User);
            if (u == null || u.Suspended)
            {
                ctx.Response.StatusCode = 401;
                return;
            }
            if (
                !app.Environment.IsDevelopment()
                && (ctx.User.IsInRole("Staff") || ctx.User.IsInRole("Admin"))
                && !u.TwoFactorEnabled
                && !ctx.Request.Path.StartsWithSegments("/api/auth")
            )
            {
                ctx.Response.StatusCode = 403;
                await ctx.Response.WriteAsJsonAsync(
                    new { title = "Enable authenticator MFA in your profile before continuing." }
                );
                return;
            }
        }
        if (
            ctx.Request.Path.StartsWithSegments("/api")
            && !HttpMethods.IsGet(ctx.Request.Method)
            && !HttpMethods.IsHead(ctx.Request.Method)
            && !HttpMethods.IsOptions(ctx.Request.Method)
        )
            await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
        await next();
    }
);
app.UseAuthorization();
app.MapGet(
    "/api/auth/csrf",
    (IAntiforgery a, HttpContext c) =>
        Results.Ok(new { token = a.GetAndStoreTokens(c).RequestToken })
);
app.MapHealthChecks("/api/health");
app.MapControllers();

// Keep unknown API routes separate from the React navigation fallback.
app.MapFallback(
        "/api/{**path}",
        () => Results.NotFound(new { title = "API endpoint not found", status = 404 })
    )
    .WithOrder(int.MaxValue - 1);
app.MapFallbackToFile(
    "index.html",
    new StaticFileOptions
    {
        OnPrepareResponse = context =>
            context.Context.Response.Headers["Cache-Control"] = "no-cache",
    }
);
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (local)
        await db.Database.EnsureCreatedAsync();
    if (args.Contains("--migrate"))
    {
        await db.Database.MigrateAsync();
        return;
    }
    await IdentityBootstrap.EnsureRoles(scope.ServiceProvider);
    if (args.Contains("--bootstrap-admin"))
    {
        try
        {
            await IdentityBootstrap.Bootstrap(scope.ServiceProvider, app.Configuration);
        }
        catch (Exception error) when (error is AppError or InvalidOperationException)
        {
            Console.Error.WriteLine(error.Message);
            Environment.ExitCode = 1;
        }
        return;
    }
}
app.Run();

public partial class Program { }
