# Prompt for Antigravity: build the SGH Angular front end

Copy everything below the line into Antigravity (or attach this file and say "follow docs/ANTIGRAVITY-PROMPT.md").

---

## 0. Your role and the situation

You are building the **Angular front end of SGH** (Système de Gestion Hospitalière), a university project (ESPRIT, module "Applications Web Distribuées"). SGH is six independent microservices behind one API gateway, plus ONE Angular app. The course grades architecture quality, tests, documentation and a working demo, and every team member must be able to explain the code. So: simple, readable, tested code; no clever abstractions; no features outside this brief.

**You only touch `frontend/`, `tools/mock/` and `docs/FRONTEND-DECISIONS.md`.** The backend, Keycloak, gateway and infra are NOT part of this task and do not exist yet. The app must run end to end with zero backend, against Prism mock servers.

**Current repository state (read it first, do not regenerate it):**
- Branch `feature/frontend-f0-f1` already contains phases F0 and F1: Angular 22 workspace in `frontend/` (standalone, zoneless, strict TS, Angular Material, Vitest, ESLint, Prettier), models, `AuthService` over an `AuthBackend` interface with mock sign-in for 8 users, interceptors, role guards, service-status polling, shell with role menu, `/login`, `/status`, `/profile`, 403/404 pages, shared components, design tokens, placeholder routes for every screen, and `tools/mock` (Prism servers + mock gateway). 147 unit tests pass.
- If `frontend/` does not exist in your workspace, stop and tell me; do not rebuild F0/F1 from scratch.
- Read `docs/FRONTEND-DECISIONS.md` and `frontend/README.md` first. Reuse what exists: `DataTable`, `PageHeader`, `StatusBadge`, `FlagBadge`, `ConfirmService`, `EmptyState`, `LoadingState`, `ErrorState`, `ServiceUnavailable`, `*appServiceGate`, `applyApiErrors`/`fieldErrorMessage`, pipes `money`, `fullName`, `localDatetime`, `toHttpParams`, `emptyPage`.

**Your job: replace each `FeaturePlaceholder` route with the real screens below, one feature per commit, in this order:** F2 Patients and Reception, F3 Staff, F4 Consultation + Vital signs page, F5 Lab, F6 Pharmacy, F7 Patient portal, F8 resilience pass.

## 1. Non-negotiable rules

1. Angular standalone components, signals, reactive forms, `HttpClient` with the existing functional interceptors, Angular Material. No NgModules, no NgRx, no `any`, no unused code, no commented-out code.
2. The app only calls the gateway at `environment.apiBaseUrl` (`http://localhost:8080`). Never a service port. Never hard-code a URL outside `environment`.
3. Features never import from other features. Shared code goes in `core/` or `shared/`. Each feature has its own `<feature>.routes.ts` (lazy), components, and small local services if needed. API clients live in `core/api/<service>.api.ts`.
4. Every screen handles **loading, empty, error and service-unavailable** states. The top level of each feature page is wrapped in `*appServiceGate="'<service>'"`, so a stopped service breaks only its own screens and recovers by itself. A page that reads from a second service (for example a patient name from Patient) degrades inside its own block, never the whole page.
5. All colours, spacing and type come from CSS variables in `src/styles/_tokens.scss`. No literal colours in components. Colour is only for meaning (status, urgency, lab flags) and is never the only signal (always text or an icon too). Visible focus ring, keyboard accessible, labels on every input. Light and dark themes must both look right.
6. UI language: English. Times are stored and sent in UTC ISO 8601 (`2026-10-12T09:30:00Z`), shown in the browser's local time with `localDatetime`. Date pickers/inputs work in local time and convert to UTC strings. Dates without time are `YYYY-MM-DD`.
7. Never show a raw UUID as the main label. Look up names (patient summary, staff directory) and cache them (a small `NameLookup` service with tests). If a lookup fails because its service is down, show the first 8 characters of the id with the label "Patient unavailable" (or "Doctor unavailable").
8. Every destructive or state-changing action (cancel, delete, sign, validate, dispense, pay, deactivate) uses `ConfirmService` first.
9. Forms: required markers, inline validation matching the API rules, submit button disabled while saving, a 422 response maps `details[{field, problem}]` onto the controls with `applyApiErrors`, a 409 shows its message as a form-level error (text given per screen).
10. Error handling is already global (interceptors: 503 with `service` marks it down + snackbar, 403/409/network snackbars, 422 silent). Do not duplicate snackbars; screens only add their own success toasts and inline messages.
11. Roles guard navigation only; the server is authoritative. Action buttons are shown only for the roles listed per screen (use `AuthService.hasRole`). Put the visibility rules in small pure functions so they can be unit tested.
12. **Run before every commit and show real output:** `npm run format:check`, `npm run lint`, `npm test`, `npm run build` (inside `frontend/`). Never say something works unless you ran it. If a spec detail is ambiguous, pick the simplest reading and write it in `docs/FRONTEND-DECISIONS.md`; stop and ask only for decisions that are hard to undo.
13. Commit per phase with `frontend: <what>` messages. Never push. No secrets in the repo.

