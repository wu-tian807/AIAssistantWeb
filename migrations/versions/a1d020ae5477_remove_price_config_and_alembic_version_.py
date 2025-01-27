"""remove price_config and alembic_version tables

Revision ID: a1d020ae5477
Revises: 63ce91c8539c
Create Date: 2025-01-08 01:18:34.912893

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1d020ae5477'
down_revision = '63ce91c8539c'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('price_config')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('price_config',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('model_name', sa.VARCHAR(length=100), nullable=False),
    sa.Column('input_price', sa.FLOAT(), nullable=False),
    sa.Column('output_price', sa.FLOAT(), nullable=False),
    sa.Column('created_at', sa.DATETIME(), nullable=True),
    sa.Column('updated_at', sa.DATETIME(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('model_name')
    )
    # ### end Alembic commands ###
