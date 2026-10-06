/**
 * URL policy for markdown rendered inside the artifact.
 *
 * Card descriptions and comments are populated from email, Slack and meeting
 * content, so every URL in them is attacker-influenced. We parse with the same
 * WHATWG `URL` parser the browser uses (it strips tabs and newlines inside the
 * scheme, so `java\tscript:` is seen as `javascript:`), allow only a short list
 * of protocols, and return the *normalized* href so what we validated is what
 * the browser follows.
 */

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const MEDIA_PROTOCOLS = new Set(['https:']);

function parse(raw: string, allowed: Set<string>): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  return allowed.has(url.protocol) ? url : null;
}

/** Returns a safe href for a markdown link, or `''` if the URL must not be followed. */
export function safeLinkUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // In-page fragment links are harmless and common in pasted markdown.
  if (trimmed.startsWith('#')) return trimmed;
  return parse(trimmed, LINK_PROTOCOLS)?.href ?? '';
}

/** Returns a safe https URL for remote media (image or video), or `''`. */
export function safeMediaUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  return parse(raw, MEDIA_PROTOCOLS)?.href ?? '';
}

/** Host label shown on the click-to-load button, e.g. `images.example.com`. */
export function mediaHost(safeUrl: string): string {
  try {
    return new URL(safeUrl).host;
  } catch {
    return '';
  }
}
