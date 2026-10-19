import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import TestCatalog, LabRequest, LabRequestTest, LabResult

CATALOGUE = [
    {"code": "HGB", "name": "Hemoglobin", "unit": "g/dL", "ref_low": 12.0, "ref_high": 17.0, "critical_low": 7.0, "critical_high": 20.0},
    {"code": "WBC", "name": "White blood cells", "unit": "10^9/L", "ref_low": 4.0, "ref_high": 11.0, "critical_low": 2.0, "critical_high": 30.0},
    {"code": "GLU", "name": "Fasting glucose", "unit": "mg/dL", "ref_low": 70.0, "ref_high": 100.0, "critical_low": 40.0, "critical_high": 400.0},
    {"code": "CHOL", "name": "Total cholesterol", "unit": "mg/dL", "ref_low": 0.0, "ref_high": 200.0, "critical_low": None, "critical_high": None},
    {"code": "CRE", "name": "Creatinine", "unit": "mg/dL", "ref_low": 0.6, "ref_high": 1.3, "critical_low": None, "critical_high": 5.0},
    {"code": "K", "name": "Potassium", "unit": "mmol/L", "ref_low": 3.5, "ref_high": 5.1, "critical_low": 2.5, "critical_high": 6.5},
]

def seed_lab_data(session: Session):
    # 1. Seed Catalogue
    for item in CATALOGUE:
        existing = session.query(TestCatalog).filter_by(code=item["code"]).first()
        if not existing:
            test = TestCatalog(**item)
            session.add(test)
    session.commit()

    # 2. Seed L1 (VALIDATED)
    l1_id = uuid.UUID("f9f9f9f9-0000-4000-8000-000000000001")
    existing_l1 = session.query(LabRequest).filter_by(id=l1_id).first()
    if not existing_l1:
        req1 = LabRequest(
            id=l1_id,
            consultation_id=uuid.UUID("f7f7f7f7-0000-4000-8000-000000000001"),
            patient_id=uuid.UUID("a1a1a1a1-0000-4000-8000-000000000005"),
            doctor_id=uuid.UUID("b2b2b2b2-0000-4000-8000-000000000002"),
            priority="ROUTINE",
            status="VALIDATED",
            requested_at=datetime(2026, 10, 10, 11, 30, 0, tzinfo=timezone.utc),
            started_at=datetime(2026, 10, 10, 13, 0, 0, tzinfo=timezone.utc),
            validated_at=datetime(2026, 10, 10, 15, 0, 0, tzinfo=timezone.utc),
            validated_by=uuid.UUID("b2b2b2b2-0000-4000-8000-000000000004"),
        )
        t1 = LabRequestTest(request=req1, code="HGB", name="Hemoglobin")
        t2 = LabRequestTest(request=req1, code="WBC", name="White blood cells")

        r1 = LabResult(
            request=req1,
            patient_id=req1.patient_id,
            test_code="HGB",
            value=14.2,
            unit="g/dL",
            reference_range="12.0-17.0",
            flag="NORMAL",
            validated_at=req1.validated_at,
        )
        r2 = LabResult(
            request=req1,
            patient_id=req1.patient_id,
            test_code="WBC",
            value=12.5,
            unit="10^9/L",
            reference_range="4.0-11.0",
            flag="HIGH",
            validated_at=req1.validated_at,
        )
        session.add(req1)
        session.add_all([t1, t2, r1, r2])
        session.commit()

    # 3. Seed L2 (REQUESTED, URGENT)
    l2_id = uuid.UUID("f9f9f9f9-0000-4000-8000-000000000002")
    existing_l2 = session.query(LabRequest).filter_by(id=l2_id).first()
    if not existing_l2:
        req2 = LabRequest(
            id=l2_id,
            consultation_id=uuid.UUID("f7f7f7f7-0000-4000-8000-000000000002"),
            patient_id=uuid.UUID("a1a1a1a1-0000-4000-8000-000000000003"),
            doctor_id=uuid.UUID("b2b2b2b2-0000-4000-8000-000000000001"),
            priority="URGENT",
            status="REQUESTED",
            requested_at=datetime(2026, 10, 12, 8, 50, 0, tzinfo=timezone.utc),
            started_at=None,
            validated_at=None,
            validated_by=None,
        )
        t1 = LabRequestTest(request=req2, code="K", name="Potassium")
        t2 = LabRequestTest(request=req2, code="CRE", name="Creatinine")
        session.add(req2)
        session.add_all([t1, t2])
        session.commit()
