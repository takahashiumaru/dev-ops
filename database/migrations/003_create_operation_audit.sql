CREATE TABLE IF NOT EXISTS `operation_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `user_name` VARCHAR(120) NOT NULL,
  `user_role` VARCHAR(40) NOT NULL,
  `action_name` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(40) NOT NULL,
  `target_name` VARCHAR(190) NOT NULL,
  `status` ENUM('running', 'scheduled', 'success', 'failed') NOT NULL DEFAULT 'running',
  `message` VARCHAR(500) NULL,
  `request_ip` VARCHAR(100) NULL,
  `metadata_json` JSON NULL,
  `started_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operation_audit_request_unique` (`request_id`),
  KEY `operation_audit_latest_index` (`started_at`),
  KEY `operation_audit_target_index` (`target_type`, `target_name`, `started_at`),
  KEY `operation_audit_user_index` (`user_id`, `started_at`),
  CONSTRAINT `operation_audit_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
