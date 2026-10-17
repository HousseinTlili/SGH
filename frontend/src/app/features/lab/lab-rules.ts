import type { LabResultLine } from '../../core/models/consultation';
import type { LabStatus } from '../../core/models/lab';

export type StepState = 'done' | 'current' | 'todo';

export interface LabStep {
  status: LabStatus;
  label: string;
  state: StepState;
}

/** The only allowed order of a lab request (LAB-2). */
export const LAB_FLOW: readonly LabStatus[] = [
  'REQUESTED',
  'IN_PROGRESS',
  'RESULT_ENTERED',
  'VALIDATED',
];

const STEP_LABELS: Record<LabStatus, string> = {
  REQUESTED: 'Requested',
  IN_PROGRESS: 'In progress',
  RESULT_ENTERED: 'Results entered',
  VALIDATED: 'Validated',
};

/** The status stepper of the lab request page: steps before the current one are done. */
export function labSteps(current: LabStatus): LabStep[] {
  const index = LAB_FLOW.indexOf(current);
  return LAB_FLOW.map((status, i) => ({
    status,
    label: STEP_LABELS[status],
    // a validated request is finished, so its last step is done too
    state: i < index || current === 'VALIDATED' ? 'done' : i === index ? 'current' : 'todo',
  }));
}

/** Values the doctor must notice first. */
export function criticalResults(results: readonly LabResultLine[]): LabResultLine[] {
  return results.filter((r) => r.flag === 'CRITICAL');
}

export function formatResultValue(value: number, unit: string): string {
  return `${value} ${unit}`.trim();
}
