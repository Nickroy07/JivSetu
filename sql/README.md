# Database scripts

| File | Use |
|---|---|
| `00_schema_mysql.sql` | **Fresh install.** Generated from `backend/app/models`. |
| `06_upgrade_v1.sql` | One-time upgrade for databases created by the legacy scripts. |
| `01_schema.sql`, `04_*`, `05_*` | Legacy (pre-v1). Kept for reference; do not use for new installs. |

The preferred path is `python init_db.py` from `backend/`, which creates the same
schema through SQLAlchemy on MySQL or SQLite and seeds the default hospital.

Regenerate `00_schema_mysql.sql` after changing a model:

```bash
cd backend
JWT_SECRET_KEY=x DATABASE_URL=sqlite:// python scripts/dump_mysql_schema.py
```
