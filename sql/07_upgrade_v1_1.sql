-- v1 -> v1.1: server-side token revocation and consent ledger. Additive only; no data is modified.

CREATE TABLE IF NOT EXISTS revoked_tokens (
	jti VARCHAR(64) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	revoked_at DATETIME NOT NULL DEFAULT now(), 
	PRIMARY KEY (jti)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_revoked_tokens_expires_at ON revoked_tokens (expires_at);

CREATE INDEX ix_revoked_tokens_expires_at ON revoked_tokens (expires_at);

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

CREATE INDEX ix_consents_visit_id ON consents (visit_id);

CREATE INDEX ix_consents_visit_id ON consents (visit_id);

CREATE INDEX ix_consents_patient_id ON consents (patient_id);

CREATE INDEX ix_consents_created_at ON consents (created_at);
