# Front-end decisions

Choices made while building `frontend/` where the Notion specification was ambiguous or silent, plus things in the spec that looked wrong. Simplest reading wins; anything that would be hard to undo is not recorded here but asked about.
Notion is read-only for the front-end work: spec changes are listed in section 3 for the project lead to apply.

Spec pages read before F0/F1 (last-edited times unchanged since `docs/PLAN.md`): Angular - Architecture and Shared Code (2026-10-06 14:47:34Z), Angular - Screens A (14:53:45Z), Angular - Screens B (14:47:34Z), Angular - Mock API (14:47:34Z), Decisions Log D9 to D20 (14:51:05Z).

## 1. Phase map (user's F-phases against `docs/PLAN.md`)

| Phase | Content | Plan phase |
|-------|---------|------------|
| F0 | Scaffold, tooling, Prism mock scripts, models, auth interfaces, interceptors, guards, shell, status bar, 403/404 | P6 (mocks) + P10 (shell) |
| F1 | Shared components, `/status`, `/profile` | P10 |
| F2 | Patients and Reception | P11 (1, 2) |
| F3 | Staff admin | P11 (6) |
| F4 | Consultation workspace and `/vitals` | P11 (3) |
| F5 | Lab | P11 (4) |
| F6 | Pharmacy | P11 (5) |
| F7 | Patient portal | P11 (7) |
| F8 | Resilience pass | P12 / P14 (UI part) |

The order differs from the plan only in that Staff (F3) comes before Consultation; the user's order is followed. Real Keycloak login (the plan's "real login early check" at the end of P10) is deferred with the backend phases.

## 2. Decisions

| # | Decision | Why |
|---|----------|-----|
| F-1 | Angular **22.2.1** (npm `latest` on 2026-10-06), zoneless, standalone, strict TypeScript, Vitest runner (the CLI default). Needs Node ^22.22.3 or ^24.15 (machine has 24.19). | Spec says "current stable Angular". |
| F-2 | `ng new --file-name-style-guide 2016` | The spec names files `auth.service.ts`, `shell.component.ts`, `app.routes.ts`; the 2025 style would drop the type from the names. |
| F-3 | Mock OpenAPI files live in `tools/mock/specs/` (not `contracts/openapi/`). `MOCK_SPEC_DIR` switches the folder. | The contracts phase (plan P4) is not part of this work. The Mock API page expects `contracts/openapi/*.yaml`; when those exist, set `MOCK_SPEC_DIR=contracts/openapi` or move the files. The specs grow with each feature phase (F2 adds patients, reception, ...). |
| F-4 | Auth is `AuthService` (signals) over an `AuthBackend` interface. `MockAuthBackend` is used in mock mode, `PendingKeycloakBackend` otherwise (nobody signed in, `/login` explains how to run the mock). `keycloak-js` is **not** installed yet. | "Real Keycloak login comes later behind the same interface", and no unused code. |
| F-5 | Mock sign-in lists the **eight** seeded users (two doctors), token is always `mock-token`, the choice is kept in `sessionStorage` per tab. | Mock API page (eight users) vs Architecture (seven roles plus a user choice): the eight users cover both. |
| F-6 | In mock mode `GET /api/me` carries `Prefer: example=<username>` so Prism returns that user's profile (one named example per user in `tools/mock/specs/staff.yaml`). Mock-only interceptor. | The token is the same for everyone, so Prism could not tell users apart otherwise. |
| F-7 | Interceptor order: auth, (mock), error. `/gateway/...` calls get no token and never raise snackbars. 503 without a `service` name, and any 5xx, show a generic snackbar. 401: one silent refresh, one retry; a second 401 or a failed refresh goes to sign-in. | Spec lists 503-with-service, 401, 403, 409, 422 and network errors only; the rest needed a rule. The status poll fails every 5 s when the gateway is down, so it must be silent. |
| F-8 | `*appServiceGate="'lab'"` structural directive wraps the top level of a feature page. While the service is DOWN the content is **not created** (no requests) and the ServiceUnavailable panel shows; it switches back by itself when the poll says UP. | `ng-content` inside `@if` would still instantiate the page and call the service. Spec: "recover automatically". |
| F-9 | Route guards follow the Architecture routing table exactly (including `/patients/new` and `/patients/:id/edit` for RECEPTIONIST, DOCTOR, NURSE, ADMIN). The form screens will add the stricter role check from Screens A (RECEPTIONIST only) in F2. | See finding S-1. |
| F-10 | Menu: Profile and Logout are in the toolbar user menu (Screens A), not the sidenav. ADMIN "Lab" goes to `/lab/requests`, ADMIN "Pharmacy" to `/pharmacy/prescriptions`, DOCTOR "Prescriptions status" to `/pharmacy/prescriptions`. A user with several roles gets the merged menu and the landing page of the first role in `ADMIN, DOCTOR, RECEPTIONIST, NURSE, LAB_TECHNICIAN, PHARMACIST, PATIENT`. | The pages give labels, not targets, and no multi-role rule. |
| F-11 | Routes of features that are not built yet render `FeaturePlaceholder` (title, service, "not built yet"), already wrapped in the service gate. Each feature phase replaces its placeholders. | Lets every role, guard and the degraded-service behaviour be tested in F0/F1. |
| F-12 | Design tokens are all in `src/styles/_tokens.scss` (light and dark, brand blue, six meaning tones, focus ring, spacing, radii, type). Material's azure palette (not the default violet) is bridged to the tokens, so a retheme is one file. Dark theme: `data-theme` on `<html>`, saved in `localStorage`, defaults to the system preference. | Brief: calm, white and blue, colour only for meaning, visible focus ring, dark theme through CSS variables. |
| F-13 | Icons use the self-hosted `material-icons` package, system font stack, no CDN. | The app must work offline on a hospital LAN. |
| F-14 | Status bar dots: filled green UP, red with an X for DOWN, hollow grey UNKNOWN, each with a tooltip and hidden text. A "Cannot reach the gateway" banner appears when the poll fails. | "Colour never the only signal"; the banner is an addition because the spec says the gateway is marked down on a failed poll but shows nothing for it. |
| F-15 | Environments: `environment.base.ts` holds shared values; `environment.ts` and `environment.mock.ts` add `mockAuth`. | `environment.mock.ts` importing `./environment` loops back on itself once Angular replaces one by the other (build error TS7022, found by running the mock build). |
| F-16 | `LabFlag` is declared in `core/models/consultation.ts`, where the Architecture page declares it; `lab.ts` imports from there. | Avoids a circular type import. |
| F-17 | The mock gateway reports a service DOWN by calling its `/health` (like the real one) with a 2 s cache, so a stopped Prism shows as DOWN up to about 2 s late; the manual `down/{service}` switch is immediate. | Gateway Config: 1 s timeout, 2 s cache. See also plan finding B15. |
| F-18 | Mock fake user `patient1` is named "Youssef Ben Salah" (Patient P1). | Seed Data gives no name for the user (plan finding B12). |