## 2. How to run and test

```
cd frontend
npm install
npm --prefix ../tools/mock install     # once
npm run start:mock                      # app on :4200, mock gateway :8080, Prism :8081-8086
curl -X POST http://localhost:8080/gateway/mock/down/lab   # simulate a crash (and /up/lab)
```
Mock sign-in lists 8 users: `doctor1`, `doctor2` (DOCTOR), `nurse1` (NURSE), `lab1` (LAB_TECHNICIAN), `pharmacist1` (PHARMACIST), `reception1` (RECEPTIONIST), `admin1` (ADMIN), `patient1` (PATIENT). Token is the fixed string `mock-token`.

### Mock data you must write (part of each phase)
Prism serves static first-examples from `tools/mock/specs/<service>.yaml` (patient, reception, consultation, lab, pharmacy, staff). Extend these files with every endpoint the screens call: request body examples, a 200/201 response example (lists need at least 2-3 items and the paged shape), and error examples (409, 422 with `details`, 404) using the shared error body. Use the seed data below (same ids and names). Declare the bearer security scheme and `security: []` on `/health`. Prism limitations are accepted: a created record never appears in a later list; error examples are reached with the header `Prefer: code=409`. Never invent ids.

## 3. Shared conventions (API)

- Base path `/api`, JSON, camelCase, UUID ids.
- Paged lists: `?page=0&size=20` (size max 100), response `{ content, page, size, totalElements, totalPages }`. Sub-collections of one parent (prescriptions of a consultation, lab orders, lab results) and `directory`, `tests`, `stock/alerts` return a **plain array**.
- Error body: `{ timestamp, status, error, message, path, correlationId, service?, details?: [{field, problem}] }`. Codes: 401 no/invalid token, 403 wrong role, 404, 409 conflict or invalid state move, 422 validation, 503 service down (gateway adds `service`).
- Headers already added by the interceptors: `Authorization: Bearer ...`, `X-Correlation-Id`.
- Gateway also serves `GET /gateway/health/services` (no token), polled every 5 s by the existing status service.

## 4. Roles, routes and menus (already implemented; keep them)

Roles: PATIENT, DOCTOR, NURSE, LAB_TECHNICIAN, PHARMACIST, RECEPTIONIST, ADMIN.

| Route | Allowed roles |
|---|---|
| `/patients`, `/patients/new`, `/patients/:id`, `/patients/:id/edit` | RECEPTIONIST, DOCTOR, NURSE, ADMIN (the two form routes: additionally refuse non-RECEPTIONIST by redirecting to `/forbidden`) |
| `/appointments`, `/appointments/new`, `/appointments/:id` | RECEPTIONIST, DOCTOR, ADMIN (`new` and edit: RECEPTIONIST only) |
| `/invoices`, `/invoices/new`, `/invoices/:id` | RECEPTIONIST, ADMIN |
| `/consultations`, `/consultations/:id` | DOCTOR, NURSE, ADMIN |
| `/vitals` | NURSE, DOCTOR |
| `/lab/requests`, `/lab/requests/:id`, `/lab/results` | LAB_TECHNICIAN, DOCTOR, ADMIN |
| `/pharmacy/prescriptions`, `/pharmacy/prescriptions/:id`, `/pharmacy/drugs`, `/pharmacy/stock` | PHARMACIST, DOCTOR, ADMIN |
| `/staff`, `/staff/new`, `/staff/:id/edit` | ADMIN |
| `/my/appointments`, `/my/invoices`, `/my/consultations` | PATIENT |
| `/profile`, `/status` | any signed-in user |

