import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import case
from sqlalchemy.orm import Session
from app.amqp import publish_lab_result_ready
from app.auth import AuthUser, require_roles
from app.database import get_db
from app.models import LabRequest, LabResult, TestCatalog
from app.schemas import (
    LabFlag,
    LabRequest as LabRequestSchema,
    LabRequestPage,
    LabResultLine,
    LabStatus,
    LabTestRef,
    ResultsInput,
)

router = APIRouter(prefix="/api/lab-requests", tags=["lab-requests"])


def to_lab_request_schema(req: LabRequest) -> LabRequestSchema:
    tests = [LabTestRef(code=t.code, name=t.name) for t in req.tests]
    results = [
        LabResultLine(
            testCode=r.test_code,
            value=float(r.value),
            unit=r.unit,
            referenceRange=r.reference_range,
            flag=LabFlag(r.flag)
        )
        for r in req.results
    ]
    return LabRequestSchema(
        id=req.id,
        consultationId=req.consultation_id,
        patientId=req.patient_id,
        doctorId=req.doctor_id,
        priority=req.priority,
        status=LabStatus(req.status),
        tests=tests,
        results=results,
        requestedAt=req.requested_at,
        startedAt=req.started_at,
        validatedAt=req.validated_at
    )


@router.get("", response_model=LabRequestPage, dependencies=[Depends(require_roles(["LAB_TECHNICIAN", "DOCTOR", "ADMIN"]))])
def list_lab_requests(
    status: Optional[LabStatus] = None,
    priority: Optional[str] = None,
    patientId: Optional[UUID] = None,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(LabRequest)

    if status:
        query = query.filter(LabRequest.status == status.value)
    if priority:
        query = query.filter(LabRequest.priority == priority)
    if patientId:
        query = query.filter(LabRequest.patient_id == patientId)

    total_elements = query.count()

    # Rule LAB-7: Work queue, URGENT first then oldest
    order_clause = [
        case((LabRequest.priority == "URGENT", 0), else_=1).asc(),
        LabRequest.requested_at.asc()
    ]
    records = query.order_by(*order_clause).offset(page * size).limit(size).all()

    total_pages = math.ceil(total_elements / size) if size > 0 else 0

    return LabRequestPage(
        content=[to_lab_request_schema(r) for r in records],
        page=page,
        size=size,
        totalElements=total_elements,
        totalPages=total_pages
    )


@router.get("/{id}", response_model=LabRequestSchema, dependencies=[Depends(require_roles(["LAB_TECHNICIAN", "DOCTOR", "ADMIN"]))])
def get_lab_request(id: UUID, db: Session = Depends(get_db)):
    req = db.query(LabRequest).filter(LabRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Resource not found")
    return to_lab_request_schema(req)


@router.post("/{id}/start", response_model=LabRequestSchema)
def start_lab_request(
    id: UUID,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_roles(["LAB_TECHNICIAN"]))
):
    req = db.query(LabRequest).filter(LabRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Resource not found")

    if req.status != "REQUESTED":
        raise HTTPException(status_code=409, detail=f"Request is {req.status}, must be REQUESTED")

    req.status = "IN_PROGRESS"
    req.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return to_lab_request_schema(req)


@router.post("/{id}/results", response_model=LabRequestSchema)
def enter_lab_results(
    id: UUID,
    payload: ResultsInput,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_roles(["LAB_TECHNICIAN"]))
):
    req = db.query(LabRequest).filter(LabRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Resource not found")

    if req.status not in ("IN_PROGRESS", "RESULT_ENTERED"):
        raise HTTPException(status_code=409, detail=f"Request is {req.status}, must be IN_PROGRESS or RESULT_ENTERED")

    allowed_test_codes = {t.code for t in req.tests}

    # Fetch catalogue tests
    catalogue = {c.code: c for c in db.query(TestCatalog).all()}

    # Clear previous results if any (re-entry replaces previous values)
    req.results.clear()

    for item in payload.results:
        if item.testCode not in allowed_test_codes:
            raise HTTPException(
                status_code=422,
                detail=[{"field": "testCode", "problem": f"{item.testCode} not part of this request"}]
            )

        cat_test = catalogue.get(item.testCode)
        if not cat_test:
            raise HTTPException(
                status_code=422,
                detail=[{"field": "testCode", "problem": f"Unknown catalogue test {item.testCode}"}]
            )

        unit = item.unit if item.unit else cat_test.unit

        # Format reference range e.g. "12.0-17.0"
        ref_low_str = f"{cat_test.ref_low:g}" if "." not in str(cat_test.ref_low) else f"{cat_test.ref_low}"
        ref_high_str = f"{cat_test.ref_high:g}" if "." not in str(cat_test.ref_high) else f"{cat_test.ref_high}"
        ref_range = f"{ref_low_str}-{ref_high_str}"

        # Flag rule:
        # below criticalLow or above criticalHigh -> CRITICAL
        # else below refLow -> LOW
        # else above refHigh -> HIGH
        # else NORMAL
        val = item.value
        if cat_test.critical_low is not None and val < cat_test.critical_low:
            flag = "CRITICAL"
        elif cat_test.critical_high is not None and val > cat_test.critical_high:
            flag = "CRITICAL"
        elif val < cat_test.ref_low:
            flag = "LOW"
        elif val > cat_test.ref_high:
            flag = "HIGH"
        else:
            flag = "NORMAL"

        res = LabResult(
            request=req,
            patient_id=req.patient_id,
            test_code=item.testCode,
            value=val,
            unit=unit,
            reference_range=ref_range,
            flag=flag
        )
        req.results.append(res)

    req.status = "RESULT_ENTERED"
    db.commit()
    db.refresh(req)
    return to_lab_request_schema(req)


@router.post("/{id}/validate", response_model=LabRequestSchema)
async def validate_lab_request(
    id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_roles(["LAB_TECHNICIAN"]))
):
    req = db.query(LabRequest).filter(LabRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Resource not found")

    if req.status != "RESULT_ENTERED":
        raise HTTPException(status_code=409, detail=f"Request is {req.status}, must be RESULT_ENTERED")

    # Check all requested tests have a result
    entered_codes = {r.test_code for r in req.results}
    for t in req.tests:
        if t.code not in entered_codes:
            raise HTTPException(
                status_code=422,
                detail=[{"field": "results", "problem": f"Test {t.code} has no result entered"}]
            )

    validated_at = datetime.now(timezone.utc)
    req.status = "VALIDATED"
    req.validated_at = validated_at

    validator_id = None
    if user.staff_id:
        try:
            validator_id = uuid.UUID(user.staff_id)
        except ValueError:
            pass
    req.validated_by = validator_id

    for r in req.results:
        r.validated_at = validated_at

    db.commit()
    db.refresh(req)

    # Publish lab.result.ready asynchronously (failure never rolls back validation, LAB-6)
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    await publish_lab_result_ready(req, correlation_id)

    return to_lab_request_schema(req)
