/**
 * Build the landing-page bundle.
 *
 * Inputs:
 *   - public/index.html         (marketing page; copied verbatim)
 *   - public/og.png             (social preview)
 *   - public/logo.svg           (favicon + brand)
 *   - ../artifact/dist/index.html (the live React artifact)
 *
 * Output: dist/
 *   - index.html                (marketing landing)
 *   - artifact.html             (raw artifact, unmodified)
 *   - demo.html                 (artifact + seeded __INITIAL_STATE__ + mock window.claude)
 *   - og.png, logo.svg, etc.
 *
 * The marketing landing references /demo.html in its iframe, so visitors
 * see the real artifact running with marketing-grade seed data and mock AI.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const DIST = join(__dirname, 'dist');
const ARTIFACT_HTML = resolve(__dirname, '..', 'artifact', 'dist', 'index.html');

mkdirSync(DIST, { recursive: true });

if (!existsSync(ARTIFACT_HTML)) {
  console.error(`Missing artifact build at ${ARTIFACT_HTML}. Run \`pnpm --filter @cowork-tasks/artifact build\` first.`);
  process.exit(1);
}

// 1) Copy public assets.
for (const name of readdirSync(PUBLIC)) {
  const src = join(PUBLIC, name);
  const dst = join(DIST, name);
  // Replace demo.html below; for now copy everything else.
  if (name === 'demo.html') continue;
  copyFileSync(src, dst);
  console.log('copied', name);
}

// 2) Copy the artifact verbatim as /artifact.html.
const artifactHtml = readFileSync(ARTIFACT_HTML, 'utf-8');
writeFileSync(join(DIST, 'artifact.html'), artifactHtml);
console.log('copied artifact.html');

// 3) Build demo.html = artifact + seed script injected before any bundle runs.
const NOW = new Date().toISOString();
const seed = {
  version: 47,
  config: {
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
    boards: [{
      id: 'main',
      name: 'Main Board',
      columns: [
        { id: 'inbox', name: 'Inbox', color: '#6b6a64' },
        { id: 'todo', name: 'To Do', color: '#6a9bcc' },
        { id: 'in-progress', name: 'In Progress', color: '#d97757' },
        { id: 'blocked', name: 'Blocked', color: '#c89a3f' },
        { id: 'done', name: 'Done', color: '#788c5d' },
      ],
    }],
  },
  tasks: [
    { id: 'demo_t1', title: 'Reply to Jamie about Q3 pricing by Fri', description: 'They asked for the breakdown by product line. Pull the latest numbers from the dashboard.', status: 'active', column: 'inbox', position: 0, owner: 'You', priority: 'high', labels: ['high-priority'], source: { type: 'email', url: 'https://mail.google.com/mail/u/0/#inbox/abc', author: 'Jamie Lee' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t2', title: "Review David's PR before standup", description: 'PR #1842 - cursor pagination refactor. About 400 lines.', status: 'active', column: 'inbox', position: 1, owner: 'You', priority: 'medium', labels: ['review'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C123/p1714', author: 'David Park' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t3', title: 'Send proposal draft to Alex (kickoff action item)', description: 'Action item from kickoff meeting on May 1. Alex wants v1 by Wednesday.', status: 'active', column: 'inbox', position: 2, owner: 'You', priority: 'high', labels: ['meeting'], source: { type: 'meeting', url: 'https://fathom.video/calls/123', author: 'Sam Rivera' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t4', title: 'Decide on vendor by Wed', description: 'Three quotes received. Compare and decide.', status: 'active', column: 'inbox', position: 3, owner: 'You', priority: 'medium', labels: [], source: { type: 'jira', url: 'https://example.atlassian.net/browse/X-1', author: 'Procurement' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t5', title: 'Confirm onboarding signoff with Acronis EU8', description: 'Verify CyberEmployee scenarios with the Acronis team.', status: 'active', column: 'todo', position: 0, owner: 'You', priority: 'high', due: '2026-05-08', labels: ['partner'], source: { type: 'jira', url: 'https://example.atlassian.net/browse/EXAMPLE-123', author: 'Jordan Park' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t6', title: 'Draft kickoff agenda for Acme', description: 'New design partner. Kickoff Tuesday at 10am PT.', status: 'active', column: 'in-progress', position: 0, owner: 'You', priority: 'high', labels: ['meeting', 'high-priority'], source: { type: 'meeting', url: 'https://fathom.video/calls/45', author: 'You' }, links: [], checklist: [{ id: 'c1', text: 'Pull last quarter notes', done: true }, { id: 'c2', text: 'Draft v1', done: false }, { id: 'c3', text: 'Review with Maya', done: false }], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t7', title: 'Update Q3 OKR doc', description: 'Quarterly OKR sync requested updates by EOD Friday.', status: 'active', column: 'in-progress', position: 1, owner: 'You', priority: 'medium', labels: ['review'], source: { type: 'manual' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t8', title: 'DNS rotation blocked on legal review', description: 'Awaiting legal sign-off on TXT-record changes.', status: 'active', column: 'blocked', position: 0, priority: 'high', labels: ['escalation'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C123/p1714560000000100', author: 'Maya Chen' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t9', title: 'Triage launch checklist', status: 'active', column: 'done', position: 0, priority: 'none', labels: [], source: { type: 'manual' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t10', title: 'Confirm contract terms with Globex', status: 'active', column: 'done', position: 1, priority: 'none', labels: ['partner'], source: { type: 'email', url: 'https://mail.google.com/0/abc', author: 'Legal' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
    { id: 'demo_t11', title: 'Approve design v3 in Figma', status: 'active', column: 'done', position: 2, priority: 'none', labels: ['review'], source: { type: 'slack', url: 'https://acme.slack.com/archives/C/p1', author: 'Designer' }, links: [], checklist: [], comments: [], created: NOW, updated: NOW },
  ],
};

const seedScript = `
<script>
/* Cowork Tasks live demo - seed runs BEFORE the artifact bundle */
(function () {
  var SEED = ${JSON.stringify(seed)};
  var state = Object.assign({ tombstones: {} }, JSON.parse(JSON.stringify(SEED)));
  window.__INITIAL_STATE__ = state;
  window.__demoState = state;

  function wrap(data) { return { content: [{ text: JSON.stringify(data) }] }; }

  window.claude = {
    callTool: function (server, tool, args) {
      args = args || {};
      if (server !== 'cowork-tasks') return Promise.resolve(wrap({ ok: true }));
      switch (tool) {
        case 'list_tasks': {
          var since = args.since || 0;
          if (since && since === state.version) {
            return Promise.resolve(wrap({ version: state.version, added: [], updated: [], removed: [] }));
          }
          var removed = Object.keys(state.tombstones).filter(function (id) { return state.tombstones[id] > since; });
          return Promise.resolve(wrap({
            version: state.version,
            added: state.tasks.filter(function (t) { return t.status === 'active'; }),
            updated: [],
            removed: removed,
          }));
        }
        case 'list_config':
          return Promise.resolve(wrap(state.config));
        case 'move_task': {
          for (var i = 0; i < state.tasks.length; i++) {
            if (state.tasks[i].id === args.id) {
              state.tasks[i].column = args.column;
              state.tasks[i].position = args.position;
              state.tasks[i].updated = new Date().toISOString();
            }
          }
          state.version += 1;
          return Promise.resolve(wrap({ ok: true, version: state.version }));
        }
        case 'update_task': {
          for (var j = 0; j < state.tasks.length; j++) {
            if (state.tasks[j].id === args.id) Object.assign(state.tasks[j], args.patch || {}, { updated: new Date().toISOString() });
          }
          state.version += 1;
          return Promise.resolve(wrap({ ok: true, version: state.version }));
        }
        case 'archive_task': {
          for (var k = 0; k < state.tasks.length; k++) {
            if (state.tasks[k].id === args.id) state.tasks[k].status = 'archived';
          }
          state.version += 1;
          state.tombstones[args.id] = state.version;
          return Promise.resolve(wrap({ ok: true, version: state.version }));
        }
        case 'delete_task': {
          state.tasks = state.tasks.filter(function (t) { return t.id !== args.id; });
          state.version += 1;
          state.tombstones[args.id] = state.version;
          return Promise.resolve(wrap({ ok: true, version: state.version }));
        }
        case 'create_task':
        case 'create_tasks': {
          var items = tool === 'create_tasks' ? (args.tasks || []) : [args];
          var created = [];
          for (var n = 0; n < items.length; n++) {
            var d = items[n];
            var t = Object.assign({}, d, {
              id: 'demo_' + Math.random().toString(36).slice(2, 7),
              status: 'active',
              column: d.column || 'inbox',
              position: d.position || 0,
              labels: d.labels || [],
              links: [], checklist: [], comments: [],
              priority: d.priority || 'none',
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
            });
            state.tasks.push(t);
            created.push(t);
          }
          state.version += 1;
          return Promise.resolve(wrap(tool === 'create_tasks' ? created : created[0]));
        }
        default:
          return Promise.resolve(wrap({ ok: true }));
      }
    },
    complete: function (prompt) {
      var p = String(prompt).toLowerCase();
      if (p.indexOf('summar') >= 0) return Promise.resolve('Jamie wants a Q3 pricing breakdown by product line. They asked for response by Friday and want to align before sharing externally.');
      if (p.indexOf('draft') >= 0 && p.indexOf('repl') >= 0) return Promise.resolve("Hi Jamie - here's the breakdown by product line. SKU-A is up 11% QoQ, SKU-C dipped 4% but is recovering. Let me know if you want to dig into either.");
      if (p.indexOf('tighten') >= 0 || p.indexOf('title') >= 0) return Promise.resolve('Send Jamie Q3 pricing breakdown by Fri');
      if (p.indexOf('split') >= 0) return Promise.resolve('1. Pull current quarter pricing data\\n2. Compare to Q2 baseline\\n3. Draft response with two callouts\\n4. Send to Jamie');
      return Promise.resolve('[demo response] Install the plugin to get real Claude responses.');
    },
    sendToChat: function (prompt) {
      console.log('[demo] sendToChat:', prompt);
      return Promise.resolve();
    },
  };
})();
</script>
<style>
  /* Subtle "demo mode" pill, fixed bottom-right of the artifact */
  body::after {
    content: "Demo mode - changes don't save";
    position: fixed;
    bottom: 12px;
    right: 12px;
    background: rgba(26, 25, 21, 0.92);
    color: #f6e5dd;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    z-index: 9999;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(26,25,21,0.2);
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
</style>
`;

const demoHtml = artifactHtml.replace('</head>', seedScript + '</head>');
writeFileSync(join(DIST, 'demo.html'), demoHtml);
console.log('built demo.html (artifact +', JSON.stringify(seed).length, 'bytes seed)');

console.log('\nLanding bundle ready in', DIST);
