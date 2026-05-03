# Scripts

Helper scripts that aren't part of the runtime. Run from the repo root.

## `pack-local.mjs`

Builds + zips the plugin for local upload to Cowork. See [docs/local-install.md](../docs/local-install.md).

```bash
pnpm pack-local
```

## `e2e-smoke.mjs`

End-to-end smoke test that drives the MCP server through `list_tasks → create_task → move_task → get_task` without Cowork.

```bash
pnpm smoke
```

## `capture-screenshots.mjs`

Renders marketing screenshots from the artifact dist using Playwright + a mocked Cowork bridge. Outputs to `docs/images/screenshots/`.

Requires the artifact e2e static server running first (port 5179).

```bash
pnpm --filter @cowork-tasks/artifact build
node packages/artifact/test/e2e/server.mjs &
node scripts/capture-screenshots.mjs
```

Output: `hero.png`, `hero-dark.png`, `hero-wide.png`, `card-detail.png`.

## `record-demo.mjs`

Records the README hero animation. Drives the live demo at http://127.0.0.1:4321/demo.html through real interactions (drag two cards, open side panel, click an Ask Claude action). Saves a WebM and converts to GIF via ffmpeg.

```bash
# In one terminal: serve the landing build
pnpm --filter @cowork-tasks/landing build
python3 -m http.server 4321 --directory packages/landing/dist &

# In another: record + convert
node packages/artifact/node_modules/.bin/playwright install chromium  # one-time
node scripts/record-demo.mjs
ffmpeg -y -i /tmp/demo-videos/page@*.webm -vf "fps=22,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/demo-palette.png
ffmpeg -y -i /tmp/demo-videos/page@*.webm -i /tmp/demo-palette.png -filter_complex "fps=22,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" docs/images/demo.gif
```

Output: ~3-4 MB GIF at 960px wide, 22 fps, ~10 seconds.

## `social-preview.html`

Standalone HTML for the GitHub social preview image (1280x640). Open over HTTP (not file://) and screenshot at 2x.

```bash
python3 -m http.server 7777 --directory scripts &
node -e "
import('@playwright/test').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:7777/social-preview.html');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'docs/images/social-preview.png', clip: { x: 0, y: 0, width: 1280, height: 640 } });
  await b.close();
});
"
```

The PNG goes into **Repo Settings → Social preview** via the GitHub UI (`gh` CLI doesn't expose this yet).
