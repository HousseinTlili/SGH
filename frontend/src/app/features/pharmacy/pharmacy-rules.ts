import type { DispenseLine, PharmacyItem } from '../../core/models/pharmacy';

/** Filter choices of the prescription queue. OPEN is the default (Screens B). */
export type QueueStatusFilter = 'OPEN' | 'ISSUED' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'ALL';

export const QUEUE_FILTERS: readonly { value: QueueStatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open prescriptions' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PARTIALLY_DISPENSED', label: 'Partially dispensed' },
  { value: 'DISPENSED', label: 'Dispensed' },
  { value: 'ALL', label: 'All' },
];

/** The `status` query value for a filter choice; undefined means "do not filter". */
export function statusParam(filter: QueueStatusFilter): string | undefined {
  switch (filter) {
    case 'OPEN':
      return 'ISSUED,PARTIALLY_DISPENSED';
    case 'ALL':
      return undefined;
    default:
      return filter;
  }
}

export function dispensedCount(items: readonly PharmacyItem[]): number {
  return items.filter((i) => i.dispensed).length;
}

/** "1 of 2 dispensed" */
export function dispensingProgress(items: readonly PharmacyItem[]): string {
  return `${dispensedCount(items)} of ${items.length} dispensed`;
}

/** One line of the dispensing history: the drug as written by the doctor, and the quantity given. */
export function describeDispensingLine(line: DispenseLine, items: readonly PharmacyItem[]): string {
  const item = items.find((i) => i.index === line.itemIndex);
  const name = item?.drugName ?? `Item ${line.itemIndex + 1}`;
  return `${name} × ${line.quantity}`;
}
