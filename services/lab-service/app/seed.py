import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.db import Base, SessionLocal, engine
from app.models import LabRequest, LabRequestTest, LabResult, TestCatalogue

D = Decimal

CATALOGUE = [
    ("HGB", "Hemoglobin", "g/dL", D("12.0"), D("17.0"), D("7.0"), D("20.0")),
    ("WBC", "White blood cells", "10^9/L", D("4.0"), D("11.0"), D("2.0"), D("30.0")),
    ("GLU", "Fasting glucose", "mg/dL", D("70"), D("100"), D("40"), D("400")),
    ("CHOL", "Total cholesterol", "mg/dL", D("0"), D("200"), None, None),
    ("CRE", "Creatinine", "mg/dL", D("0.6"), D("1.3"), None, D("5.0")),
    ("K", "Potassium", "mmol/L", D("3.5"), D("5.1"), D("2.5"), D("6.5")),
]

L1 = uuid.UUID("f9f9f9f9-0000-4000-8000-000000000001")
L2 = uuid.UUID("f9f9f9f9-0000-4000-8000-000000000002")


def utc(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def run_seed() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        for code, name, unit, lo, hi, clo, chi in CATALOGUE:
            if s.get(TestCatalogue, code) is None:
                s.add(TestCatalogue(code=code, name=name, unit=unit, ref_low=lo,
                                    ref_high=hi, critical_low=clo, critical_high=chi))

        if s.get(LabRequest, L1) is None:
            l1 = LabRequest(
                id=L1,
                consultation_id=uuid.UUID("f7f7f7f7-0000-4000-8000-000000000001"),
                patient_id=uuid.UUID("a1a1a1a1-0000-4000-8000-000000000005"),
                doctor_id=uuid.UUID("b2b2b2b2-0000-4000-8000-000000000002"),
                priority="ROUTINE", status="VALIDATED",
                requested_at=utc("2026-10-10T11:30:00Z"),
                started_at=utc("2026-10-10T13:00:00Z"),
                validated_at=utc("2026-10-10T15:00:00Z"),
            )
            l1.tests = [LabRequestTest(code="HGB", name="Hemoglobin"),
                        LabRequestTest(code="WBC", name="White blood cells")]
            l1.results = [
                LabResult(test_code="HGB", value=D("14.2"), unit="g/dL",
                          reference_range="12.0-17.0", flag="NORMAL"),
                LabResult(test_code="WBC", value=D("12.5"), unit="10^9/L",
                          reference_range="4.0-11.0", flag="HIGH"),
            ]
            s.add(l1)

        if s.get(LabRequest, L2) is None:
            l2 = LabRequest(
                id=L2,
                consultation_id=uuid.UUID("f7f7f7f7-0000-4000-8000-000000000002"),
                patient_id=uuid.UUID("a1a1a1a1-0000-4000-8000-000000000003"),
                doctor_id=uuid.UUID("b2b2b2b2-0000-4000-8000-000000000001"),
                priority="URGENT", status="REQUESTED",
                requested_at=utc("2026-10-12T08:50:00Z"),
            )
            l2.tests = [LabRequestTest(code="K", name="Potassium"),
                        LabRequestTest(code="CRE", name="Creatinine")]
            s.add(l2)

        s.commit()


if __name__ == "__main__":
    run_seed()
    print("Seed OK")