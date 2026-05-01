import { describe, it, expect } from 'vitest';
import { fingerprint, runOnce, InMemoryRuntime, checkContract } from '../connectors/index.js';
import type { Connector } from '../connectors/index.js';

function makeConnector(emit: (push: (item: unknown) => void) => void): Connector {
  let polled = false;
  return {
    id: 'test-connector',
    label: 'Test',
    category: 'email',
    auth: { kind: 'apiKey', envVar: 'X' },
    async watch(cursor, push) {
      if (!polled) {
        emit((item) => push(item as Parameters<typeof push>[0]));
        polled = true;
      }
      return cursor ?? 'cursor-1';
    },
  };
}

describe('connector runtime', () => {
  it('enqueues new items and dedupes on second run', async () => {
    const runtime = new InMemoryRuntime();
    const connector = makeConnector((push) => {
      push({
        id: 'msg-1',
        sourceHash: fingerprint('msg-1', 'v1'),
        title: 'Hello world',
        priority: 'normal',
      });
    });

    const stats1 = await runOnce(runtime, connector);
    expect(stats1.itemsLastTick).toBe(1);
    expect(runtime.queue).toHaveLength(1);

    const stats2 = await runOnce(runtime, connector);
    expect(stats2.itemsLastTick).toBe(0);
    expect(runtime.queue).toHaveLength(1);
  });

  it('persists cursor between runs', async () => {
    const runtime = new InMemoryRuntime();
    const connector = makeConnector(() => {});
    await runOnce(runtime, connector);
    expect(runtime.cursor).toBe('cursor-1');
  });

  it('passes contract check', async () => {
    const connector = makeConnector((push) => {
      push({
        id: 'msg-1',
        sourceHash: fingerprint('msg-1', 'v1'),
        title: 'Hello',
        priority: 'normal',
      });
    });
    const result = await checkContract(connector);
    expect(result.ok).toBe(true);
  });

  it('contract check fails when dedup is missing', async () => {
    let counter = 0;
    const broken: Connector = {
      id: 'broken',
      label: 'Broken',
      category: 'email',
      auth: { kind: 'apiKey', envVar: 'X' },
      async watch(_cursor, push) {
        counter += 1;
        push({
          id: `msg-${counter}`,
          sourceHash: `hash-${counter}`, // never repeats so dedup never trips
          title: 'always new',
          priority: 'normal',
        });
        return null;
      },
    };
    const result = await checkContract(broken);
    expect(result.ok).toBe(false);
  });
});
