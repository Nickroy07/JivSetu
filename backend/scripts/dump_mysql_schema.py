"""Regenerate sql/00_schema_mysql.sql from the SQLAlchemy models."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.dialects import mysql  # noqa: E402
from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: E402

import app.models  # noqa: E402,F401
from app.db import Base  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "sql" / "00_schema_mysql.sql"


def main() -> None:
    dialect = mysql.dialect()
    lines = [
        "-- GENERATED from backend/app/models by backend/scripts/dump_mysql_schema.py. Do not edit by hand.",
        "-- Fresh install: mysql -u root -p < sql/00_schema_mysql.sql   (or run: python backend/init_db.py)",
        "CREATE DATABASE IF NOT EXISTS jivsetu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        "USE jivsetu;",
        "",
    ]
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table, if_not_exists=True).compile(dialect=dialect)).strip()
        lines.append(ddl + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n")
        lines.extend(str(CreateIndex(index).compile(dialect=dialect)).strip() + ";" for index in table.indexes)
        lines.append("")
    lines.append(
        "INSERT IGNORE INTO hospitals (hospital_code, name, name_hi, name_mr, is_active) VALUES "
        "('JANSEVA-DGH', 'Janseva District Government Hospital', 'जनसेवा जिला सरकारी अस्पताल', "
        "'जनसेवा जिल्हा सरकारी रुग्णालय', 1);"
    )
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
