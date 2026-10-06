import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PatientSummary } from '../models/patient';
import type { StaffPublic } from '../models/staff';

@Injectable({ providedIn: 'root' })
export class NameLookupService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  private readonly patientSummaryCache = new Map<string, Observable<PatientSummary | null>>();
  private readonly staffDirectoryCache = new Map<string, Observable<StaffPublic[]>>();
  private readonly staffMemberCache = new Map<string, Observable<StaffPublic | null>>();

  /**
   * Retrieves and caches the patient summary.
   * If the service fails or returns an error, emits null.
   */
  getPatientSummary(patientId: string): Observable<PatientSummary | null> {
    if (!patientId) {
      return of(null);
    }
    const cached = this.patientSummaryCache.get(patientId);
    if (cached) {
      return cached;
    }

    const request$ = this.http
      .get<PatientSummary>(`${this.base}/patients/${patientId}/summary`)
      .pipe(
        catchError(() => of(null)),
        shareReplay(1),
      );

    this.patientSummaryCache.set(patientId, request$);
    return request$;
  }

  /**
   * Returns the patient's full name, or falls back to "Patient unavailable (<id:8>)" if unreachable.
   */
  getPatientName(patientId: string): Observable<string> {
    if (!patientId) {
      return of('');
    }
    const shortId = patientId.slice(0, 8);
    return this.getPatientSummary(patientId).pipe(
      map((summary) => summary?.fullName ?? `Patient unavailable (${shortId})`),
    );
  }

  /**
   * Retrieves the staff directory for a specific role (e.g. DOCTOR), cached by role.
   */
  getStaffDirectory(role?: string): Observable<StaffPublic[]> {
    const key = role ?? 'ALL';
    const cached = this.staffDirectoryCache.get(key);
    if (cached) {
      return cached;
    }

    const url = role
      ? `${this.base}/staff/directory?role=${encodeURIComponent(role)}`
      : `${this.base}/staff/directory`;

    const request$ = this.http.get<StaffPublic[]>(url).pipe(
      catchError(() => of([])),
      shareReplay(1),
    );

    this.staffDirectoryCache.set(key, request$);
    return request$;
  }

  /**
   * Looks up a staff member by ID. If individual lookup is supported or finds in directory.
   */
  getStaffMember(staffId: string): Observable<StaffPublic | null> {
    if (!staffId) {
      return of(null);
    }
    const cached = this.staffMemberCache.get(staffId);
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<StaffPublic>(`${this.base}/staff/${staffId}/public`).pipe(
      catchError(() => of(null)),
      shareReplay(1),
    );

    this.staffMemberCache.set(staffId, request$);
    return request$;
  }

  /**
   * Returns a doctor's full name, checking cached directory/public staff,
   * falling back to "Doctor unavailable (<id:8>)".
   */
  getDoctorName(doctorId: string): Observable<string> {
    if (!doctorId) {
      return of('');
    }
    const shortId = doctorId.slice(0, 8);

    // Try finding in cached DOCTOR directory first, else call getStaffMember
    return this.getStaffDirectory('DOCTOR').pipe(
      map((doctors) => doctors.find((d) => d.id === doctorId)),
      map((found) => {
        if (found) {
          return found.fullName;
        }
        return null;
      }),
      catchError(() => of(null)),
      map((name) => {
        if (name) {
          return name;
        }
        return `Doctor unavailable (${shortId})`;
      }),
    );
  }

  /** Clears cached lookups (useful for tests or cache invalidation). */
  clearCache(): void {
    this.patientSummaryCache.clear();
    this.staffDirectoryCache.clear();
    this.staffMemberCache.clear();
  }
}