Landing page by role: RECEPTIONIST and DOCTOR `/appointments`, NURSE `/vitals`, LAB_TECHNICIAN `/lab/requests`, PHARMACIST `/pharmacy/prescriptions`, ADMIN `/status`, PATIENT `/my/appointments`.

## 5. TypeScript models

Already in `core/models/*.ts` and must match the API exactly (Patient, PatientInput, PatientSummary, MedicalFileEntry, Appointment, AppointmentInput, Slot, Availability, Invoice, InvoiceLine, Consultation, VitalSigns, PrescriptionItem, Prescription, LabTestRef, LabOrder, LabFlag, LabResultLine, LabResultCopy, LabRequest, LabTest, Drug, DrugInput, PharmacyItem, PharmacyPrescription, DispenseLine, Staff, StaffPublic, Me, Paged, ApiError). Add small input/response types next to them when a screen needs one (for example a dispensing record, a stock adjustment body).

## 6. Screens

### F2a. Patients (service `patient`)

**Patient list `/patients`**: search box (debounce 300 ms) sending `search`; data table columns Last name, First name, Birth date, Gender, Phone, Blood type; default size 20; row click opens the detail. Button "New patient" for RECEPTIONIST only. API: `GET /api/patients?search=&page=&size=`.

**Patient form `/patients/new`, `/patients/:id/edit`** (RECEPTIONIST). Fields and validation: First name* and Last name* (1-80 chars, not blank); Birth date* (date picker, not in the future, not before 1900-01-01); Gender* (MALE, FEMALE, OTHER); Phone (pattern `^[+]?[0-9 ]{8,15}$`); Email (valid, max 120); Address (max 255); Blood type (A+ A- B+ B- AB+ AB- O+ O-); Allergies (textarea, max 500); Insurance provider (max 100); Insurance number (max 50). Save = `POST /api/patients` (new, 201) or `PUT /api/patients/{id}` (full replacement, 200), then go to the detail with snackbar "Patient saved". 409 → form-level "A patient with the same name and birth date already exists". 422 → fields.

**Patient detail `/patients/:id`**: header with full name, age (from birthDate), gender, blood type chip, allergies shown prominently when present. Tabs:
- **Overview**: all fields.
- **Medical file** (DOCTOR, NURSE): paged list newest first (type icon, summary, source service, date) from `GET /api/patients/{id}/medical-file?type=&page=&size=`. DOCTOR also sees an "Add note" form: `POST /api/patients/{id}/medical-file` body `{ summary }` (1-1000 chars) → creates a NOTE.
- **Appointments** (RECEPTIONIST, DOCTOR, ADMIN): `GET /api/appointments?patientId=`; rows link to the appointment.
- **Consultations** (DOCTOR, NURSE, ADMIN): `GET /api/consultations?patientId=`.
Actions: Edit (RECEPTIONIST), Delete with confirmation (ADMIN; `DELETE /api/patients/{id}` → 204, back to list), "New appointment" (RECEPTIONIST, opens `/appointments/new` with the patient prefilled), "New consultation" (DOCTOR, `POST /api/consultations {patientId}` then opens it). **Each tab loads from its own service; when that service is down only that tab shows ServiceUnavailable.**

### F2b. Reception (service `reception`)

