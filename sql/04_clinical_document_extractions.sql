USE jivsetu;

CREATE TABLE IF NOT EXISTS clinical_document_extractions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    document_id BIGINT UNSIGNED NOT NULL,
    extraction_status ENUM('completed','failed') NOT NULL DEFAULT 'completed',
    extracted_data JSON NOT NULL,
    confidence DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clinical_extraction_document (document_id),
    KEY idx_clinical_extraction_document_id (document_id),
    CONSTRAINT fk_clinical_extraction_document
        FOREIGN KEY (document_id)
        REFERENCES medical_documents(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
