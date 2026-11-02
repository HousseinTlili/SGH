# Reception service (port 8082, stack Express 5 (TypeScript))

Scope: this folder only. Do not edit other folders.

Read before coding (docs/spec/ or Notion): Reception Service - API Spec, Domain Model and Business Rules (this service's section and the cross-cutting rules X-1 to X-8), Seed Data and Fixtures (this service's rows), API Contracts and Conventions, Event Catalogue, Stack Templates, Resilience Demo (this service's row), Decisions Log.

Run:  npm install && npm run start:dev
Test: npm test
Docs: http://localhost:8082/docs

Order of work: 1 models and migrations, seed check; 2 read endpoints; 3 write endpoints with the business rules; 4 events (publish and consume); 5 outgoing calls with fallbacks; 6 the tests listed in the API Spec; 7 README.
After each step run the tests and show the output.

If the contract looks wrong or unclear, stop and tell the human. Do not change behaviour silently.
