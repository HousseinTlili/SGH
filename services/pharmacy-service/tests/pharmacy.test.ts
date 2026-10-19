import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { app } from "../src/app.js";
import { pool, setDatabaseReady } from "../src/db/pool.js";
import { getToken, setupTestDatabase } from "./helpers.js";

describe("SGH Pharmacy Service Tests", () => {
  let adminToken: string;
  let pharmToken: string;
  let docToken: string;
  let nurseToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = await getToken("admin1");
    pharmToken = await getToken("pharmacist1");
    docToken = await getToken("doctor1");
    nurseToken = await getToken("nurse1");
  });

  // Group 1: Health & API Docs
  describe("Group 1: Health & API Docs", () => {
    it("GET /health returns 200 UP without authentication", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "UP" });
    });

    it("GET /openapi.json returns the OpenAPI specification", async () => {
      const res = await request(app).get("/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe("3.0.3");
      expect(res.body.info.title).toContain("Pharmacy");
    });
  });

  // Group 3: Auth & Role Validation
  describe("Group 3: Auth & Role Validation", () => {
    it("returns 401 on invalid token", async () => {
      const res = await request(app)
        .get("/api/drugs")
        .set("Authorization", "Bearer invalid-token");
      expect(res.status).toBe(401);
      expect(res.body.correlationId).toBeDefined();
    });

    it("DOCTOR calling POST /api/drugs gets 403", async () => {
      const res = await request(app)
        .post("/api/drugs")
        .set("Authorization", `Bearer ${docToken}`)
        .send({
          name: "Test Drug",
          form: "TABLET",
          strength: "10 mg",
          unit: "tablet",
          stock: 10,
          reorderThreshold: 5
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("NURSE calling POST /api/drugs gets 403 before body validation", async () => {
      const res = await request(app)
        .post("/api/drugs")
        .set("Authorization", `Bearer ${nurseToken}`)
        .send({}); // invalid empty body
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("DOCTOR calling POST /api/prescriptions/:id/dispense gets 403", async () => {
      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${docToken}`)
        .send({ lines: [{ itemIndex: 0, drugId: "d4d4d4d4-0000-4000-8000-000000000001", quantity: 5 }] });
      expect(res.status).toBe(403);
    });
  });

  // Group 4: Drug Catalog & Search (PHA-1)
  describe("Group 4: Drug Catalog & Search (PHA-1)", () => {
    it("lists seeded drugs with default paging", async () => {
      const res = await request(app)
        .get("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalElements).toBe(10);
      expect(res.body.content.length).toBe(10);
      expect(res.body.content[0]).toHaveProperty("name");
      expect(res.body.content[0]).toHaveProperty("stock");
      expect(res.body.content[0]).toHaveProperty("reorderThreshold");
    });

    it("case-insensitive search by name", async () => {
      const res = await request(app)
        .get("/api/drugs?search=amox")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalElements).toBe(1);
      expect(res.body.content[0].name).toBe("Amoxicillin");
      expect(res.body.content[0].stock).toBe(55);
    });

    it("handles page and size pagination", async () => {
      const res = await request(app)
        .get("/api/drugs?page=0&size=4")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.content.length).toBe(4);
      expect(res.body.totalPages).toBe(3);
    });
  });

  // Group 5: Drug Creation & Duplicate Detection (PHA-2)
  describe("Group 5: Drug Creation & Duplicate Detection (PHA-2)", () => {
    it("PHARMACIST creates a new drug (201 with Location header)", async () => {
      const res = await request(app)
        .post("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          name: "Aspirin",
          form: "TABLET",
          strength: "100 mg",
          unit: "tablet",
          stock: 200,
          reorderThreshold: 50
        });
      expect(res.status).toBe(201);
      expect(res.headers.location).toMatch(/^\/api\/drugs\/[a-f0-9-]+$/);
      expect(res.body.name).toBe("Aspirin");
      expect(res.body.stock).toBe(200);
    });

    it("duplicate name plus strength returns 409 (case-insensitive)", async () => {
      const res = await request(app)
        .post("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          name: "aspirin",
          form: "TABLET",
          strength: "100 MG",
          unit: "tablet",
          stock: 50,
          reorderThreshold: 10
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });

    it("validation failure on invalid form returns 422", async () => {
      const res = await request(app)
        .post("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          name: "Valid Name",
          form: "LIQUID", // invalid form
          strength: "10 mg",
          unit: "ml",
          stock: 10,
          reorderThreshold: 5
        });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("Unprocessable Entity");
      expect(res.body.details).toBeDefined();
    });
  });

  // Group 6: Drug Update & Stock Endpoint (PHA-2, PHA-3)
  describe("Group 6: Drug Update & Stock Endpoint (PHA-2, PHA-3)", () => {
    it("PUT /api/drugs/:id ignores stock value in request body", async () => {
      // D01 Paracetamol has stock 500
      const res = await request(app)
        .put("/api/drugs/d4d4d4d4-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          name: "Paracetamol",
          form: "TABLET",
          strength: "500 mg",
          unit: "tablet",
          stock: 9999, // Should be ignored
          reorderThreshold: 120
        });
      expect(res.status).toBe(200);
      expect(res.body.reorderThreshold).toBe(120);
      expect(res.body.stock).toBe(500); // Stock unchanged!
    });

    it("PUT /api/drugs/:id returns 404 for unknown drug", async () => {
      const res = await request(app)
        .put(`/api/drugs/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          name: "Unknown",
          form: "TABLET",
          strength: "50 mg",
          unit: "tablet",
          stock: 10,
          reorderThreshold: 5
        });
      expect(res.status).toBe(404);
    });

    it("POST /api/drugs/:id/stock adjusts stock with signed delta", async () => {
      // D01 Paracetamol stock is 500, subtract 20
      const res = await request(app)
        .post("/api/drugs/d4d4d4d4-0000-4000-8000-000000000001/stock")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          delta: -20,
          reason: "Damaged packaging"
        });
      expect(res.status).toBe(200);
      expect(res.body.stock).toBe(480);
    });

    it("POST /api/drugs/:id/stock returns 409 if resulting stock would be below zero", async () => {
      // D01 Paracetamol stock is 480, try to subtract 1000
      const res = await request(app)
        .post("/api/drugs/d4d4d4d4-0000-4000-8000-000000000001/stock")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          delta: -1000,
          reason: "Too many units removed"
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");

      // Verify stock was not changed
      const checkRes = await request(app)
        .get("/api/drugs?search=Paracetamol")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(checkRes.body.content[0].stock).toBe(480);
    });

    it("POST /api/drugs/:id/stock with delta 0 returns 422", async () => {
      const res = await request(app)
        .post("/api/drugs/d4d4d4d4-0000-4000-8000-000000000001/stock")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          delta: 0,
          reason: "Zero delta"
        });
      expect(res.status).toBe(422);
    });
  });

  // Group 7: Stock Alerts (PHA-8)
  describe("Group 7: Stock Alerts (PHA-8)", () => {
    it("returns plain array of drugs with stock <= reorderThreshold", async () => {
      const res = await request(app)
        .get("/api/stock/alerts")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Amoxicillin has stock 55 <= threshold 60
      const amox = res.body.find((d: any) => d.name === "Amoxicillin");
      expect(amox).toBeDefined();
      expect(amox.stock).toBe(55);
      expect(amox.reorderThreshold).toBe(60);
    });

    it("adding a stock reduction causes that drug to appear in alerts", async () => {
      // D02 Ibuprofen: stock 300, threshold 80. Adjust by -230 -> stock 70 <= 80
      await request(app)
        .post("/api/drugs/d4d4d4d4-0000-4000-8000-000000000002/stock")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({ delta: -230, reason: "Bulk usage" });

      const res = await request(app)
        .get("/api/stock/alerts")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      const ibup = res.body.find((d: any) => d.name === "Ibuprofen");
      expect(ibup).toBeDefined();
      expect(ibup.stock).toBe(70);
    });
  });

  // Group 8: Prescription Queue & Detail (PHA-1, D31)
  describe("Group 8: Prescription Queue & Detail (PHA-1, D31)", () => {
    it("lists prescriptions with status and patient info", async () => {
      const res = await request(app)
        .get("/api/prescriptions")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalElements).toBeGreaterThanOrEqual(1);
      const r1 = res.body.content.find(
        (rx: any) => rx.id === "f8f8f8f8-0000-4000-8000-000000000001"
      );
      expect(r1).toBeDefined();
      expect(r1.status).toBe("ISSUED");
      expect(r1.items.length).toBe(2);
      expect(r1.items[0].drugName).toBe("Paracetamol 500 mg");
      expect(r1.items[0].dispensed).toBe(false);
    });

    it("filters prescriptions using comma-separated status list (D31)", async () => {
      const res = await request(app)
        .get("/api/prescriptions?status=ISSUED,PARTIALLY_DISPENSED")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.content.every((rx: any) =>
          ["ISSUED", "PARTIALLY_DISPENSED"].includes(rx.status)
        )
      ).toBe(true);
    });

    it("GET /api/prescriptions/:id returns full prescription details", async () => {
      const res = await request(app)
        .get("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("f8f8f8f8-0000-4000-8000-000000000001");
      expect(res.body.items.length).toBe(2);
    });

    it("GET /api/prescriptions/:id returns 404 for unknown id", async () => {
      const res = await request(app)
        .get(`/api/prescriptions/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(404);
    });
  });

  // Group 9: Dispensing & Stock Decrement (PHA-4, PHA-5, PHA-6, PHA-7)
  describe("Group 9: Dispensing & Stock Decrement (PHA-4 to PHA-7)", () => {
    it("dispenses item 0, decrements stock, updates status to PARTIALLY_DISPENSED", async () => {
      // Check current Paracetamol stock (should be 480 after earlier tests)
      const drugBefore = await request(app)
        .get("/api/drugs?search=Paracetamol")
        .set("Authorization", `Bearer ${pharmToken}`);
      const stockBefore = drugBefore.body.content[0].stock;

      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          lines: [
            {
              itemIndex: 0,
              drugId: "d4d4d4d4-0000-4000-8000-000000000001",
              quantity: 15
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PARTIALLY_DISPENSED");
      expect(res.body.items[0].dispensed).toBe(true);
      expect(res.body.items[1].dispensed).toBe(false);

      // Verify drug stock was decremented by 15
      const drugAfter = await request(app)
        .get("/api/drugs?search=Paracetamol")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(drugAfter.body.content[0].stock).toBe(stockBefore - 15);
    });

    it("dispensing an already dispensed item returns 409", async () => {
      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          lines: [
            {
              itemIndex: 0, // already dispensed!
              drugId: "d4d4d4d4-0000-4000-8000-000000000001",
              quantity: 15
            }
          ]
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });

    it("dispensing with invalid itemIndex returns 422", async () => {
      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          lines: [
            {
              itemIndex: 99, // non-existent index
              drugId: "d4d4d4d4-0000-4000-8000-000000000001",
              quantity: 5
            }
          ]
        });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("Unprocessable Entity");
    });

    it("GET /api/prescriptions/:id/dispensings returns dispensing history", async () => {
      const res = await request(app)
        .get("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispensings")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].lines[0].itemIndex).toBe(0);
      expect(res.body[0].lines[0].quantity).toBe(15);
    });

    it("dispensing remaining item index 1 updates prescription status to DISPENSED", async () => {
      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          lines: [
            {
              itemIndex: 1,
              drugId: "d4d4d4d4-0000-4000-8000-000000000009", // Cetirizine 10 mg
              quantity: 7
            }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DISPENSED");
      expect(res.body.items[0].dispensed).toBe(true);
      expect(res.body.items[1].dispensed).toBe(true);
    });

    it("attempting to dispense on a fully DISPENSED prescription returns 409", async () => {
      const res = await request(app)
        .post("/api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense")
        .set("Authorization", `Bearer ${pharmToken}`)
        .send({
          lines: [
            {
              itemIndex: 0,
              drugId: "d4d4d4d4-0000-4000-8000-000000000001",
              quantity: 1
            }
          ]
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });
  });

  // Group 10: Concurrency, Row Locking & Resilience
  describe("Group 10: Concurrency & Resilience", () => {
    it("two parallel dispenses competing for last units: one succeeds, one gets 409 insufficient stock", async () => {
      const client = await pool.connect();
      const testDrugId = crypto.randomUUID();
      const testRxId1 = crypto.randomUUID();
      const testRxId2 = crypto.randomUUID();

      try {
        // Create drug with exactly 10 units in stock
        await client.query(
          `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold)
           VALUES ($1, 'Limited Drug', 'TABLET', '10 mg', 'tablet', 10, 5)`,
          [testDrugId]
        );

        // Create two prescriptions each with 1 item needing 10 units
        for (const rxId of [testRxId1, testRxId2]) {
          await client.query(
            `INSERT INTO prescription_copies (id, consultation_id, patient_id, doctor_id, status)
             VALUES ($1, $2, 'a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000001', 'ISSUED')`,
            [rxId, crypto.randomUUID()]
          );
          await client.query(
            `INSERT INTO prescription_items (id, prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed)
             VALUES ($1, $2, 0, 'Limited Drug 10 mg', '1 tablet', '1 per day', '10 days', false)`,
            [crypto.randomUUID(), rxId]
          );
        }
      } finally {
        client.release();
      }

      // Launch both dispenses concurrently, each requesting 10 units
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/prescriptions/${testRxId1}/dispense`)
          .set("Authorization", `Bearer ${pharmToken}`)
          .send({ lines: [{ itemIndex: 0, drugId: testDrugId, quantity: 10 }] }),
        request(app)
          .post(`/api/prescriptions/${testRxId2}/dispense`)
          .set("Authorization", `Bearer ${pharmToken}`)
          .send({ lines: [{ itemIndex: 0, drugId: testDrugId, quantity: 10 }] })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify stock is now exactly 0 (not negative)
      const drugCheck = await request(app)
        .get("/api/drugs?search=Limited Drug")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(drugCheck.body.content[0].stock).toBe(0);
    });

    it("Resilience X-8: when database is not ready, /health is 200 UP and data endpoints return 503", async () => {
      setDatabaseReady(false);

      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);
      expect(healthRes.body).toEqual({ status: "UP" });

      const dataRes = await request(app)
        .get("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(dataRes.status).toBe(503);
      expect(dataRes.body.error).toBe("Service Unavailable");
      expect(dataRes.body.message).toBe("Database unavailable");

      // Restore database readiness
      setDatabaseReady(true);

      const recoveredRes = await request(app)
        .get("/api/drugs")
        .set("Authorization", `Bearer ${pharmToken}`);
      expect(recoveredRes.status).toBe(200);
    });
  });
});
