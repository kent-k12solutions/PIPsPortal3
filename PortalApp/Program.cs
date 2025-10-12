using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

static void ApplyNoCacheHeaders(HttpResponse response)
{
    response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
    response.Headers.Pragma = "no-cache";
    response.Headers.Expires = "0";
}

app.MapMethods("/save-config.ashx", new[] { "POST", "PUT" }, async (HttpContext context, IWebHostEnvironment environment) =>
{
    ApplyNoCacheHeaders(context.Response);

    string body;
    using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false))
    {
        body = await reader.ReadToEndAsync();
    }

    if (string.IsNullOrWhiteSpace(body))
    {
        return Results.Json(new
        {
            success = false,
            message = "The request body was empty."
        }, statusCode: StatusCodes.Status400BadRequest);
    }

    try
    {
        using var _ = JsonDocument.Parse(body);
    }
    catch (JsonException ex)
    {
        return Results.Json(new
        {
            success = false,
            message = $"Invalid JSON payload: {ex.Message}"
        }, statusCode: StatusCodes.Status400BadRequest);
    }

    var webRoot = environment.WebRootPath;
    if (string.IsNullOrWhiteSpace(webRoot))
    {
        webRoot = Path.Combine(environment.ContentRootPath, "wwwroot");
    }

    var configPath = Path.Combine(webRoot, "config.json");

    try
    {
        Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
        await File.WriteAllTextAsync(configPath, body, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }
    catch (UnauthorizedAccessException ex)
    {
        return Results.Json(new
        {
            success = false,
            message = $"IIS does not have write access to config.json. {ex.Message}"
        }, statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (DirectoryNotFoundException ex)
    {
        return Results.Json(new
        {
            success = false,
            message = $"The destination directory for config.json could not be found. {ex.Message}"
        }, statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (IOException ex)
    {
        return Results.Json(new
        {
            success = false,
            message = $"Unable to write config.json: {ex.Message}"
        }, statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (Exception ex)
    {
        return Results.Json(new
        {
            success = false,
            message = $"An unexpected error occurred while saving config.json: {ex.Message}"
        }, statusCode: StatusCodes.Status500InternalServerError);
    }

    context.Response.Headers["X-Portal-Config-Path"] = configPath;

    return Results.Json(new { success = true });
}).WithName("SavePortalConfig")
  .Produces(StatusCodes.Status200OK)
  .Produces(StatusCodes.Status400BadRequest)
  .Produces(StatusCodes.Status500InternalServerError);

const string AllowedSaveMethods = "OPTIONS, POST, PUT";

app.MapGet("/save-config.ashx", (HttpResponse response) =>
{
    ApplyNoCacheHeaders(response);
    response.Headers.Allow = AllowedSaveMethods;
    return Results.StatusCode(StatusCodes.Status405MethodNotAllowed);
}).WithName("SavePortalConfigGet")
  .Produces(StatusCodes.Status405MethodNotAllowed)
  .ExcludeFromDescription();

app.MapMethods("/save-config.ashx", new[] { "OPTIONS" }, (HttpResponse response) =>
{
    ApplyNoCacheHeaders(response);
    response.Headers.Allow = AllowedSaveMethods;
    return Results.Ok();
}).WithName("SavePortalConfigOptions")
  .Produces(StatusCodes.Status200OK)
  .ExcludeFromDescription();

app.MapFallbackToFile("index.html");

app.Run();
