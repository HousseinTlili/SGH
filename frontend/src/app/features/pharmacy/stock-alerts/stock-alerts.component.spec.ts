import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth } from '../../../../testing/auth';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import type { Drug } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { StockAlertsComponent } from './stock-alerts.component';

const lowDrug: Drug = {
  id: 'd4d4d4d4-0000-4000-8000-000000000003',
  name: 'Amoxicillin',
  form: 'CAPSULE',
  strength: '500 mg',
  unit: 'capsule',
  stock: 20,
  reorderThreshold: 50,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
};

describe('StockAlertsComponent', () => {
  let apiSpy: {
    listStockAlerts: ReturnType<typeof vi.fn>;
    adjustStock: ReturnType<typeof vi.fn>;
  };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      listStockAlerts: vi.fn().mockReturnValue(of([lowDrug])),
      adjustStock: vi.fn().mockReturnValue(of(lowDrug)),
    };
    statusSpy = { isUp: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [StockAlertsComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PharmacyApi, useValue: apiSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();
  });

  it('loads and computes shortage for stock alerts', () => {
    const fixture = TestBed.createComponent(StockAlertsComponent);
    fixture.detectChanges();

    expect(apiSpy.listStockAlerts).toHaveBeenCalled();
    const rows = fixture.componentInstance['rows']();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Amoxicillin');
    expect(rows[0].deficit).toBe(30); // 50 - 20
  });
});
