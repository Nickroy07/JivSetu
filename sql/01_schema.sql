CREATE DATABASE IF NOT EXISTS jivsetu
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE jivsetu;

CREATE TABLE IF NOT EXISTS hospitals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hospital_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    name_hi VARCHAR(255) NULL,
    name_mr VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_code VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role ENUM('patient', 'doctor', 'admin') NOT NULL,
    hospital_id BIGINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_users_role (role),
    INDEX idx_users_hospital (hospital_id),
    CONSTRAINT chk_patient_hospital
        CHECK (role = 'patient' OR hospital_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS patients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL UNIQUE,
    date_of_birth DATE NULL,
    gender VARCHAR(30) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_patients_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_patients_mobile (mobile)
);

CREATE TABLE IF NOT EXISTS doctors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL UNIQUE,
    hospital_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_doctors_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_doctors_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS patient_consents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT UNSIGNED NOT NULL,
    encounter_id BIGINT UNSIGNED NULL,
    consent_type ENUM(
        'case_taking',
        'voice_processing',
        'document_processing',
        'data_sharing'
    ) NOT NULL,
    status ENUM('granted', 'revoked') NOT NULL,
    granted_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    version VARCHAR(30) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consents_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_consents_patient_type (patient_id, consent_type)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NULL,
    hospital_id BIGINT UNSIGNED NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_audit_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_audit_actor (actor_user_id),
    INDEX idx_audit_hospital_time (hospital_id, created_at),
    INDEX idx_audit_resource (resource_type, resource_id)
);

INSERT INTO hospitals (hospital_code, name, name_hi, name_mr)
VALUES (
    'JANSEVA-DGH',
    'Janseva District Government Hospital',
    'जनसेवा जिला सरकारी अस्पताल',
    'जनसेवा जिल्हा सरकारी रुग्णालय'
)
ON DUPLICATE KEY UPDATE name = VALUES(name);
