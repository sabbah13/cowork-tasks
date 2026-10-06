import { describe, it, expect } from 'vitest';
import {
  classifyMcpError,
  isValidHostServer,
  unwrapPayload,
  writeFailureMessage,
  READ_ONLY_TOOLS,
} from '../mcpBridge';

describe('isValidHostServer', () => {
  it('accepts the shape the runtime produces for a plugin server', () => {
    expect(isValidHostServer('host:plugin_cowork-tasks_cowork-tasks')).toBe(true);
    expect(isValidHostServer('host:filesystem')).toBe(true);
  });

  it.each(['', 'host:', 'filesystem', 'host:a b', 'host:a/b', 'host:x";alert(1)//', null, 42])(
    'rejects %j',
    (v) => {
      expect(isValidHostServer(v)).toBe(false);
    },
  );
});

describe('classifyMcpError', () => {
  it.each([
    'server_not_connected',
    'not_in_manifest',
    'not_granted',
    'capability_disabled',
    'capability_removed',
    'blocked_by_policy',
    'needs_reauth',
    'consent_required',
  ])('treats %s as the bridge being unusable', (code) => {
    expect(classifyMcpError({ code }).kind).toBe('bridge-down');
  });

  it('treats cancelled as the viewer declining a write, not a dead bridge', () => {
    expect(classifyMcpError({ code: 'cancelled' }).kind).toBe('declined');
  });

  it('keeps the bridge on tool-level failures', () => {
    expect(classifyMcpError({ code: 'tool_error' }).kind).toBe('tool');
    expect(classifyMcpError({ code: 'bad_request' }).kind).toBe('tool');
  });

  it('keeps the bridge on transient failures and on unknown or missing codes', () => {
    expect(classifyMcpError({ code: 'server_unavailable' }).kind).toBe('transient');
    expect(classifyMcpError({ code: 'rate_limited' }).kind).toBe('transient');
    expect(classifyMcpError({ code: 'something_from_the_future' }).kind).toBe('transient');
    expect(classifyMcpError(new Error('boom')).kind).toBe('transient');
    expect(classifyMcpError(undefined).kind).toBe('transient');
  });
});

describe('unwrapPayload', () => {
  it('prefers the runtime-provided payload', () => {
    expect(unwrapPayload({ payload: { ok: true }, content: [{ type: 'text', text: '{"ok":false}' }] })).toEqual({
      ok: true,
    });
  });

  it('falls back to structuredContent, then to parsing the first text block', () => {
    expect(unwrapPayload({ structuredContent: { a: 1 }, content: [] })).toEqual({ a: 1 });
    expect(unwrapPayload({ content: [{ type: 'text', text: '{"version":7}' }] })).toEqual({
      version: 7,
    });
  });

  it('returns plain text verbatim when it is not JSON', () => {
    expect(unwrapPayload({ content: [{ type: 'text', text: 'hello' }] })).toBe('hello');
  });

  it('passes through values that are not result envelopes', () => {
    expect(unwrapPayload(null)).toBeNull();
    expect(unwrapPayload({ ok: true })).toEqual({ ok: true });
  });
});

describe('read-only tools and failure messages', () => {
  it('lists the read tools the board polls', () => {
    expect(READ_ONLY_TOOLS.has('list_tasks')).toBe(true);
    expect(READ_ONLY_TOOLS.has('move_task')).toBe(false);
  });

  it('has distinct wording per failure kind', () => {
    const msgs = new Set(
      (['declined', 'bridge-down', 'tool', 'transient'] as const).map(writeFailureMessage),
    );
    expect(msgs.size).toBe(4);
  });
});
