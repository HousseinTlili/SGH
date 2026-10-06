import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Paged } from '../models/common';
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Availability,
  Invoice,
  InvoiceLine,
} from '../models/reception';
import { clampPaging, toHttpParams } from '../../shared/util/paging';

export interface AppointmentFilters {
  doctorId?: string;
  patientId?: string;
  date?: string;
  status?: AppointmentStatus | AppointmentStatus[] | string;
  page?: number;
  size?: number;
}

export interface InvoiceFilters {
  patientId?: string;
  status?: string;
  page?: number;
  size?: number;
}

export interface CreateInvoiceInput {
  patientId: string;
  appointmentId?: string | null;
  lines: InvoiceLine[];
}

@Injectable({ providedIn: 'root' })
export class ReceptionApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  listAppointments(filters: AppointmentFilters = {}): Observable<Paged<Appointment>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const statusParam = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;

    const params = toHttpParams({
      doctorId: filters.doctorId,
      patientId: filters.patientId,
      date: filters.date,
      status: statusParam,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Appointment>>(`${this.base}/appointments`, { params });
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.base}/appointments/${id}`);
  }

  createAppointment(input: AppointmentInput): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/appointments`, input);
  }

  updateAppointment(id: string, input: AppointmentInput): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.base}/appointments/${id}`, input);
  }

  checkInAppointment(id: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/appointments/${id}/check-in`, {});
  }

  completeAppointment(id: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/appointments/${id}/complete`, {});
  }

  cancelAppointment(id: string, reason?: string | null): Observable<Appointment> {
    const body = reason ? { reason } : {};
    return this.http.post<Appointment>(`${this.base}/appointments/${id}/cancel`, body);
  }

  getAvailability(doctorId: string, date: string): Observable<Availability> {
    const params = toHttpParams({ doctorId, date });
    return this.http.get<Availability>(`${this.base}/appointments/availability`, {
      params,
    });
  }

  listInvoices(filters: InvoiceFilters = {}): Observable<Paged<Invoice>> {
    const paging = clampPaging(filters.page ?? 0, filters.size ?? 20);
    const params = toHttpParams({
      patientId: filters.patientId,
      status: filters.status,
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<Paged<Invoice>>(`${this.base}/invoices`, { params });
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/invoices/${id}`);
  }

  createInvoice(input: CreateInvoiceInput): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices`, input);
  }

  payInvoice(id: string, method: 'CASH' | 'CARD'): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices/${id}/pay`, { method });
  }

  cancelInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices/${id}/cancel`, {});
  }
}
