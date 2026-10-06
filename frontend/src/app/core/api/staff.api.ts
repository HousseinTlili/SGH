import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type { Me, Staff, StaffInput, StaffPublic } from '../models/staff';
import { clampPaging, toHttpParams } from '../../shared/util/paging';

export interface StaffFilters {
  role?: string;
  department?: string;
  active?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  me(): Observable<Me> {
    return this.http.get<Me>(`${this.base}/me`);
  }

  directory(role?: string): Observable<StaffPublic[]> {
    const params = role ? `?role=${encodeURIComponent(role)}` : '';
    return this.http.get<StaffPublic[]>(`${this.base}/staff/directory${params}`);
  }

  publicProfile(id: string): Observable<StaffPublic> {
    return this.http.get<StaffPublic>(`${this.base}/staff/${id}/public`);
  }

  list(filters: StaffFilters = {}): Observable<Paged<Staff>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      role: filters.role,
      department: filters.department,
      active: filters.active,
      search: filters.search,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Staff>>(`${this.base}/staff`, { params });
  }

  get(id: string): Observable<Staff> {
    return this.http.get<Staff>(`${this.base}/staff/${id}`);
  }

  create(staff: StaffInput): Observable<Staff> {
    return this.http.post<Staff>(`${this.base}/staff`, staff);
  }

  update(id: string, staff: StaffInput): Observable<Staff> {
    return this.http.put<Staff>(`${this.base}/staff/${id}`, staff);
  }

  deactivate(id: string): Observable<Staff> {
    return this.http.post<Staff>(`${this.base}/staff/${id}/deactivate`, {});
  }
}
