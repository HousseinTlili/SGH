import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PharmacyPrescription } from '../models/pharmacy';

@Injectable({ providedIn: 'root' })
export class PharmacyApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  getPrescription(id: string): Observable<PharmacyPrescription> {
    return this.http.get<PharmacyPrescription>(`${this.base}/prescriptions/${id}`);
  }
}
