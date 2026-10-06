import { Pipe, type PipeTransform } from '@angular/core';

/** 80 -> "80.00 TND" (the platform currency is always TND). */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'TND'): string {
    return value === null || value === undefined || Number.isNaN(value)
      ? ''
      : `${value.toFixed(2)} ${currency}`;
  }
}
