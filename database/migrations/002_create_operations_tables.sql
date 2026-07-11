CREATE TABLE IF NOT EXISTS `github_repositories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `github_id` BIGINT UNSIGNED NOT NULL,
  `owner` VARCHAR(120) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `full_name` VARCHAR(320) NOT NULL,
  `description` TEXT NULL,
  `visibility` ENUM('public', 'private', 'internal') NOT NULL DEFAULT 'private',
  `default_branch` VARCHAR(190) NOT NULL DEFAULT 'main',
  `language` VARCHAR(80) NULL,
  `html_url` VARCHAR(500) NOT NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `open_issues_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `pushed_at` DATETIME NULL,
  `synced_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `github_repositories_github_id_unique` (`github_id`),
  UNIQUE KEY `github_repositories_full_name_unique` (`full_name`),
  KEY `github_repositories_owner_index` (`owner`),
  KEY `github_repositories_pushed_at_index` (`pushed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `github_workflow_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `github_id` BIGINT UNSIGNED NOT NULL,
  `repository_id` BIGINT UNSIGNED NOT NULL,
  `workflow_name` VARCHAR(255) NOT NULL,
  `event_name` VARCHAR(80) NOT NULL,
  `branch` VARCHAR(190) NULL,
  `head_sha` CHAR(40) NULL,
  `run_number` INT UNSIGNED NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `conclusion` VARCHAR(40) NULL,
  `actor_login` VARCHAR(120) NULL,
  `html_url` VARCHAR(500) NOT NULL,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `synced_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `github_workflow_runs_github_id_unique` (`github_id`),
  KEY `github_workflow_runs_repo_started_index` (`repository_id`, `started_at`),
  KEY `github_workflow_runs_status_index` (`status`, `conclusion`),
  CONSTRAINT `github_workflow_runs_repository_fk`
    FOREIGN KEY (`repository_id`) REFERENCES `github_repositories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `integration_syncs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `integration` VARCHAR(60) NOT NULL,
  `status` ENUM('running', 'success', 'failed') NOT NULL,
  `items_synced` INT UNSIGNED NOT NULL DEFAULT 0,
  `message` VARCHAR(500) NULL,
  `started_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `integration_syncs_latest_index` (`integration`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `server_metric_snapshots` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `server_key` VARCHAR(120) NOT NULL,
  `cpu_percent` DECIMAL(5,2) NULL,
  `memory_percent` DECIMAL(5,2) NULL,
  `swap_percent` DECIMAL(5,2) NULL,
  `disk_percent` DECIMAL(5,2) NULL,
  `load_1m` DECIMAL(8,2) NULL,
  `load_5m` DECIMAL(8,2) NULL,
  `load_15m` DECIMAL(8,2) NULL,
  `captured_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `server_metric_snapshots_server_time_index` (`server_key`, `captured_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
