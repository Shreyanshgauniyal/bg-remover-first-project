# Connect Color Meets Canvas to remove.bg

## Security first
If you pasted an API key into a chat, screenshot, public issue, or repository, revoke it in your remove.bg dashboard and create a replacement. Do not put API keys in frontend code or commit them to GitHub.

## 1. Configure local environment
1. Extract this project.
2. In the project root, copy `.env.example` and name the copy `.env`.
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
3. Fill in the Supabase values from your Supabase project.
   - `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only)
4. Put the NEW remove.bg key in `REMOVE_BG_API_KEY`.
5. Keep `.env` private. It is ignored by Git.

## 2. Install and run
Install Node.js LTS, open a terminal in this folder, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (the configured port is usually http://localhost:8080).

## 3. Supabase setup
The app uses Supabase authentication and its monthly credit RPCs. In the Supabase SQL Editor, run `drizzle/migrations/0000_pixelcut_projects_and_usage.sql` if it has not already been applied. Ensure the `pixelcut` storage bucket exists if you use the project's image storage features.

## 4. Deploy to Cloudflare Workers
Do not upload `.env` to GitHub. After pushing the source code, set secrets on the Worker:

```bash
npx wrangler login
npx wrangler secret put REMOVE_BG_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

For the frontend build, configure the public Supabase values as build-time environment variables in your deployment/build environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Then run:

```bash
npm run build
npx wrangler deploy
```

Check the Cloudflare build output and logs if deployment reports a configuration issue.

## 5. What changed
- Replaced the Lovable AI Gateway image-edit call with the server-side remove.bg endpoint.
- The backend now reads `REMOVE_BG_API_KEY`.
- The backend returns remove.bg's PNG response directly.
- The browser client now handles a direct image response instead of expecting an AI event stream.
- Added `.env.example`; excluded the original `.env` from this handoff archive.
- Added `.env` and `.env.*` to `.gitignore` (while allowing `.env.example`).

## Important limitations
The remove.bg free API allowance is limited and its preview output is lower resolution than paid output. Your app's own monthly user-credit limit is separate from the remove.bg account quota. Test with a small image first.

## Preview the public website before configuring Supabase

The public home page can now run without Supabase credentials. In that mode, sign-in, saved projects, and background-removal requests that require an authenticated user are unavailable. Add valid Supabase values to `.env` later to enable those features.

Run `npm.cmd install` and then `npm.cmd run dev` in Windows PowerShell. Open the local URL printed by Vite (usually `http://localhost:8080`).


## Anonymous local background removal

The `/remove` workflow does not require a user account or Supabase. The server endpoint accepts a validated image upload and calls remove.bg using `REMOVE_BG_API_KEY` from the server environment. Create a local `.env` file and set `REMOVE_BG_API_KEY=...`. Keep this key server-side; never rename it to a `VITE_` variable or commit `.env`. Supabase is optional and is only used for account-backed features such as saved projects.

Because this endpoint is intentionally usable without sign-in, do not deploy it publicly without adding rate limiting and abuse protection.
