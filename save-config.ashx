<%@ WebHandler Language="C#" Class="SavePortalConfigHandler" %>

using System;
using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

public class SavePortalConfigHandler : IHttpHandler
{
    private const string ConfigFileName = "config.json";
    private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

    public void ProcessRequest(HttpContext context)
    {
        if (!IsSupportedMethod(context.Request.HttpMethod))
        {
            context.Response.StatusCode = 405;
            context.Response.StatusDescription = "Method Not Allowed";
            context.Response.AppendHeader("Allow", "POST, PUT");
            return;
        }

        string body;
        using (var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding ?? Encoding.UTF8))
        {
            body = reader.ReadToEnd();
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            WriteError(context, 400, "The request body was empty.");
            return;
        }

        try
        {
            // Validate that the payload is valid JSON before writing it to disk.
            Serializer.DeserializeObject(body);
        }
        catch (Exception ex)
        {
            WriteError(context, 400, "Invalid JSON payload: " + ex.Message);
            return;
        }

        var configPath = context.Server.MapPath("~/" + ConfigFileName);

        try
        {
            var directory = Path.GetDirectoryName(configPath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.WriteAllText(configPath, body, new UTF8Encoding(false));
        }
        catch (UnauthorizedAccessException ex)
        {
            WriteError(context, 500, "IIS does not have write access to config.json. " + ex.Message);
            return;
        }
        catch (DirectoryNotFoundException ex)
        {
            WriteError(context, 500, "The destination directory for config.json could not be found. " + ex.Message);
            return;
        }
        catch (IOException ex)
        {
            WriteError(context, 500, "Unable to write config.json: " + ex.Message);
            return;
        }
        catch (Exception ex)
        {
            WriteError(context, 500, "An unexpected error occurred while saving config.json: " + ex.Message);
            return;
        }

        context.Response.StatusCode = 200;
        context.Response.ContentType = "application/json";
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        context.Response.Cache.SetNoStore();
        context.Response.Write("{\"success\":true}");
    }

    public bool IsReusable
    {
        get { return false; }
    }

    private static bool IsSupportedMethod(string method)
    {
        return string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(method, "PUT", StringComparison.OrdinalIgnoreCase);
    }

    private static void WriteError(HttpContext context, int statusCode, string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        context.Response.Cache.SetNoStore();

        var payload = new
        {
            success = false,
            message
        };

        context.Response.Write(Serializer.Serialize(payload));
    }
}
