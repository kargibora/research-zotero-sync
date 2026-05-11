export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

export function renderNoteHtml(paper, notes, marker) {
  const e = escapeHtml;
  const grouped = { comment: [], highlight: [] };
  for (const n of notes) (grouped[n.kind] || (grouped[n.kind] = [])).push(n);

  const section = (title, items) => items.length ? `
    <h3>${e(title)}</h3>
    <ol>${items.map(n => `
      <li>
        <p><small>${e(n.createdAt || '')}</small></p>
        <blockquote>${e(n.text || '').replace(/\n/g, '<br/>')}</blockquote>
      </li>`).join('')}</ol>
  ` : '';

  return `
    <h2>Synced research notes</h2>
    <p><small>${e(marker)} | synced ${new Date().toISOString()}</small></p>
    <p><b>Source:</b> <a href="${e(paper.sourceUrl || '')}">${e(paper.sourceUrl || '')}</a></p>
    ${paper.pdfUrl ? `<p><b>PDF:</b> <a href="${e(paper.pdfUrl)}">${e(paper.pdfUrl)}</a></p>` : ''}
    <ul>
      ${paper.arxivId ? `<li>arXiv: ${e(paper.arxivId)}</li>` : ''}
      ${paper.doi ? `<li>DOI: ${e(paper.doi)}</li>` : ''}
    </ul>
    ${section('Comments', grouped.comment)}
    ${section('Highlights', grouped.highlight)}
  `;
}
