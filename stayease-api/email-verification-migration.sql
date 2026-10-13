ALTER TABLE users
    ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN verification_code VARCHAR(6) NULL,
    ADD COLUMN code_expires_at DATETIME NULL;
