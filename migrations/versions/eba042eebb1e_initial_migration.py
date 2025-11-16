"""Initial migration - activities table

Revision ID: eba042eebb1e
Revises: 001_initial
Create Date: 2025-11-16 13:07:04.373576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'eba042eebb1e'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create activities table if it doesn't exist
    # Table may already exist from previous setup
    from sqlalchemy import inspect
    
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    
    if 'activities' not in existing_tables:
        op.create_table(
            'activities',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('department', sa.String(length=100), nullable=False),
            sa.Column('activity_type', sa.String(length=100), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('patient_name', sa.String(length=255), nullable=True),
            sa.Column('patient_id', sa.String(length=100), nullable=True),
            sa.Column('performed_by', sa.String(length=255), nullable=False),
            sa.Column('activity_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    op.drop_table('activities')

