# VTEX CMS (Storefront > Content) management API

The public CMS API is read-only, so the Campaign Agent uses the same internal
endpoints the content-platform Admin UI (`content-platform-ui.vercel.admin.vtex.com`)
calls. They were taken from that app's JavaScript bundles; they are not documented
by VTEX and can change without notice.

All requests go to `https://{account}.myvtex.com` with the Admin user token in both
the `Authorization` and `VtexIdclientAutCookie` headers. A browser session cookie
alone returns `401 Authorization header is missing or malformed`.

## Endpoints used

| Purpose | Method | Path |
| --- | --- | --- |
| List stores | GET | `/api/content-platform/manage/{account}/stores?page=1&pageSize=50` |
| Get store (has `buildSettings.previewUrl`) | GET | `/api/content-platform/manage/{account}/stores/{storeId}` |
| List branches (`id`, `name`, `schemaVersion`, `isDev`, `mergedAt`) | GET | `/api/content-platform/manage/{account}/{storeId}/branches` |
| Resolve schema and binding | GET | `/api/content-platform/schemas/{account}.{storeId}[@{schemaVersion}]/resolution` |
| Create or update an entry (commit) | POST | `/api/content-platform/manage/{account}/{storeId}/branches/{branchId}/commits` |
| Latest version of an entry in a branch | GET | `/api/content-platform/manage/{account}/{storeId}/{contentType}/entries/{entryId}/last-version?branchId={branchId}` |

Other endpoints seen in the bundle (not used): `.../entries/{entryId}/versions`,
`.../entries/{entryId}/history`, `.../{storeId}/branches` (POST creates a branch with
`{ name, description, author, isDev, schemaVersion }`), `.../{storeId}/merges`.

## Commit body

Creating content in the Admin sends a commit without `entryId`:

```json
{
  "author": "user@example.com",
  "contentTypeId": "landingPage",
  "message": "Commit done.",
  "data": { "...": "serialized entry, see below" },
  "schemaBinding": { "...": "binding from the resolution endpoint" },
  "entryName": "Black Friday Running"
}
```

Saving an existing entry adds `entryId`, `baseHash`, `identifierKeys`,
`search_keywords` and `commitType`.

## Entry serialization

Objects and primitive values are stored as-is. Arrays are stored as a keyed map:

```json
{
  "sections": {
    "$fnType": "array",
    "values": {
      "a1b2": { "$componentKey": "Hero", "title": "...", "id": "a1b2", "$position": 0 },
      "c3d4": { "$componentKey": "ProductShelf", "title": "...", "id": "c3d4", "$position": 1 }
    }
  }
}
```

Each section item is the component's props plus `$componentKey`.

## Preview URL

The Admin opens `store.buildSettings.previewUrl` (for FastStore usually
`https://{account}.vtex.app/api/preview`) with these query parameters:
`contentType`, `documentId` (entry id), `versionId` (on the content platform this
is the **branch id**, not the entry version), optional `locale` and `slug`
(without the leading slash).

## Media

Banner images are not uploaded to the CMS media gallery. The agent commits each
generated PNG to the public GitHub branch configured by `GITHUB_REPO` /
`GITHUB_BRANCH` (under `GITHUB_ASSETS_DIR`, default `campaigns/`) and stores the
public raw URL in the landing page:

`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/campaigns/{slug}/{file}.png`

The repository must stay public. A private repo's raw URL requires authentication,
so the storefront preview cannot load it.
