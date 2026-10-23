# PrimeGoods Campaign Agent

A VTEX Admin agent that turns one sentence into a full campaign:

1. Searches the VTEX Catalog and previews the products.
2. Asks for anything missing (discount, dates, products) and shows a plan to confirm.
3. After confirmation, creates the **collection**, a **promotion** scoped to it, the
   landing page **copy** and **banners** (Gemini), and saves a **landing page** in a
   **CMS branch** (Storefront > Content).
4. Shares the CMS **preview link** of the landing page.

| Folder | Stack | Purpose |
| --- | --- | --- |
| [`admin-ui/`](./admin-ui/) | Next.js, Raccoon, `@vtex/agentic-ui`, Shoreline | Chat UI, same views and components as the Collections Agent |
| [`backend/`](./backend/) | Node.js, Express, `@google/genai` | Agent loop (Gemini function calling), VTEX and CMS clients, conversation storage |

Nothing is created before the user confirms the plan: the confirmation card carries a
one-time code, and the creation tools refuse to run until the user sends it.

## Requirements

- Node.js 22+
- VTEX CLI (`vtex`) logged in to `primegoods`
- A Gemini API key
- A CMS branch in Storefront > Content (create it in the CMS before asking for a campaign)
- The Admin user needs permissions for Catalog (collections), Promotions and the CMS

## Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # set GEMINI_API_KEY (and optionally CMS_BRANCH)

# UI
cd ../admin-ui
npx pnpm@10 install
cp .env.example .env
```

## Run locally

Use three terminals:

```bash
# 1. Backend on http://localhost:8009
cd backend && npm run dev

# 2. UI on http://localhost:3010
cd admin-ui && npx next dev -p 3010

# 3. Link the Admin app in a workspace WITHOUT "localhost" in its name
vtex login primegoods
vtex use campaignagent
cd admin-ui/apps/campaign-agent && vtex link
```

Open `https://campaignagent--primegoods.myvtex.com/admin/campaign-agent`
(the app is listed under **Promotions** in the Admin menu).

Do not use a `*localhost` workspace while the FastStore dev server runs on port 3000.
In those workspaces the Admin loads every Admin app (Promotions, Content, …) from
`localhost:3000`, so those menus open the storefront instead. In a regular dev
workspace the Admin keeps the native apps and loads only this app from
`localhost:3010` (the `prodUrl` in `admin/navigation.json`).

The Admin passes the logged-in user's token to the UI, which forwards it to the backend.
All VTEX and CMS calls run with that user's permissions.

## Example

> Create a Black Friday campaign for Nike running shoes with 20% off from Nov 20 to Nov 30, landing page in the `black-friday` branch

The agent searches the products, previews them, shows the plan with a
"Confirm campaign XXXXXX" button, and after confirmation creates everything. The
**Campaign steps** column on the right of the chat tracks each step (collection,
promotion, copy, banners, landing page); finished steps open the created collection,
promotion or CMS entry in a new tab.

## Landing page and CMS

- The page is a `landingPage` entry built with native FastStore sections (Hero,
  BannerText, ProductShelf filtered by the new collection). See
  [`backend/docs/cms-api.md`](./backend/docs/cms-api.md) for the CMS endpoints used.
- The branch comes from the chat or `CMS_BRANCH`. If missing or not found, the agent asks
  for it and lists the available branches.
- The FastStore repo (`../faststore-primegoods`) only provides the schema. Its
  `cms/faststore/pages/cms_content_type__landingpage.jsonc` now includes the native
  `seo` object and `identifierKeys: ["slug"]`. Publish it to the CMS with
  `yarn cms-sync` from that repo (not run automatically). Until then the agent saves
  the page without SEO fields.

### Banner images

Each banner is committed to the public GitHub branch in `GITHUB_REPO`
(`GITHUB_BRANCH`, default `main`, under `campaigns/{slug}/`). The landing page uses
that file's public raw URL, for example
`https://raw.githubusercontent.com/{owner}/{repo}/main/campaigns/{slug}/desktop-ab12cd34.png`.
The repository has to be public so the CMS preview can load the image.

## Tests

```bash
cd backend && npm run typecheck && npm test
cd admin-ui && npx tsc --noEmit && npx vitest run
```

## Data

Conversations, uploaded attachments and generated banners are stored as files in
`backend/data/` (`DATA_DIR`). Delete the folder to reset the history.
