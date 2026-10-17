import jwt


def token(roles=("PHARMACIST",), staff_id="pharmacist-1"):
    return jwt.encode(
        {
            "iss": "test-issuer",
            "sub": staff_id,
            "staffId": staff_id,
            "realm_access": {"roles": list(roles)},
        },
        "test-secret",
        algorithm="HS256",
    )


def headers(roles=("PHARMACIST",)):
    return {"Authorization": f"Bearer {token(roles)}"}


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json == {"status": "UP"}


def test_missing_token_is_rejected(client):
    assert client.get("/api/drugs").status_code == 401


def test_wrong_role_cannot_dispense(client):
    response = client.post(
        "/api/prescriptions/prescription-1/dispense",
        json={"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 1}]},
        headers=headers(("DOCTOR",)),
    )
    assert response.status_code == 403


def test_dispense_decrements_stock_and_marks_prescription(client, app):
    response = client.post(
        "/api/prescriptions/prescription-1/dispense",
        json={"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 2}]},
        headers=headers(),
    )
    assert response.status_code == 201
    assert response.json["prescription"]["status"] == "DISPENSED"
    with app.app_context():
        from pharmacy.extensions import db
        from pharmacy.models import Drug

        assert db.session.get(Drug, "drug-1").stock == 8


def test_insufficient_stock_changes_nothing(client, app):
    response = client.post(
        "/api/prescriptions/prescription-1/dispense",
        json={"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 11}]},
        headers=headers(),
    )
    assert response.status_code == 409
    with app.app_context():
        from pharmacy.extensions import db
        from pharmacy.models import Drug, PrescriptionCopy

        assert db.session.get(Drug, "drug-1").stock == 10
        assert db.session.get(PrescriptionCopy, "copy-1").status == "ISSUED"


def test_cannot_dispense_fully_dispensed_twice(client):
    payload = {"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 1}]}
    assert client.post(
        "/api/prescriptions/prescription-1/dispense", json=payload, headers=headers()
    ).status_code == 201
    response = client.post(
        "/api/prescriptions/prescription-1/dispense", json=payload, headers=headers()
    )
    assert response.status_code == 409


def test_stock_alerts_include_drugs_at_threshold(client, app):
    with app.app_context():
        from pharmacy.extensions import db
        from pharmacy.models import Drug

        drug = db.session.get(Drug, "drug-1")
        drug.stock = 3
        db.session.commit()
    response = client.get("/api/stock/alerts", headers=headers(("DOCTOR",)))
    assert response.status_code == 200
    assert response.json[0]["id"] == "drug-1"


def test_partial_dispensing_does_not_allow_same_item_twice(client, app):
    from pharmacy.extensions import db
    from pharmacy.models import PrescriptionCopy, PrescriptionItem

    with app.app_context():
        prescription = PrescriptionCopy(
            id="copy-2",
            prescription_id="prescription-2",
            consultation_id="consultation-2",
            patient_id="patient-2",
            doctor_id="doctor-2",
        )
        prescription.items = [
            PrescriptionItem(
                item_index=0,
                drug_name="Paracetamol",
                dosage="1000mg",
                frequency="Once daily",
                duration="5 days",
            ),
            PrescriptionItem(
                item_index=1,
                drug_name="Paracetamol",
                dosage="1000mg",
                frequency="Once daily",
                duration="5 days",
            ),
        ]
        db.session.add(prescription)
        db.session.commit()

    line = {"itemIndex": 0, "drugId": "drug-1", "quantity": 1}
    assert client.post(
        "/api/prescriptions/prescription-2/dispense", json={"items": [line]}, headers=headers()
    ).status_code == 201
    response = client.post(
        "/api/prescriptions/prescription-2/dispense", json={"items": [line]}, headers=headers()
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.get(PrescriptionCopy, "copy-2").status == "PARTIALLY_DISPENSED"


def test_cancelled_prescription_cannot_be_dispensed(client, app):
    from pharmacy.extensions import db
    from pharmacy.models import PrescriptionCopy

    with app.app_context():
        prescription = db.session.get(PrescriptionCopy, "copy-1")
        prescription.status = "CANCELLED"
        db.session.commit()
    response = client.post(
        "/api/prescriptions/prescription-1/dispense",
        json={"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 1}]},
        headers=headers(),
    )
    assert response.status_code == 409


def test_drug_payload_rejects_boolean_stock(client):
    response = client.post(
        "/api/drugs",
        json={
            "name": "Invalid",
            "form": "Tablet",
            "strength": "1mg",
            "unit": "tablet",
            "stock": True,
            "reorderThreshold": 1,
        },
        headers=headers(),
    )
    assert response.status_code == 422


def test_duplicate_prescription_event_is_idempotent(app):
    from pharmacy.extensions import db
    from pharmacy.models import PrescriptionCopy
    from pharmacy.services import upsert_prescription_copy

    payload = {
        "prescriptionId": "event-prescription-1",
        "consultationId": "consultation-2",
        "patientId": "patient-2",
        "doctorId": "doctor-2",
        "items": [
            {
                "drugName": "Omeprazole",
                "dosage": "20mg",
                "frequency": "Once daily",
                "duration": "14 days",
            }
        ],
    }
    with app.app_context():
        upsert_prescription_copy(payload)
        upsert_prescription_copy(payload)
        assert PrescriptionCopy.query.filter_by(
            prescription_id="event-prescription-1"
        ).count() == 1
        assert db.session.query(PrescriptionCopy).count() == 2
