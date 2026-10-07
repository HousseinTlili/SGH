import type { LabResultLine } from '../../core/models/consultation';
import { LAB_FLOW, criticalResults, formatResultValue, labSteps } from './lab-rules';

const line = (testCode: string, flag: LabResultLine['flag']): LabResultLine => ({
  testCode,
  value: 1,
  unit: 'u',
  referenceRange: '0-2',
  flag,
});

describe('labSteps (status stepper, LAB-2)', () => {
  it('lists the four steps in the allowed order', () => {
    expect(labSteps('REQUESTED').map((s) => s.status)).toEqual([...LAB_FLOW]);
  });

  it.each([
    ['REQUESTED', ['current', 'todo', 'todo', 'todo']],
    ['IN_PROGRESS', ['done', 'current', 'todo', 'todo']],
    ['RESULT_ENTERED', ['done', 'done', 'current', 'todo']],
    ['VALIDATED', ['done', 'done', 'done', 'done']],
  ] as const)('%s -> %j', (status, states) => {
    expect(labSteps(status).map((s) => s.state)).toEqual(states);
  });

  it('has readable labels', () => {
    expect(labSteps('REQUESTED').map((s) => s.label)).toEqual([
      'Requested',
      'In progress',
      'Results entered',
      'Validated',
    ]);
  });
});

describe('criticalResults', () => {
  it('keeps only CRITICAL lines', () => {
    const lines = [line('HGB', 'NORMAL'), line('K', 'CRITICAL'), line('WBC', 'HIGH')];
    expect(criticalResults(lines).map((l) => l.testCode)).toEqual(['K']);
  });

  it('is empty when nothing is critical', () => {
    expect(criticalResults([line('HGB', 'LOW')])).toEqual([]);
  });
});

describe('formatResultValue', () => {
  it('joins value and unit', () => {
    expect(formatResultValue(14.2, 'g/dL')).toBe('14.2 g/dL');
    expect(formatResultValue(12.5, '10^9/L')).toBe('12.5 10^9/L');
  });

  it('has no trailing space without a unit', () => {
    expect(formatResultValue(3, '')).toBe('3');
  });
});
