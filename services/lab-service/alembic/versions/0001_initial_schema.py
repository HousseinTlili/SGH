"""initial schema

Revision ID: 0001
Revises:

Every table is created only when it is missing, so a database that was created by the earlier
`create_all` start-up (no alembic_version table) is adopted instead of failing.
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _create_if_missing(name: str, *columns, **kwargs) -> None:
    if not sa.inspect(op.get_bind()).has_table(name):
        op.create_table(name, *columns, **kwargs)


def upgrade() -> None:
    _create_if_missing(
        "tests",
        sa.Column("code", sa.String(10), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("unit", sa.String(30), nullable=False),
        sa.Column("ref_low", sa.Float, nullable=False),
        sa.Column("ref_high", sa.Float, nullable=False),
        sa.Column("critical_low", sa.Float, nullable=True),
        sa.Column("critical_high", sa.Float, nullable=True),
    )

    _create_if_missing(
        "lab_requests",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("consultation_id", sa.Uuid, nullable=False),
        sa.Column("patient_id", sa.Uuid, nullable=False),
        sa.Column("doctor_id", sa.Uuid, nullable=False),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_by", sa.Uuid, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for column in ("consultation_id", "patient_id", "doctor_id", "status", "validated_at"):
        op.create_index(f"ix_lab_requests_{column}", "lab_requests", [column], if_not_exists=True)

    _create_if_missing(
        "lab_request_tests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("lab_request_id", sa.Uuid, sa.ForeignKey("lab_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
    )
    op.create_index("ix_lab_request_tests_lab_request_id", "lab_request_tests", ["lab_request_id"], if_not_exists=True)

    _create_if_missing(
        "lab_results",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("lab_request_id", sa.Uuid, sa.ForeignKey("lab_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", sa.Uuid, nullable=False),
        sa.Column("test_code", sa.String(10), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("unit", sa.String(30), nullable=False),
        sa.Column("reference_range", sa.String(50), nullable=False),
        sa.Column("flag", sa.String(20), nullable=False),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for column in ("lab_request_id", "patient_id", "validated_at"):
        op.create_index(f"ix_lab_results_{column}", "lab_results", [column], if_not_exists=True)

    _create_if_missing(
        "processed_events",
        sa.Column("event_id", sa.String(100), primary_key=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for table in ("processed_events", "lab_results", "lab_request_tests", "lab_requests", "tests"):
        op.drop_table(table)
