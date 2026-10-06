import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type {
  Consultation,
  LabOrder,
  LabResultCopy,
  LabTestRef,
  Prescription,
  PrescriptionItem,
  VitalSigns,
} from '../models/consultation';
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
  appointmentId?: string | null;
}

export interface UpdateConsultationNotesInput {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}

export interface VitalsFilters {
  patientId?: string;
  consultationId?: string;
  page?: number;
  size?: number;
}

export interface RecordVitalsInput {
  patientId: string;
  consultationId?: string | null;
  temperature?: number | null;
  heartRate?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  spo2?: number | null;
  weight?: number | null;
}

export interface CreateLabOrderInput {
  priority: 'ROUTINE' | 'URGENT';
  tests: LabTestRef[];
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

  updateNotes(id: string, notes: UpdateConsultationNotesInput): Observable<Consultation> {
    return this.http.put<Consultation>(`${this.base}/consultations/${id}`, notes);
  }

  sign(id: string): Observable<Consultation> {
    return this.http.post<Consultation>(`${this.base}/consultations/${id}/sign`, {});
  }

  listVitals(filters: VitalsFilters = {}): Observable<Paged<VitalSigns>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      patientId: filters.patientId,
      consultationId: filters.consultationId,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<VitalSigns>>(`${this.base}/vitals`, { params });
  }

  recordVitals(input: RecordVitalsInput): Observable<VitalSigns> {
    return this.http.post<VitalSigns>(`${this.base}/vitals`, input);
  }

  getPrescriptions(id: string): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(`${this.base}/consultations/${id}/prescriptions`);
  }

  createPrescription(id: string, items: PrescriptionItem[]): Observable<Prescription> {
    return this.http.post<Prescription>(`${this.base}/consultations/${id}/prescriptions`, {
      items,
    });
  }

  getLabOrders(id: string): Observable<LabOrder[]> {
    return this.http.get<LabOrder[]>(`${this.base}/consultations/${id}/lab-orders`);
  }

  createLabOrder(id: string, order: CreateLabOrderInput): Observable<LabOrder> {
    return this.http.post<LabOrder>(`${this.base}/consultations/${id}/lab-orders`, order);
  }

  getLabResults(id: string): Observable<LabResultCopy[]> {
    return this.http.get<LabResultCopy[]>(`${this.base}/consultations/${id}/lab-results`);
  }
}
