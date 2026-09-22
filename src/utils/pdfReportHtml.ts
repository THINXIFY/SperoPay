// Phase 6B Reports -- pure HTML builder for the exported PDF. Deliberately
// separated from the actual print/share I/O (see reportExport.ts): this
// file only ever builds a string, so it's fully unit-testable without
// mocking expo-print/expo-sharing, and the visual design lives in one place
// a reviewer can read top to bottom.
//
// Design direction (spec): white background, dark typography, restrained
// Spero lime accents, clean tables, strong spacing, proper page breaks --
// a real business document, not a screenshot of the app's dark/lime UI.
export interface PdfReportMetric {
  label: string;
  value: string;
}

export interface PdfReportParams {
  businessName: string;
  businessLogoUrl?: string;
  reportTitle: string;
  dateRangeLabel: string;
  generatedAtLabel: string;
  metrics: PdfReportMetric[];
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  // Shown instead of the table when tableRows is empty -- a report PDF
  // should never render a table with a header row and nothing under it.
  emptyMessage: string;
}

const LIME = '#8FAE00'; // A darkened, print-safe shade of Spero's #C7F500 accent -- the bright UI lime fails contrast/legibility badly on white paper.
const INK = '#0A0A0A';
const MUTED = '#6B6B6B';
const BORDER = '#E4E4E1';

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMetricCards(metrics: PdfReportMetric[]): string {
  return metrics
    .map(
      (m) => `
      <div class="metric">
        <div class="metric-label">${escapeHtml(m.label)}</div>
        <div class="metric-value">${escapeHtml(m.value)}</div>
      </div>`
    )
    .join('');
}

function renderTable(headers: string[], rows: Array<Array<string | number>>, emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }
  const headerHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

export function buildReportHtml(params: PdfReportParams): string {
  const logoHtml = params.businessLogoUrl
    ? `<img class="logo" src="${escapeHtml(params.businessLogoUrl)}" />`
    : `<div class="logo-fallback">${escapeHtml(params.businessName.charAt(0).toUpperCase() || 'S')}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page {
    size: A4;
    margin: 28mm 16mm 20mm 16mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: Helvetica, Arial, sans-serif;
      font-size: 9px;
      color: ${MUTED};
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: ${INK};
    background: #FFFFFF;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid ${INK};
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand { display: flex; align-items: center; }
  .logo { width: 36px; height: 36px; border-radius: 8px; object-fit: contain; margin-right: 10px; }
  .logo-fallback {
    width: 36px; height: 36px; border-radius: 8px; margin-right: 10px;
    background: ${INK}; color: #FFFFFF; font-weight: bold; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .business-name { font-size: 15px; font-weight: 700; }
  .header-right { text-align: right; }
  .report-title { font-size: 20px; font-weight: 800; margin: 0 0 4px 0; }
  .report-meta { font-size: 11px; color: ${MUTED}; }
  .metrics { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
  .metric {
    flex: 1 1 140px;
    border: 1px solid ${BORDER};
    border-radius: 8px;
    padding: 10px 12px;
    border-top: 3px solid ${LIME};
  }
  .metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: ${MUTED}; margin-bottom: 4px; }
  .metric-value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead { display: table-header-group; } /* repeat the header row on every printed page */
  tr { page-break-inside: avoid; }
  th {
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${MUTED};
    border-bottom: 1px solid ${INK};
    padding: 6px 8px;
  }
  td {
    font-size: 11px;
    padding: 7px 8px;
    border-bottom: 1px solid ${BORDER};
  }
  tbody tr:nth-child(even) { background: #FAFAF9; }
  .empty { color: ${MUTED}; font-style: italic; padding: 24px 0; text-align: center; }
  .footer-note { margin-top: 24px; font-size: 9px; color: ${MUTED}; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${logoHtml}
      <div class="business-name">${escapeHtml(params.businessName)}</div>
    </div>
    <div class="header-right">
      <p class="report-title">${escapeHtml(params.reportTitle)}</p>
      <p class="report-meta">${escapeHtml(params.dateRangeLabel)}<br/>Generated ${escapeHtml(params.generatedAtLabel)}</p>
    </div>
  </div>

  <div class="metrics">
    ${renderMetricCards(params.metrics)}
  </div>

  ${renderTable(params.tableHeaders, params.tableRows, params.emptyMessage)}

  <p class="footer-note">Generated by Spero &middot; ${escapeHtml(params.businessName)}</p>
</body>
</html>`;
}
