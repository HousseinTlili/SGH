import * as QRCodeImport from 'qrcode';

interface QrApi {
  toString: (
    text: string,
    options: {
      type: 'svg';
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      margin?: number;
      width?: number;
      color?: { dark: string; light: string };
    },
  ) => Promise<string>;
}

function qrApi(): QrApi {
  const mod = QRCodeImport as unknown as QrApi & { default?: QrApi };
  return mod.default ?? mod;
}

/** Opaque deep-link only — never pass allergen or clinical text. */
export function passportQrPayload(origin: string, passportToken: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/patients/passport/${passportToken}`;
}

/** SVG QR for a short opaque passport deep-link. */
export async function qrSvg(payload: string): Promise<string> {
  return qrApi().toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 160,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
