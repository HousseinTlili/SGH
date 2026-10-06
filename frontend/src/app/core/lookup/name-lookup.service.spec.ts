import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { NameLookupService } from './name-lookup.service';

describe('NameLookupService', () => {
  let service: NameLookupService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/api`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), NameLookupService],
    });
    service = TestBed.inject(NameLookupService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('looks up patient name and caches subsequent requests', () => {
    const patientId = 'a1a1a1a1-0000-4000-8000-000000000001';
    let name1 = '';
    let name2 = '';

    service.getPatientName(patientId).subscribe((res) => (name1 = res));

    const req = httpTesting.expectOne(`${base}/patients/${patientId}/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: patientId,
      fullName: 'Youssef Ben Salah',
      birthDate: '1985-03-14',
    });

    expect(name1).toBe('Youssef Ben Salah');

    // Second request should use cached value and NOT trigger another HTTP call
    service.getPatientName(patientId).subscribe((res) => (name2 = res));
    expect(name2).toBe('Youssef Ben Salah');
    httpTesting.expectNone(`${base}/patients/${patientId}/summary`);
  });

  it('falls back to short id with label when patient lookup fails', () => {
    const patientId = 'a1a1a1a1-9999-4000-8000-000000000001';
    let name = '';

    service.getPatientName(patientId).subscribe((res) => (name = res));

    const req = httpTesting.expectOne(`${base}/patients/${patientId}/summary`);
    req.flush('Down', { status: 503, statusText: 'Service Unavailable' });

    expect(name).toBe('Patient unavailable (a1a1a1a1)');
  });

  it('looks up doctor name from staff directory and caches it', () => {
    const doctorId = 'b2b2b2b2-0000-4000-8000-000000000001';
    let docName = '';

    service.getDoctorName(doctorId).subscribe((res) => (docName = res));

    const req = httpTesting.expectOne(`${base}/staff/directory?role=DOCTOR`);
    req.flush([
      {
        id: doctorId,
        fullName: 'Amel Trabelsi',
        role: 'DOCTOR',
        specialty: 'Cardiology',
      },
    ]);

    expect(docName).toBe('Amel Trabelsi');

    // Repeated call uses cache
    let docName2 = '';
    service.getDoctorName(doctorId).subscribe((res) => (docName2 = res));
    expect(docName2).toBe('Amel Trabelsi');
    httpTesting.expectNone(`${base}/staff/directory?role=DOCTOR`);
  });

  it('falls back when doctor lookup fails', () => {
    const doctorId = 'b2b2b2b2-9999-4000-8000-000000000099';
    let docName = '';

    service.getDoctorName(doctorId).subscribe((res) => (docName = res));

    const req = httpTesting.expectOne(`${base}/staff/directory?role=DOCTOR`);
    req.flush('Error', { status: 503, statusText: 'Service Unavailable' });

    expect(docName).toBe('Doctor unavailable (b2b2b2b2)');
  });
});
