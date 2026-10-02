# Web deployment

Slop Copter uses the same hosting setup as Omacontra: **Cloudflare Pages Direct
Upload**. Vite produces a static site in `dist/`. There is no server, Worker,
database or external asset dependency.

- Production site: <https://slop-copter.pages.dev/>
- Source: <https://github.com/gardnmi/slop-copter>
- Pages project: `slop-copter`
- Production branch: `main`

## Publish an update

Use Node.js 22.12 or newer and a Cloudflare account with Pages access:

```sh
npm ci
npm test
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
git push origin main
npm run deploy
```

`CHROMIUM_PATH` is optional when Playwright's Chromium is installed. The deploy
command builds the game and uploads `dist/` with Wrangler 4.138.0, matching the
version used by Omacontra. GitHub pushes do not deploy automatically.

Wrangler uses its existing local OAuth login; run `npx --yes wrangler@4.138.0 login`
if authentication expires. Credentials and `.wrangler/` state are never
committed. For a new account/project, initialize once before the first deploy:

```sh
npx --yes wrangler@4.138.0 pages project create slop-copter --production-branch main --force
```

The create-only `--force` flag keeps this on Pages instead of Wrangler's new
Workers delegation. It is unnecessary for subsequent deployments to the existing
Pages project; `npm run deploy` does not use it.

After deployment, open the production URL and check the opening screen, Start,
audio controls and a direct chapter link such as `?level=landing`. The production
build excludes the development test hook. Browser audio starts after interaction.

Cloudflare's [Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/)
describes the hosting workflow. Rollbacks are available from the Pages project's
deployment history in the Cloudflare dashboard.
