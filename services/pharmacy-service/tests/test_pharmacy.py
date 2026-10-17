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
        from pharmacy.models import Drug

        assert Drug.query.get("drug-1").stock == 8


def test_insufficient_stock_changes_nothing(client, app):
    response = client.post(
        "/api/prescriptions/prescription-1/dispense",
        json={"items": [{"itemIndex": 0, "drugId": "drug-1", "quantity": 11}]},
        headers=headers(),
    )
    assert response.status_code == 409
    with app.app_context():
        from pharmacy.models import Drug, PrescriptionCopy

        assert Drug.query.get("drug-1").stock == 10
        assert PrescriptionCopy.query.get("copy-1").status == "ISSUED"


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
        from pharmacy.models import Drug

        drug = Drug.query.get("drug-1")
        drug.stock = 3
        db = __import__("pharmacy.extensions", fromlist=["db"]).db
        db.session.commit()
    response = client.get("/api/stock/alerts", headers=headers(("DOCTOR",)))
    assert response.status_code == 200
    assert response.json[0]["id"] == "drug-1"
