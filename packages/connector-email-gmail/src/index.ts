import { fingerprint, type Connector, type SourceItem } from '@cowork-tasks/core';

export interface GmailCredentials {
  accessToken: string;
  /** Optional refresh helper. Called on 401 responses. */
  refresh?: () => Promise<string>;
}

export interface GmailConnectorOpts {
  credentials: GmailCredentials | (() => Promise<GmailCredentials>);
  /**
   * Optional fetch impl - used by tests to inject responses without an HTTP
   * server. Defaults to global `fetch`.
   */
  fetchImpl?: typeof fetch;
  /** Inbox label to scan. Default: `INBOX`. */
  labelId?: string;
}

interface GmailMessageMeta {
  id: string;
  threadId: string;
  historyId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { body?: { data?: string }; mimeType?: string }[];
    mimeType?: string;
  };
  snippet?: string;
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export function createGmailConnector(opts: GmailConnectorOpts): Connector {
  const labelId = opts.labelId ?? 'INBOX';
  const fetcher = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function creds(): Promise<GmailCredentials> {
    return typeof opts.credentials === 'function' ? opts.credentials() : opts.credentials;
  }

  async function api<T>(pathAndQuery: string): Promise<T> {
    const c = await creds();
    let res = await fetcher(`${GMAIL_API}${pathAndQuery}`, {
      headers: { authorization: `Bearer ${c.accessToken}` },
    });
    if (res.status === 401 && c.refresh) {
      const fresh = await c.refresh();
      res = await fetcher(`${GMAIL_API}${pathAndQuery}`, {
        headers: { authorization: `Bearer ${fresh}` },
      });
    }
    if (!res.ok) {
      throw new Error(`gmail ${pathAndQuery}: HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async function fetchProfile(): Promise<{ historyId: string; emailAddress: string }> {
    return api<{ historyId: string; emailAddress: string }>(`/users/me/profile`);
  }

  async function fetchHistory(startHistoryId: string): Promise<{
    history?: { messagesAdded?: { message: { id: string; threadId: string } }[] }[];
    historyId: string;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: 'messageAdded',
      labelId,
    });
    return api(`/users/me/history?${params.toString()}`);
  }

  async function fetchInboxIds(): Promise<{ id: string; threadId: string }[]> {
    // First-run path: pull the most recent N messages from the inbox label.
    const params = new URLSearchParams({ labelIds: labelId, maxResults: '25' });
    const res = await api<{ messages?: { id: string; threadId: string }[] }>(
      `/users/me/messages?${params.toString()}`,
    );
    return res.messages ?? [];
  }

  async function fetchMessage(id: string): Promise<GmailMessageMeta> {
    return api<GmailMessageMeta>(
      `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
  }

  async function fetchSnippet(id: string): Promise<string | undefined> {
    try {
      const full = await api<GmailMessageMeta>(`/users/me/messages/${id}?format=full`);
      return decodeBody(full) ?? full.snippet;
    } catch {
      return undefined;
    }
  }

  return {
    id: 'email-gmail',
    label: 'Gmail',
    category: 'email',
    auth: {
      kind: 'oauth',
      provider: 'google',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
    schedule: { kind: 'poll', intervalMs: 120_000 },

    async watch(cursor, push) {
      let ids: { id: string; threadId: string }[];
      let nextCursor: string;

      if (!cursor) {
        const profile = await fetchProfile();
        ids = await fetchInboxIds();
        nextCursor = profile.historyId;
      } else {
        const history = await fetchHistory(cursor);
        const msgs: { id: string; threadId: string }[] = [];
        for (const h of history.history ?? []) {
          for (const added of h.messagesAdded ?? []) {
            msgs.push({ id: added.message.id, threadId: added.message.threadId });
          }
        }
        ids = msgs;
        nextCursor = history.historyId ?? cursor;
      }

      // Dedupe by message id (history can repeat across pages)
      const seen = new Set<string>();
      for (const { id } of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const meta = await fetchMessage(id);
        const headers = headersOf(meta);
        const subject = headers.subject ?? '(no subject)';
        const from = headers.from ?? 'unknown';
        const author = parseEmailAuthor(from);
        const body = await fetchSnippet(id);
        const item: SourceItem = {
          id,
          sourceHash: fingerprint('gmail', id, meta.historyId),
          title: subject,
          body: body?.slice(0, 4000),
          url: `https://mail.google.com/mail/u/0/#inbox/${meta.threadId}`,
          author,
          timestamp: headers.date ?? new Date().toISOString(),
          priority: 'normal',
          meta: { threadId: meta.threadId, labelIds: meta.labelIds ?? [] },
        };
        push(item);
      }

      return nextCursor;
    },
  };
}

function headersOf(meta: GmailMessageMeta): { from?: string; subject?: string; date?: string } {
  const out: { from?: string; subject?: string; date?: string } = {};
  for (const h of meta.payload?.headers ?? []) {
    const k = h.name.toLowerCase();
    if (k === 'from') out.from = h.value;
    else if (k === 'subject') out.subject = h.value;
    else if (k === 'date') out.date = new Date(h.value).toISOString();
  }
  return out;
}

function parseEmailAuthor(from: string): string {
  const match = /^"?([^"<]+?)"?\s*<.+>$/.exec(from);
  return match ? match[1]!.trim() : from.trim();
}

function decodeBody(msg: GmailMessageMeta): string | undefined {
  const data = msg.payload?.body?.data ?? msg.payload?.parts?.find((p) => p.mimeType === 'text/plain')?.body?.data;
  if (!data) return undefined;
  try {
    return Buffer.from(data, 'base64url').toString('utf-8');
  } catch {
    return undefined;
  }
}
