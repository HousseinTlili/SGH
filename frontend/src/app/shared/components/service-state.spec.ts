import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { lastCorrelationId } from '../../core/http/correlation';
import { ServiceStatusService } from '../../core/status/service-status.service';
import { ErrorStateComponent } from './error-state/error-state.component';
import { ServiceGateDirective } from './service-gate/service-gate.directive';
import { ServiceStatusBarComponent } from './service-status-bar/service-status-bar.component';
import { ServiceUnavailableComponent } from './service-unavailable/service-unavailable.component';

@Component({
  imports: [ServiceGateDirective],
  template: `<p *appServiceGate="'lab'" id="content">lab data</p>`,
})
class GateHost {}

const text = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

describe('ServiceGateDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('shows the content while the service is up (or unknown)', async () => {
    const fixture = TestBed.createComponent(GateHost);
    await fixture.whenStable();
    expect(text(fixture)).toContain('lab data');
  });

  it('replaces the content by the ServiceUnavailable panel while the service is down', async () => {
    const fixture = TestBed.createComponent(GateHost);
    await fixture.whenStable();
    TestBed.inject(ServiceStatusService).markDown('lab');
    await fixture.whenStable();
    expect(text(fixture)).not.toContain('lab data');
    expect(text(fixture)).toContain('Lab service is unavailable.');
    expect(text(fixture)).toContain('Everything else keeps working.');
  });

  it('does not hide the content of a different service', async () => {
    const fixture = TestBed.createComponent(GateHost);
    TestBed.inject(ServiceStatusService).markDown('pharmacy');
    await fixture.whenStable();
    expect(text(fixture)).toContain('lab data');
  });

  it('comes back by itself when the service is up again', async () => {
    const status = TestBed.inject(ServiceStatusService);
    const fixture = TestBed.createComponent(GateHost);
    status.markDown('lab');
    await fixture.whenStable();
    expect(text(fixture)).not.toContain('lab data');
    status.state.update((s) => ({ ...s, lab: 'UP' }));
    await fixture.whenStable();
    expect(text(fixture)).toContain('lab data');
  });
});

describe('ServiceUnavailableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('Retry asks the status service for a fresh check and emits retry', async () => {
    const refresh = vi
      .spyOn(TestBed.inject(ServiceStatusService), 'refresh')
      .mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(ServiceUnavailableComponent);
    fixture.componentRef.setInput('service', 'pharmacy');
    const emitted = vi.fn();
    fixture.componentInstance.retry.subscribe(emitted);
    await fixture.whenStable();
    expect(text(fixture)).toContain('Pharmacy service is unavailable.');
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(refresh).toHaveBeenCalledOnce();
    expect(emitted).toHaveBeenCalledOnce();
  });
});

describe('ServiceStatusBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('shows six dots, one per service, with readable states', async () => {
    const status = TestBed.inject(ServiceStatusService);
    status.markDown('lab');
    const fixture = TestBed.createComponent(ServiceStatusBarComponent);
    await fixture.whenStable();
    const dots = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li.dot'));
    expect(dots).toHaveLength(6);
    expect(dots.map((d) => d.getAttribute('data-state'))).toEqual([
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
      'DOWN',
      'UNKNOWN',
      'UNKNOWN',
    ]);
    expect(text(fixture)).toContain('Lab: DOWN');
    // a DOWN dot also carries an icon, so colour is never the only signal
    expect(dots[3].querySelector('mat-icon')).not.toBeNull();
  });
});

describe('ErrorStateComponent', () => {
  it('shows the message and the correlation id as Reference', async () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('error', {
      status: 500,
      error: 'Internal Server Error',
      message: 'Boom',
      correlationId: 'b3f1c2d4',
    });
    await fixture.whenStable();
    expect(text(fixture)).toContain('Boom');
    expect(text(fixture)).toContain('Reference: b3f1c2d4');
  });

  it('falls back to the id of the last request when the body has none', async () => {
    lastCorrelationId.set('last0001');
    const fixture = TestBed.createComponent(ErrorStateComponent);
    await fixture.whenStable();
    expect(text(fixture)).toContain('Reference: last0001');
  });

  it('emits retry from the button', async () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
