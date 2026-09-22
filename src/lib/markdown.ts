/**
 * Minimal, dependency-free Markdown → HTML renderer.
 *
 * Security: the input is HTML-escaped *first*, so raw HTML in a note can never
 * be interpreted by the browser. Only a fixed allow-list of inline constructs
 * is then re-introduced, which keeps user/AI content inert.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes everything, then re-enables `code`, bold, italic and links. */
function renderInline(raw: string): string {
  const escaped = escapeHtml(raw);

  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(
      /\[([^\]]+)\]\((https?:&#x2F;&#x2F;[^\s)]+|https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>',
    )
    .replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$2</a>',
    );
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraphBuffer: string[] = [];
  let inBlockquote = false;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    html.push(`<p>${paragraphBuffer.map(renderInline).join('<br />')}</p>`);
    paragraphBuffer = [];
  };

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      html.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      if (inCodeBlock) {
        html.push(
          `<pre data-lang="${escapeHtml(codeLanguage)}"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`,
        );
        codeBuffer = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        flushParagraph();
        closeList();
        closeBlockquote();
        inCodeBlock = true;
        codeLanguage = fence[1] ?? '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = Math.min(3, heading[1].length);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line) || /^\s*-{3,}\s*$/.test(line)) {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push('<hr />');
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      html.push(`<p>${renderInline(quote[1])}</p>`);
      continue;
    }
    closeBlockquote();

    const taskItem = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (taskItem) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      const checked = taskItem[1].toLowerCase() === 'x';
      html.push(
        `<li class="md-task"><span aria-hidden="true">${checked ? '☑' : '☐'}</span> ${renderInline(taskItem[2])}</li>`,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraphBuffer.push(line.trim());
  }

  if (inCodeBlock && codeBuffer.length) {
    html.push(`<pre data-lang="${escapeHtml(codeLanguage)}"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  closeList();
  closeBlockquote();

  return html.join('\n');
}

/** Strips markdown syntax to plain text, for previews and search results. */
export function stripMarkdown(source: string, maxLength = 160): string {
  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trimEnd()}…` : plain;
}

/** Extracts `#tag` style hashtags from free text (used by the note editor). */
export function extractTags(source: string): string[] {
  const matches = source.match(/(?:^|\s)#([a-zA-Z][\w-]{1,29})/g) ?? [];
  return Array.from(new Set(matches.map((match) => match.trim().slice(1).toLowerCase())));
}
