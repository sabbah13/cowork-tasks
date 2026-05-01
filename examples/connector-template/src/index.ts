import { fingerprint, type Connector, type SourceItem } from '@cowork-tasks/core';

export interface MyConnectorOpts {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * Replace this with your service. The base runtime drives `watch()` on the
 * configured schedule, persists the returned cursor, dedupes via
 * `sourceHash`, and routes new items to the triage queue.
 */
export function createMyConnector(opts: MyConnectorOpts): Connector {
  const fetcher = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return {
    id: 'my-source',
    label: 'My Source',
    category: 'email', // 'email' | 'meeting' | 'chat' | 'issues'
    auth: { kind: 'apiKey', envVar: 'MY_SOURCE_API_KEY' },
    schedule: { kind: 'poll', intervalMs: 2 * 60_000 },

    async watch(cursor, push) {
      // 1. Decide where to start. Use the cursor if present, otherwise pick a
      //    reasonable default (e.g., last 24h).
      const since = cursor ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      // 2. Hit your API. Prefer a delta endpoint; otherwise filter by
      //    timestamp + use ETag/If-Modified-Since to get 304s when idle.
      const res = await fetcher(`https://api.example.com/items?since=${since}`, {
        headers: { authorization: `Bearer ${opts.apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items: { id: string; title: string; ts: string }[] };

      // 3. Push each new item. The base runtime calls `is_processed` for you.
      let maxTs = since;
      for (const it of json.items) {
        if (it.ts > maxTs) maxTs = it.ts;
        const item: SourceItem = {
          id: it.id,
          sourceHash: fingerprint('my-source', it.id, it.ts),
          title: it.title,
          url: `https://app.example.com/item/${it.id}`,
          timestamp: it.ts,
          priority: 'normal',
        };
        push(item);
      }

      // 4. Return the cursor to persist for the next tick.
      return maxTs;
    },
  };
}
