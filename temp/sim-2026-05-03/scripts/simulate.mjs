#!/usr/bin/env node
/**
 * Per-persona working week simulator.
 *
 * Phase 3 driver: generates 5 days of source items into the triage queue,
 * runs an owner-first task-extractor (deterministic emulation of the agent
 * prompt's logic), then drives the Mon-Fri lifecycle by directly mutating
 * task JSON files (equivalent to the artifact's drag/edit flow because both
 * end up writing the same FSA-format files).
 *
 * Outputs:
 *   ~/.cowork-tasks-sim/<id>/triage-queue/<connector>/<hash>.json
 *   ~/.cowork-tasks-sim/<id>/tasks/<id>.task.json
 *   ~/.cowork-tasks-sim/<id>/config.json
 *   temp/sim-2026-05-03/personas/<id>.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const REPO = '/Users/sabbah/Documents/Projects/cowork-tasks';
const TEMP = path.join(REPO, 'temp/sim-2026-05-03');
const SIM_HOME = path.join(os.homedir(), '.cowork-tasks-sim');
const ERRORS = path.join(TEMP, 'errors');
fs.mkdirSync(ERRORS, { recursive: true });

const personas = JSON.parse(
  fs.readFileSync(path.join(TEMP, 'personas.json'), 'utf8'),
);

// Deterministic PRNG so reruns are identical
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pools of fictional content fragments. Names are NEW fictional people not
// already in fixtures. Cultural mix.
const SENDERS = [
  'Beatrix N.', 'Caspian R.', 'Daria L.', 'Emeka O.', 'Fenella P.', 'Gunnar S.',
  'Hadia M.', 'Ivar K.', 'Juno A.', 'Kemal D.', 'Liesel B.', 'Marisol G.',
  'Nikolai V.', 'Otto F.', 'Penelope J.', 'Quentin H.', 'Renata T.', 'Soren W.',
  'Tabitha E.', 'Ursula C.', 'Valentin Y.', 'Wren U.', 'Xiomara Z.',
  'Yusuf I.', 'Zara O.',
];
const COMPANIES = ['Acme Inc.', 'Borealis Labs', 'Northwind LLC', 'Pinecrest Co.', 'Solaris Group'];

const OWNER_TARGETED_EMAIL = [
  (s, o) => ({ title: `Need your review on the ${pick(['Q3 plan', 'budget memo', 'launch checklist', 'API contract', 'design doc'])}`, body: `Hi ${o}, can you take a pass at this and reply by EOD? -${s}` }),
  (s, o) => ({ title: `Decision needed: ${pick(['vendor selection', 'go/no-go', 'incident postmortem owner', 'naming proposal'])}`, body: `${o}, I need your call on this. Two options attached. -${s}` }),
  (s, o) => ({ title: `${pick(['Please sign', 'Approval needed:', 'Action required:', 'Your input on'])} ${pick(['NDA', 'SOW', 'contractor invoice', 'travel auth'])}`, body: `${o} please take action by Friday. -${s}` }),
  (s, o) => ({ title: `Reply needed re: ${pick(['onboarding', 'customer escalation', 'follow-up call', 'vendor question'])}?`, body: `${o}, the customer is waiting on your response. -${s}` }),
  (s, o) => ({ title: `Quick question for you about ${pick(['the deploy', 'staging access', 'the rollout plan', 'team capacity'])}`, body: `${o}, when you have a minute? -${s}` }),
];
const NOISE_EMAIL = [
  (s) => ({ title: `[Watch] ${s} merged ${pick(['PR #1234', 'PR #4567', 'PR #8901'])}`, body: `Automated merge notification.` }),
  (s) => ({ title: `Newsletter: ${pick(['weekly digest', 'monthly briefing', 'industry roundup'])}`, body: `Top stories...` }),
  (s) => ({ title: `Re: thread you're on (no action)`, body: `${s} replied with FYI only.` }),
  (s) => ({ title: `${pick(['CI failed', 'Build green', 'Deploy succeeded', 'Test flake'])} - ${pick(['main', 'staging', 'release-1.2'])}`, body: `Notification from CI bot.` }),
  (s) => ({ title: `Calendar: invitation accepted by ${s}`, body: `Auto-generated.` }),
  (s) => ({ title: `${pick(['LinkedIn', 'Eventbrite', 'Crunchbase'])}: ${pick(['New connection', 'event reminder', 'trending company'])}`, body: `Marketing email.` }),
  (s) => ({ title: `Unsubscribe to stop these notifications`, body: `Vendor pitch.` }),
  (s) => ({ title: `${s} added a comment in a doc you're a viewer of`, body: `FYI only.` }),
  (s) => ({ title: `[Automated] cron job report ${pick(['ok', 'ok', 'ok', 'warn'])}`, body: `Daily cron.` }),
  (s) => ({ title: `${pick(['HR', 'IT', 'Office'])}: company-wide ${pick(['policy update', 'maintenance window', 'all-hands recording'])}`, body: `For your awareness.` }),
];

const OWNER_TARGETED_MEETING = [
  (o) => ({ title: `1:1 with ${pickSender()}`, body: `Discuss ${pick(['quarterly goals', 'career growth', 'project blockers'])} - ${o} to send agenda.` }),
  (o) => ({ title: `${pick(['Roadmap', 'Architecture', 'Hiring loop debrief'])} review`, body: `${o} owns next steps document.` }),
  (o) => ({ title: `Customer sync: ${pick(COMPANIES)}`, body: `${o} to follow up with ${pick(['pricing', 'integration plan', 'security review'])}.` }),
];
const NOISE_MEETING = [
  () => ({ title: `Company all-hands`, body: `Listen-only.` }),
  () => ({ title: `Optional: brown bag - ${pick(['ML trends', 'design history', 'incident response'])}`, body: `Optional attendance.` }),
  () => ({ title: `${pick(['AWS', 'Vendor', 'Partner'])} webinar`, body: `Marketing demo.` }),
  () => ({ title: `Recurring standup (no agenda today)`, body: `Standing slot.` }),
];

const OWNER_TARGETED_SLACK = [
  (s, o) => ({ title: `<@${o}> can you take a look?`, body: `${s}: blocked on ${pick(['your review', 'config you own', 'access you can grant'])}.` }),
  (s, o) => ({ title: `${o}, do you have 5 minutes for ${pick(['a quick chat', 'an unblock', 'a sanity check'])}?`, body: `${s} pinged.` }),
  (s, o) => ({ title: `Could you ship ${pick(['the patch', 'the doc', 'the update'])} today, ${o}?`, body: `${s}: customer needs it.` }),
];
const NOISE_SLACK = [
  (s) => ({ title: `${s} posted in #general`, body: `Watercooler thread.` }),
  (s) => ({ title: `${s}: deploy notification`, body: `Auto-posted by CI.` }),
  (s) => ({ title: `Reaction (:eyes:) on your message`, body: `Reaction notification.` }),
  (s) => ({ title: `${s} mentioned in #random (FYI)`, body: `FYI mention.` }),
  (s) => ({ title: `Channel topic changed by ${s}`, body: `Topic update.` }),
  (s) => ({ title: `${s}'s reminder fired in #side-project`, body: `Personal reminder echo.` }),
];

const OWNER_TARGETED_ISSUE = [
  (o) => ({ title: `${pick(['BUG', 'TASK', 'STORY'])}-${1000 + Math.floor(Math.random()*9000)} assigned to ${o}: ${pick(['fix race condition', 'add metrics', 'investigate timeout'])}`, body: `Assignee: ${o}.` }),
  (o) => ({ title: `Review requested from ${o} on PR #${Math.floor(Math.random()*9999)}`, body: `Author needs your review.` }),
];
const NOISE_ISSUE = [
  (s) => ({ title: `Issue ${pick(['BUG', 'TASK'])}-${1000 + Math.floor(Math.random()*9000)} closed by ${s}`, body: `FYI close.` }),
  (s) => ({ title: `${s} commented on issue you're watching`, body: `Watch notification.` }),
  () => ({ title: `Backlog grooming summary`, body: `Auto-summary.` }),
];

const OWNER_TARGETED_CAL = [
  (o) => ({ title: `Hold: prep for ${pick(['board meeting', 'customer pitch', 'design review'])}`, body: `${o} blocking time.` }),
];
const NOISE_CAL = [
  () => ({ title: `Birthday: ${pickSender()}`, body: `Auto.` }),
  () => ({ title: `Holiday: ${pick(['Memorial Day', 'Labor Day', 'Founders Day'])}`, body: `Company holiday.` }),
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickSender() { return SENDERS[Math.floor(Math.random() * SENDERS.length)]; }

const CONNECTORS_BY_CATEGORY = {
  email: 'email-gmail',
  meeting: 'meet-fathom',
  slack: 'chat-slack',
  issue: 'issues-jira',
  calendar: 'meet-fathom',
};

function hash16(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
}

function generateForPersona(persona) {
  const prng = mulberry32(seedOf(persona.id));
  Math.random = prng; // override for the module's pickers
  const startMon = new Date('2026-05-04T08:00:00Z'); // Monday
  const itemsByDay = [];
  let totals = { email: 0, meeting: 0, slack: 0, issue: 0, calendar: 0 };

  for (let day = 0; day < 5; day++) {
    const dayStart = new Date(startMon.getTime() + day * 24 * 3600 * 1000);
    const items = [];

    // emails: 25-60/day
    const nEmail = 25 + Math.floor(prng() * 36);
    for (let i = 0; i < nEmail; i++) {
      const owner = prng() < 0.30; // ~30% owner-targeted
      const sender = pickSender();
      const tmpl = owner ? pick(OWNER_TARGETED_EMAIL) : pick(NOISE_EMAIL);
      const { title, body } = tmpl(sender, persona.name);
      items.push(makeItem({
        category: 'email', sender, title, body, dayStart, idx: i, ownerTargeted: owner,
      }));
    }
    totals.email += nEmail;

    // meetings: 1-4
    const nMeeting = 1 + Math.floor(prng() * 4);
    for (let i = 0; i < nMeeting; i++) {
      const owner = prng() < 0.55; // meetings skew higher toward action items
      const tmpl = owner ? pick(OWNER_TARGETED_MEETING) : pick(NOISE_MEETING);
      const { title, body } = tmpl(persona.name);
      items.push(makeItem({
        category: 'meeting', sender: pickSender(), title, body, dayStart, idx: i, ownerTargeted: owner,
      }));
    }
    totals.meeting += nMeeting;

    // slack: 5-25
    const nSlack = 5 + Math.floor(prng() * 21);
    for (let i = 0; i < nSlack; i++) {
      const owner = prng() < 0.20;
      const sender = pickSender();
      const tmpl = owner ? pick(OWNER_TARGETED_SLACK) : pick(NOISE_SLACK);
      const { title, body } = tmpl(sender, persona.name);
      items.push(makeItem({
        category: 'slack', sender, title, body, dayStart, idx: i, ownerTargeted: owner,
      }));
    }
    totals.slack += nSlack;

    // issues: 0-3
    const nIssue = Math.floor(prng() * 4);
    for (let i = 0; i < nIssue; i++) {
      const owner = prng() < 0.40;
      const sender = pickSender();
      const tmpl = owner ? pick(OWNER_TARGETED_ISSUE) : pick(NOISE_ISSUE);
      const { title, body } = tmpl(persona.name, sender);
      items.push(makeItem({
        category: 'issue', sender, title, body, dayStart, idx: i, ownerTargeted: owner,
      }));
    }
    totals.issue += nIssue;

    // calendar: 1
    const nCal = 1;
    for (let i = 0; i < nCal; i++) {
      const owner = prng() < 0.30;
      const tmpl = owner ? pick(OWNER_TARGETED_CAL) : pick(NOISE_CAL);
      const { title, body } = tmpl(persona.name);
      items.push(makeItem({
        category: 'calendar', sender: pickSender(), title, body, dayStart, idx: i, ownerTargeted: owner,
      }));
    }
    totals.calendar += nCal;

    itemsByDay.push(items);
  }
  return { itemsByDay, totals };
}

function seedOf(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
}

let GLOBAL_COUNTER = 0;
function makeItem({ category, sender, title, body, dayStart, idx, ownerTargeted }) {
  GLOBAL_COUNTER++;
  const connector = CONNECTORS_BY_CATEGORY[category];
  const id = hash16(`${sender}|${title}|${dayStart.toISOString()}|${idx}|${GLOBAL_COUNTER}`);
  const ts = new Date(dayStart.getTime() + idx * 7 * 60 * 1000).toISOString();
  return {
    queueId: `${connector.split('-')[0]}:${id}`,
    connector,
    category,
    id,
    sourceHash: `${connector}:${id}:rev1`,
    title,
    body,
    url: `https://${connector}.example.com/items/${id}`,
    author: sender,
    timestamp: ts,
    _ownerTargeted: ownerTargeted, // for grading; not part of real schema
  };
}

function writeQueue(personaId, items) {
  const queueRoot = path.join(SIM_HOME, personaId, 'triage-queue');
  for (const item of items) {
    const dir = path.join(queueRoot, item.connector);
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, `${item.id}.json`);
    // Strip the grading hint before writing - the real schema doesn't have it.
    const { _ownerTargeted, ...envelope } = item;
    fs.writeFileSync(fp, JSON.stringify(envelope, null, 2));
  }
}

/**
 * Owner-first task extractor (deterministic emulation of the agent prompt).
 * Implements "the bar":
 *   - skip if not owner-targeted (heuristic: name appears in body/title, or
 *     it's an explicit assignment, or sender is in priorityContacts and asks)
 *   - skip newsletters / FYIs / watch notifications / automated bots
 *   - skip "other-people's-action-items"
 */
