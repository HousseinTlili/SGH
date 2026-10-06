import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type { MedicalFileEntry, Patient, PatientInput, PatientSummary } from '../models/patient';
import { clampPaging, toHttpParams } from '../../shared/util/paging';

@Injectable({ providedIn: 'root' })
export class PatientApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  list(search?: string, page = 0, size = 20): Observable<Paged<Patient>> {
    const paging = clampPaging(page, size);
    const params = toHttpParams({
      search,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Patient>>(`${this.base}/patients`, { params });
  }

  get(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.base}/patients/${id}`);
  }

  summary(id: string): Observable<PatientSummary> {
    return this.http.get<PatientSummary>(`${this.base}/patients/${id}/summary`);
  }

  create(patient: PatientInput): Observable<Patient> {
    return this.http.post<Patient>(`${this.base}/patients`, patient);
  }

  update(id: string, patient: PatientInput): Observable<Patient> {
    return this.http.put<Patient>(`${this.base}/patients/${id}`, patient);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/patients/${id}`);
  }

  medicalFile(id: string, type?: string, page = 0, size = 20): Observable<Paged<MedicalFileEntry>> {
    const paging = clampPaging(page, size);
    const params = toHttpParams({
      type,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<MedicalFileEntry>>(`${this.base}/patients/${id}/medical-file`, {
      params,
    });
  }

  addMedicalFileNote(id: string, summary: string): Observable<MedicalFileEntry> {
    return this.http.post<MedicalFileEntry>(`${this.base}/patients/${id}/medical-file`, {
      summary,
    });
  }
}
