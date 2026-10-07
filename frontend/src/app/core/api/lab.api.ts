import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { clampPaging, toHttpParams } from '../../shared/util/paging';
import type { Paged } from '../models/common';
import type { LabRequest, LabResultRow, LabTest } from '../models/lab';

export interface LabRequestFilters {
  status?: string;
  priority?: string;
  patientId?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class LabApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  getTests(): Observable<LabTest[]> {
    return this.http.get<LabTest[]>(`${this.base}/tests`);
  }

  /** The work queue: the API already puts URGENT first, then the oldest request. */
  listRequests(filters: LabRequestFilters = {}): Observable<Paged<LabRequest>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      status: filters.status,
      priority: filters.priority,
      patientId: filters.patientId,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<LabRequest>>(`${this.base}/lab-requests`, { params });
  }

  getRequest(id: string): Observable<LabRequest> {
    return this.http.get<LabRequest>(`${this.base}/lab-requests/${id}`);
  }

  /** Validated results only, newest first. */
  listResults(patientId?: string, page = 0, size = 20): Observable<Paged<LabResultRow>> {
    const paging = clampPaging(page, size);
    const params = toHttpParams({ patientId, page: paging.page, size: paging.size });
    return this.http.get<Paged<LabResultRow>>(`${this.base}/lab-results`, { params });
  }
}