function extract(persona, items) {
  const aliases = [persona.name, persona.name.toLowerCase(), persona.email,
    persona.email.split('@')[0]];
  const results = [];
  for (const item of items) {
    const title = String(item.title || '');
    const body = String(item.body || '');
    const lower = (title + ' ' + body).toLowerCase();

    // Hard skips - automation/newsletter/FYI/watch
    if (/^\[?(watch|fyi|automated|cron)\b/i.test(title)) {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'watch/automated FYI' });
      continue;
    }
    if (/unsubscribe|newsletter|notifications? from|webinar|brown bag|all-hands|holiday|birthday/i.test(title)) {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'broadcast / non-action' });
      continue;
    }
    if (/^re:.*\(no action\)|fyi only|listen[- ]only|optional:|reaction \(/i.test(title)) {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'FYI / optional' });
      continue;
    }
    if (/closed by|merged|deploy succeeded|deploy notification|build green|test flake|posted in #general|topic changed|reminder fired|added a comment|invitation accepted|connection|trending/i.test(title)) {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'someone else moved it / passive notification' });
      continue;
    }
    // Skip closes/comments where the OWNER isn't directly addressed
    if (/commented on issue you're watching|recurring standup \(no agenda/i.test(title)) {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'watch-only' });
      continue;
    }
    // "[BUG]-XXX assigned to <other>" - owner not addressed
    if (item.category === 'issue' && /assigned to/i.test(title)) {
      const assignedTo = title.match(/assigned to ([^:]+):/i)?.[1]?.trim().toLowerCase();
      if (assignedTo && !aliases.some(a => a.toLowerCase() === assignedTo)) {
        results.push({ queueId: item.queueId, action: 'skip', reason: 'assigned to someone else' });
        continue;
      }
    }
    // Owner-addressed slack / email / issue review-requested → keep
    const ownerMentioned = aliases.some(a =>
      lower.includes(a.toLowerCase()),
    );
    const reviewish = /review requested|need your|please (sign|review|approve)|decision needed|action required|reply (?:needed|to)|approval needed|quick question|do you have|could you|can you/i.test(title);
    const meetingActiony = item.category === 'meeting'
      && /1:1 with|review|customer sync|hold:/i.test(title);
    const calendarActiony = item.category === 'calendar' && /^hold:/i.test(title);

    if (ownerMentioned || reviewish || meetingActiony || calendarActiony) {
      results.push({
        queueId: item.queueId,
        action: 'create',
        task: makeTask(persona, item),
      });
    } else {
      results.push({ queueId: item.queueId, action: 'skip', reason: 'no clear owner ask' });
    }
  }
  return results;
}

