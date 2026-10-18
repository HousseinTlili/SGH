import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import LabRequest, LabResult, TestCatalogue
from app.services.flags import compute_flag, format_range


def _get(session: Session, request_id: uuid.UUID) -> LabRequest:
    r = session.get(LabRequest, request_id)
    if r is None:
        raise ApiError(404, "Resource not found")
    return r


def start(session: Session, request_id: uuid.UUID) -> LabRequest:
    r = _get(session, request_id)
    if r.status != "REQUESTED":
        raise ApiError(409, "Request is not REQUESTED")
    r.status = "IN_PROGRESS"
    r.started_at = datetime.now(timezone.utc)
    session.commit()
    return r


def enter_results(session: Session, request_id: uuid.UUID, items: list, staff_id: uuid.UUID | None) -> LabRequest:
    r = _get(session, request_id)
    if r.status not in ("IN_PROGRESS", "RESULT_ENTERED"):
        raise ApiError(409, "Request is not IN_PROGRESS")

    allowed = {t.code for t in r.tests}
    catalogue = {c.code: c for c in session.scalars(select(TestCatalogue)).all()}

    problems, new_results = [], []
    for i, it in enumerate(items):
        if it.testCode not in allowed or it.testCode not in catalogue:
            problems.append({"field": f"results[{i}].testCode", "problem": "not part of this request"})
            continue
        try:
            value = Decimal(str(it.value))
        except InvalidOperation:
            problems.append({"field": f"results[{i}].value", "problem": "must be a number"})
            continue
        c = catalogue[it.testCode]
        new_results.append(LabResult(
            test_code=c.code, value=value, unit=it.unit or c.unit,
            reference_range=format_range(c.ref_low, c.ref_high),
            flag=compute_flag(value, c.ref_low, c.ref_high, c.critical_low, c.critical_high),
            entered_by=staff_id,
        ))
    if problems:
        raise ApiError(422, "Validation failed", problems)

    # Saisie répétée : la seconde remplace la première
    r.results.clear()
    session.flush()
    r.results.extend(new_results)
    r.status = "RESULT_ENTERED"
    session.commit()
    return r


def validate(session: Session, request_id: uuid.UUID, staff_id: uuid.UUID | None) -> LabRequest:
    r = _get(session, request_id)
    if r.status != "RESULT_ENTERED":
        raise ApiError(409, "Request is not RESULT_ENTERED")
    entered = {x.test_code for x in r.results}
    missing = [t.code for t in r.tests if t.code not in entered]
    if missing:
        raise ApiError(422, "Validation failed",
                       [{"field": c, "problem": "no result entered"} for c in missing])
    for x in r.results:
        x.validated_by = staff_id
    r.status = "VALIDATED"
    r.validated_at = datetime.now(timezone.utc)
    session.commit()
    return r