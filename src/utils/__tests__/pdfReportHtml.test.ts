import { buildReportHtml } from '../pdfReportHtml';

const BASE_PARAMS = {
  businessName: 'Spero Studio',
  reportTitle: 'Payments Report',
  dateRangeLabel: 'This Month',
  generatedAtLabel: 'Sep 8, 2026',
  metrics: [{ label: 'Total Received', value: '2,450 USDC' }],
  tableHeaders: ['Customer', 'Amount'],
  tableRows: [['Alex Morgan', '250 USDC']],
  emptyMessage: 'No payments in this period.',
};

describe('buildReportHtml', () => {
  it('renders business name, report title, date range, and generated date', () => {
    const html = buildReportHtml(BASE_PARAMS);
    expect(html).toContain('Spero Studio');
    expect(html).toContain('Payments Report');
    expect(html).toContain('This Month');
    expect(html).toContain('Sep 8, 2026');
  });

  it('renders every summary metric', () => {
    const html = buildReportHtml({ ...BASE_PARAMS, metrics: [{ label: 'Total Received', value: '2,450 USDC' }, { label: 'Payments', value: '12' }] });
    expect(html).toContain('Total Received');
    expect(html).toContain('2,450 USDC');
    expect(html).toContain('Payments');
  });

  it('renders a full table with headers and rows when data exists', () => {
    const html = buildReportHtml(BASE_PARAMS);
    expect(html).toContain('<th>Customer</th>');
    expect(html).toContain('<td>Alex Morgan</td>');
    expect(html).toContain('<td>250 USDC</td>');
    expect(html).not.toContain('No payments in this period.');
  });

  it('renders the empty message instead of a table when there are no rows', () => {
    const html = buildReportHtml({ ...BASE_PARAMS, tableRows: [] });
    expect(html).toContain('No payments in this period.');
    expect(html).not.toContain('<table>');
  });

  it('escapes HTML-significant characters in dynamic content so untrusted data cannot break the document', () => {
    const html = buildReportHtml({
      ...BASE_PARAMS,
      businessName: '<script>alert(1)</script>',
      tableRows: [['Bob & "The Builder" <Co>', '100']],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Bob &amp; &quot;The Builder&quot; &lt;Co&gt;');
  });

  it('renders a business logo image when a logo URL is provided', () => {
    const html = buildReportHtml({ ...BASE_PARAMS, businessLogoUrl: 'https://example.com/logo.png' });
    expect(html).toContain('<img class="logo" src="https://example.com/logo.png" />');
  });

  it('renders a lettered fallback mark when no logo URL is provided', () => {
    const html = buildReportHtml(BASE_PARAMS);
    expect(html).not.toContain('<img class="logo"');
    expect(html).toContain('logo-fallback');
    expect(html).toContain('>S<');
  });

  it('includes page-number footer content and print page-break rules', () => {
    const html = buildReportHtml(BASE_PARAMS);
    expect(html).toContain('counter(page)');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('is valid enough HTML to at least balance html/body/table tags', () => {
    const html = buildReportHtml(BASE_PARAMS);
    expect((html.match(/<html>/g) || []).length).toBe(1);
    expect((html.match(/<\/html>/g) || []).length).toBe(1);
    expect((html.match(/<table>/g) || []).length).toBe((html.match(/<\/table>/g) || []).length);
  });
});
