// Phase 6B Reports -- the only I/O side of report export (generating the
// actual PDF/CSV file and handing it to the OS share sheet). Deliberately
// separated from pdfReportHtml.ts/csvExport.ts, which only ever build
// strings -- this file is the thin, mockable boundary where those strings
// touch the filesystem and native share UI.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export class ReportExportUnavailableError extends Error {
  constructor() {
    super("Sharing isn't available on this device.");
    this.name = 'ReportExportUnavailableError';
  }
}

function timestampedFileName(base: string, extension: string): string {
  // A fresh, collision-free name per export -- avoids any question of
  // whether a stale same-named cache file from a previous export could be
  // shared instead of the just-generated one.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}-${stamp}.${extension}`;
}

async function shareFile(uri: string, options: { mimeType: string; dialogTitle: string; UTI: string }): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ReportExportUnavailableError();
  }
  await Sharing.shareAsync(uri, options);
}

// Renders `html` to a real PDF file (via the platform's native print
// pipeline -- WebView/Chromium-based on both Android and iOS, see
// pdfReportHtml.ts for the CSS this depends on) and opens the OS share
// sheet for it.
export async function shareReportPdf(html: string, baseFileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, { mimeType: 'application/pdf', dialogTitle: timestampedFileName(baseFileName, 'pdf'), UTI: 'com.adobe.pdf' });
}

// Writes `csv` to a cache file and opens the OS share sheet for it. The
// cache directory (not document directory) is deliberate -- an exported
// report is a point-in-time snapshot the user shares or saves elsewhere
// immediately; it isn't app state that needs to survive/be recoverable
// later, so it's fine for the OS to reclaim it under storage pressure.
export async function shareReportCsv(csv: string, baseFileName: string): Promise<void> {
  const fileName = timestampedFileName(baseFileName, 'csv');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  await shareFile(file.uri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
}
