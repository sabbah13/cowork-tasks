import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';

interface MarkdownProps {
  source: string;
  className?: string;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default;
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
      return m;
    });
  }
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

const components: Components = {
  a({ href, children, ...rest }) {
    const url = String(href ?? '');
    if (url && VIDEO_EXT.test(url)) {
      return (
        <video controls preload="metadata" className="md-video">
          <source src={url} />
        </video>
      );
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  },
  img({ src, alt, ...rest }) {
    const url = typeof src === 'string' ? src : '';
    if (url && VIDEO_EXT.test(url)) {
      return (
        <video controls preload="metadata" className="md-video">
          <source src={url} />
        </video>
      );
    }
    return <img src={url} alt={alt ?? ''} loading="lazy" className="md-img" {...rest} />;
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
        urlTransform={(u) => u}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
