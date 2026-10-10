USE jivsetu;

CREATE TABLE IF NOT EXISTS patient_visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    patient_id BIGINT UNSIGNED NOT NULL,
    hospital_id BIGINT UNSIGNED NOT NULL,
    visit_date DATE NOT NULL,
    status ENUM(
        'waiting',
        'in_interview',
        'documents_uploaded',
        'ready_for_review',
        'completed'
    ) NOT NULL DEFAULT 'waiting',
    chief_complaint VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_patient_visits_date (visit_date),
    KEY idx_patient_visits_status (status),
    KEY idx_patient_visits_hospital (hospital_id),
    KEY idx_patient_visits_patient (patient_id),
    CONSTRAINT fk_patient_visits_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_patient_visits_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
