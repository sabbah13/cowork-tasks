import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const VIDEOS = '/tmp/demo-videos-v4';
mkdirSync(VIDEOS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: VIDEOS, size: { width: 1280, height: 720 } },
  colorScheme: 'light',
});
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:4321/demo.html', { waitUntil: 'networkidle' });
await page.locator('header[role="banner"]').waitFor({ state: 'visible', timeout: 15_000 });
await page.waitForTimeout(800);

const t0 = Date.now();
const t = (ms) => Date.now() - t0;

await page.waitForTimeout(1000);
console.log(`[${t()}ms] initial`);

// Email arrival toast - styled like a real macOS Gmail desktop notification
await page.evaluate(() => {
  const gmailLogo = `
    <svg width="22" height="22" viewBox="0 0 256 193" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
      <path d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z" fill="#4285f4"/>
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798z" fill="#34a853"/>
      <path d="M58.182 93.14l-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 33.469-4.669 42.166L128 145.504z" fill="#ea4335"/>
      <path d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z" fill="#fbbc04"/>
      <path d="M0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.226z" fill="#c5221f"/>
    </svg>`;
  const toast = document.createElement('div');
  toast.id = 'demo-toast';
  toast.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      ${gmailLogo}
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#56554f;font-weight:700">Gmail</div>
          <div style="font-size:11px;color:#9a9994">now</div>
        </div>
        <div style="font-weight:600;margin-top:2px;font-size:14px;color:#1a1915">Maya Chen</div>
        <div style="font-size:13px;color:#56554f;margin-top:2px;line-height:1.35">Quick favor - can you review the Q3 deck before Friday?</div>
      </div>
    </div>`;
  Object.assign(toast.style, {
    position:'fixed', top:'70px', right:'20px', width:'340px', background:'#ffffff',
    border:'1px solid rgba(26,25,21,0.08)', borderRadius:'12px', padding:'14px 16px',
    fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxShadow:'0 12px 32px rgba(26,25,21,0.18), 0 2px 6px rgba(26,25,21,0.06)',
    zIndex:'99999', transform:'translateX(380px)',
    transition:'transform 320ms cubic-bezier(.2,.7,.2,1), opacity 320ms ease',
    pointerEvents:'none', backdropFilter:'blur(20px)',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
});
await page.waitForTimeout(900);
console.log(`[${t()}ms] toast in`);

// Create card via demo bridge
await page.evaluate(() => {
  if (window.claude?.callTool) {
    window.claude.callTool('cowork-tasks', 'create_task', {
      title: "Review Maya's Q3 deck before Friday",
      description: 'Maya asked to look over the deck and flag concerns.',
      column: 'inbox', position: 0, priority: 'high', labels: ['review'], owner: 'You',
      source: { type:'email', url:'https://mail.google.com/0/abc', author:'Maya Chen' },
    });
  }
});
await page.waitForTimeout(2400);
console.log(`[${t()}ms] card materialized`);

// Fade toast out
await page.evaluate(() => {
  const tt = document.getElementById('demo-toast');
  if (tt) { tt.style.transform = 'translateX(380px)'; tt.style.opacity = '0'; setTimeout(()=>tt.remove(), 400); }
});

async function dragColumn(fromColId, toColId) {
  const fromCol = page.locator(`[data-column-id="${fromColId}"]`).first();
  const fromCard = fromCol.locator('[data-task-id]').first();
  const toCol = page.locator(`[data-column-id="${toColId}"]`).first();
  const fromBox = await fromCard.boundingBox();
  const toBox = await toCol.boundingBox();
  if (!fromBox || !toBox) {
    console.log('skip drag', fromColId, '->', toColId, 'boxes:', !!fromBox, !!toBox);
    return null;
  }
  const fx = fromBox.x + fromBox.width / 2;
  const fy = fromBox.y + 24;
  const tx = toBox.x + toBox.width / 2;
  const ty = toBox.y + 100;
  await page.mouse.move(fx, fy);
  await page.waitForTimeout(120);
  await page.mouse.down();
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const x = fx + (tx - fx) * (i / steps);
    const y = fy + (ty - fy) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(450);
  return { fx, fy, tx, ty };
}

await dragColumn('inbox', 'todo');
console.log(`[${t()}ms] drag1`);

// Click first card in todo
const todoCard = page.locator('[data-column-id="todo"] [data-task-id]').first();
if (await todoCard.count()) {
  const box = await todoCard.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.waitForTimeout(150);
    await page.mouse.click(box.x + box.width / 2, box.y + 30);
    await page.waitForTimeout(700);
  }
}
console.log(`[${t()}ms] panel open`);

// Click an Ask Claude action - try Tighten title
const tighten = page.locator('button:has-text("Tighten")').first();
if (await tighten.count()) {
  await tighten.click();
  await page.waitForTimeout(1300);
}
console.log(`[${t()}ms] action clicked`);

// Close panel
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Drag from todo to in-progress
await dragColumn('todo', 'in-progress');
console.log(`[${t()}ms] drag2`);

await page.waitForTimeout(800);
console.log(`[${t()}ms] done`);

const videoPath = await page.video()?.path();
await ctx.close();
await browser.close();
console.log('Recorded:', videoPath);
