/**
 * Capture marketing screenshots from the artifact dist.
 * Self-contained: spins up a Playwright browser, injects __INITIAL_STATE__
 * + a window.claude mock matching what Cowork provides, screenshots the
 * board in light + dark, with and without the side panel open.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const OUT = '/Users/sabbah/Documents/Projects/cowork-tasks/docs/images/screenshots';
mkdirSync(OUT, { recursive: true });

const NOW = '2026-05-02T05:09:00Z';
const FULL_CONFIG = {
  defaultBoard: 'main',
  triageIntervalMinutes: 60,
  labels: [
    { id: 'urgent', name: 'urgent', color: '#b8503a' },
    { id: 'meeting', name: 'meeting', color: '#788c5d' },
    { id: 'review', name: 'review', color: '#8a6ec7' },
    { id: 'partner', name: 'partner', color: '#4ab3c2' },
    { id: 'high-priority', name: 'high-priority', color: '#d97757' },
    { id: 'escalation', name: 'escalation', color: '#b8503a' },
  ],
  boards: [
    {
      id: 'main',
      name: 'Main Board',
      columns: [
        { id: 'inbox', name: 'Inbox', color: '#6b6a64' },
        { id: 'todo', name: 'To Do', color: '#6a9bcc' },
        { id: 'in-progress', name: 'In Progress', color: '#d97757' },
        { id: 'blocked', name: 'Blocked', color: '#c89a3f' },
        { id: 'done', name: 'Done', color: '#788c5d' },
      ],
    },
  ],
};

const TASKS = [
  { id: 't1', title: 'Reply to Jamie about Q3 pricing by Fri', description: 'They asked for the breakdown by product line.', status: 'active', column: 'inbox', position: 0, owner: 'You', priority: 'high', labels: ['high-priority'], source: { type: 'email', url: 'https://mail.google.com/mail/u/0/#inbox/abc', author: 'Jamie Lee' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't2', title: 'Review David\'s PR before standup', description: 'PR #1842 - cursor pagination refactor.', status: 'active', column: 'inbox', position: 1, owner: 'You', priority: 'medium', labels: ['review'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C123/p1714', author: 'David Park' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't3', title: 'Send proposal draft to Alex (kickoff)', description: 'Action item from kickoff meeting on May 1.', status: 'active', column: 'inbox', position: 2, owner: 'You', priority: 'high', labels: ['meeting'], source: { type: 'meeting', url: 'https://fathom.video/calls/123', author: 'Sam Rivera' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't4', title: 'Decide on vendor by Wed', description: 'Three quotes received. Compare and decide.', status: 'active', column: 'inbox', position: 3, priority: 'medium', labels: [], source: { type: 'jira', url: 'https://example.atlassian.net/browse/X-1', author: 'Procurement' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't5', title: 'Confirm onboarding signoff with Acronis EU8', description: 'Verify CyberEmployee scenarios.', status: 'active', column: 'todo', position: 0, owner: 'You', priority: 'high', due: '2026-05-08', labels: ['partner'], source: { type: 'jira', url: 'https://example.atlassian.net/browse/EXAMPLE-123', author: 'Jordan Park' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't6', title: 'Draft kickoff agenda for Acme', description: 'New design partner. Kickoff Tuesday.', status: 'active', column: 'in-progress', position: 0, owner: 'You', priority: 'high', labels: ['meeting', 'high-priority'], source: { type: 'meeting', url: 'https://fathom.video/calls/45', author: 'You' }, links: [], checklist: [{ id: 'c1', text: 'Pull last quarter notes', done: true }, { id: 'c2', text: 'Draft v1', done: false }], comments: [], created: NOW, updated: NOW },
  { id: 't7', title: 'Update Q3 OKR doc', description: 'Quarterly OKR sync requested updates.', status: 'active', column: 'in-progress', position: 1, owner: 'You', priority: 'medium', labels: ['review'], source: { type: 'manual' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't8', title: 'DNS rotation blocked on legal review', description: 'Awaiting legal sign-off on TXT records.', status: 'active', column: 'blocked', position: 0, priority: 'high', labels: ['escalation'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C123/p1714560000000100', author: 'Maya Chen' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't9', title: 'Triage launch checklist', status: 'active', column: 'done', position: 0, priority: 'none', labels: [], source: { type: 'manual' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't10', title: 'Confirm contract terms with Globex', status: 'active', column: 'done', position: 1, priority: 'none', labels: ['partner'], source: { type: 'email', url: 'https://mail.google.com/0/abc', author: 'Legal' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't11', title: 'Approve design v3 in Figma', status: 'active', column: 'done', position: 2, priority: 'none', labels: ['review'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C/p1', author: 'Designer' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  { id: 't12', title: 'Ship partner-success report v3', description: 'Published.', status: 'active', column: 'done', position: 3, priority: 'none', labels: ['partner'], source: { type: 'manual' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
];

const browser = await chromium.launch();

async function shot(filename, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: opts.dark ? 'dark' : 'light',
  });
  const page = await ctx.newPage();

  await page.addInitScript(({ tasks, config, dark }) => {
    const state = { version: 47, tasks, config, tombstones: {} };
    window.__INITIAL_STATE__ = state;
    window.__claudeCalls = [];
    window.__mockState = state;
    if (dark) {
      try {
        document.documentElement?.classList.add('dark');
        localStorage.setItem('cowork-tasks:theme', 'dark');
      } catch (_) {}
    }
    const wrap = (data) => ({ content: [{ text: JSON.stringify(data) }] });
    window.claude = {
      callTool: async (server, tool, args = {}) => {
        if (server !== 'cowork-tasks') return wrap({ ok: true });
        if (tool === 'list_tasks') return wrap({ version: state.version, added: state.tasks.filter(t => t.status === 'active'), updated: [], removed: [] });
        if (tool === 'list_config') return wrap(state.config);
        return wrap({ ok: true });
      },
      complete: async (p) => `[mock] ${p.slice(0, 40)}...`,
      sendToChat: async () => {},
    };
  }, { tasks: TASKS, config: FULL_CONFIG, dark: !!opts.dark });

  await page.goto('http://127.0.0.1:5179/artifact.html');
  await page.locator('header[role="banner"]').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(800);
  if (opts.action) await opts.action(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${filename}`, fullPage: opts.fullPage ?? false });
  await ctx.close();
  console.log('Wrote', filename);
}

await shot('hero.png');
await shot('hero-dark.png', { dark: true });
await shot('hero-wide.png', { viewport: { width: 1920, height: 1080 } });
await shot('card-detail.png', {
  action: async (p) => {
    const card = p.locator('[data-task-id]').first();
    if (await card.count()) await card.click();
  },
});

await browser.close();
console.log('Done');
