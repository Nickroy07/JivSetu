# Database scripts

| File | Use |
|---|---|
| `00_schema_mysql.sql` | **Fresh install.** Generated from `backend/app/models`. |
| `09_upgrade_identifiers_abha.sql` | Adds `patient_identifiers` and `abha_links` (apply after 08 if upgrading). |
| `08_upgrade_ayush.sql` | Adds `ayush_assessments` (apply after 07 if upgrading). |
| `07_upgrade_v1_1.sql` | Adds `revoked_tokens` and `consents` (apply after 06 if upgrading). |
| `06_upgrade_v1.sql` | One-time upgrade for databases created by the legacy scripts. |
| `01_schema.sql`, `04_*`, `05_*` | Legacy (pre-v1). Kept for reference; do not use for new installs. |

The preferred path is `python init_db.py` from `backend/`, which creates the same
schema through SQLAlchemy on MySQL or SQLite and seeds the default hospital.

Regenerate `00_schema_mysql.sql` after changing a model:

```bash
cd backend
JWT_SECRET_KEY=x DATABASE_URL=sqlite:// python scripts/dump_mysql_schema.py
```
