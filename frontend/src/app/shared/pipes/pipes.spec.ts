import { FullNamePipe } from './full-name.pipe';
import { LocalDatetimePipe } from './local-datetime.pipe';
import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('writes two decimals and the currency', () => {
    expect(pipe.transform(80)).toBe('80.00 TND');
    expect(pipe.transform(75.5)).toBe('75.50 TND');
    expect(pipe.transform(0)).toBe('0.00 TND');
  });

  it('is empty for a missing value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(Number.NaN)).toBe('');
  });
});

describe('FullNamePipe', () => {
  const pipe = new FullNamePipe();

  it('joins first and last name', () => {
    expect(pipe.transform('Youssef', 'Ben Salah')).toBe('Youssef Ben Salah');
  });

  it('copes with missing parts and extra spaces', () => {
    expect(pipe.transform(' Amira ', undefined)).toBe('Amira');
    expect(pipe.transform(null, 'Mejri')).toBe('Mejri');
    expect(pipe.transform('', '')).toBe('');
  });
});

describe('LocalDatetimePipe', () => {
  const pipe = new LocalDatetimePipe();
  const pad = (n: number) => String(n).padStart(2, '0');

  it('shows a UTC timestamp in the browser local time as "dd MMM yyyy HH:mm"', () => {
    const iso = '2026-10-12T09:30:00Z';
    const d = new Date(iso);
    const month = d.toLocaleString('en-US', { month: 'short' });
    expect(pipe.transform(iso)).toBe(
      `${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  });

  it('is empty for missing or invalid input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('not a date')).toBe('');
  });
});
