from pathlib import Path

from alembic.config import Config

import app.models  # noqa: F401
from app.database import Base


def test_alembic_config_exists():
    assert Path("alembic.ini").exists()
    assert Path("migrations/env.py").exists()
    assert Path("migrations/versions").exists()


def test_alembic_script_location_is_backend_alembic():
    config = Config("alembic.ini")

    assert config.get_main_option("script_location") == "migrations"


def test_model_metadata_is_available_for_alembic():
    table_names = set(Base.metadata.tables)

    assert "transactions" in table_names
    assert "owed_items" in table_names
    assert "import_batches" in table_names
    assert "wealth_snapshots" in table_names
