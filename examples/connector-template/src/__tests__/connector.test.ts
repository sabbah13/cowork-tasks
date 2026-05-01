import { describe, it, expect } from 'vitest';
import { checkContract } from '@cowork-tasks/core';
import { createMyConnector } from '../index.js';

function mockFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

describe('my-source connector template', () => {
  it('passes the connector contract', async () => {
    const connector = createMyConnector({
      apiKey: 'k',
      fetchImpl: mockFetch({
        items: [{ id: 'a', title: 'Hello', ts: new Date().toISOString() }],
      }),
    });
    const result = await checkContract(connector);
    expect(result.ok).toBe(true);
  });
});
