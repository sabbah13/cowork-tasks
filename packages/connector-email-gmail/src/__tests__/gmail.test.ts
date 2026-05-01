import { describe, it, expect } from 'vitest';
import { checkContract, InMemoryRuntime, runOnce } from '@cowork-tasks/core';
import { createGmailConnector } from '../index.js';

function mockFetch(handlers: Record<string, () => unknown>): typeof fetch {
  return (async (url: RequestInfo | URL): Promise<Response> => {
    const u = String(url);
    const key = Object.keys(handlers).find((k) => u.includes(k));
    if (!key) {
      return new Response('not mocked', { status: 404 });
    }
    return new Response(JSON.stringify(handlers[key]!()), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('email-gmail connector', () => {
  it('passes the connector contract', async () => {
    const fetchImpl = mockFetch({
      '/users/me/profile': () => ({ historyId: '1', emailAddress: 'me@example.com' }),
      '/users/me/history?': () => ({ history: [], historyId: '2' }),
      '/users/me/messages?': () => ({
        messages: [{ id: 'm1', threadId: 't1' }],
      }),
      '/users/me/messages/m1': () => ({
        id: 'm1',
        threadId: 't1',
        historyId: '1',
        payload: {
          headers: [
            { name: 'From', value: '"Sarah" <sarah@example.com>' },
            { name: 'Subject', value: 'Please review Q3 plan' },
            { name: 'Date', value: '2026-05-01T09:00:00Z' },
          ],
          body: { data: Buffer.from('Hi, please review.').toString('base64url') },
        },
      }),
    });
    const connector = createGmailConnector({
      credentials: { accessToken: 'tok' },
      fetchImpl,
    });
    const result = await checkContract(connector);
    expect(result.ok).toBe(true);
  });

  it('uses historyId as cursor on subsequent runs', async () => {
    let calls = 0;
    const fetchImpl = mockFetch({
      '/users/me/profile': () => ({ historyId: '100', emailAddress: 'me@example.com' }),
      '/users/me/messages?labelIds=': () => ({ messages: [{ id: 'm1', threadId: 't1' }] }),
      '/users/me/messages/m1': () => ({
        id: 'm1',
        threadId: 't1',
        historyId: '100',
        payload: { headers: [{ name: 'Subject', value: 'A' }] },
      }),
      '/users/me/history?': () => {
        calls += 1;
        return { history: [], historyId: '101' };
      },
    });
    const connector = createGmailConnector({
      credentials: { accessToken: 'tok' },
      fetchImpl,
    });
    const runtime = new InMemoryRuntime();
    await runOnce(runtime, connector);
    expect(runtime.cursor).toBe('100');
    await runOnce(runtime, connector);
    expect(runtime.cursor).toBe('101');
    expect(calls).toBe(1);
  });
});
