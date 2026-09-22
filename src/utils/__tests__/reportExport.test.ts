jest.mock('expo-print', () => ({
  __esModule: true,
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockCreate = jest.fn();
const mockWrite = jest.fn();
// One shared File instance per test file is deliberate (mirrors
// avatarUpload.test.ts's supabase storage-chain mock) -- the code under
// test constructs `new File(...)` itself, so the mock class always returns
// an object exposing the same jest.fn()s the test asserts against.
jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { cache: 'mock-cache-dir' },
  File: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    write: mockWrite,
    uri: 'file:///mock-cache-dir/report.csv',
  })),
}));

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { shareReportPdf, shareReportCsv, ReportExportUnavailableError } from '../reportExport';

const mockPrintToFileAsync = jest.mocked(Print.printToFileAsync);
const mockIsAvailableAsync = jest.mocked(Sharing.isAvailableAsync);
const mockShareAsync = jest.mocked(Sharing.shareAsync);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('shareReportPdf', () => {
  it('prints the given HTML to a PDF file and shares it with the correct mime type', async () => {
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///mock/report.pdf', numberOfPages: 1 } as never);
    mockIsAvailableAsync.mockResolvedValue(true);

    await shareReportPdf('<html></html>', 'payments-report');

    expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///mock/report.pdf',
      expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
    );
  });

  it('throws a ReportExportUnavailableError instead of silently failing when sharing is unavailable', async () => {
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///mock/report.pdf', numberOfPages: 1 } as never);
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(shareReportPdf('<html></html>', 'payments-report')).rejects.toBeInstanceOf(ReportExportUnavailableError);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});

describe('shareReportCsv', () => {
  it('writes the CSV to a cache file (overwriting) and shares it with the correct mime type', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);

    await shareReportCsv('A,B\r\n1,2\r\n', 'payments-report');

    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith('A,B\r\n1,2\r\n');
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///mock-cache-dir/report.csv',
      expect.objectContaining({ mimeType: 'text/csv' })
    );
  });

  it('throws a ReportExportUnavailableError instead of silently failing when sharing is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(shareReportCsv('A,B\r\n', 'payments-report')).rejects.toBeInstanceOf(ReportExportUnavailableError);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});
