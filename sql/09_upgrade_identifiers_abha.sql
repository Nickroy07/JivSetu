-- v1.2 -> v1.3: patient_identifiers (card/QR tokens) and abha_links. Additive only; no data is modified.

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

CREATE INDEX ix_patient_identifiers_patient_id ON patient_identifiers (patient_id);

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
