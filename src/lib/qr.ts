import QRCode from 'qrcode';

export interface QrGenerationOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates a PNG Base64 Data URL for a given string
 */
export async function generateQrDataUrl(
  text: string,
  options: QrGenerationOptions = {}
): Promise<string> {
  const { width = 400, margin = 2, errorCorrectionLevel = 'M' } = options;
  return QRCode.toDataURL(text, {
    width,
    margin,
    errorCorrectionLevel,
    color: {
      dark: '#1C1613',
      light: '#FFFFFF',
    },
  });
}

/**
 * Generates an SVG string representation of the QR code
 */
export async function generateQrSvg(
  text: string,
  options: QrGenerationOptions = {}
): Promise<string> {
  const { margin = 2, errorCorrectionLevel = 'M' } = options;
  return QRCode.toString(text, {
    type: 'svg',
    margin,
    errorCorrectionLevel,
    color: {
      dark: '#1C1613',
      light: '#FFFFFF',
    },
  });
}

/**
 * Formats canonical customer scan URL for a service location.
 * Supports either (baseUrl, code) or (code, baseUrl) and falls back safely to window.location.origin
 */
export function buildLocationScanUrl(first: string, second?: string | null): string {
  let baseUrl = '';
  let code = '';

  if (first.startsWith('http://') || first.startsWith('https://')) {
    baseUrl = first;
    code = second || '';
  } else if (second && (second.startsWith('http://') || second.startsWith('https://'))) {
    code = first;
    baseUrl = second;
  } else {
    code = first;
    baseUrl = second || '';
  }

  const effectiveBase = baseUrl.trim() || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://convivium.cm');
  const sanitized = effectiveBase.replace(/\/+$/, '');
  return `${sanitized}/?spot=${encodeURIComponent(code.trim())}`;
}

/**
 * Triggers a download of a file in the browser (Data URL or text/blob)
 */
export function triggerFileDownload(filename: string, content: string, mimeType?: string) {
  const link = document.createElement('a');
  if (content.startsWith('data:')) {
    link.href = content;
  } else {
    const blob = new Blob([content], { type: mimeType || 'image/svg+xml;charset=utf-8' });
    link.href = URL.createObjectURL(blob);
  }
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
