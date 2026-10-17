import pytest

from pharmacy import create_app
from pharmacy.extensions import db
from pharmacy.models import Drug, PrescriptionCopy, PrescriptionItem


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "JWT_ISSUER": "test-issuer",
            "JWT_SECRET": "test-secret",
            "RABBITMQ_URL": "",
            "AUTO_CREATE_SCHEMA": True,
        }
    )
    with app.app_context():
        db.drop_all()
        db.create_all()
        drug = Drug(
            id="drug-1",
            name="Paracetamol",
            form="Tablet",
            strength="1000mg",
            unit="tablet",
            stock=10,
            reorder_threshold=3,
        )
        prescription = PrescriptionCopy(
            id="copy-1",
            prescription_id="prescription-1",
            consultation_id="consultation-1",
            patient_id="patient-1",
            doctor_id="doctor-1",
        )
        prescription.items = [
            PrescriptionItem(
                item_index=0,
                drug_name="Paracetamol",
                dosage="1000mg",
                frequency="Once daily",
                duration="5 days",
            )
        ]
        db.session.add_all([drug, prescription])
        db.session.commit()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_header():
    return {"Authorization": "Bearer test-token"}
