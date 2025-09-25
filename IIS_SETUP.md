# IIS configuration for saving `config.json`

The admin portal now sends updates to [`save-config.ashx`](./save-config.ashx). The handler validates the JSON payload and writes it to `config.json` on disk so that subsequent requests (and the service worker cache) see the new configuration.

Follow the steps below when hosting the portal on IIS:

1. **Deploy the files**
   - Copy the entire contents of the repository (including `save-config.ashx`) to the IIS site root.
   - Convert the folder into an IIS application that targets the **.NET Framework 4.x** pipeline (Integrated mode).

2. **Enable the handler**
   - `.ashx` handlers are enabled by default in the .NET pipeline. If handler mappings were customised, add a mapping for `*.ashx` to the **`System.Web.UI.SimpleHandlerFactory`**.
   - Restart the site after adding the mapping to ensure the new handler is loaded.

3. **Grant write permissions to `config.json`**
   - Locate the physical folder that contains `config.json`.
   - Right–click the file → **Properties** → **Security** → **Edit**.
   - Grant **Modify** permission to the IIS application pool identity (for example, `IIS AppPool\\YourAppPoolName`).
   - If the application pool runs under a custom service account, grant Modify permission to that account instead.
   - Repeat the step for the containing folder if inheriting permissions is disabled.

4. **Recycle the application pool**
   - Recycle or restart the application pool so it picks up the permission changes.

5. **Verify the endpoint**
   - Browse to `https://your-site/save-config.ashx` with a GET request; it should return **405 Method Not Allowed** (confirming the handler is active).
   - Use the admin portal to save a change. `config.json` should update immediately on disk.

6. **Optional hardening**
   - Restrict access to `save-config.ashx` with IIS IP restrictions or Windows authentication if the admin portal is not otherwise secured.
   - Back up `config.json` regularly so accidental edits can be reverted quickly.

Once these steps are complete the admin UI will be able to persist configuration changes through IIS.
