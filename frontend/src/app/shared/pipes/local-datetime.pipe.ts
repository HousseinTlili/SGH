import { formatDate } from '@angular/common';
import { Pipe, type PipeTransform } from '@angular/core';

/** UTC ISO string -> browser local time, "12 Oct 2026 09:30". Dates are stored and sent in UTC only. */
@Pipe({ name: 'localDatetime' })
export class LocalDatetimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : formatDate(date, 'dd MMM yyyy HH:mm', 'en-US');
  }
}
