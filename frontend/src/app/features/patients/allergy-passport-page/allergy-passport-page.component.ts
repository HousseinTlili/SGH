import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientApi } from '../../../core/api/patient.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { AllergyPassport, PatientAllergy } from '../../../core/models/patient';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { AllergyPassportComponent } from '../allergy-passport/allergy-passport.component';
import {
  canEditAllergy,
  canRecordAllergy,
  canVerifyAllergy,
  canViewAllergyHistory,
} from '../patient-rules';

@Component({
  selector: 'app-allergy-passport-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    ServiceGateDirective,
    AllergyPassportComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './allergy-passport-page.component.html',
  styleUrl: './allergy-passport-page.component.scss',
})
export class AllergyPassportPageComponent implements OnInit {
  private readonly api = inject(PatientApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly passport = signal<AllergyPassport | null>(null);

  protected readonly canRecord = canRecordAllergy((role) => this.auth.hasRole(role));
  protected readonly canVerify = canVerifyAllergy((role) => this.auth.hasRole(role));
  protected readonly canViewHistory = canViewAllergyHistory((role) => this.auth.hasRole(role));
  protected readonly canEditFn = (allergy: PatientAllergy) =>
    canEditAllergy((role) => this.auth.hasRole(role), allergy.verificationStatus);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.router.navigate(['/patients']);
      return;
    }
    this.api.allergyPassportByToken(token).subscribe({
      next: (passport) => {
        this.passport.set(passport);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('This opaque passport token is unknown or you are not allowed to open it.');
        this.loading.set(false);
      },
    });
  }

  openPatientFile(): void {
    const id = this.passport()?.patientId;
    if (id) {
      this.router.navigate(['/patients', id]);
    }
  }
}
