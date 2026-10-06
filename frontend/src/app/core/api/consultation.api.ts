import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type { Consultation } from '../models/consultation';
import { clampPaging, toHttpParams } from '../../shared/util/paging';

export interface ConsultationFilters {
  patientId?: string;
  doctorId?: string;
  status?: string;
  page?: number;
  size?: number;
}

export interface CreateConsultationInput {
  patientId: string;
  appointmentId?: string;
}

@Injectable({ providedIn: 'root' })
export class ConsultationApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  list(filters: ConsultationFilters = {}): Observable<Paged<Consultation>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      patientId: filters.patientId,
      doctorId: filters.doctorId,
      status: filters.status,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Consultation>>(`${this.base}/consultations`, { params });
  }

  get(id: string): Observable<Consultation> {
    return this.http.get<Consultation>(`${this.base}/consultations/${id}`);
  }

  create(input: CreateConsultationInput): Observable<Consultation> {
    return this.http.post<Consultation>(`${this.base}/consultations`, input);
  }
}
