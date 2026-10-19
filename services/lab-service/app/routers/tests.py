from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.auth import require_roles
from app.database import get_db
from app.models import TestCatalog
from app.schemas import TestDto

router = APIRouter(prefix="/api/tests", tags=["tests"])

@router.get("", response_model=List[TestDto], dependencies=[Depends(require_roles(["LAB_TECHNICIAN", "DOCTOR", "ADMIN"]))])
def list_tests(db: Session = Depends(get_db)):
    tests = db.query(TestCatalog).all()
    return [
        TestDto(
            code=t.code,
            name=t.name,
            unit=t.unit,
            refLow=t.ref_low,
            refHigh=t.ref_high,
            criticalLow=t.critical_low,
            criticalHigh=t.critical_high
        )
        for t in tests
    ]
