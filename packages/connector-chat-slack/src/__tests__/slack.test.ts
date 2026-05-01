import { describe, it, expect } from 'vitest';
import { checkContract, runOnce, InMemoryRuntime } from '@cowork-tasks/core';
import { createSlackConnector } from '../index.js';

function mockFetch(routes: Record<string, () => unknown>): typeof fetch {
  return (async (url: RequestInfo | URL): Promise<Response> => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    return new Response(JSON.stringify(key ? routes[key]!() : { ok: false, error: 'unmocked' }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
}

describe('chat-slack connector', () => {
  it('passes the connector contract', async () => {
    const fetchImpl = mockFetch({
      'auth.test': () => ({ ok: true, user_id: 'U1' }),
      'search.messages': () => ({
        ok: true,
        messages: {
          matches: [{ ts: '9999999999.000001', user: 'U2', text: 'Hey @U1 take a look' }],
        },
      }),
      'users.conversations': () => ({ ok: true, channels: [] }),
    });
    const connector = createSlackConnector({ token: 'xoxp-test', fetchImpl });
    const result = await checkContract(connector);
    expect(result.ok).toBe(true);
  });

  it('advances cursor across runs', async () => {
    const fetchImpl = mockFetch({
      'auth.test': () => ({ ok: true, user_id: 'U1' }),
      'search.messages': () => ({
        ok: true,
        messages: {
          matches: [{ ts: '9999999999.000001', user: 'U2', text: 'Hey' }],
        },
      }),
      'users.conversations': () => ({ ok: true, channels: [] }),
    });
    const connector = createSlackConnector({ token: 'xoxp-test', fetchImpl });
    const runtime = new InMemoryRuntime();
    await runOnce(runtime, connector);
    const first = runtime.cursor;
    expect(first).toBeTruthy();
    await runOnce(runtime, connector);
    expect(runtime.cursor).toBeTruthy();
    expect(runtime.queue).toHaveLength(1);
  });
});
