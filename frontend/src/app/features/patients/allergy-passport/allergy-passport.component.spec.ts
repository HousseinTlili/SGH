import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { AllergyPassport } from '../../../core/models/patient';
import { AllergyPassportComponent } from './allergy-passport.component';

const passport: AllergyPassport = {
  patientId: 'p1',
  passportToken: 'c0ffeeee-0000-4000-8000-000000000001',
  fullName: 'Youssef Ben Salah',
  birthDate: '1985-03-14',
  bloodType: 'A+',
  generatedAt: '2026-11-10T12:00:00Z',
  allergies: [
    {
      id: 'a1',
      patientId: 'p1',
      allergen: 'Penicillin',
      category: 'MEDICATION',
      observedReaction: 'Anaphylaxis',
      reactionSeverity: 'SEVERE',
      clinicalStatus: 'ACTIVE',
      verificationStatus: 'CONFIRMED',
      criticality: 'HIGH',
      version: 1,
      recordedByUsername: 'doctor1',
      recordedByRole: 'DOCTOR',
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    },
  ],
};

describe('AllergyPassportComponent', () => {
  it('renders structured allergy and important visual alert without treatment advice', async () => {
    await TestBed.configureTestingModule({ imports: [AllergyPassportComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AllergyPassportComponent);
    fixture.componentRef.setInput('passport', passport);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Smart Allergy Passport');
    expect(text).toContain('Penicillin');
    expect(text).toContain('CONFIRMED');
    expect(text).toContain('Important');
    expect(text).toContain('does not establish a diagnosis');
    expect(text).toContain('opaque passport token');
    expect(text).toContain(passport.passportToken);
    expect(text).toContain('/patients/passport/' + passport.passportToken);
  });

  it('does not infer no known allergies from an empty passport', async () => {
    await TestBed.configureTestingModule({ imports: [AllergyPassportComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AllergyPassportComponent);
    fixture.componentRef.setInput('passport', { ...passport, allergies: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('information has not been recorded');
    expect(fixture.nativeElement.textContent).not.toContain('No known allergies');
  });
});
