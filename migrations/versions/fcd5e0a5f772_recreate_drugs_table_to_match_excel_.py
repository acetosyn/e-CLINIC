"""Recreate drugs table to match Excel columns

Revision ID: fcd5e0a5f772
Revises: ff0ac5d47645
Create Date: 2025-11-16 15:40:50.681429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fcd5e0a5f772'
down_revision: Union[str, None] = 'ff0ac5d47645'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing drugs table
    op.drop_table('drugs')
    
    # Create new drugs table matching Excel columns
    op.create_table(
        'drugs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('serial_number', sa.Integer(), nullable=True),  # S/N from Excel
        sa.Column('name', sa.String(length=255), nullable=False),  # Name from Excel
        sa.Column('outsourced_price', sa.Numeric(precision=10, scale=2), nullable=True),  # Outsourced (B)
        sa.Column('walkin_patient_price', sa.Numeric(precision=10, scale=2), nullable=True),  # Walk in Patient (C)
        sa.Column('hospital_patient_price', sa.Numeric(precision=10, scale=2), nullable=True),  # Hospital Patient (D)
        sa.Column('category', sa.String(length=255), nullable=True),  # Category from Excel
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Revert to old structure (if needed)
    op.drop_table('drugs')
    op.create_table(
        'drugs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('drug_name', sa.String(length=255), nullable=False),
        sa.Column('generic_name', sa.String(length=255), nullable=True),
        sa.Column('dosage_form', sa.String(length=100), nullable=True),
        sa.Column('strength', sa.String(length=100), nullable=True),
        sa.Column('manufacturer', sa.String(length=255), nullable=True),
        sa.Column('batch_number', sa.String(length=100), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('category', sa.String(length=255), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