## 3. Spec findings (for the project lead to decide; nothing was changed in Notion)

- **S-1 Route roles vs screen roles.** Architecture routing table allows RECEPTIONIST, DOCTOR, NURSE, ADMIN on `/patients/new` and `/patients/:id/edit`, and RECEPTIONIST, DOCTOR, ADMIN on `/appointments/new`; Screens A says both forms are RECEPTIONIST only. Followed the table for the guards, and F2 will refuse the form for other roles. Cleaner fix: split the rows in the table.
- **S-2 Nurse and pharmacy status.** Screens B (consultation Prescriptions tab) says NURSE sees the dispensing badge from `GET /api/prescriptions/{id}`, but the gateway rule for `/api/prescriptions/**` is PHARMACIST, DOCTOR, ADMIN, so a nurse gets 403 and the error interceptor would show "You are not allowed to do this". F4 will request it for DOCTOR only unless told otherwise. (Plan finding B17.)
- **S-3 Lab results path.** Screens B says "Results section from `GET /lab-results`" without the path; it must be `/api/consultations/{id}/lab-results`.
- **S-4 Banner promise.** Screens B shows "They will appear when the Patient service is back" for a null `patientSnapshot`, but no backend rule fills it in (plan finding M9). F4 will word the banner "Patient details are unavailable" unless told otherwise.
- **S-5 Mock API location.** See F-3. The page also lists `npm run start:mock` in `frontend/` and `npm run mock` at the root: both exist.
- **S-6 Test runner wording.** Architecture says "Angular's default unit test runner": that is Vitest in Angular 22, which is what is used (`npm test` runs `ng test --watch=false`).
- **S-7 Environment file.** The page shows one `environment.ts` with every field. The mock environment cannot import it after file replacement (F-15), so a base file was added.

## 4. Known limits right now

- No real Keycloak login yet (F-4); `npm start` shows a sign-in page that points to `npm run start:mock`.
- Only `/health`, the gateway status and `/api/me` are mocked so far; feature phases add the rest.
- Prism answers with static examples: a created record never shows up in a later list (stated on the Mock API page).
- The full flow with real services (including Keycloak and the real gateway) has not been run; nothing in this front end has been exercised against a real backend.
