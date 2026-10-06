# SGH front end

Angular 22 app (standalone components, zoneless, strict TypeScript, Angular Material, Vitest). It talks only to the API gateway at `http://localhost:8080`.

## Run it

Everything below runs from this folder (`frontend/`). Needs Node 22.22+ or 24.15+.

```
npm install
npm --prefix ../tools/mock install      # once, installs Prism and the mock gateway
npm run start:mock                      # mock backend + app on http://localhost:4200
```

`start:mock` starts the mock backend (gateway on 8080, Prism on 8081 to 8086) and `ng serve` with the mock environment. Open http://localhost:4200 and pick a user: each of the seven roles has its own menu and start page.

Simulate a stopped service without stopping anything:

```
curl -X POST http://localhost:8080/gateway/mock/down/lab     # only the Lab screens degrade
curl -X POST http://localhost:8080/gateway/mock/up/lab
```

`npm start` runs against the real gateway. Real Keycloak sign-in is not connected yet, so it only shows a page that points to `npm run start:mock`.

## Checks

```
npm test            # unit tests, single run
npm run lint
npm run format:check
npm run build
```

## Where things are

| Path | What |
|------|------|
| `src/styles/_tokens.scss` | Every colour, space and type token (light and dark). Retheme here. |
| `src/app/core/` | models, auth, http interceptors, service status, theme |
| `src/app/shared/` | reusable components, pipes, util |
| `src/app/layout/` | shell, menu by role, login, profile, status, 403 and 404 pages |
| `src/app/features/` | one folder per service, lazy routes (screens arrive phase by phase) |
| `src/environments/` | `environment.ts` (real) and `environment.mock.ts` (mock) |

Decisions and spec questions: `../docs/FRONTEND-DECISIONS.md`.
