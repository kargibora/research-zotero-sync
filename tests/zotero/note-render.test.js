import { describe, it, expect } from 'vitest';
import { renderNoteHtml, escapeHtml } from '../../src/zotero/note-render.js';

describe('escapeHtml', () => {
  it('escapes the five html-significant chars', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});

describe('renderNoteHtml', () => {
  it('includes the marker and the comments', () => {
    const html = renderNoteHtml({
      sourceUrl: 'https://www.alphaxiv.org/abs/2504.10045',
      pdfUrl: 'https://arxiv.org/pdf/2504.10045',
      arxivId: '2504.10045',
      doi: ''
    }, [
      { kind: 'comment', text: 'first', createdAt: '2026-04-01' },
      { kind: 'highlight', text: 'second', createdAt: '2026-04-02' }
    ], 'research-sync:alphaxiv-comments');

    expect(html).toContain('research-sync:alphaxiv-comments');
    expect(html).toContain('first');
    expect(html).toContain('second');
    expect(html).toContain('2504.10045');
  });
});
