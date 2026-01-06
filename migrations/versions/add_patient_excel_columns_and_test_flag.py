"""Add patient Excel columns and is_test flag

Revision ID: 04232db42ae6
Revises: fcd5e0a5f772
Create Date: 2025-01-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04232db42ae6'
down_revision: Union[str, None] = 'fcd5e0a5f772'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns from Excel file
    op.add_column('patients', sa.Column('account_status', sa.String(length=50), nullable=True))
    op.add_column('patients', sa.Column('registration_date', sa.Date(), nullable=True))
    op.add_column('patients', sa.Column('category', sa.String(length=100), nullable=True))
    
    # Add is_test flag to distinguish test patients from real ones
    # Default to False (real patients), existing test patients should be manually updated
    op.add_column('patients', sa.Column('is_test', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove the columns we added
    op.drop_column('patients', 'is_test')
    op.drop_column('patients', 'category')
    op.drop_column('patients', 'registration_date')
    op.drop_column('patients', 'account_status')

