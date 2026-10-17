import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { clampPaging, toHttpParams } from '../../shared/util/paging';
import type { Paged } from '../models/common';
import type { Dispensing, PharmacyPrescription } from '../models/pharmacy';

export interface PrescriptionFilters {
  /** One status, or several joined with commas (see docs/FRONTEND-DECISIONS.md, F-19). */
  status?: string;
  patientId?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class PharmacyApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  /** Open prescriptions first, then the oldest (decided by the API). */
  listPrescriptions(filters: PrescriptionFilters = {}): Observable<Paged<PharmacyPrescription>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      status: filters.status,
      patientId: filters.patientId,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<PharmacyPrescription>>(`${this.base}/prescriptions`, { params });
  }

  getPrescription(id: string): Observable<PharmacyPrescription> {
    return this.http.get<PharmacyPrescription>(`${this.base}/prescriptions/${id}`);
  }

  /** A plain array: sub-collection of one prescription. */
  getDispensings(id: string): Observable<Dispensing[]> {
    return this.http.get<Dispensing[]>(`${this.base}/prescriptions/${id}/dispensings`);
  }
}
