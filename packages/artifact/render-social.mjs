import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 640 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto('http://localhost:7777/social-preview.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Render the body so the .card fills the viewport exactly
await page.addStyleTag({ content: 'body{min-height:auto !important;background:#fbfbfa !important} .card{margin:0 !important}' });
await page.waitForTimeout(200);

const outPath = process.argv[2] || '/Users/sabbah/Documents/Projects/cowork-tasks/docs/images/social-preview.png';
await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1280, height: 640 } });

console.log('Wrote', outPath);
await browser.close();