**Appointment list `/appointments`**: filters: date (default today), doctor (select from `GET /api/staff/directory?role=DOCTOR`; for DOCTOR it is forced to themselves), status (multi), patient (search by name using the patient list). Table: Time (start to end), Patient (name via `GET /api/patients/{id}/summary`), Doctor name, Reason, Status badge, and a warning icon with tooltip "Patient not verified yet" when `patientVerified` is false. Row actions by status: SCHEDULED → Check in, Edit, Cancel (RECEPTIONIST); CHECKED_IN → Complete (DOCTOR, RECEPTIONIST), Cancel (RECEPTIONIST); a DOCTOR can "Start consultation" on CHECKED_IN (creates a consultation draft linked to the appointment and opens it). Button "New appointment" (RECEPTIONIST). API: `GET /api/appointments?doctorId=&patientId=&date=YYYY-MM-DD&status=&page=&size=`, `POST /api/appointments/{id}/check-in`, `/complete`, `/cancel` (cancel opens a dialog asking an optional reason ≤255, body `{ reason }`). Invalid moves return 409 (allowed moves: SCHEDULED→CHECKED_IN, SCHEDULED→CANCELLED, CHECKED_IN→COMPLETED, CHECKED_IN→CANCELLED).

**New / edit appointment `/appointments/new`, `/appointments/:id`** (RECEPTIONIST; only SCHEDULED can be edited):
1. Patient: autocomplete over the patient list. If Patient is down: allow pasting a patient id and show "Patient service is down: the patient will be verified later".
2. Doctor: select from the staff directory.
3. Date: date picker, not in the past. Once doctor and date are set, load `GET /api/appointments/availability?doctorId=&date=` (`{ doctorId, date, slots:[{startAt,endAt,available}] }`, 18 half-hour slots 08:00-17:00 UTC) and show a grid of slots; available ones selectable, taken ones disabled.
4. Duration: 30, 45, 60 minutes (end = slot start + duration) or custom 10-120.
5. Reason: 1-255 chars.
Submit `POST /api/appointments` (201) or `PUT /api/appointments/{id}` with `{ patientId, doctorId, startAt, endAt, reason }`. Rules: end after start, duration 10-120 min, start in the future. 409 → "This doctor already has an appointment at that time" and refresh the slot grid. 422 → map details (including "patient not found"). Success: snackbar and back to the list for that day.

**Invoice list `/invoices`**: filters status and patient; table Date, Patient, Appointment (link), Total (`money`), Status badge; row click opens the detail; "New invoice" (RECEPTIONIST). API `GET /api/invoices?patientId=&status=&page=&size=`.