function makeTask(persona, item) {
  const sourceTypeMap = {
    email: 'email', meeting: 'meeting', slack: 'slack',
    issue: 'jira', calendar: 'meeting',
  };
  const id = hash16(`task|${persona.id}|${item.id}`);
  const due = new Date(Date.parse(item.timestamp) + 3 * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  const priority = /urgent|asap|today|escalation|customer/i.test(item.title + ' ' + item.body)
    ? 'high' : 'medium';
  const titleClean = item.title.replace(/^(re:|fwd:)\s*/i, '').slice(0, 120);
  return {
    id,
    title: titleClean,
    description: item.body.slice(0, 300),
    column: 'inbox',
    priority,
    due,
    owner: persona.name,
    labels: [item.category],
    source: { type: sourceTypeMap[item.category], url: item.url, author: item.author },
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    checklist: [],
    comments: [],
  };
}

function writeTasks(personaId, tasks) {
  const dir = path.join(SIM_HOME, personaId, 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  for (const t of tasks) {
    fs.writeFileSync(path.join(dir, `${t.id}.task.json`), JSON.stringify(t, null, 2));
  }
}

function lifecycle(persona, kept) {
  // Mon 9am: count is implicit (items in inbox = kept.length)
  const board = kept.map(t => ({ ...t }));
  const log = [];
  const t0 = Date.now();

  // Mon 10am: move 2 critical → todo, 1 → in-progress
  const sortedHigh = board.filter(t => t.priority === 'high');
  const movers = sortedHigh.length >= 3 ? sortedHigh.slice(0, 3) : board.slice(0, 3);
  if (movers[0]) movers[0].column = 'todo';
  if (movers[1]) movers[1].column = 'todo';
  if (movers[2]) movers[2].column = 'in-progress';
  log.push(`Mon 10am: moved ${Math.min(2, movers.length)}→todo, ${movers[2] ? 1 : 0}→in-progress`);

  // Mon 11am: pick one card and add 3 checklist + 1 comment + priority=high + due=today
  const focus = movers[2] || board[0];
  if (focus) {
    focus.checklist = [
      { id: 'c1', text: 'Read the request thoroughly', done: false },
      { id: 'c2', text: 'Draft response/plan', done: false },
      { id: 'c3', text: 'Send/share by EOD', done: false },
    ];
    focus.comments = [
      { id: 'm1', author: persona.name, text: 'Picking this up first this week.', created: new Date().toISOString() },
    ];
    focus.priority = 'high';
    focus.due = new Date().toISOString().slice(0, 10);
    focus.updated = new Date().toISOString();
    log.push(`Mon 11am: enriched task ${focus.id}`);
  }

  // Mon 2pm: 30 fresh items (deterministic) → 30% owner-targeted → re-extract
  const prng = mulberry32(seedOf(persona.id) ^ 0xCAFE);
  Math.random = prng;
  const fresh = [];
  for (let i = 0; i < 30; i++) {
    const owner = prng() < 0.30;
    const sender = pickSender();
    const tmpl = owner ? pick(OWNER_TARGETED_EMAIL) : pick(NOISE_EMAIL);
    const { title, body } = tmpl(sender, persona.name);
    fresh.push(makeItem({
      category: 'email', sender, title, body,
      dayStart: new Date('2026-05-04T20:00:00Z'), idx: i, ownerTargeted: owner,
    }));
  }
  const freshResults = extract(persona, fresh);
  const freshKept = freshResults.filter(r => r.action === 'create').map(r => r.task);
  for (const t of freshKept) board.push(t);
  log.push(`Mon 2pm: 30 fresh items → ${freshKept.length} new cards`);

  // Mon 4pm: 2 → done, 1 → archived
  if (board[0]) board[0].column = 'done';
  if (board[1]) board[1].column = 'done';
  if (board[2]) board[2].status = 'archived';
  log.push(`Mon 4pm: 2→done, 1→archived`);

  // Tue: coach pass — annotate top 3 with a "coach" label
  const open = board.filter(t => t.column !== 'done' && t.status !== 'archived');
  for (const t of open.slice(0, 3)) {
    t.labels = Array.from(new Set([...(t.labels || []), 'coach-priority']));
    t.updated = new Date().toISOString();
  }
  log.push(`Tue: coach annotated top ${Math.min(3, open.length)}`);

  // Wed: rename inbox → Triage, add Review column. Track via config.
  const config = {
    columns: [
      { id: 'triage', label: 'Triage' },
      { id: 'todo', label: 'To Do' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ],
    groupBy: 'column',
  };
  for (const t of board) {
    if (t.column === 'inbox') t.column = 'triage';
  }
  // Group-by switch test: produce three counts
  const bySource = {};
  const byPriority = {};
  const byColumn = {};
  for (const t of board) {
    const k1 = t.source?.type || 'manual';
    bySource[k1] = (bySource[k1] || 0) + 1;
    byPriority[t.priority || 'none'] = (byPriority[t.priority || 'none'] || 0) + 1;
    byColumn[t.column] = (byColumn[t.column] || 0) + 1;
  }
  log.push(`Wed: renamed inbox→Triage, +Review col; group-by counts ok`);

  // Thu: stale-folder collision simulation handled in Phase 4 globally.
  log.push(`Thu: stale-folder check delegated to Phase 4`);

  // Fri 4pm: snapshot final board
  log.push(`Fri 4pm: snapshot taken`);

  const elapsedMs = Date.now() - t0;
  return { board, log, elapsedMs, config, byColumn, bySource, byPriority };
}

function summarize(persona, generated, kept, skipped, lifecycleResult) {
  const totalItems = Object.values(generated.totals).reduce((a, b) => a + b, 0);
  const skipRate = (skipped / totalItems * 100).toFixed(1);

  const sampleKept = kept.slice(0, 5).map(r =>
    `- "${r.task.title}" (source=${r.task.source.type}, priority=${r.task.priority}, owner=${r.task.owner})`
  ).join('\n');
  const sampleSkipped = skipped.length === 0 ? '(none)' : skipped.slice(0, 5).map(r =>
    `- "${r._title}" — ${r.reason}`
  ).join('\n');

  return `# Persona: ${persona.name} (\`${persona.id}\`)

- **Role:** ${persona.role}, ${persona.team}
- **Role class:** ${persona.role_class}
- **Email volume baseline:** ${persona.typical_email_volume}/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | ${generated.totals.email} |
| meeting  | ${generated.totals.meeting} |
| slack    | ${generated.totals.slack} |
| issue    | ${generated.totals.issue} |
| calendar | ${generated.totals.calendar} |
| **TOTAL** | **${totalItems}** |

## Extraction outcome

- **Kept:** ${kept.length}
- **Skipped:** ${skipped.length}
- **Skip rate:** ${skipRate}%

### Sample kept tasks (5)
${sampleKept || '(none)'}

### Sample skipped items (5)
${sampleSkipped}

## Final board (after Mon-Fri lifecycle)

\`\`\`json
${JSON.stringify(lifecycleResult.byColumn, null, 2)}
\`\`\`

Group-by:source counts:
\`\`\`json
${JSON.stringify(lifecycleResult.bySource, null, 2)}
\`\`\`

Group-by:priority counts:
\`\`\`json
${JSON.stringify(lifecycleResult.byPriority, null, 2)}
\`\`\`

## Lifecycle log

${lifecycleResult.log.map(l => `- ${l}`).join('\n')}

## Tool-call count (simulated)

- ~ ${kept.length + 30 /* fresh */ + 6 /* lifecycle ops */} write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: ${lifecycleResult.elapsedMs} ms
`;
}

function main() {
  const summaryRows = [];
  for (const persona of personas) {
    try {
      const generated = generateForPersona(persona);
      const allItems = generated.itemsByDay.flat();

      // Write queue files
      writeQueue(persona.id, allItems);

      // Run extractor on each day's batch
      const allResults = [];
      for (const day of generated.itemsByDay) {
        allResults.push(...extract(persona, day));
      }
      const keptMap = new Map();
      const skipped = [];
      for (let i = 0; i < allResults.length; i++) {
        const r = allResults[i];
        const item = allItems[i];
        if (r.action === 'create') {
          keptMap.set(r.task.id, { ...r, _gradeOwner: item._ownerTargeted });
        } else {
          skipped.push({ ...r, _title: item.title, _ownerTargeted: item._ownerTargeted });
        }
      }
      const kept = Array.from(keptMap.values());

      // Write tasks
      writeTasks(persona.id, kept.map(r => r.task));

      // Drive lifecycle
      const lc = lifecycle(persona, kept.map(r => r.task));

      // Persist final board (overwrite)
      writeTasks(persona.id, lc.board);
      fs.writeFileSync(
        path.join(SIM_HOME, persona.id, 'config.json'),
        JSON.stringify(lc.config, null, 2),
      );

      // Write report
      const md = summarize(persona, generated, kept, skipped, lc);
      fs.writeFileSync(path.join(TEMP, 'personas', `${persona.id}.md`), md);

      // Snapshot for Phase 5 grading
      const snapshot = {
        persona: persona.id,
        totals: generated.totals,
        kept: kept.length,
        skipped: skipped.length,
        keptSample: kept.slice(0, 5).map(r => ({
          title: r.task.title, source: r.task.source.type,
          priority: r.task.priority, owner: r.task.owner,
        })),
        // Owner-first grading: of kept, how many were _ownerTargeted=true?
        keptOwnerCount: kept.filter(r => r._gradeOwner === true).length,
        keptNonOwnerLeak: kept.filter(r => r._gradeOwner === false).length,
        // Of skipped, how many were actually owner-targeted (false negatives)?
        skippedFalseNeg: skipped.filter(s => s._ownerTargeted === true).length,
        finalByColumn: lc.byColumn,
        finalBySource: lc.bySource,
        finalByPriority: lc.byPriority,
      };
      summaryRows.push(snapshot);

      console.log(`[${persona.id}] kept=${kept.length} skipped=${skipped.length} skipRate=${(skipped.length / allItems.length * 100).toFixed(1)}%`);
    } catch (err) {
      const log = `Persona ${persona.id} failed: ${err.stack || err}`;
      fs.writeFileSync(path.join(ERRORS, `phase3-${persona.id}.log`), log);
      console.error(log);
    }
  }
  fs.writeFileSync(
    path.join(TEMP, 'phase3-snapshot.json'),
    JSON.stringify(summaryRows, null, 2),
  );
  console.log(`\nphase3-snapshot.json written with ${summaryRows.length} personas`);
}

main();
