import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { AllergyPassport, PatientAllergy } from '../../../core/models/patient';
import { passportQrPayload, qrSvg } from '../../../shared/util/qr-svg';

@Component({
  selector: 'app-allergy-passport',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './allergy-passport.component.html',
  styleUrl: './allergy-passport.component.scss',
})
export class AllergyPassportComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly passport = input.required<AllergyPassport>();
  readonly canRecord = input(false);
  readonly canVerify = input(false);
  readonly canViewHistory = input(false);
  readonly canEdit = input<(allergy: PatientAllergy) => boolean>(() => false);

  readonly add = output<void>();
  readonly edit = output<PatientAllergy>();
  readonly verify = output<{ allergy: PatientAllergy; status: 'CONFIRMED' | 'REFUTED' }>();
  readonly history = output<PatientAllergy>();

  readonly qrHtml = signal<SafeHtml | null>(null);
  readonly qrPayload = signal('');
  readonly qrError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const token = this.passport().passportToken;
      this.qrHtml.set(null);
      this.qrError.set(null);

      if (!token) {
        this.qrPayload.set('');
        this.qrError.set(
          'Passport token is missing. Restart Patient Service so migration V4 is applied.',
        );
        return;
      }

      const payload = passportQrPayload(window.location.origin, token);
      this.qrPayload.set(payload);

      void qrSvg(payload)
        .then((svg) => {
          this.qrHtml.set(this.sanitizer.bypassSecurityTrustHtml(svg));
        })
        .catch(() => {
          this.qrError.set('QR generation failed in the browser.');
        });
    });
  }

  protected isImportant(allergy: PatientAllergy): boolean {
    return (
      allergy.clinicalStatus === 'ACTIVE' &&
      allergy.verificationStatus !== 'REFUTED' &&
      (allergy.criticality === 'HIGH' || allergy.reactionSeverity === 'SEVERE')
    );
  }
}
