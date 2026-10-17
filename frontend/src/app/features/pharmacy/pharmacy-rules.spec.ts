import type { PharmacyItem } from '../../core/models/pharmacy';
import {
  QUEUE_FILTERS,
  describeDispensingLine,
  dispensedCount,
  dispensingProgress,
  statusParam,
} from './pharmacy-rules';

const item = (index: number, drugName: string, dispensed: boolean): PharmacyItem => ({
  index,
  drugName,
  dosage: '1 tablet',
  frequency: '3 per day',
  duration: '5 days',
  dispensed,
});

describe('statusParam (queue filter -> status query)', () => {
  it('OPEN asks for issued and partially dispensed prescriptions', () => {
    expect(statusParam('OPEN')).toBe('ISSUED,PARTIALLY_DISPENSED');
  });

  it('ALL sends no status at all', () => {
    expect(statusParam('ALL')).toBeUndefined();
  });

  it.each(['ISSUED', 'PARTIALLY_DISPENSED', 'DISPENSED'] as const)('%s is sent as is', (status) => {
    expect(statusParam(status)).toBe(status);
  });

  it('OPEN is the first choice, so it is the default', () => {
    expect(QUEUE_FILTERS[0].value).toBe('OPEN');
  });
});

describe('dispensing progress', () => {
  const items = [item(0, 'Paracetamol 500 mg', true), item(1, 'Cetirizine 10 mg', false)];

  it('counts dispensed items', () => {
    expect(dispensedCount(items)).toBe(1);
    expect(dispensedCount([])).toBe(0);
  });

  it('is written as "x of y dispensed"', () => {
    expect(dispensingProgress(items)).toBe('1 of 2 dispensed');
    expect(dispensingProgress([item(0, 'A', true)])).toBe('1 of 1 dispensed');
  });
});

describe('describeDispensingLine', () => {
  const items = [item(0, 'Paracetamol 500 mg', true), item(1, 'Cetirizine 10 mg', false)];

  it('uses the drug name written by the doctor and the quantity given', () => {
    expect(describeDispensingLine({ itemIndex: 1, drugId: 'd', quantity: 7 }, items)).toBe(
      'Cetirizine 10 mg × 7',
    );
  });

  it('falls back to the item number when the item is unknown', () => {
    expect(describeDispensingLine({ itemIndex: 4, drugId: 'd', quantity: 2 }, items)).toBe(
      'Item 5 × 2',
    );
  });
});
