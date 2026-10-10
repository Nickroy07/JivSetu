-- v1.1 -> v1.2: AYUSH assessments. Additive only; no data is modified.
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
CREATE INDEX ix_ayush_assessments_patient_id ON ayush_assessments (patient_id);
CREATE INDEX ix_ayush_assessments_visit_id ON ayush_assessments (visit_id);
