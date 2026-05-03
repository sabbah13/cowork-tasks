import { type Page } from '@playwright/test';
import { installCursor } from './cursor';

const NOW = '2026-05-02T05:09:00Z';

export const FULL_CONFIG = {
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

export const FULL_TASKS = [
  {
    id: 't1',
    title: 'Build v1 analytics dashboard plugin; ship to design partner',
    description: "Define requirements scoped in today's session.",
    status: 'active',
    column: 'inbox',
    position: 0,
    owner: 'Sam Rivera',
    priority: 'high',
    labels: ['meeting', 'high-priority'],
    source: {
      type: 'meeting',
      url: 'https://fathom.video/calls/123456?timestamp=4489',
      author: 'Sam Rivera',
    },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't2',
    title: 'Watch: Pricing experiment readout',
    description: 'Maya Chen owns; review next Monday.',
    status: 'active',
    column: 'inbox',
    position: 1,
    priority: 'medium',
    labels: ['meeting', 'review'],
    source: {
      type: 'meeting',
      url: 'https://fathom.video/calls/123456?timestamp=3127',
      author: 'Maya Chen',
    },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't3',
    title: 'Watch: Shasta traffic cutover to 100%',
    description: 'Larry / Apoorva. Escalation watchlist.',
    status: 'active',
    column: 'inbox',
    position: 2,
    priority: 'medium',
    labels: ['meeting', 'escalation', 'review'],
    source: { type: 'meeting', url: 'https://fathom.video/calls/123456?timestamp=3081' },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't4',
    title: 'Review Q3 plan from Jamie Lee',
    description: 'Sarah asked for review and comments by Friday.',
    status: 'active',
    column: 'todo',
    position: 0,
    owner: 'Sam Rivera',
    priority: 'medium',
    due: '2026-05-08',
    labels: ['review'],
    source: {
      type: 'email',
      url: 'https://mail.google.com/mail/u/0/#inbox/18a2c5',
      author: 'Jamie Lee',
    },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't5',
    title: 'Acronis EU8 onboarding signoff',
    description: 'Verify CyberEmployee scenarios with Acronis team.',
    status: 'active',
    column: 'in-progress',
    position: 0,
    priority: 'high',
    labels: ['partner'],
    source: {
      type: 'jira',
      url: 'https://example.atlassian.net/browse/EXAMPLE-123',
      author: 'Jordan Park',
    },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't6',
    title: 'DNS rotation for crimson-wok blocked on legal review',
    description: 'Awaiting legal sign-off on TXT-record changes.',
    status: 'active',
    column: 'blocked',
    position: 0,
    priority: 'high',
    labels: ['escalation'],
    source: {
      type: 'slack',
      url: 'https://acme.slack.com/archives/C123/p1714560000000100',
      author: 'Maya Chen',
    },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
  {
    id: 't7',
    title: 'Ship partner-success report v3',
    description: 'Published to https://example.com/reports/partner-success/.',
    status: 'active',
    column: 'done',
    position: 0,
    priority: 'none',
    labels: ['partner'],
    source: { type: 'manual' },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
  },
];

export interface CoworkSetup {
  fixture?: 'full' | 'empty';
  bridge?: 'ok' | 'fail' | 'missing';
}

/**
 * Inject `window.__INITIAL_STATE__` + a stateful `window.claude` mock
 * before any artifact code runs. Mirrors what Cowork does for live
 * artifacts in production.
 */
export async function setupCoworkEnv(page: Page, opts: CoworkSetup = {}): Promise<void> {
  const fixture = opts.fixture ?? 'full';
  const bridge = opts.bridge ?? 'ok';
  const tasks = fixture === 'empty' ? [] : FULL_TASKS;
  const state = { version: 47, tasks, config: FULL_CONFIG };

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // eslint-disable-next-line no-console
      console.log(`[browser ${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[browser pageerror] ${err.message}`);
  });

  // Inject the cursor visualization first - before the artifact bundle so
  // the mounted dot survives React re-renders.
  await page.addInitScript(installCursor);

  await page.addInitScript(
    ({ initial, bridge }) => {
      type AnyTask = {
        id: string;
        status: string;
        column: string;
        position: number;
        [k: string]: unknown;
      };
      type State = {
        version: number;
        tasks: AnyTask[];
        config: unknown;
        tombstones: Record<string, number>;
      };
      const state: State = {
        ...JSON.parse(JSON.stringify(initial)),
        tombstones: {},
      };
      (window as unknown as { __INITIAL_STATE__: State }).__INITIAL_STATE__ = state;
      (window as unknown as { __claudeCalls: unknown[] }).__claudeCalls = [];
      (window as unknown as { __mockState: State }).__mockState = state;

      if (bridge === 'missing') return;

      const record = (rec: unknown) => {
        (window as unknown as { __claudeCalls: unknown[] }).__claudeCalls.push(rec);
      };
      const wrap = (data: unknown) => ({ content: [{ text: JSON.stringify(data) }] });

      // Shared MCP handler — both bridge surfaces delegate to this so a
      // single test fixture covers either runtime. Returns a Cowork-style
      // wrapped envelope; the artifact's callMcp() unwraps `content`.
      const handle = async (server: string, tool: string, args: Record<string, unknown> = {}) => {
        record({ kind: 'callTool', server, tool, args });
        if (server !== 'cowork-tasks') return wrap({ ok: true });

        switch (tool) {
          case 'list_tasks': {
            const since = (args as { since?: number }).since ?? 0;
            if (since && since === state.version) {
              return wrap({
                version: state.version,
                added: [],
                updated: [],
                removed: [],
              });
            }
            const removed = Object.entries(state.tombstones)
              .filter(([, v]) => v > since)
              .map(([id]) => id);
            return wrap({
              version: state.version,
              added: state.tasks.filter((t) => t.status === 'active'),
              updated: [],
              removed,
            });
          }
          case 'list_config':
            return wrap(state.config);
          case 'archive_task': {
            const id = (args as { id: string }).id;
            for (const t of state.tasks) if (t.id === id) t.status = 'archived';
            state.version += 1;
            state.tombstones[id] = state.version;
            return wrap({ ok: true, version: state.version });
          }
          case 'delete_task': {
            const id = (args as { id: string }).id;
            state.tasks = state.tasks.filter((t) => t.id !== id);
            state.version += 1;
            state.tombstones[id] = state.version;
            return wrap({ ok: true, version: state.version });
          }
          case 'move_task': {
            const { id, column, position } = args as {
              id: string;
              column: string;
              position: number;
            };
            for (const t of state.tasks) {
              if (t.id === id) {
                t.column = column;
                t.position = position;
              }
            }
            state.version += 1;
            return wrap({ ok: true, version: state.version });
          }
          case 'update_task': {
            const { id, patch } = args as {
              id: string;
              patch: Record<string, unknown>;
            };
            for (const t of state.tasks) if (t.id === id) Object.assign(t, patch);
            state.version += 1;
            return wrap({ ok: true, version: state.version });
          }
          case 'create_task':
          case 'create_tasks': {
            const items =
              tool === 'create_tasks'
                ? ((args as { tasks: AnyTask[] }).tasks ?? [])
                : ([args] as AnyTask[]);
            const created: AnyTask[] = [];
            for (const draft of items) {
              const t: AnyTask = {
                ...draft,
                id: `mock_${Math.random().toString(36).slice(2, 7)}`,
                status: 'active',
                column: draft.column ?? 'inbox',
                position: draft.position ?? 0,
                labels: (draft as { labels?: unknown[] }).labels ?? [],
                links: [],
                checklist: [],
                comments: [],
                priority: (draft as { priority?: string }).priority ?? 'none',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
              };
              state.tasks.push(t);
              created.push(t);
            }
            state.version += 1;
            return wrap(tool === 'create_tasks' ? created : created[0]);
          }
          default:
            return wrap({ ok: true });
        }
      };

      // window.cowork — the documented Live Artifacts host API. Primary.
      (window as unknown as { cowork: unknown }).cowork = {
        callMcpTool:
          bridge === 'fail'
            ? async () => {
                throw new Error('mock 400');
              }
            : async (toolName: string, args: Record<string, unknown> = {}) => {
                // Cowork's wire format is `mcp__<server>__<tool>`. Support
                // both that and the older `<server>:<tool>` form for the
                // benefit of the legacy fallback path.
                let server = 'cowork-tasks';
                let tool = toolName;
                if (toolName.startsWith('mcp__')) {
                  const rest = toolName.slice('mcp__'.length);
                  const idx = rest.indexOf('__');
                  if (idx > 0) {
                    server = rest.slice(0, idx);
                    tool = rest.slice(idx + 2);
                  }
                } else if (toolName.includes(':')) {
                  [server, tool] = toolName.split(':', 2) as [string, string];
                }
                return handle(server, tool, args);
              },
        askClaude: async (prompt: string, context?: unknown) => {
          record({ kind: 'askClaude', prompt, context });
          return `[mock] ${String(prompt).slice(0, 40)}...`;
        },
        runScheduledTask: (taskId: string) => {
          record({ kind: 'runScheduledTask', taskId });
        },
      };

      // window.claude — legacy fallback. Both bridges record to the
      // same __claudeCalls array so existing tests still pass.
      (window as unknown as { claude: unknown }).claude = {
        callTool:
          bridge === 'fail'
            ? async () => {
                throw new Error('mock 400');
              }
            : async (server: string, tool: string, args: Record<string, unknown> = {}) =>
                handle(server, tool, args),
        complete: async (prompt: string) => {
          record({ kind: 'complete', prompt });
          return `[mock] ${prompt.slice(0, 40)}...`;
        },
        sendToChat: async (prompt: string) => {
          record({ kind: 'sendToChat', prompt });
        },
      };
    },
    { initial: state, bridge },
  );
}

export async function gotoBoard(page: Page, opts: CoworkSetup = {}): Promise<Page> {
  await setupCoworkEnv(page, opts);
  await page.goto('/artifact.html');
  await page.locator('header[role="banner"]').waitFor({ state: 'visible', timeout: 10_000 });
  return page;
}
