"""Add user settings

Revision ID: 4de1c210a79d
Revises: c5a7aec8df37
Create Date: 2025-01-07 06:38:20.979464

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4de1c210a79d'
down_revision = 'c5a7aec8df37'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('settings', sa.JSON(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('settings')

    # ### end Alembic commands ###