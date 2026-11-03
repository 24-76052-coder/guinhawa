-- =====================================================================
-- Guinhawa Poultry Supply — create the single Admin account
--
-- The CLI setup script (backend/scripts/setup_admin.php) cannot run on
-- shared hosting without SSH, so use this SQL instead.
--
-- 1. Generate a password hash on your own PC with XAMPP's PHP:
--
--    C:\xampp2\php\php.exe -r "echo password_hash('YourStrongPassword', PASSWORD_DEFAULT);"
--
-- 2. Replace PASTE_HASH_HERE below with that output (keep the quotes).
-- 3. Run this statement in phpMyAdmin on the HOSTED database.
--
-- Remove this file from the server afterwards if you uploaded the deploy
-- folder. The statement fails if an admin already exists, so it is harmless
-- to keep, but there is no reason to publish it.
-- =====================================================================

INSERT INTO admin (id, username, full_name, password_hash, must_change_password)
VALUES (1, 'admin', 'System Administrator', 'PASTE_HASH_HERE', 0);
