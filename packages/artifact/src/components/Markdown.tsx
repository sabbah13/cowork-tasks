import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import { mediaHost, safeLinkUrl, safeMediaUrl } from '../safeUrl';

interface MarkdownProps {
  source: string;
  className?: string;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

/**
 * Pinned mermaid build. Bump the version and the integrity hash together:
 *   curl -fsSL <url> | openssl dgst -sha384 -binary | openssl base64 -A
 */
const MERMAID_VERSION = '11.17.2';
const MERMAID_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
const MERMAID_SRI = 'sha384-EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2';

/**
 * Lazy-load mermaid from a CDN so the artifact bundle stays small.
 * Mermaid is ~3 MB minified - inlining it would make every artifact
 * ship that weight even when no card uses a diagram. The CDN script is
 * fetched only the first time a ```mermaid block renders, pinned to an
 * exact version and verified with Subresource Integrity.
 */
interface MermaidGlobal {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, src: string) => Promise<{ svg: string }>;
}
declare global {
  interface Window {
    mermaid?: MermaidGlobal;
  }
}

let mermaidPromise: Promise<MermaidGlobal> | null = null;
function loadMermaid(): Promise<MermaidGlobal> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = new Promise<MermaidGlobal>((resolve, reject) => {
    if (window.mermaid) return resolve(window.mermaid);
    const script = document.createElement('script');
    script.src = MERMAID_URL;
    script.integrity = MERMAID_SRI;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      const m = window.mermaid;
      if (!m) return reject(new Error('mermaid failed to load'));
      m.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: '#faf9f5',
          primaryColor: '#f5f3eb',
          primaryTextColor: '#1a1915',
          primaryBorderColor: 'rgba(20,20,19,0.12)',
          lineColor: 'rgba(20,20,19,0.35)',
          fontFamily: 'Styrene A, Anthropic Sans, Inter, ui-sans-serif',
        },
        securityLevel: 'strict',
      });
      resolve(m);
    };
    script.onerror = () => reject(new Error('mermaid CDN load failed'));
    document.head.appendChild(script);
  });
  return mermaidPromise;
}

function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadMermaid().then(async (mermaid) => {
      if (cancelled || !ref.current) return;
      try {
        const id = 'm' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="mermaid-error">${String(err)}</pre>`;
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chart]);
  return <div ref={ref} className="md-mermaid" />;
}

/**
 * Remote media is never fetched until the user asks for it. Descriptions come
 * from email and chat content, so auto-loading would let a hostile sender
 * fire tracking requests the moment a card is opened.
 */
function RemoteMedia({ url, kind, alt }: { url: string; kind: 'image' | 'video'; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!loaded) {
    return (
      <button
        type="button"
        className="md-remote"
        // The description preview is itself a click/Enter/Space target that
        // switches the side panel into edit mode. Keep this button's events
        // to itself so loading media doesn't unmount it.
        onClick={(e) => {
          e.stopPropagation();
          setLoaded(true);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        Load remote {kind} from {mediaHost(url)}
        {alt ? ` (${alt})` : ''}
      </button>
    );
  }
  if (kind === 'video') {
    return (
      <video controls preload="metadata" className="md-video">
        <source src={url} />
      </video>
    );
  }
  return (
    <img src={url} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" className="md-img" />
  );
}

const components: Components = {
  a({ href, children, node: _node, ...rest }) {
    const raw = String(href ?? '');
    const mediaUrl = VIDEO_EXT.test(raw) ? safeMediaUrl(raw) : '';
    if (mediaUrl) return <RemoteMedia url={mediaUrl} kind="video" />;
    const url = safeLinkUrl(raw);
    // Unsafe or relative URL: keep the text, drop the link.
    if (!url) return <span>{children}</span>;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  },
  img({ src, alt, node: _node }) {
    const url = safeMediaUrl(typeof src === 'string' ? src : '');
    if (!url) return <span className="md-blocked-media">{alt ?? ''}</span>;
    return <RemoteMedia url={url} kind={VIDEO_EXT.test(url) ? 'video' : 'image'} alt={alt} />;
  },
  code({ className, children, ...rest }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const text = String(children ?? '').replace(/\n$/, '');
    if (lang === 'mermaid') return <MermaidBlock chart={text} />;
    const inline = !className;
    if (inline) {
      return (
        <code className="md-inline-code" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

/**
 * Renders markdown with the modern toolbox: GFM (tables, task lists,
 * strikethrough, autolinks), code highlighting, mermaid diagrams, lazy
 * images, inline videos. Bare URLs become clickable links via remark-gfm.
 */
export function Markdown({ source, className }: MarkdownProps) {
  return (
    <div className={`md-prose ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
