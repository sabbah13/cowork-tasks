/**
 * Record a 10-second demo of the live kanban for the README.
 *
 * 1. Boots Playwright with built-in video recording (WebM).
 * 2. Drives the demo.html running on the local Vercel build.
 * 3. Performs realistic interactions: drag cards, open side panel, click AI action.
 * 4. Saves WebM video which we then convert to optimized GIF via ffmpeg.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const VIDEOS = '/tmp/demo-videos';
mkdirSync(VIDEOS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1, // 1x for smaller GIF
  recordVideo: { dir: VIDEOS, size: { width: 1280, height: 720 } },
  // Force light mode for marketing
  colorScheme: 'light',
});
const page = await ctx.newPage();

// Use the local build (faster + deterministic) rather than the deployed URL
const URL = process.env.DEMO_URL || 'http://127.0.0.1:4321/demo.html';
await page.goto(URL, { waitUntil: 'networkidle' });

// Wait for the artifact to render
await page.locator('header[role="banner"]').waitFor({ state: 'visible', timeout: 15_000 });
await page.waitForTimeout(800);

console.log('Recording 10s demo...');

const t0 = Date.now();
const t = (ms) => Date.now() - t0;

// Helper: smooth, slow drag using mouse motion
async function smoothDrag(fromSel, toSel) {
  const from = page.locator(fromSel).first();
  const to = page.locator(toSel).first();
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) {
    console.log('skipping drag, missing box for', fromSel, '->', toSel);
    return;
  }
  const fx = fromBox.x + fromBox.width / 2;
  const fy = fromBox.y + 24;
  const tx = toBox.x + toBox.width / 2;
  const ty = toBox.y + 80;

  await page.mouse.move(fx, fy);
  await page.waitForTimeout(150);
  await page.mouse.down();
  // Slow interpolated drag - 25 steps over ~1.2s
  const steps = 25;
  for (let i = 1; i <= steps; i++) {
    const x = fx + (tx - fx) * (i / steps);
    const y = fy + (ty - fy) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

// Initial pause: let the user see the layout
await page.waitForTimeout(1200);
console.log(`[${t()}ms] initial pause done`);

// Drag 1: First Inbox card -> To Do column
await smoothDrag('[data-task-id]:not([data-column="todo"])', '[data-column="todo"]');
console.log(`[${t()}ms] drag 1 done`);

// Drag 2: another Inbox card -> In Progress
await smoothDrag('[data-task-id]:not([data-column="in-progress"])', '[data-column="in-progress"]');
console.log(`[${t()}ms] drag 2 done`);

// Open card detail
const card = page.locator('[data-task-id]').nth(2);
if (await card.count()) {
  const box = await card.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(700);
  }
}
console.log(`[${t()}ms] card opened`);

// Click an "Ask Claude" action button if visible
const askBtn = page.locator('button:has-text("Tighten")').first();
if (await askBtn.count()) {
  await askBtn.click();
  await page.waitForTimeout(1200);
}
console.log(`[${t()}ms] AI action clicked`);

// Close panel by pressing Escape
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// Final hold
await page.waitForTimeout(800);
console.log(`[${t()}ms] done`);

const videoPath = await page.video()?.path();
await ctx.close();
await browser.close();
console.log('Recorded:', videoPath);
