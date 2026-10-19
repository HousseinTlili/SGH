from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class LabStatus(str, Enum):
    REQUESTED = "REQUESTED"
    IN_PROGRESS = "IN_PROGRESS"
    RESULT_ENTERED = "RESULT_ENTERED"
    VALIDATED = "VALIDATED"


class LabFlag(str, Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    LOW = "LOW"
    CRITICAL = "CRITICAL"


class Health(BaseModel):
    status: str = "UP"


class FieldProblem(BaseModel):
    field: str
    problem: str


class ApiError(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: int
    error: str
    message: str
    path: str
    correlationId: str
    service: Optional[str] = None
    details: Optional[List[FieldProblem]] = None


class LabTestRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str


class LabResultLine(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    testCode: str
    value: float
    unit: str
    referenceRange: str
    flag: LabFlag


class LabRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    consultationId: UUID
    patientId: UUID
    doctorId: UUID
    priority: str
    status: LabStatus
    tests: List[LabTestRef]
    results: List[LabResultLine] = Field(default_factory=list)
    requestedAt: datetime
    startedAt: Optional[datetime] = None
    validatedAt: Optional[datetime] = None


class LabRequestPage(BaseModel):
    content: List[LabRequest]
    page: int
    size: int
    totalElements: int
    totalPages: int


class ResultInputItem(BaseModel):
    testCode: str = Field(min_length=1, max_length=10)
    # LAB-3: the value must be a real number (NaN and infinity are not measurements).
    value: float = Field(allow_inf_nan=False)
    unit: Optional[str] = Field(default=None, max_length=30)


class ResultsInput(BaseModel):
    results: List[ResultInputItem] = Field(..., min_length=1, max_length=50)


class LabPriority(str, Enum):
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"


class LabResultRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    labRequestId: UUID
    patientId: UUID
    testCode: str
    value: float
    unit: str
    referenceRange: str
    flag: LabFlag
    validatedAt: datetime


class LabResultRowPage(BaseModel):
    content: List[LabResultRow]
    page: int
    size: int
    totalElements: int
    totalPages: int


class TestDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str
    unit: str
    refLow: float
    refHigh: float
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
