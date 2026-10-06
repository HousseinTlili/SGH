import { TestBed } from '@angular/core/testing';
import { flagIcon, flagLabel, flagTone } from './flag-badge/flag';
import { FlagBadgeComponent } from './flag-badge/flag-badge.component';
import { StatusBadgeComponent } from './status-badge/status-badge.component';
import { statusLabel, statusTone } from './status-badge/status-tone';

describe('statusTone (StatusBadge table of Angular - Architecture)', () => {
  it.each([
    ['SCHEDULED', 'info'],
    ['CHECKED_IN', 'warning'],
    ['COMPLETED', 'success'],
    ['CANCELLED', 'neutral'],
    ['PENDING', 'warning'],
    ['PAID', 'success'],
    ['DRAFT', 'warning'],
    ['SIGNED', 'success'],
    ['REQUESTED', 'info'],
    ['IN_PROGRESS', 'warning'],
    ['RESULT_ENTERED', 'accent'],
    ['VALIDATED', 'success'],
    ['ISSUED', 'info'],
    ['PARTIALLY_DISPENSED', 'warning'],
    ['DISPENSED', 'success'],
    ['URGENT', 'danger'],
    ['ROUTINE', 'neutral'],
  ])('%s is %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it('an unknown status is neutral', () => {
    expect(statusTone('SOMETHING_NEW')).toBe('neutral');
  });

  it('writes a readable label', () => {
    expect(statusLabel('CHECKED_IN')).toBe('Checked in');
    expect(statusLabel('PARTIALLY_DISPENSED')).toBe('Partially dispensed');
    expect(statusLabel('URGENT')).toBe('Urgent');
  });
});

describe('flag mapping', () => {
  it('NORMAL green, HIGH and LOW amber, CRITICAL red', () => {
    expect(flagTone('NORMAL')).toBe('success');
    expect(flagTone('HIGH')).toBe('warning');
    expect(flagTone('LOW')).toBe('warning');
    expect(flagTone('CRITICAL')).toBe('danger');
  });

  it('every flag has its own icon, so colour is never the only signal', () => {
    const icons = (['NORMAL', 'HIGH', 'LOW', 'CRITICAL'] as const).map(flagIcon);
    expect(new Set(icons).size).toBe(4);
  });

  it('writes a readable label', () => {
    expect(flagLabel('CRITICAL')).toBe('Critical');
  });
});

describe('badge components', () => {
  it('StatusBadge shows the label and its tone', async () => {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', 'CHECKED_IN');
    await fixture.whenStable();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('.sgh-badge');
    expect(badge?.textContent?.trim()).toBe('Checked in');
    expect(badge?.getAttribute('data-tone')).toBe('warning');
  });

  it('FlagBadge shows an icon and a text label', async () => {
    const fixture = TestBed.createComponent(FlagBadgeComponent);
    fixture.componentRef.setInput('flag', 'CRITICAL');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('error');
    expect(el.textContent).toContain('Critical');
    expect(el.querySelector('.sgh-badge')?.getAttribute('data-tone')).toBe('danger');
  });
});
