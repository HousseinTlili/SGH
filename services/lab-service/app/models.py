import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TestCatalogue(Base):
    __tablename__ = "test_catalogue"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20))
    ref_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    ref_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    critical_low: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    critical_high: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)


class LabRequest(Base):
    __tablename__ = "lab_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    consultation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    priority: Mapped[str] = mapped_column(String(10))  # ROUTINE | URGENT
    status: Mapped[str] = mapped_column(String(20), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tests: Mapped[list["LabRequestTest"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    results: Mapped[list["LabResult"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class LabRequestTest(Base):
    __tablename__ = "lab_request_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lab_request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lab_requests.id"), index=True)
    code: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(100))

    request: Mapped["LabRequest"] = relationship(back_populates="tests")


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lab_request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lab_requests.id"), index=True)
    test_code: Mapped[str] = mapped_column(String(10))
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit: Mapped[str] = mapped_column(String(20))
    reference_range: Mapped[str] = mapped_column(String(30))
    flag: Mapped[str] = mapped_column(String(10))  # NORMAL | HIGH | LOW | CRITICAL
    entered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    request: Mapped["LabRequest"] = relationship(back_populates="results")


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )