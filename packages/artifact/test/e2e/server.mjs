#!/usr/bin/env node
/**
 * Tiny static server for the e2e suite.
 *
 *   /                  -> Cowork host page (loads the artifact in an iframe-
 *                          equivalent and primes window.__INITIAL_STATE__
 *                          + window.claude exactly as Cowork would).
 *   /artifact.html     -> the built single-file artifact (`dist/index.html`).
 *   /__health          -> 200 OK, used by Playwright to detect server up.
 *   /__claude/<method> -> the mock Cowork bridge endpoints.
 *
 * The Cowork simulator + this server together let the suite drive the
 * artifact end-to-end without any real Cowork process.
 */
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.resolve(here, '..', '..', 'dist');
const hostHtmlPath = path.join(here, 'cowork-host.html');

const PORT = Number(process.env.E2E_PORT ?? 5179);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/__health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      const html = await fs.readFile(hostHtmlPath, 'utf-8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname === '/artifact.html') {
      const html = await fs.readFile(path.join(artifactRoot, 'index.html'), 'utf-8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`not found: ${pathname}`);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`[e2e] static server on http://127.0.0.1:${PORT}\n`);
});
