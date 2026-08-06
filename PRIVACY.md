# Privacy Policy

**Last updated:** August 6, 2026

Audit Web Tools is a local desktop application. This policy describes the data behavior of the application distributed from this repository.

## Data processed locally

The app may process the following data on the device:

- URLs, page titles, and favicons in visit history and saved projects.
- Website cookies, cache, and page session data in the shared preview session.
- Page console messages, network requests, response metadata, and audit findings in the runtime evidence buffers.
- Screenshots, audit results, and project metadata in capture bundles.
- Application logs written by Electron Log for local troubleshooting.

Capture bundles are written under `~/.audit-screens/captures/` and may contain page content, URLs, screenshots, repository metadata for localhost projects, and sanitized audit evidence. Do not create a capture bundle while viewing information you do not want copied to disk or shared with an agent.

## Agent and MCP access

When Audit Web Tools is running, its local MCP server starts automatically on `127.0.0.1:4319`. A local MCP client can navigate the preview panes, read observed page context, run audits, and request screenshots or capture bundles. The endpoint is not exposed to the network, but loopback access is available to other processes on the same device.

Configure or disable agent access according to the release instructions before using the app with sensitive pages. Treat any connected coding agent as able to read the context that the app exposes.

## Network requests

The app connects to URLs that you enter or that are referenced by an audited page. SEO and Lighthouse features may fetch referenced resources such as canonical URLs, robots files, sitemaps, and social images. These requests go to the target sites and may include the preview session's user agent. Authentication cookies are used for the request when required by the audit flow, but the application sanitizes sensitive headers and body fields from persisted audit evidence where possible.

The app does not send analytics, advertising identifiers, or crash reports to a service configured by this repository.

## Storage and deletion

History and saved projects can be cleared from the application UI. Capture bundles and local logs are ordinary files and must be deleted by the user from their local storage. Clearing history does not necessarily clear website cookies or cache; use the app's user-data controls or remove the app's local data when a complete session reset is required.

## Changes and contact

This policy may change with future releases. For questions or privacy requests, open an issue at <https://github.com/predo-soares/audit-screens/issues>.
