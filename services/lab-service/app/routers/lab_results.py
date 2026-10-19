import math
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.auth import require_roles
from app.database import get_db
from app.models import LabResult
from app.schemas import LabFlag, LabResultRow, LabResultRowPage

router = APIRouter(prefix="/api/lab-results", tags=["lab-results"])

@router.get("", response_model=LabResultRowPage, dependencies=[Depends(require_roles(["LAB_TECHNICIAN", "DOCTOR", "ADMIN"]))])
def list_validated_results(
    patientId: Optional[UUID] = None,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(LabResult).filter(LabResult.validated_at.isnot(None))

    if patientId:
        query = query.filter(LabResult.patient_id == patientId)

    total_elements = query.count()
    records = query.order_by(LabResult.validated_at.desc(), LabResult.id.desc()).offset(page * size).limit(size).all()

    total_pages = math.ceil(total_elements / size) if size > 0 else 0

    content = [
        LabResultRow(
            labRequestId=r.lab_request_id,
            patientId=r.patient_id,
            testCode=r.test_code,
            value=float(r.value),
            unit=r.unit,
            referenceRange=r.reference_range,
            flag=LabFlag(r.flag),
            validatedAt=r.validated_at
        )
        for r in records
    ]

    return LabResultRowPage(
        content=content,
        page=page,
        size=size,
        totalElements=total_elements,
        totalPages=total_pages
    )
