import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LabTest } from '../models/lab';

@Injectable({ providedIn: 'root' })
export class LabApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  getTests(): Observable<LabTest[]> {
    return this.http.get<LabTest[]>(`${this.base}/tests`);
  }
}
