from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import or_, select

from .auth import require_roles
from .errors import error
from .extensions import db
from .models import Dispensing, DispensingItem, Drug, PrescriptionCopy, PrescriptionItem
from .services import publish_event, verify_prescription_with_consultation

health = Blueprint("health", __name__)
api = Blueprint("api", __name__)


@health.get("/health")
def health_check():
    return jsonify({"status": "UP"})


@api.get("/drugs")
@require_roles("PHARMACIST", "DOCTOR", "ADMIN")
def list_drugs():
    search = request.args.get("search", "").strip()
    query = select(Drug).order_by(Drug.name)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Drug.name.ilike(pattern), Drug.strength.ilike(pattern)))
    return jsonify([drug.to_dict() for drug in db.session.scalars(query)])


@api.post("/drugs")
@require_roles("PHARMACIST")
def create_drug():
    payload = request.get_json(silent=True) or {}
    required = ("name", "form", "strength", "unit", "stock", "reorderThreshold")
    if any(field not in payload for field in required):
        return error(400, "name, form, strength, unit, stock and reorderThreshold are required")
    if not _valid_nonnegative_int(payload["stock"]) or not _valid_nonnegative_int(
        payload["reorderThreshold"]
    ):
        return error(422, "stock and reorderThreshold cannot be negative")
    if any(not isinstance(payload[field], str) or not payload[field].strip() for field in required[:4]):
        return error(422, "name, form, strength and unit must be non-empty strings")
    drug = Drug(
        name=payload["name"].strip(),
        form=payload["form"].strip(),
        strength=payload["strength"].strip(),
        unit=payload["unit"].strip(),
        stock=payload["stock"],
        reorder_threshold=payload["reorderThreshold"],
    )
    db.session.add(drug)
    db.session.commit()
    return jsonify(drug.to_dict()), 201


@api.put("/drugs/<drug_id>")
@require_roles("PHARMACIST")
def update_drug(drug_id):
    drug = db.session.get(Drug, drug_id)
    if drug is None:
        return error(404, "Drug not found")
    payload = request.get_json(silent=True) or {}
    for field, attribute in (
        ("name", "name"),
        ("form", "form"),
        ("strength", "strength"),
        ("unit", "unit"),
        ("stock", "stock"),
        ("reorderThreshold", "reorder_threshold"),
    ):
        if field in payload:
            if field in ("stock", "reorderThreshold"):
                if not _valid_nonnegative_int(payload[field]):
                    return error(422, f"{field} must be a non-negative integer")
            elif not isinstance(payload[field], str) or not payload[field].strip():
                return error(422, f"{field} must be a non-empty string")
            setattr(drug, attribute, payload[field])
    db.session.commit()
    return jsonify(drug.to_dict())


@api.post("/drugs/<drug_id>/stock")
@require_roles("PHARMACIST")
def adjust_stock(drug_id):
    drug = db.session.scalar(select(Drug).where(Drug.id == drug_id).with_for_update())
    payload = request.get_json(silent=True) or {}
    amount = payload.get("quantity")
    if drug is None:
        return error(404, "Drug not found")
    if not isinstance(amount, int) or amount == 0:
        return error(422, "quantity must be a non-zero integer")
    if drug.stock + amount < 0:
        return error(409, "Stock cannot become negative")
    drug.stock += amount
    db.session.commit()
    return jsonify(drug.to_dict())


@api.get("/stock/alerts")
@require_roles("PHARMACIST", "DOCTOR", "ADMIN")
def stock_alerts():
    drugs = db.session.scalars(
        select(Drug).where(Drug.stock <= Drug.reorder_threshold).order_by(Drug.name)
    )
    return jsonify([drug.to_dict() for drug in drugs])


@api.get("/prescriptions")
@require_roles("PHARMACIST", "DOCTOR", "ADMIN")
def list_prescriptions():
    query = select(PrescriptionCopy).order_by(PrescriptionCopy.created_at.desc())
    if status := request.args.get("status"):
        query = query.where(PrescriptionCopy.status == status)
    if patient_id := request.args.get("patientId"):
        query = query.where(PrescriptionCopy.patient_id == patient_id)
    return jsonify([prescription.to_dict() for prescription in db.session.scalars(query)])


@api.get("/prescriptions/<prescription_id>")
@require_roles("PHARMACIST", "DOCTOR", "ADMIN")
def get_prescription(prescription_id):
    prescription = db.session.scalar(
        select(PrescriptionCopy).where(
            (PrescriptionCopy.id == prescription_id)
            | (PrescriptionCopy.prescription_id == prescription_id)
        )
    )
    if prescription is None:
        return error(404, "Prescription not found")
    return jsonify(prescription.to_dict())


@api.post("/prescriptions/<prescription_id>/dispense")
@require_roles("PHARMACIST")
def dispense_prescription(prescription_id):
    payload = request.get_json(silent=True) or {}
    lines = payload.get("items")
    if not isinstance(lines, list) or not lines:
        return error(400, "items must be a non-empty array")

    prescription = db.session.scalar(
        select(PrescriptionCopy)
        .where(
            (PrescriptionCopy.id == prescription_id)
            | (PrescriptionCopy.prescription_id == prescription_id)
        )
        .with_for_update()
    )
    if prescription is None:
        return error(404, "Prescription not found")
    if prescription.status in ("CANCELLED", "DISPENSED"):
        return error(409, f"Prescription is already {prescription.status.lower()}")
    if not verify_prescription_with_consultation(current_app, prescription):
        return error(409, "Prescription could not be verified with Consultation")

    parsed = []
    seen_indexes = set()
    for line in lines:
        index = line.get("itemIndex")
        drug_id = line.get("drugId")
        quantity = line.get("quantity")
        if not isinstance(index, int) or not isinstance(quantity, int) or quantity <= 0 or not drug_id:
            return error(422, "Each item requires itemIndex, drugId and a positive integer quantity")
        if index in seen_indexes:
            return error(422, "Each prescription item may appear only once")
        seen_indexes.add(index)
        item = db.session.scalar(
            select(PrescriptionItem)
            .where(
                PrescriptionItem.prescription_id == prescription.id,
                PrescriptionItem.item_index == index,
            )
        )
        drug = db.session.scalar(select(Drug).where(Drug.id == drug_id).with_for_update())
        if item is None:
            return error(422, f"Prescription item {index} does not exist")
        if item.dispensed_quantity > 0:
            return error(409, f"Prescription item {index} has already been dispensed")
        if drug is None:
            return error(404, f"Drug {drug_id} not found")
        if drug.stock < quantity:
            db.session.rollback()
            return error(409, f"Insufficient stock for {drug.name}")
        parsed.append((item, drug, quantity))

    dispensing = Dispensing(
        prescription_id=prescription.prescription_id,
        pharmacist_id=g.user_id,
    )
    db.session.add(dispensing)
    for item, drug, quantity in parsed:
        drug.stock -= quantity
        item.dispensed_quantity += quantity
        dispensing.items.append(
            DispensingItem(item_index=item.item_index, drug_id=drug.id, quantity=quantity)
        )
    prescription.status = _prescription_status(prescription)
    db.session.commit()
    result = {
        "prescription": prescription.to_dict(),
        "dispensing": dispensing.to_dict(),
    }
    publish_event(current_app, "prescription.dispensed", result)
    return jsonify(result), 201


def _prescription_status(prescription):
    if all(item.dispensed_quantity > 0 for item in prescription.items):
        return "DISPENSED"
    return "PARTIALLY_DISPENSED"


def _valid_nonnegative_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0
