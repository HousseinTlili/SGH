import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts light when nothing is saved and the system has no dark preference', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggle switches the theme on <html> and remembers it', () => {
    const theme = TestBed.inject(ThemeService);
    theme.toggle();
    expect(theme.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('sgh.theme')).toBe('dark');
    theme.toggle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('restores the saved choice', () => {
    localStorage.setItem('sgh.theme', 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });
});
