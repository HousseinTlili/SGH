"""Create pharmacy schema.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "drugs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("form", sa.String(80), nullable=False),
        sa.Column("strength", sa.String(80), nullable=False),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_threshold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("stock >= 0", name="ck_drugs_stock_nonnegative"),
        sa.CheckConstraint("reorder_threshold >= 0", name="ck_drugs_reorder_nonnegative"),
    )
    op.create_index("ix_drugs_name_strength", "drugs", ["name", "strength"])

    op.create_table(
        "prescription_copies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prescription_id", sa.String(36), nullable=False, unique=True),
        sa.Column("consultation_id", sa.String(36), nullable=False),
        sa.Column("patient_id", sa.String(36), nullable=False),
        sa.Column("doctor_id", sa.String(36), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="ISSUED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('ISSUED', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED')",
            name="ck_prescriptions_status",
        ),
    )
    op.create_index(
        "ix_prescriptions_patient_status",
        "prescription_copies",
        ["patient_id", "status"],
    )

    op.create_table(
        "prescription_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prescription_id", sa.String(36), nullable=False),
        sa.Column("item_index", sa.Integer(), nullable=False),
        sa.Column("drug_name", sa.String(160), nullable=False),
        sa.Column("dosage", sa.String(80), nullable=False),
        sa.Column("frequency", sa.String(160), nullable=False),
        sa.Column("duration", sa.String(80), nullable=False),
        sa.Column("dispensed_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["prescription_id"], ["prescription_copies.id"]),
        sa.UniqueConstraint("prescription_id", "item_index", name="uq_prescription_item_index"),
        sa.CheckConstraint(
            "dispensed_quantity >= 0", name="ck_items_dispensed_nonnegative"
        ),
    )

    op.create_table(
        "dispensings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prescription_id", sa.String(36), nullable=False),
        sa.Column("pharmacist_id", sa.String(36), nullable=False),
        sa.Column("dispensed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dispensings_prescription_id", "dispensings", ["prescription_id"])

    op.create_table(
        "dispensing_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dispensing_id", sa.String(36), nullable=False),
        sa.Column("item_index", sa.Integer(), nullable=False),
        sa.Column("drug_id", sa.String(36), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["dispensing_id"], ["dispensings.id"]),
        sa.CheckConstraint(
            "quantity > 0", name="ck_dispensing_items_quantity_positive"
        ),
    )


def downgrade():
    op.drop_table("dispensing_items")
    op.drop_index("ix_dispensings_prescription_id", table_name="dispensings")
    op.drop_table("dispensings")
    op.drop_table("prescription_items")
    op.drop_index("ix_prescriptions_patient_status", table_name="prescription_copies")
    op.drop_table("prescription_copies")
    op.drop_index("ix_drugs_name_strength", table_name="drugs")
    op.drop_table("drugs")
