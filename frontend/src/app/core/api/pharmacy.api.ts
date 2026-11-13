import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { clampPaging, toHttpParams } from '../../shared/util/paging';
import type { Paged } from '../models/common';
import type {
  DispenseLine,
  Dispensing,
  Drug,
  DrugInput,
  PharmacyPrescription,
} from '../models/pharmacy';

export interface PrescriptionFilters {
  /** One status, or several joined with commas (see docs/FRONTEND-DECISIONS.md, F-19). */
  status?: string;
  patientId?: string;
  page?: number;
  size?: number;
}

export interface DrugFilters {
  search?: string;
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

  dispense(id: string, lines: DispenseLine[]): Observable<PharmacyPrescription> {
    return this.http.post<PharmacyPrescription>(`${this.base}/prescriptions/${id}/dispense`, {
      lines,
    });
  }

  listDrugs(filters: DrugFilters = {}): Observable<Paged<Drug>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      search: filters.search,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Drug>>(`${this.base}/drugs`, { params });
  }

  createDrug(input: DrugInput): Observable<Drug> {
    return this.http.post<Drug>(`${this.base}/drugs`, input);
  }

  updateDrug(id: string, input: DrugInput): Observable<Drug> {
    return this.http.put<Drug>(`${this.base}/drugs/${id}`, input);
  }

  adjustStock(id: string, delta: number, reason: string): Observable<Drug> {
    return this.http.post<Drug>(`${this.base}/drugs/${id}/stock`, { delta, reason });
  }

  listStockAlerts(): Observable<Drug[]> {
    return this.http.get<Drug[]>(`${this.base}/stock/alerts`);
  }
}
