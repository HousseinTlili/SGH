from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import TestCatalogue
from app.schemas import TestDto

router = APIRouter(prefix="/api", tags=["tests"])


@router.get("/tests", response_model=list[TestDto])
def list_tests(session: Session = Depends(get_session)):
    rows = session.scalars(select(TestCatalogue).order_by(TestCatalogue.code)).all()
    return [
        TestDto(
            code=r.code, name=r.name, unit=r.unit,
            refLow=r.ref_low, refHigh=r.ref_high,
            criticalLow=r.critical_low, criticalHigh=r.critical_high,
        )
        for r in rows
    ]