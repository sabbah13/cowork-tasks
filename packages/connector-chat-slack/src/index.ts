import { fingerprint, type Connector, type SourceItem } from '@cowork-tasks/core';

export interface SlackConnectorOpts {
  /** User token (xoxp-...). */
  token: string;
  /** Custom fetch impl for tests. */
  fetchImpl?: typeof fetch;
  /** Workspace base URL for permalinks. e.g. `https://acme.slack.com`. */
  workspaceUrl?: string;
}

interface SlackUserPersona {
  id: string;
  realName?: string;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: 'im' | 'mpim' | 'channel' | 'group';
  team?: string;
  thread_ts?: string;
}

interface SlackCursor {
  /** Latest `ts` we already enqueued. */
  ts: string;
}

const SLACK_API = 'https://slack.com/api';

export function createSlackConnector(opts: SlackConnectorOpts): Connector {
  const fetcher = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function api<T>(method: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${SLACK_API}/${method}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await fetcher(url.toString(), {
      headers: { authorization: `Bearer ${opts.token}` },
    });
    if (!res.ok) throw new Error(`slack ${method}: HTTP ${res.status}`);
    const json = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!json.ok) throw new Error(`slack ${method}: ${json.error}`);
    return json;
  }

  async function self(): Promise<SlackUserPersona> {
    const r = await api<{ user_id: string }>('auth.test');
    return { id: r.user_id };
  }

  return {
    id: 'chat-slack',
    label: 'Slack',
    category: 'chat',
    auth: { kind: 'token', envVar: 'SLACK_USER_TOKEN' },
    schedule: { kind: 'poll', intervalMs: 60_000 },

    async watch(cursor, push) {
      const me = await self();
      const cursorObj: SlackCursor | null = cursor ? safeJson<SlackCursor>(cursor) : null;
      const sinceTs = cursorObj?.ts ?? toSlackTs(Date.now() - 24 * 3600 * 1000);

      // Pull recent mentions via search.messages
      const searchTerm = `<@${me.id}>`;
      const search = await api<{
        messages?: { matches?: SlackMessage[] };
      }>('search.messages', { query: searchTerm, count: '50', sort: 'timestamp' });
      const mentions = search.messages?.matches ?? [];

      const items: SlackMessage[] = [];
      for (const m of mentions) if (m.ts > sinceTs) items.push(m);

      // Pull recent DMs (via conversations.list + history)
      const dmList = await api<{
        channels?: { id: string; user: string }[];
      }>('users.conversations', { types: 'im', exclude_archived: 'true', limit: '50' });

      for (const ch of dmList.channels ?? []) {
        const hist = await api<{ messages?: SlackMessage[] }>('conversations.history', {
          channel: ch.id,
          oldest: sinceTs,
          limit: '20',
        });
        for (const msg of hist.messages ?? []) {
          if (msg.user && msg.user !== me.id && msg.ts > sinceTs) {
            items.push({ ...msg, channel: ch.id, channel_type: 'im' });
          }
        }
      }

      // Sort and emit
      items.sort((a, b) => a.ts.localeCompare(b.ts));
      let maxTs = sinceTs;
      for (const m of items) {
        if (!m.text || !m.text.trim()) continue;
        if (m.ts > maxTs) maxTs = m.ts;
        const item: SourceItem = {
          id: `${m.channel ?? '?'}:${m.ts}`,
          sourceHash: fingerprint('slack', m.channel ?? '?', m.ts),
          title: truncate(m.text, 80),
          body: m.text,
          url: opts.workspaceUrl
            ? `${opts.workspaceUrl}/archives/${m.channel}/p${m.ts.replace('.', '')}`
            : undefined,
          author: m.user,
          timestamp: new Date(Number(m.ts.split('.')[0]) * 1000).toISOString(),
          priority: m.channel_type === 'im' ? 'high' : 'normal',
          meta: { channel: m.channel, channelType: m.channel_type },
        };
        push(item);
      }

      return JSON.stringify({ ts: maxTs } satisfies SlackCursor);
    },
  };
}

function toSlackTs(epochMs: number): string {
  return `${(epochMs / 1000).toFixed(6)}`;
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
