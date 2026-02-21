import { useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { OpSynFullLogo } from '@/components/ui/opsyn-logo';

import { docsContent } from './docs-content';
import { DocsSidebar } from './docs-sidebar';

/** Find page by slug across all sections */
function findPage(slug: string) {
  for (const section of docsContent) {
    const page = section.pages.find((p) => p.slug === slug);
    if (page) return page;
  }
  return null;
}

/* ─── Lightweight Markdown Renderer ─── */

function renderMarkdown(md: string): string {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_match, lang, code) =>
      `<pre class="docs-code-block"><code class="language-${lang || ''}">${escapeHtml(code.trimEnd())}</code></pre>`,
  );

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, headerRow: string, _separator: string, bodyRows: string) => {
      const headers = headerRow
        .split('|')
        .filter((c: string) => c.trim())
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join('');
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) => {
          const cells = row
            .split('|')
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<div class="docs-table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="docs-link">$1</a>',
  );

  // Unordered lists
  html = html.replace(
    /^((?:- .+\n?)+)/gm,
    (block) => {
      const items = block
        .trim()
        .split('\n')
        .map((line) => `<li>${line.replace(/^- /, '')}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    },
  );

  // Ordered lists
  html = html.replace(
    /^((?:\d+\. .+\n?)+)/gm,
    (block) => {
      const items = block
        .trim()
        .split('\n')
        .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    },
  );

  // Paragraphs — wrap remaining lines
  html = html.replace(
    /^(?!<[a-z])((?!<[a-z]).+)$/gm,
    (line) => (line.trim() ? `<p>${line}</p>` : ''),
  );

  return html;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ─── Docs Page ─── */

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug =
    searchParams.get('page') || docsContent[0].pages[0].slug;

  const activePage = useMemo(() => findPage(activeSlug), [activeSlug]);

  const handleNavigate = useCallback(
    (slug: string) => {
      setSearchParams({ page: slug }, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams],
  );

  const renderedHtml = useMemo(
    () => (activePage ? renderMarkdown(activePage.content) : ''),
    [activePage],
  );

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4">
        <Link to="/" className="flex items-center gap-2">
          <OpSynFullLogo className="h-7 w-auto text-foreground" />
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Docs</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-4 mr-1" />
            Home
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <DocsSidebar activeSlug={activeSlug} onNavigate={handleNavigate} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto outline-none">
          <article
            className="docs-content mx-auto max-w-3xl px-6 py-10 sm:px-10 lg:px-16"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </main>
      </div>

      {/* Scoped styles for rendered markdown */}
      <style>{`
        .docs-content h1 {
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          margin-bottom: 1rem;
          line-height: 1.2;
        }
        .docs-content h2 {
          font-size: 1.4rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
          letter-spacing: -0.015em;
        }
        .docs-content h3 {
          font-size: 1.15rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.5rem;
        }
        .docs-content p {
          margin-bottom: 0.75rem;
          line-height: 1.75;
          color: hsl(var(--muted-foreground));
        }
        .docs-content strong {
          color: hsl(var(--foreground));
          font-weight: 600;
        }
        .docs-content ul,
        .docs-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .docs-content ul {
          list-style-type: disc;
        }
        .docs-content ol {
          list-style-type: decimal;
        }
        .docs-content li {
          margin-bottom: 0.375rem;
          line-height: 1.7;
          color: hsl(var(--muted-foreground));
        }
        .docs-inline-code {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
          padding: 0.15em 0.4em;
          border-radius: 0.3em;
          font-size: 0.875em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Courier New', monospace;
        }
        .docs-code-block {
          background: hsl(var(--accent));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 1rem 1.25rem;
          margin-bottom: 1rem;
          overflow-x: auto;
          font-size: 0.85rem;
          line-height: 1.6;
        }
        .docs-code-block code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Courier New', monospace;
          color: hsl(var(--foreground));
        }
        .docs-link {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .docs-link:hover {
          color: hsl(var(--primary) / 0.8);
        }
        .docs-table-wrap {
          margin-bottom: 1rem;
          overflow-x: auto;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
        }
        .docs-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .docs-table-wrap th {
          background: hsl(var(--accent));
          padding: 0.625rem 1rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 1px solid hsl(var(--border));
        }
        .docs-table-wrap td {
          padding: 0.625rem 1rem;
          border-bottom: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
        }
        .docs-table-wrap tr:last-child td {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}
