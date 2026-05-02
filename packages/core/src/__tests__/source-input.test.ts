import { describe, it, expect } from 'vitest';
import { SourceInputSchema } from '../schema.js';

describe('SourceInputSchema (lenient)', () => {
  it('accepts a bare URL string', () => {
    const out = SourceInputSchema.parse('https://fathom.video/calls/12345?timestamp=4489');
    expect(out).toEqual({
      type: 'manual',
      url: 'https://fathom.video/calls/12345?timestamp=4489',
    });
  });

  it('accepts a non-URL string as path', () => {
    const out = SourceInputSchema.parse('mail/readable/2026/05/01.md');
    expect(out).toEqual({ type: 'manual', path: 'mail/readable/2026/05/01.md' });
  });

  it('accepts a full source object verbatim', () => {
    const out = SourceInputSchema.parse({
      type: 'meeting',
      url: 'https://fathom.video/calls/123456?timestamp=4489',
      title: 'Impromptu Google Meet',
      author: 'Sam Rivera',
    });
    expect(out).toMatchObject({
      type: 'meeting',
      url: 'https://fathom.video/calls/123456?timestamp=4489',
      title: 'Impromptu Google Meet',
      author: 'Sam Rivera',
    });
  });

  it('infers type=manual when missing', () => {
    const out = SourceInputSchema.parse({ url: 'https://example.com' });
    expect(out).toMatchObject({ type: 'manual', url: 'https://example.com' });
  });

  it('preserves unknown keys instead of dropping silently', () => {
    const out = SourceInputSchema.parse({
      type: 'meeting',
      url: 'https://fathom.video/calls/1',
      timestamp: 4489,
      vendor: 'fathom',
    });
    expect(out).toMatchObject({ type: 'meeting', timestamp: 4489, vendor: 'fathom' });
  });
});
