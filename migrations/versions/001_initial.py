"""Initial migration - users table

Revision ID: 001_initial
Revises: 
Create Date: 2025-01-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table already exists in Supabase, so this is a no-op
    # This migration just marks the initial state
    pass


def downgrade() -> None:
    # No downgrade needed since table already exists
    pass

