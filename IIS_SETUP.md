# Hosting the ASP.NET Core portal on IIS

The portal is now a .NET 8 ASP.NET Core application. Configuration saves are handled by the `/save-config.ashx` endpoint that writes the JSON payload to `wwwroot/config.json` and returns an `X-Portal-Config-Path` header with the absolute path that IIS used.

Follow the steps below to deploy the application on IIS:

1. **Install the .NET 8 Hosting Bundle**
   - Download the latest [.NET 8 Hosting Bundle](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) on the IIS server.
   - Run the installer and restart IIS when prompted so the ASP.NET Core module is available.

2. **Publish the site**
   - On your build machine, execute `dotnet publish PortalApp/PortalApp.csproj -c Release -o publish`.
   - Copy the contents of the generated `publish` folder to your IIS site directory (for example, `C:\inetpub\wwwroot\PIPsPortal`).

3. **Create the IIS site or application**
   - Point the IIS site/application to the publish folder.
   - Use the **No Managed Code** application pool (ASP.NET Core runs out-of-process behind the ASP.NET Core Module).

4. **Grant write permission to `config.json`**
   - Grant **Modify** permission on `wwwroot\config.json` (and optionally the containing folder) to the application pool identity, e.g. `IIS AppPool\PIPsPortal`.
   - If a custom service account is used for the pool, grant permissions to that account instead.

5. **Recycle the application pool**
   - Recycle or restart the application pool after changing permissions so the worker process picks up the new ACLs.

5. **Verify the endpoint**
   - Browse to `https://your-site/save-config.ashx` with a GET request; it should return **405 Method Not Allowed** (confirming the handler is active).
   - Use the admin portal to save a change. `config.json` should update immediately on disk.

7. **Optional hardening**
   - Restrict access to `/save-config.ashx` with IP restrictions, Windows authentication, or a reverse proxy firewall.
   - Back up `config.json` regularly in case you need to revert changes quickly.

After completing these steps the admin UI will persist configuration updates through the ASP.NET Core application.
