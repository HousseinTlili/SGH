import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { getToken, setupTestDatabase } from "./helpers.js";
import { setDatabaseReady } from "../src/db/pool.js";

describe("SGH Doctor (Consultation) Service Tests", () => {
  let doc1Token: string;
  let doc2Token: string;
  let nurse1Token: string;
  let pharm1Token: string;
  let admin1Token: string;
  let patient1Token: string;

  beforeAll(async () => {
    await setupTestDatabase();
    doc1Token = await getToken("doctor1");
    doc2Token = await getToken("doctor2");
    nurse1Token = await getToken("nurse1");
    pharm1Token = await getToken("pharmacist1");
    admin1Token = await getToken("admin1");
    patient1Token = await getToken("patient1");
  });

  // 1. Health and OpenAPI endpoints (X-6)
  describe("Health & API Docs", () => {
    it("GET /health returns 200 UP without authentication", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "UP" });
    });

    it("GET /openapi.json returns the OpenAPI specification", async () => {
      const res = await request(app).get("/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe("3.0.3");
      expect(res.body.info.title).toContain("Consultation");
    });
  });

  // 2. Stub acceptance ping (D25)
  describe("Stub Acceptance Ping", () => {
    it("GET /api/_stub/ping returns 401 without a token", async () => {
      const res = await request(app).get("/api/_stub/ping");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("GET /api/_stub/ping returns 403 with DOCTOR or NURSE role", async () => {
      const res = await request(app)
        .get("/api/_stub/ping")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("GET /api/_stub/ping returns 200 with ADMIN role", async () => {
      const res = await request(app)
        .get("/api/_stub/ping")
        .set("Authorization", `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        service: "consultation",
        user: "admin1"
      });
    });
  });

  // 3. Authentication & Role checks (CON-10, X-7)
  describe("Auth & Role Validation", () => {
    it("returns 401 on invalid token", async () => {
      const res = await request(app)
        .get("/api/consultations")
        .set("Authorization", "Bearer invalid-token");
      expect(res.status).toBe(401);
      expect(res.body.correlationId).toBeDefined();
    });

    it("PHARMACIST calling GET /api/consultations gets 403 (CON-10)", async () => {
      const res = await request(app)
        .get("/api/consultations")
        .set("Authorization", `Bearer ${pharm1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("NURSE calling POST /api/consultations gets 403 before body validation", async () => {
      const res = await request(app)
        .post("/api/consultations")
        .set("Authorization", `Bearer ${nurse1Token}`)
        .send({}); // Empty body
      expect(res.status).toBe(403);
    });
  });

  // 4. Consultations list & queries (CON-9)
  describe("List & Query Consultations", () => {
    it("DOCTOR can list consultations with paging", async () => {
      const res = await request(app)
        .get("/api/consultations?page=0&size=10")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toBeInstanceOf(Array);
      expect(res.body.page).toBe(0);
      expect(res.body.totalElements).toBeGreaterThanOrEqual(2);
      expect(res.header["x-correlation-id"]).toBeDefined();
    });

    it("can filter consultations by status", async () => {
      const res = await request(app)
        .get("/api/consultations?status=SIGNED")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.content.every((c: any) => c.status === "SIGNED")).toBe(true);
    });

    it("PATIENT is forced to own consultations (CON-9)", async () => {
      // Patient 1 owns no seeded consultations, but if they request another patientId -> 403
      const res = await request(app)
        .get("/api/consultations?patientId=a1a1a1a1-0000-4000-8000-000000000005")
        .set("Authorization", `Bearer ${patient1Token}`);
      expect(res.status).toBe(403);
    });
  });

  // 5. Open a consultation (CON-1, CON-2)
  describe("Open Consultation", () => {
    it("DOCTOR can create a consultation and falls back to snapshot null when Patient service is down (CON-1, CON-2)", async () => {
      const newConsultation = {
        patientId: "a1a1a1a1-0000-4000-8000-000000000001",
        subjective: "Severe headache"
      };

      const res = await request(app)
        .post("/api/consultations")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send(newConsultation);

      expect(res.status).toBe(201);
      expect(res.header["location"]).toContain("/api/consultations/");
      expect(res.body.id).toBeDefined();
      expect(res.body.patientId).toBe(newConsultation.patientId);
      expect(res.body.doctorId).toBe("b2b2b2b2-0000-4000-8000-000000000001");
      expect(res.body.status).toBe("DRAFT");
      // Patient service is not running on 8081, so fallback is null snapshot
      expect(res.body.patientSnapshot).toBeNull();
    });

    it("returns 422 if patientId is missing or invalid", async () => {
      const res = await request(app)
        .post("/api/consultations")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({ subjective: "Missing patientId" });

      expect(res.status).toBe(422);
      expect(res.body.details).toBeDefined();
    });
  });

  // 6. Get single consultation
  describe("Get Single Consultation", () => {
    it("returns 200 with consultation details", async () => {
      const res = await request(app)
        .get("/api/consultations/f7f7f7f7-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("f7f7f7f7-0000-4000-8000-000000000001");
      expect(res.body.patientSnapshot).toEqual({
        fullName: "Hatem Dridi",
        birthDate: "1965-05-18"
      });
      expect(res.body.status).toBe("SIGNED");
    });

    it("returns 404 for unknown consultation ID", async () => {
      const res = await request(app)
        .get("/api/consultations/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(res.status).toBe(404);
    });
  });

  // 7. Update SOAP notes (CON-3, D30)
  describe("Update Consultation", () => {
    it("own doctor can partially update a DRAFT consultation (D30)", async () => {
      // C2 belongs to doctor S1 (doctor1)
      const res = await request(app)
        .put("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({
          objective: "Blood pressure elevated at 145/92",
          assessment: "Stage 1 Hypertension"
        });

      expect(res.status).toBe(200);
      expect(res.body.objective).toBe("Blood pressure elevated at 145/92");
      expect(res.body.assessment).toBe("Stage 1 Hypertension");
      // Original subjective preserved
      expect(res.body.subjective).toBe("Chest discomfort since yesterday");
    });

    it("different doctor cannot edit consultation (403)", async () => {
      // C2 belongs to doctor S1, doctor2 attempts update
      const res = await request(app)
        .put("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002")
        .set("Authorization", `Bearer ${doc2Token}`)
        .send({ assessment: "Attempted edit" });

      expect(res.status).toBe(403);
    });

    it("editing already SIGNED consultation returns 409 Conflict (CON-3)", async () => {
      // C1 is SIGNED, doctor S2 (doctor2) attempts update
      const res = await request(app)
        .put("/api/consultations/f7f7f7f7-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${doc2Token}`)
        .send({ assessment: "Update attempt" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });
  });

  // 8. Sign consultation (CON-4)
  describe("Sign Consultation", () => {
    it("signing SIGNED consultation returns 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000001/sign")
        .set("Authorization", `Bearer ${doc2Token}`);

      expect(res.status).toBe(409);
    });

    it("signing draft with missing plan returns 422 (CON-4)", async () => {
      // C2 has no plan set yet
      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/sign")
        .set("Authorization", `Bearer ${doc1Token}`);

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "plan", problem: "must not be blank" })
        ])
      );
    });

    it("own doctor signs consultation when assessment & plan are populated", async () => {
      // Add plan first
      await request(app)
        .put("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({ plan: "Low sodium diet, cardiology review in 2 weeks" });

      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/sign")
        .set("Authorization", `Bearer ${doc1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("SIGNED");
      expect(res.body.signedAt).toBeDefined();
    });
  });

  // 9. Vital signs (CON-8)
  describe("Vital Signs", () => {
    it("records vital signs and checks diastolic lower than systolic (CON-8)", async () => {
      const vitals = {
        patientId: "a1a1a1a1-0000-4000-8000-000000000001",
        temperature: 37.0,
        heartRate: 72,
        systolic: 120,
        diastolic: 80,
        spo2: 99
      };

      const res = await request(app)
        .post("/api/vitals")
        .set("Authorization", `Bearer ${nurse1Token}`)
        .send(vitals);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.recordedBy).toBe("b2b2b2b2-0000-4000-8000-000000000003");
      expect(res.body.temperature).toBe(37.0);
    });

    it("returns 422 if diastolic >= systolic", async () => {
      const res = await request(app)
        .post("/api/vitals")
        .set("Authorization", `Bearer ${nurse1Token}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          systolic: 110,
          diastolic: 120
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "diastolic", problem: "must be lower than systolic" })
        ])
      );
    });

    it("returns 422 if no measurement fields are provided", async () => {
      const res = await request(app)
        .post("/api/vitals")
        .set("Authorization", `Bearer ${nurse1Token}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001"
        });

      expect(res.status).toBe(422);
    });
  });

  // 10. Prescriptions (CON-5, CON-10)
  describe("Prescriptions", () => {
    it("DOCTOR can issue prescription and PHARMACIST can view prescriptions (CON-5, CON-10)", async () => {
      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/prescriptions")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({
          items: [
            {
              drugName: "Amlodipine 5 mg",
              dosage: "1 tablet",
              frequency: "1 per day",
              duration: "30 days"
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe("ISSUED");
      expect(res.body.items).toHaveLength(1);

      // PHARMACIST can view prescriptions
      const listRes = await request(app)
        .get("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/prescriptions")
        .set("Authorization", `Bearer ${pharm1Token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body).toBeInstanceOf(Array);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // 11. Lab orders & results (CON-6, CON-7)
  describe("Lab Orders & Results", () => {
    it("DOCTOR orders lab tests with unique test codes (CON-6)", async () => {
      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/lab-orders")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({
          priority: "ROUTINE",
          tests: [
            { code: "GLU", name: "Fasting glucose" },
            { code: "CHOL", name: "Total cholesterol" }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe("REQUESTED");
      expect(res.body.tests).toHaveLength(2);
    });

    it("returns 422 if lab order contains duplicate test codes", async () => {
      const res = await request(app)
        .post("/api/consultations/f7f7f7f7-0000-4000-8000-000000000002/lab-orders")
        .set("Authorization", `Bearer ${doc1Token}`)
        .send({
          priority: "ROUTINE",
          tests: [
            { code: "GLU", name: "Glucose test 1" },
            { code: "GLU", name: "Glucose test 2" }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "tests", problem: "Test codes must be unique" })
        ])
      );
    });

    it("retrieves validated lab results for consultation (CON-7)", async () => {
      const res = await request(app)
        .get("/api/consultations/f7f7f7f7-0000-4000-8000-000000000001/lab-results")
        .set("Authorization", `Bearer ${doc1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ testCode: "HGB", flag: "NORMAL" }),
          expect.objectContaining({ testCode: "WBC", flag: "HIGH" })
        ])
      );
    });
  });

  // 12. Resilience check: Rule X-8
  describe("Rule X-8: Database Unavailable Behavior", () => {
    it("returns 503 for data endpoints when database is not ready, but health stays 200", async () => {
      setDatabaseReady(false);

      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe("UP");

      const dataRes = await request(app)
        .get("/api/consultations")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(dataRes.status).toBe(503);
      expect(dataRes.body.message).toBe("Database unavailable");

      // Restore ready state
      setDatabaseReady(true);
      const restoredRes = await request(app)
        .get("/api/consultations")
        .set("Authorization", `Bearer ${doc1Token}`);
      expect(restoredRes.status).toBe(200);
    });
  });
});
