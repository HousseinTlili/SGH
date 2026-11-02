import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth } from '../../../../testing/auth';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import type { Drug } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { DrugListComponent } from './drug-list.component';

const sampleDrug: Drug = {
  id: 'd4d4d4d4-0000-4000-8000-000000000001',
  name: 'Paracetamol',
  form: 'TABLET',
  strength: '500 mg',
  unit: 'tablet',
  stock: 250,
  reorderThreshold: 100,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
};

describe('DrugListComponent', () => {
  let apiSpy: {
    listDrugs: ReturnType<typeof vi.fn>;
    createDrug: ReturnType<typeof vi.fn>;
    updateDrug: ReturnType<typeof vi.fn>;
    adjustStock: ReturnType<typeof vi.fn>;
  };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      listDrugs: vi.fn().mockReturnValue(
        of({
          content: [sampleDrug],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      createDrug: vi.fn().mockReturnValue(of(sampleDrug)),
      updateDrug: vi.fn().mockReturnValue(of(sampleDrug)),
      adjustStock: vi.fn().mockReturnValue(of(sampleDrug)),
    };
    statusSpy = { isUp: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [DrugListComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PharmacyApi, useValue: apiSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();
  });

  it('loads and displays drug list', () => {
    const fixture = TestBed.createComponent(DrugListComponent);
    fixture.detectChanges();

    expect(apiSpy.listDrugs).toHaveBeenCalled();
    const rows = fixture.componentInstance['drugs']();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Paracetamol');
    expect(rows[0].stock).toBe(250);
  });
});
