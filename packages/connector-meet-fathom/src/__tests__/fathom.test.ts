import { describe, it, expect } from 'vitest';
import { checkContract, InMemoryRuntime, runOnce } from '@cowork-tasks/core';
import { createFathomConnector } from '../index.js';

function mockFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

describe('meet-fathom connector', () => {
  it('passes the connector contract', async () => {
    const connector = createFathomConnector({
      apiKey: 'k',
      fetchImpl: mockFetch({
        meetings: [
          {
            id: 'meeting-1',
            title: 'Q3 kickoff',
            url: 'https://fathom.video/calls/12345',
            share_url: 'https://fathom.video/share/abc',
            end_time: new Date().toISOString(),
            host: { name: 'Alex' },
            summary: 'discussed plan',
          },
        ],
      }),
    });
    const result = await checkContract(connector);
    expect(result.ok).toBe(true);
  });

  it('uses end_time as cursor', async () => {
    const t1 = '2026-05-01T10:00:00Z';
    const connector = createFathomConnector({
      apiKey: 'k',
      fetchImpl: mockFetch({
        meetings: [
          {
            id: 'm1',
            title: 'a',
            url: 'https://fathom.video/calls/1',
            end_time: t1,
            host: { name: 'A' },
          },
        ],
      }),
    });
    const runtime = new InMemoryRuntime();
    await runOnce(runtime, connector);
    expect(runtime.cursor).toBe(t1);
  });
});
