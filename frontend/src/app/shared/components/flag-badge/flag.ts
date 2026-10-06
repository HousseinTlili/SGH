import type { LabFlag } from '../../../core/models/consultation';
import type { Tone } from '../status-badge/status-tone';

/** Flag -> colour (NORMAL green, HIGH and LOW amber, CRITICAL red). Icons keep colour from being the only signal. */
export function flagTone(flag: LabFlag): Tone {
  switch (flag) {
    case 'NORMAL':
      return 'success';
    case 'HIGH':
    case 'LOW':
      return 'warning';
    case 'CRITICAL':
      return 'danger';
  }
}

export function flagIcon(flag: LabFlag): string {
  switch (flag) {
    case 'NORMAL':
      return 'check_circle';
    case 'HIGH':
      return 'arrow_upward';
    case 'LOW':
      return 'arrow_downward';
    case 'CRITICAL':
      return 'error';
  }
}

export function flagLabel(flag: LabFlag): string {
  return flag.charAt(0) + flag.slice(1).toLowerCase();
}
