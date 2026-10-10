-- GENERATED from backend/app/models by backend/scripts/dump_mysql_schema.py. Do not edit by hand.
-- Fresh install: mysql -u root -p < sql/00_schema_mysql.sql   (or run: python backend/init_db.py)
CREATE DATABASE IF NOT EXISTS jivsetu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jivsetu;

CREATE TABLE IF NOT EXISTS hospitals (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	hospital_code VARCHAR(50) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	name_hi VARCHAR(255), 
	name_mr VARCHAR(255), 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (hospital_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS otp_challenges (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	mobile VARCHAR(15) NOT NULL, 
	provider VARCHAR(20) NOT NULL, 
	code_hash VARCHAR(128), 
	attempts INTEGER NOT NULL, 
	expires_at DATETIME NOT NULL, 
	consumed_at DATETIME, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_otp_challenges_created_at ON otp_challenges (created_at);
CREATE INDEX ix_otp_challenges_mobile ON otp_challenges (mobile);

CREATE TABLE IF NOT EXISTS revoked_tokens (
	jti VARCHAR(64) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	revoked_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (jti)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_revoked_tokens_expires_at ON revoked_tokens (expires_at);

CREATE TABLE IF NOT EXISTS users (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	user_code VARCHAR(100) NOT NULL, 
	password_hash VARCHAR(255), 
	`role` VARCHAR(20) NOT NULL, 
	hospital_id BIGINT, 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (user_code), 
	FOREIGN KEY(hospital_id) REFERENCES hospitals (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_users_role ON users (`role`);
CREATE INDEX ix_users_hospital_id ON users (hospital_id);

CREATE TABLE IF NOT EXISTS audit_logs (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	actor_user_id BIGINT, 
	hospital_id BIGINT, 
	action VARCHAR(80) NOT NULL, 
	resource_type VARCHAR(80) NOT NULL, 
	resource_id VARCHAR(128) NOT NULL, 
	details TEXT, 
	ip_address VARCHAR(45), 
	created_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(hospital_id) REFERENCES hospitals (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS doctors (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	user_id BIGINT NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	email VARCHAR(255), 
	hospital_id BIGINT NOT NULL, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (email), 
	FOREIGN KEY(hospital_id) REFERENCES hospitals (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS patients (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	user_id BIGINT NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	mobile VARCHAR(15) NOT NULL, 
	date_of_birth DATE, 
	gender VARCHAR(30), 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX ix_patients_mobile ON patients (mobile);

CREATE TABLE IF NOT EXISTS abha_links (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT NOT NULL, 
	abha_number VARCHAR(14) NOT NULL, 
	abha_address VARCHAR(100), 
	verified BOOL NOT NULL, 
	verification_source VARCHAR(20) NOT NULL, 
	linked_by BIGINT, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (patient_id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	FOREIGN KEY(linked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS patient_identifiers (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT NOT NULL, 
	kind VARCHAR(10) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	is_active BOOL NOT NULL, 
	issued_by BIGINT, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	last_used_at DATETIME, 
	deactivated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	UNIQUE (token_hash), 
	FOREIGN KEY(issued_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_patient_identifiers_patient_id ON patient_identifiers (patient_id);

CREATE TABLE IF NOT EXISTS patient_visits (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT NOT NULL, 
	hospital_id BIGINT NOT NULL, 
	visit_date DATE NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	chief_complaint VARCHAR(255), 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	FOREIGN KEY(hospital_id) REFERENCES hospitals (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_patient_visits_status ON patient_visits (status);
CREATE INDEX ix_patient_visits_hospital_id ON patient_visits (hospital_id);
CREATE INDEX ix_patient_visits_visit_date ON patient_visits (visit_date);
CREATE INDEX ix_patient_visits_patient_id ON patient_visits (patient_id);

CREATE TABLE IF NOT EXISTS ayush_assessments (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT NOT NULL, 
	visit_id BIGINT NOT NULL, 
	module VARCHAR(20) NOT NULL, 
	data JSON NOT NULL, 
	sources JSON NOT NULL, 
	history JSON NOT NULL, 
	review_status VARCHAR(20) NOT NULL, 
	reviewed_by VARCHAR(100), 
	reviewed_at DATETIME, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_ayush_visit_module UNIQUE (visit_id, module), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	FOREIGN KEY(visit_id) REFERENCES patient_visits (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_ayush_assessments_patient_id ON ayush_assessments (patient_id);
CREATE INDEX ix_ayush_assessments_visit_id ON ayush_assessments (visit_id);

CREATE TABLE IF NOT EXISTS clinical_histories (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	visit_id BIGINT NOT NULL, 
	patient_id BIGINT NOT NULL, 
	chief_complaint VARCHAR(255), 
	history_data JSON NOT NULL, 
	red_flags JSON, 
	ai_summary JSON, 
	doctor_edits JSON, 
	completion_status VARCHAR(30) NOT NULL, 
	physician_status VARCHAR(30) NOT NULL, 
	physician_notes TEXT, 
	reviewed_by VARCHAR(100), 
	reviewed_at DATETIME, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (visit_id), 
	FOREIGN KEY(visit_id) REFERENCES patient_visits (id) ON DELETE CASCADE, 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_clinical_histories_patient_id ON clinical_histories (patient_id);

CREATE TABLE IF NOT EXISTS consents (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT NOT NULL, 
	visit_id BIGINT, 
	purpose VARCHAR(40) NOT NULL, 
	granted BOOL NOT NULL, 
	text_version VARCHAR(20) NOT NULL, 
	language VARCHAR(5), 
	created_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	FOREIGN KEY(visit_id) REFERENCES patient_visits (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_consents_patient_id ON consents (patient_id);
CREATE INDEX ix_consents_created_at ON consents (created_at);
CREATE INDEX ix_consents_visit_id ON consents (visit_id);

CREATE TABLE IF NOT EXISTS medical_documents (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	patient_id BIGINT, 
	visit_id BIGINT, 
	document_type VARCHAR(50) NOT NULL, 
	original_filename VARCHAR(255) NOT NULL, 
	stored_filename VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	mime_type VARCHAR(100) NOT NULL, 
	file_size BIGINT NOT NULL, 
	sha256 VARCHAR(64), 
	upload_status VARCHAR(20) NOT NULL, 
	ocr_status VARCHAR(20) NOT NULL, 
	ocr_text TEXT, 
	extraction_method VARCHAR(30), 
	processing_error VARCHAR(500), 
	processing_attempts INTEGER NOT NULL, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id) ON DELETE CASCADE, 
	FOREIGN KEY(visit_id) REFERENCES patient_visits (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_medical_documents_patient_id ON medical_documents (patient_id);
CREATE INDEX ix_medical_documents_visit_id ON medical_documents (visit_id);
CREATE INDEX ix_medical_documents_sha256 ON medical_documents (sha256);

CREATE TABLE IF NOT EXISTS clinical_document_extractions (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	document_id BIGINT NOT NULL, 
	extraction_status VARCHAR(20) NOT NULL, 
	extracted_data JSON NOT NULL, 
	confidence NUMERIC(5, 2) NOT NULL, 
	fields_found INTEGER NOT NULL, 
	reviewed_data JSON, 
	reviewed_by VARCHAR(100), 
	reviewed_at DATETIME, 
	created_at DATETIME NOT NULL DEFAULT now(), 
	updated_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (document_id), 
	FOREIGN KEY(document_id) REFERENCES medical_documents (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT IGNORE INTO hospitals (hospital_code, name, name_hi, name_mr, is_active) VALUES ('JANSEVA-DGH', 'Janseva District Government Hospital', 'जनसेवा जिला सरकारी अस्पताल', 'जनसेवा जिल्हा सरकारी रुग्णालय', 1);
