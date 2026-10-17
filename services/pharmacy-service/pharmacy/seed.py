from .extensions import db
from .models import Drug


SEED_DRUGS = [
    {
        "id": "e1e1e1e1-0000-4000-8000-000000000001",
        "name": "Paracetamol",
        "form": "Tablet",
        "strength": "1000mg",
        "unit": "tablet",
        "stock": 120,
        "reorder_threshold": 25,
    },
    {
        "id": "e1e1e1e1-0000-4000-8000-000000000002",
        "name": "Omeprazole",
        "form": "Capsule",
        "strength": "20mg",
        "unit": "capsule",
        "stock": 60,
        "reorder_threshold": 15,
    },
    {
        "id": "e1e1e1e1-0000-4000-8000-000000000003",
        "name": "Amoxicillin",
        "form": "Capsule",
        "strength": "500mg",
        "unit": "capsule",
        "stock": 40,
        "reorder_threshold": 10,
    },
]


def seed_drugs():
    if Drug.query.first():
        return
    db.session.add_all(Drug(**drug) for drug in SEED_DRUGS)
    db.session.commit()


if __name__ == "__main__":
    from . import create_app

    application = create_app()
    with application.app_context():
        seed_drugs()
