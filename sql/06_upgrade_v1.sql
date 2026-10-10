-- One-time upgrade for databases created from the legacy scripts
-- (01_schema.sql, 04_*, 05_*). Run ONCE, after taking a backup:
--   mysqldump -u root -p jivsetu > backup.sql
--   mysql -u root -p jivsetu < sql/06_upgrade_v1.sql
-- Then run `python init_db.py` from backend/ to create any missing tables.
USE jivsetu;

ALTER TABLE medical_documents
    ADD COLUMN visit_id BIGINT UNSIGNED NULL AFTER patient_id,
    ADD COLUMN sha256 VARCHAR(64) NULL,
    ADD COLUMN extraction_method VARCHAR(30) NULL,
    ADD COLUMN processing_error VARCHAR(500) NULL,
    ADD COLUMN processing_attempts INT NOT NULL DEFAULT 0,
    MODIFY upload_status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    MODIFY ocr_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD INDEX ix_medical_documents_sha256 (sha256),
    ADD INDEX ix_medical_documents_visit_id (visit_id);

ALTER TABLE clinical_document_extractions
    MODIFY extraction_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    ADD COLUMN fields_found INT NOT NULL DEFAULT 0,
    ADD COLUMN reviewed_data JSON NULL,
    ADD COLUMN reviewed_by VARCHAR(100) NULL,
    ADD COLUMN reviewed_at DATETIME NULL;

ALTER TABLE clinical_histories
    ADD COLUMN ai_summary JSON NULL,
    ADD COLUMN doctor_edits JSON NULL,
    ADD COLUMN reviewed_by VARCHAR(100) NULL,
    ADD COLUMN reviewed_at DATETIME NULL,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE patient_visits
    MODIFY status VARCHAR(30) NOT NULL DEFAULT 'waiting';

CREATE TABLE IF NOT EXISTS otp_challenges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(15) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    code_hash VARCHAR(128) NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_otp_challenges_mobile (mobile),
    INDEX ix_otp_challenges_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
