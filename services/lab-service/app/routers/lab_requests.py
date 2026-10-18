import math
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_session
from app.errors import ApiError
from app.models import LabRequest
from app.schemas import (
    LabRequestDto,
    LabRequestPage,
    LabResultLine,
    LabTestRef,
    ResultsInput,
)
from app.services import workflow

router = APIRouter(prefix="/api", tags=["lab-requests"])


def to_dto(r: LabRequest) -> LabRequestDto:
    return LabRequestDto(
        id=r.id,
        consultationId=r.consultation_id,
        patientId=r.patient_id,
        doctorId=r.doctor_id,
        priority=r.priority,
        status=r.status,
        tests=[LabTestRef(code=t.code, name=t.name) for t in r.tests],
        results=[
            LabResultLine(
                testCode=x.test_code,
                value=x.value,
                unit=x.unit,
                referenceRange=x.reference_range,
                flag=x.flag,
            )
            for x in r.results
        ],
        requestedAt=r.requested_at,
        startedAt=r.started_at,
        validatedAt=r.validated_at,
    )


@router.get("/lab-requests", response_model=LabRequestPage)
def list_lab_requests(
    status: Literal["REQUESTED", "IN_PROGRESS", "RESULT_ENTERED", "VALIDATED"] | None = None,
    priority: Literal["ROUTINE", "URGENT"] | None = None,
    patientId: uuid.UUID | None = None,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    filters = []
    if status:
        filters.append(LabRequest.status == status)
    if priority:
        filters.append(LabRequest.priority == priority)
    if patientId:
        filters.append(LabRequest.patient_id == patientId)

    total = session.scalar(select(func.count()).select_from(LabRequest).where(*filters)) or 0

    # LAB-7 : URGENT d'abord, puis requestedAt croissant
    urgent_first = case((LabRequest.priority == "URGENT", 0), else_=1)
    rows = session.scalars(
        select(LabRequest)
        .where(*filters)
        .options(selectinload(LabRequest.tests), selectinload(LabRequest.results))
        .order_by(urgent_first, LabRequest.requested_at.asc())
        .offset(page * size)
        .limit(size)
    ).all()

    return LabRequestPage(
        content=[to_dto(r) for r in rows],
        page=page,
        size=size,
        totalElements=total,
        totalPages=math.ceil(total / size) if total else 0,
    )


@router.get("/lab-requests/{id}", response_model=LabRequestDto)
def get_lab_request(id: uuid.UUID, session: Session = Depends(get_session)):
    r = session.get(LabRequest, id)
    if r is None:
        raise ApiError(404, "Resource not found")
    return to_dto(r)


@router.post("/lab-requests/{id}/start", response_model=LabRequestDto)
def start_request(id: uuid.UUID, session: Session = Depends(get_session)):
    return to_dto(workflow.start(session, id))


@router.post("/lab-requests/{id}/results", response_model=LabRequestDto)
def enter_results(id: uuid.UUID, body: ResultsInput, session: Session = Depends(get_session)):
    return to_dto(workflow.enter_results(session, id, body.results, None))


@router.post("/lab-requests/{id}/validate", response_model=LabRequestDto)
def validate_request(id: uuid.UUID, session: Session = Depends(get_session)):
    return to_dto(workflow.validate(session, id, None))