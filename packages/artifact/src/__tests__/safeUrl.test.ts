import { describe, it, expect } from 'vitest';
import { safeLinkUrl, safeMediaUrl, mediaHost } from '../safeUrl';

describe('safeLinkUrl', () => {
  it('allows http, https and mailto', () => {
    expect(safeLinkUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeLinkUrl('http://example.com')).toBe('http://example.com/');
    expect(safeLinkUrl('mailto:sam@example.com')).toBe('mailto:sam@example.com');
  });

  it('allows in-page fragment links', () => {
    expect(safeLinkUrl('#section-2')).toBe('#section-2');
  });

  it('blocks javascript: in every disguise', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBe('');
    expect(safeLinkUrl('JaVaScRiPt:alert(1)')).toBe('');
    expect(safeLinkUrl('  javascript:alert(1)')).toBe('');
    // The URL parser drops tabs and newlines inside the scheme.
    expect(safeLinkUrl('java\tscript:alert(1)')).toBe('');
    expect(safeLinkUrl('java\nscript:alert(1)')).toBe('');
  });

  it('blocks data:, vbscript: and file: links', () => {
    expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeLinkUrl('vbscript:msgbox(1)')).toBe('');
    expect(safeLinkUrl('file:///etc/passwd')).toBe('');
  });

  it('blocks relative and malformed URLs and empty input', () => {
    expect(safeLinkUrl('/relative/path')).toBe('');
    expect(safeLinkUrl('not a url')).toBe('');
    expect(safeLinkUrl('')).toBe('');
    expect(safeLinkUrl(undefined)).toBe('');
    expect(safeLinkUrl(null)).toBe('');
  });
});

describe('safeMediaUrl', () => {
  it('allows https only', () => {
    expect(safeMediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(safeMediaUrl('http://cdn.example.com/a.png')).toBe('');
  });

  it('blocks data:, javascript: and relative media', () => {
    expect(safeMediaUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe('');
    expect(safeMediaUrl('javascript:alert(1)')).toBe('');
    expect(safeMediaUrl('//cdn.example.com/a.png')).toBe('');
    expect(safeMediaUrl('')).toBe('');
  });
});

describe('mediaHost', () => {
  it('returns the host for display', () => {
    expect(mediaHost('https://cdn.example.com:8443/a.png')).toBe('cdn.example.com:8443');
  });

  it('returns empty string for garbage', () => {
    expect(mediaHost('nope')).toBe('');
  });
});