**Invoice form `/invoices/new`**: patient (autocomplete), optional appointment (select among that patient's appointments), lines editor (add/remove rows; description 1-150, quantity integer ≥1, unit price ≥0 with 2 decimals; 1 to 30 lines), live total shown but **never sent**. `POST /api/invoices { patientId, appointmentId?, lines }` → opens the detail.

**Invoice detail `/invoices/:id`**: lines table, total (server-computed), status, payment info. PENDING: "Mark as paid" (dialog choosing CASH or CARD with the text "Payment is simulated, no card data is entered"; `POST /api/invoices/{id}/pay { method }`) and "Cancel invoice" (confirmation; `POST /api/invoices/{id}/cancel`). PAID or CANCELLED: read only. 409 for invalid moves.

### F3. Staff admin (service `staff`, ADMIN)

**Staff list `/staff`**: filters role, department, active toggle, search; table Name, Role, Specialty, Department, Email, Active badge; row click edits; "New staff member". API `GET /api/staff?role=&department=&active=&search=&page=&size=`.

**Staff form `/staff/new`, `/staff/:id/edit`**: first name* , last name* (≤80), role* (select of the six staff roles: DOCTOR, NURSE, LAB_TECHNICIAN, PHARMACIST, RECEPTIONIST, ADMIN), specialty (≤80), department* (≤80), email* (valid, unique, ≤120), Keycloak user id (optional UUID). `POST /api/staff` / `PUT /api/staff/{id}`. 409 → "This e-mail is already used". On edit, a "Deactivate" button with confirmation (`POST /api/staff/{id}/deactivate`; disabled when already inactive; 409 if already inactive). Note under the form: "This manages the profile only. Login accounts come from Keycloak."

(Already done: `/profile` calls `GET /api/me`; `/status` shows a card per service plus the gateway.)

### F4. Consultation (service `consultation`)

**Consultation list `/consultations`** (DOCTOR, NURSE, ADMIN): filters status (DRAFT, SIGNED), patient (autocomplete), doctor (select; DOCTOR defaults to self). Table: Date, Patient (snapshot name, or "Patient unavailable"), Doctor, Assessment (first 60 chars), Status badge; row click opens the workspace. `GET /api/consultations?patientId=&doctorId=&status=&page=&size=` (newest first).

**Consultation workspace `/consultations/:id`**: header with patient name, birth date, allergies (from the Patient summary/file when available; if Patient is down, show only the snapshot) and status. If `patientSnapshot` is null show a banner "Patient details are unavailable". Tabs:
1. **Notes (SOAP)**: four text areas Subjective, Objective, Assessment, Plan (each ≤4000). When DRAFT and the signed-in DOCTOR owns it (`doctorId` = their staffId): editable with "Save draft" (`PUT /api/consultations/{id}` with the four fields) and "Sign consultation" (`POST /api/consultations/{id}/sign`, confirmation "A signed consultation cannot be edited"). Sign is disabled with a hint until Assessment and Plan are filled (422 otherwise). SIGNED or not the owner: read only, showing `signedAt`. A 409 on save → "This consultation is already signed".
2. **Vital signs** (NURSE and DOCTOR): table of this consultation's measurements newest first (`GET /api/vitals?consultationId=`) and a form: temperature (30.0-45.0 °C), heart rate (20-250), systolic (50-260), diastolic (30-160, and must be lower than systolic), SpO2 (50-100), weight (0.5-400 kg). All optional but **at least one value required**. `POST /api/vitals { patientId, consultationId?, ...values }`. Write the validators as pure functions with tests.
3. **Prescriptions** (DOCTOR writes, NURSE reads): list of the consultation's prescriptions (`GET /api/consultations/{id}/prescriptions`, plain array; items table, created date). "New prescription" opens a builder: 1 to 20 rows with drugName (≤120), dosage (≤60), frequency (≤60), duration (≤60), all required; `POST /api/consultations/{id}/prescriptions { items }` → toast "Sent to the pharmacy". For DOCTOR only, show each prescription's dispensing status from `GET /api/prescriptions/{id}` (badges ISSUED, PARTIALLY_DISPENSED, DISPENSED); if Pharmacy is down show "Pharmacy status unavailable" and nothing else breaks. (Do not call it for NURSE: the gateway forbids it.)
4. **Lab** (DOCTOR orders, NURSE reads): two sections. Orders table (priority badge, tests, status REQUESTED or VALIDATED, date) from `GET /api/consultations/{id}/lab-orders` (array). Results from `GET /api/consultations/{id}/lab-results` (array of `{ labRequestId, results:[{testCode,value,unit,referenceRange,flag}], validatedAt }`) showing each validated result with value, unit, range and `FlagBadge`, newest first, CRITICAL rows highlighted. "New lab order" dialog: priority select (ROUTINE, URGENT) and test multi-select (1 to 10 tests) loaded from `GET /api/tests` (Lab). **If Lab is down the list falls back to a built-in list of the six catalogue tests (HGB Hemoglobin, WBC White blood cells, GLU Fasting glucose, CHOL Total cholesterol, CRE Creatinine, K Potassium) and the dialog says "Lab service is down, the order will be processed when it is back"; the order still goes through** (`POST /api/consultations/{id}/lab-orders { priority, tests:[{code,name}] }`, returns immediately 201 even with Lab down). Success toast "Order sent".

**Create consultation**: from a patient page or an appointment ("Start consultation"): `POST /api/consultations { patientId, appointmentId? }` then open the workspace. (The doctor id comes from the token, never the form.)

**Vital signs page `/vitals`** (NURSE, DOCTOR): patient autocomplete, then the history table (`GET /api/vitals?patientId=&page=&size=`) and the same recording form (consultation optional).

### F5. Lab (service `lab`)

**Lab queue `/lab/requests`** (LAB_TECHNICIAN, DOCTOR, ADMIN): filters status (default REQUESTED, IN_PROGRESS, RESULT_ENTERED), priority, patient. Table in the order the API returns (URGENT first, then oldest): Priority badge (red for URGENT), Patient (name via summary, or id), Tests (codes), Status badge, Requested (relative time, exact time on hover). Auto refresh every 10 seconds plus a Refresh button; row click opens the request. `GET /api/lab-requests?status=&priority=&patientId=&page=&size=`.

**Lab request `/lab/requests/:id`**: header: patient, doctor, priority, requested time, and a status stepper REQUESTED → IN_PROGRESS → RESULT_ENTERED → VALIDATED. LAB_TECHNICIAN actions by status:
- REQUESTED: "Start processing" (`POST /api/lab-requests/{id}/start`).
- IN_PROGRESS or RESULT_ENTERED: a result table with one row per test: Test, Value (number input, required), Unit (read only, from the catalogue `GET /api/tests`), Reference range (read only). "Save results" → `POST /api/lab-requests/{id}/results { results:[{testCode,value,unit?}] }`; afterwards show the computed `FlagBadge` per row (NORMAL, HIGH, LOW, CRITICAL). Entering results again while RESULT_ENTERED replaces the previous values.
- RESULT_ENTERED: "Validate and send to doctor" (confirmation; the dialog lists the CRITICAL values; `POST /api/lab-requests/{id}/validate`). Validated results are immutable.
- VALIDATED: read only, shows `validatedAt`.
DOCTOR and ADMIN see the same page read only. Errors: 409 shows the current status and refreshes the page; 422 maps to the offending row.

**Lab results `/lab/results`**: patient filter and a paged table of validated results (Date, Patient, Test, Value with unit, Range, FlagBadge); row opens the lab request. `GET /api/lab-results?patientId=&page=&size=`.

### F6. Pharmacy (service `pharmacy`)

**Prescription queue `/pharmacy/prescriptions`** (PHARMACIST, DOCTOR, ADMIN): filters status (default ISSUED and PARTIALLY_DISPENSED), patient. Table: Created, Patient (name via summary), Doctor (`GET /api/staff/{id}/public`), Items count, Status badge; row click opens it; auto refresh every 10 s. `GET /api/prescriptions?status=&patientId=&page=&size=`.

**Prescription detail and dispensing `/pharmacy/prescriptions/:id`**: header with patient, doctor, created time, status. Items table: drug name as written by the doctor, dosage, frequency, duration, dispensed icon. For PHARMACIST, a dispensing panel for items not yet dispensed: per item choose the drug (autocomplete over `GET /api/drugs?search=` prefilled with the best name match) and a quantity (integer ≥1), show the chosen drug's current stock and block a quantity above stock with "Not enough stock" (pure function with tests). "Dispense selected items" with confirmation → `POST /api/prescriptions/{id}/dispense { lines:[{itemIndex,drugId,quantity}] }`. On 409 show the server message ("insufficient stock", "already dispensed") and refresh. Below: the dispensing history `GET /api/prescriptions/{id}/dispensings` (array). DOCTOR and ADMIN: read only.

**Drugs and stock `/pharmacy/drugs`, `/pharmacy/stock`**: drug list (search, paged): Name, Form, Strength, Stock, Threshold, and a red "Low stock" badge (icon + text) when stock ≤ threshold. PHARMACIST: "New drug" and "Edit" (form with name ≤120, form TABLET/CAPSULE/SYRUP/INJECTION/CREAM/DROPS/INHALER, strength ≤40, unit ≤30, stock ≥0 (create only; PUT ignores stock), reorder threshold ≥0; 409 on duplicate name + strength) and an "Adjust stock" dialog (`POST /api/drugs/{id}/stock { delta, reason }`; delta non-zero integer, reason 1-200 chars; shows the resulting stock and blocks a result below zero). The stock page lists `GET /api/stock/alerts` (array) with the same adjust action.

### F7. Patient portal (role PATIENT)

Read-only; the gateway and services already restrict to the patient's own data.
- `/my/appointments`: upcoming and past appointments (`GET /api/appointments`, patient forced) with the doctor's name and status.
- `/my/invoices`: invoices with total and status.
- `/my/consultations`: signed consultations (date, doctor, assessment, plan), each with its prescriptions (`/api/consultations/{id}/prescriptions`) and validated lab results (`/api/consultations/{id}/lab-results`); **each section independent so one service being down does not hide the others**.
No patient search, no edit actions.

### F8. Resilience pass

Using `curl -X POST http://localhost:8080/gateway/mock/down/<service>` (patient, reception, consultation, lab, pharmacy, staff), check that for each service **only its own screens/blocks degrade**, the status bar dot and `/status` card turn red within 5 s, and everything recovers after `/up/`. Specific cases to verify and unit test where possible: patient down → appointment form still works with a pasted id and tabs on the patient page degrade individually; lab down → lab order still sent using the built-in test list; pharmacy down → "Pharmacy status unavailable" in the consultation; staff down → profile page falls back to token data; gateway unreachable → banner (already built). Write the results into `docs/FRONTEND-DECISIONS.md`.

## 7. Seed data for the mocks (fixed ids; never invent new ones)

**Patients** `a1a1a1a1-0000-4000-8000-00000000000N` (N=1..8): P1 Youssef Ben Salah 1985-03-14 MALE +21620111001 A+ (allergy Penicillin) · P2 Amira Mejri 1992-07-22 FEMALE O+ · P3 Nizar Khelifi 1978-11-02 MALE B+ · P4 Leila Ben Ammar 2001-01-30 FEMALE AB+ (Latex) · P5 Hatem Dridi 1965-05-18 MALE O- (Aspirin) · P6 Mariem Sassi 1999-09-09 FEMALE A- · P7 Omar Zouari 1988-12-25 MALE B- · P8 Sarra Belhaj 1973-04-04 FEMALE A+ (Sulfa drugs). Insurance CNAM / 10001..10008. Address "Tunis, Tunisia". Emails `firstname.lastname@example.com`.
**Staff** `b2b2b2b2-0000-4000-8000-00000000000N` (N=1..7): S1 Amel Trabelsi DOCTOR Cardiology · S2 Karim Jlassi DOCTOR General practice · S3 Sonia Gharbi NURSE · S4 Walid Mansouri LAB_TECHNICIAN · S5 Ines Chaabane PHARMACIST · S6 Rim Bouazizi RECEPTIONIST · S7 Sami Hamdi ADMIN. Emails `<username>@sgh.local`.
**Appointments** `e5e5e5e5-...-00000000000N`: A1 P1/S1 tomorrow 09:00-09:30 SCHEDULED "Cardiology follow-up" · A2 P2/S2 tomorrow 10:00-10:30 SCHEDULED "General check-up" · A3 P3/S1 today 08:30-09:00 CHECKED_IN "Chest discomfort" · A4 P5/S2 two days ago 11:00-11:30 COMPLETED "Persistent cough" (all patientVerified true; make one extra example with false).
**Invoices** `e6e6e6e6-...-N`: INV1 P5 for A4 PAID CASH, lines "General consultation" 1×50.00 and "Blood tests (HGB, WBC)" 1×30.00, total 80.00 TND · INV2 P3 for A3 PENDING, "Cardiology consultation" 1×70.00, total 70.00.
**Consultations** `f7f7f7f7-...-N`: C1 P5 doctor S2 appointment A4 SIGNED (subjective "Persistent cough for two weeks", objective "Temperature 37.2, lungs clear on auscultation", assessment "Likely viral bronchitis", plan "Rest, fluids, review if no improvement after one week", snapshot Hatem Dridi 1965-05-18) · C2 P3 doctor S1 appointment A3 DRAFT (subjective "Chest discomfort since yesterday", snapshot Nizar Khelifi 1978-11-02).
**Vital signs** `fafafafa-...-N`: V1 P5/C1 by S3 temp 37.2 HR 78 BP 128/82 SpO2 98 weight 82.5 · V2 P3/C2 by S3 temp 36.8 HR 96 BP 145/92 SpO2 97 weight 90.0.
**Prescription R1** `f8f8f8f8-...-01` (C1, P5, S2, ISSUED): "Paracetamol 500 mg" 1 tablet, 3 per day, 5 days · "Cetirizine 10 mg" 1 tablet, 1 per day, 7 days. In Pharmacy: items indexed from 0 with `dispensed:false`.
**Lab requests** `f9f9f9f9-...-N`: L1 C1/P5/S2 ROUTINE VALIDATED tests HGB, WBC, results HGB 14.2 g/dL 12.0-17.0 NORMAL, WBC 12.5 10^9/L 4.0-11.0 HIGH · L2 C2/P3/S1 URGENT REQUESTED tests K (Potassium), CRE (Creatinine).
**Lab catalogue** (code, name, unit, refLow, refHigh, criticalLow, criticalHigh): HGB Hemoglobin g/dL 12.0 17.0 7.0 20.0 · WBC White blood cells 10^9/L 4.0 11.0 2.0 30.0 · GLU Fasting glucose mg/dL 70 100 40 400 · CHOL Total cholesterol mg/dL 0 200 - - · CRE Creatinine mg/dL 0.6 1.3 - 5.0 · K Potassium mmol/L 3.5 5.1 2.5 6.5. Flag rule: below criticalLow or above criticalHigh → CRITICAL; else below refLow → LOW; else above refHigh → HIGH; else NORMAL.
**Drugs** `d4d4d4d4-0000-4000-8000-0000000000NN` (NN=01..10): D01 Paracetamol TABLET 500 mg stock 500 thr 100 · D02 Ibuprofen TABLET 400 mg 300/80 · D03 Amoxicillin CAPSULE 500 mg **55/60 (low stock)** · D04 Omeprazole CAPSULE 20 mg 150/50 · D05 Metformin TABLET 850 mg 400/100 · D06 Amlodipine TABLET 5 mg 250/70 · D07 Atorvastatin TABLET 20 mg 180/60 · D08 Salbutamol INHALER 100 mcg/dose 120/30 · D09 Cetirizine TABLET 10 mg 220/50 · D10 Insulin glargine INJECTION 100 IU/ml 40/20.

## 8. Status badge colours (already implemented)

SCHEDULED blue · CHECKED_IN amber · COMPLETED green · CANCELLED grey · PENDING amber · PAID green · DRAFT amber · SIGNED green · REQUESTED blue · IN_PROGRESS amber · RESULT_ENTERED purple · VALIDATED green · ISSUED blue · PARTIALLY_DISPENSED amber · DISPENSED green · URGENT red · ROUTINE grey. Flags: NORMAL green, HIGH and LOW amber, CRITICAL red with an icon.

## 9. Unit tests required (Vitest, `npm test`)

Form validation helpers (patient form rules, vital-signs validators incl. "diastolic lower than systolic" and "at least one value", invoice line rules, appointment duration 10-120) · name lookup caching (second request for the same id does not hit the API; failure falls back to the short id) · role-based action visibility (who sees which buttons per screen) · the dispense quantity rule · flag badge mapping (exists) · 409/422 handling in at least one form per feature · each feature's top-level page shows ServiceUnavailable when its service is down and still shows other content when only a sub-block's service is down.

## 10. Definition of done (per phase, then overall)

- Every screen above exists with the listed fields, validations, actions and role visibility, in light and dark themes, usable down to tablet width.
- Works against the mock servers; `npm run format:check`, `npm run lint`, `npm test`, `npm run build` all pass and you show their real output.
- Each page degrades only for its own service and recovers by itself.
- No `FeaturePlaceholder` left (delete that component with the last one), no `any`, no unused code.
- `docs/FRONTEND-DECISIONS.md` lists every ambiguous detail you decided, and every place where this brief looked wrong.
- At the end give me: what you built per phase, how to run it, real command output, anything that looked wrong, and what is still untested against a real backend (state plainly that nothing has run against real services or Keycloak).

Start with F2. Read the repo first, summarise your plan in 10 lines, then build. Do not skip the confirmation dialogs, empty/error/unavailable states, or the mock specs: they are part of the work.
