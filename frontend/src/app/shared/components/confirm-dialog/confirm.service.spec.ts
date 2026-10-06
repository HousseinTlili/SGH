import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
  const buttons = () => Array.from(overlay().querySelectorAll('button'));
  const click = (label: string) =>
    buttons()
      .find((b) => b.textContent?.trim() === label)
      ?.click();

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('shows the title and message and emits true on confirm', async () => {
    let result: boolean | undefined;
    TestBed.inject(ConfirmService)
      .confirm({
        title: 'Sign consultation',
        message: 'A signed consultation cannot be edited',
        confirmLabel: 'Sign',
      })
      .subscribe((r) => (result = r));
    await vi.waitFor(() => expect(overlay().textContent).toContain('Sign consultation'));
    expect(overlay().textContent).toContain('A signed consultation cannot be edited');
    click('Sign');
    await vi.waitFor(() => expect(result).toBe(true));
  });

  it('emits false on cancel', async () => {
    let result: boolean | undefined;
    TestBed.inject(ConfirmService)
      .confirm({ title: 'Delete patient', message: 'Sure?', danger: true })
      .subscribe((r) => (result = r));
    await vi.waitFor(() => expect(overlay().textContent).toContain('Delete patient'));
    click('Cancel');
    await vi.waitFor(() => expect(result).toBe(false));
  });
});
