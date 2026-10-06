import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Me, StaffPublic } from '../models/staff';

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
}
