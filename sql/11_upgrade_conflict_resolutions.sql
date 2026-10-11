-- Clinician decisions on conflicts between patient answers and documents (append-only).
-- Safe to run once on an existing database; it only creates a new table.
CREATE TABLE IF NOT EXISTS `conflict_resolutions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `visit_id` BIGINT NOT NULL,
  `field` VARCHAR(64) NOT NULL,
  `decision` VARCHAR(30) NOT NULL,
  `reason` TEXT NOT NULL,
  `resolved_by` VARCHAR(100) NOT NULL,
  `resolved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `ix_conflict_resolutions_visit_id` (`visit_id`),
  CONSTRAINT `fk_conflict_resolutions_visit` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
