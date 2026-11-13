import { describe, expect, it } from 'vitest';
import { passportQrPayload } from './qr-svg';

describe('passportQrPayload', () => {
  it('builds a deep-link with only the opaque token', () => {
    const token = 'c0ffeeee-0000-4000-8000-000000000001';
    const payload = passportQrPayload('http://localhost:4200/', token);
    expect(payload).toBe(`http://localhost:4200/patients/passport/${token}`);
    expect(payload).not.toMatch(/Penicillin|allergy|SEVERE|Anaphylaxis/i);
  });
});
