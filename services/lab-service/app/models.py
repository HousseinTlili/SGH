import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, func, Uuid
from sqlalchemy.orm import relationship
from app.database import Base

class TestCatalog(Base):
    __tablename__ = "tests"

    code = Column(String(10), primary_key=True)
    name = Column(String(100), nullable=False)
    unit = Column(String(30), nullable=False)
    ref_low = Column(Float, nullable=False)
    ref_high = Column(Float, nullable=False)
    critical_low = Column(Float, nullable=True)
    critical_high = Column(Float, nullable=True)


class LabRequest(Base):
    __tablename__ = "lab_requests"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    consultation_id = Column(Uuid, nullable=False, index=True)
    patient_id = Column(Uuid, nullable=False, index=True)
    doctor_id = Column(Uuid, nullable=False, index=True)
    priority = Column(String(20), nullable=False)  # ROUTINE, URGENT
    status = Column(String(30), nullable=False, default="REQUESTED", index=True)  # REQUESTED, IN_PROGRESS, RESULT_ENTERED, VALIDATED
    requested_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True, index=True)
    validated_by = Column(Uuid, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tests = relationship("LabRequestTest", cascade="all, delete-orphan", back_populates="request", lazy="joined")
    results = relationship("LabResult", cascade="all, delete-orphan", back_populates="request", lazy="joined", order_by="LabResult.id")


class LabRequestTest(Base):
    __tablename__ = "lab_request_tests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lab_request_id = Column(Uuid, ForeignKey("lab_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    name = Column(String(100), nullable=False)

    request = relationship("LabRequest", back_populates="tests")


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lab_request_id = Column(Uuid, ForeignKey("lab_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Uuid, nullable=False, index=True)
    test_code = Column(String(10), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(30), nullable=False)
    reference_range = Column(String(50), nullable=False)
    flag = Column(String(20), nullable=False)  # NORMAL, HIGH, LOW, CRITICAL
    validated_at = Column(DateTime(timezone=True), nullable=True, index=True)
    entered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("LabRequest", back_populates="results")


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id = Column(String(100), primary_key=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
