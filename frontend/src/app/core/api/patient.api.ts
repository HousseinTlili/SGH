import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type {
  AllergyHistory,
  AllergyPassport,
  MedicalFileEntry,
  Patient,
  PatientAllergy,
  PatientAllergyInput,
  PatientInput,
  PatientStatistics,
  PatientStatisticsQuery,
  PatientSummary,
  SimilarPatient,
} from '../models/patient';
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

  allergies(patientId: string): Observable<PatientAllergy[]> {
    return this.http.get<PatientAllergy[]>(`${this.base}/patients/${patientId}/allergies`);
  }

  allergyPassport(patientId: string): Observable<AllergyPassport> {
    return this.http.get<AllergyPassport>(`${this.base}/patients/${patientId}/allergy-passport`);
  }

  allergyPassportByToken(passportToken: string): Observable<AllergyPassport> {
    return this.http.get<AllergyPassport>(`${this.base}/patients/passport/${passportToken}`);
  }

  createAllergy(patientId: string, input: PatientAllergyInput): Observable<PatientAllergy> {
    return this.http.post<PatientAllergy>(`${this.base}/patients/${patientId}/allergies`, input);
  }

  updateAllergy(
    patientId: string,
    allergyId: string,
    input: PatientAllergyInput,
  ): Observable<PatientAllergy> {
    return this.http.put<PatientAllergy>(
      `${this.base}/patients/${patientId}/allergies/${allergyId}`,
      input,
    );
  }

  verifyAllergy(
    patientId: string,
    allergyId: string,
    verificationStatus: 'CONFIRMED' | 'REFUTED',
    version: number,
  ): Observable<PatientAllergy> {
    return this.http.post<PatientAllergy>(
      `${this.base}/patients/${patientId}/allergies/${allergyId}/verification`,
      { verificationStatus, version },
    );
  }

  allergyHistory(patientId: string, allergyId: string): Observable<AllergyHistory[]> {
    return this.http.get<AllergyHistory[]>(
      `${this.base}/patients/${patientId}/allergies/${allergyId}/history`,
    );
  }

  statistics(query: PatientStatisticsQuery = {}): Observable<PatientStatistics> {
    const params = toHttpParams({
      period: query.period,
      from: query.from,
      to: query.to,
      ageGroup: query.ageGroup,
      gender: query.gender,
    });
    return this.http.get<PatientStatistics>(`${this.base}/patients/statistics`, { params });
  }

  similar(
    firstName: string,
    lastName: string,
    birthDate?: string,
    excludeId?: string,
  ): Observable<SimilarPatient[]> {
    const params = toHttpParams({
      firstName,
      lastName,
      birthDate,
      excludeId,
    });
    return this.http.get<SimilarPatient[]>(`${this.base}/patients/similar`, { params });
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
