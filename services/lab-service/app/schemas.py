import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer

Status = Literal["REQUESTED", "IN_PROGRESS", "RESULT_ENTERED", "VALIDATED"]
Flag = Literal["NORMAL", "HIGH", "LOW", "CRITICAL"]


class Health(BaseModel):
    status: Literal["UP"]


class _Num(BaseModel):
    # Decimal -> nombre JSON (pas une chaîne)
    @field_serializer("*", mode="wrap")
    def _dec(self, v, handler):
        return float(v) if isinstance(v, Decimal) else handler(v)


class TestDto(_Num):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str
    unit: str
    refLow: Decimal
    refHigh: Decimal
    criticalLow: Decimal | None = None
    criticalHigh: Decimal | None = None


class LabTestRef(BaseModel):
    code: str
    name: str


class LabResultLine(_Num):
    testCode: str
    value: Decimal
    unit: str
    referenceRange: str
    flag: Flag


class LabRequestDto(BaseModel):
    id: uuid.UUID
    consultationId: uuid.UUID
    patientId: uuid.UUID
    doctorId: uuid.UUID
    priority: Literal["ROUTINE", "URGENT"]
    status: Status
    tests: list[LabTestRef]
    results: list[LabResultLine]
    requestedAt: datetime
    startedAt: datetime | None = None
    validatedAt: datetime | None = None


class Page(BaseModel):
    page: int
    size: int
    totalElements: int
    totalPages: int


class LabRequestPage(Page):
    content: list[LabRequestDto]