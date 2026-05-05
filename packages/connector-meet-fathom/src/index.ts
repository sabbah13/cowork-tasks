import { fingerprint, type Connector, type SourceItem } from '@cowork-tasks/core';

export interface FathomConnectorOpts {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

interface FathomMeeting {
  id: string;
  recording_id?: string;
  title: string;
  url: string;
  share_url?: string;
  end_time: string;
  host?: { name?: string };
  summary?: string;
  transcript?: string;
}

const FATHOM_API = 'https://api.fathom.video/external/v1';

export function createFathomConnector(opts: FathomConnectorOpts): Connector {
  const fetcher = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function api<T>(pathAndQuery: string): Promise<T> {
    const res = await fetcher(`${FATHOM_API}${pathAndQuery}`, {
      headers: { 'X-Api-Key': opts.apiKey },
    });
    if (!res.ok) throw new Error(`fathom ${pathAndQuery}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    id: 'meet-fathom',
    label: 'Fathom',
    category: 'meeting',
    auth: { kind: 'apiKey', envVar: 'FATHOM_API_KEY' },
    schedule: { kind: 'poll', intervalMs: 5 * 60_000 },

    async watch(cursor, push) {
      const since =
        cursor ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const params = new URLSearchParams({ since, limit: '20' });
      const res = await api<{ meetings?: FathomMeeting[] }>(`/meetings?${params.toString()}`);
      const meetings = res.meetings ?? [];

      let maxEnd = '';
      for (const m of meetings) {
        if (m.end_time > maxEnd) maxEnd = m.end_time;
        const item: SourceItem = {
          id: m.id,
          sourceHash: fingerprint('fathom', m.id, m.end_time),
          title: m.title,
          body: combineSummaryAndTranscript(m.summary, m.transcript),
          url: m.share_url ?? m.url,
          author: m.host?.name,
          timestamp: m.end_time,
          priority: 'normal',
          meta: { recordingId: m.recording_id },
        };
        push(item);
      }
      return maxEnd || since;
    },
  };
}

function combineSummaryAndTranscript(summary?: string, transcript?: string): string | undefined {
  const parts: string[] = [];
  if (summary) parts.push(`Summary:\n${summary}`);
  if (transcript) parts.push(`Transcript:\n${transcript.slice(0, 6000)}`);
  return parts.length ? parts.join('\n\n') : undefined;
}
