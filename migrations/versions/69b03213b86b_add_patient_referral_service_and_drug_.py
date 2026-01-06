"""Add patient referral service and drug tables

Revision ID: 69b03213b86b
Revises: eba042eebb1e
Create Date: 2025-11-16 14:11:06.801237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69b03213b86b'
down_revision: Union[str, None] = 'eba042eebb1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create referrals table
    op.create_table(
        'referrals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('contact', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create services table
    op.create_table(
        'services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_type', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create drugs table
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
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create patients table
    op.create_table(
        'patients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_no', sa.String(length=50), nullable=False),
        sa.Column('patient_id', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=20), nullable=True),
        sa.Column('first_name', sa.String(length=255), nullable=False),
        sa.Column('last_name', sa.String(length=255), nullable=False),
        sa.Column('date_of_birth', sa.Date(), nullable=False),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('sex', sa.String(length=20), nullable=False),
        sa.Column('occupation', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('referred_by_id', sa.Integer(), nullable=True),
        sa.Column('registered_by', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_no'),
        sa.UniqueConstraint('patient_id'),
        sa.ForeignKeyConstraint(['referred_by_id'], ['referrals.id'], name='fk_patients_referred_by_id')
    )


def downgrade() -> None:
    op.drop_table('patients')
    op.drop_table('drugs')
    op.drop_table('services')
    op.drop_table('referrals')

