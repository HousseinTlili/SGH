from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, Index

from .extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Drug(db.Model):
    __tablename__ = "drugs"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_drugs_stock_nonnegative"),
        CheckConstraint("reorder_threshold >= 0", name="ck_drugs_reorder_nonnegative"),
        Index("ix_drugs_name_strength", "name", "strength"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    name = db.Column(db.String(160), nullable=False)
    form = db.Column(db.String(80), nullable=False)
    strength = db.Column(db.String(80), nullable=False)
    unit = db.Column(db.String(40), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    reorder_threshold = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "form": self.form,
            "strength": self.strength,
            "unit": self.unit,
            "stock": self.stock,
            "reorderThreshold": self.reorder_threshold,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }


class PrescriptionCopy(db.Model):
    __tablename__ = "prescription_copies"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ISSUED', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED')",
            name="ck_prescriptions_status",
        ),
        Index("ix_prescriptions_patient_status", "patient_id", "status"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    prescription_id = db.Column(db.String(36), nullable=False, unique=True, index=True)
    consultation_id = db.Column(db.String(36), nullable=False)
    patient_id = db.Column(db.String(36), nullable=False, index=True)
    doctor_id = db.Column(db.String(36), nullable=False)
    status = db.Column(db.String(24), nullable=False, default="ISSUED", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    items = db.relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "prescriptionId": self.prescription_id,
            "consultationId": self.consultation_id,
            "patientId": self.patient_id,
            "doctorId": self.doctor_id,
            "status": self.status,
            "items": [item.to_dict() for item in sorted(self.items, key=lambda i: i.item_index)],
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }


class PrescriptionItem(db.Model):
    __tablename__ = "prescription_items"
    __table_args__ = (
        db.UniqueConstraint("prescription_id", "item_index", name="uq_prescription_item_index"),
        CheckConstraint("dispensed_quantity >= 0", name="ck_items_dispensed_nonnegative"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    prescription_id = db.Column(
        db.String(36), db.ForeignKey("prescription_copies.id"), nullable=False
    )
    item_index = db.Column(db.Integer, nullable=False)
    drug_name = db.Column(db.String(160), nullable=False)
    dosage = db.Column(db.String(80), nullable=False)
    frequency = db.Column(db.String(160), nullable=False)
    duration = db.Column(db.String(80), nullable=False)
    dispensed_quantity = db.Column(db.Integer, nullable=False, default=0)
    prescription = db.relationship("PrescriptionCopy", back_populates="items")

    def to_dict(self):
        return {
            "index": self.item_index,
            "drugName": self.drug_name,
            "dosage": self.dosage,
            "frequency": self.frequency,
            "duration": self.duration,
            "dispensedQuantity": self.dispensed_quantity,
            "dispensed": self.dispensed_quantity > 0,
        }


class Dispensing(db.Model):
    __tablename__ = "dispensings"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    prescription_id = db.Column(db.String(36), nullable=False, index=True)
    pharmacist_id = db.Column(db.String(36), nullable=False)
    dispensed_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    items = db.relationship(
        "DispensingItem", back_populates="dispensing", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "prescriptionId": self.prescription_id,
            "pharmacistId": self.pharmacist_id,
            "dispensedAt": self.dispensed_at.isoformat(),
            "items": [item.to_dict() for item in self.items],
        }


class DispensingItem(db.Model):
    __tablename__ = "dispensing_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    dispensing_id = db.Column(
        db.String(36), db.ForeignKey("dispensings.id"), nullable=False
    )
    item_index = db.Column(db.Integer, nullable=False)
    drug_id = db.Column(db.String(36), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    dispensing = db.relationship("Dispensing", back_populates="items")
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_dispensing_items_quantity_positive"),
    )

    def to_dict(self):
        return {
            "itemIndex": self.item_index,
            "drugId": self.drug_id,
            "quantity": self.quantity,
        }
