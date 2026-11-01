<?php
/**
 * Secure initial administrator setup.
 *
 * Run this once, from a terminal, after importing guinhawa_db.sql:
 *
 *   C:\xampp2\php\php.exe backend\scripts\setup_admin.php --username=admin --name="System Administrator"
 *
 * The script refuses to run when an admin already exists. It can only be run
 * from the command line, so a browser cannot create the administrator account.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This setup script can only be run from the command line.\n");
}

require __DIR__ . '/../bootstrap.php';

use Guinhawa\Database;
use Guinhawa\Validator;

function argument(string $name): ?string
{
    global $argv;
    foreach ($argv as $argument) {
        if (str_starts_with($argument, "--{$name}=")) {
            return substr($argument, strlen($name) + 3);
        }
        if ($argument === "--{$name}") {
            return '';
        }
    }
    return null;
}

echo "==============================================\n";
echo " Guinhawa Poultry Supply - Admin Setup\n";
echo "==============================================\n";

try {
    $existing = Database::fetchOne('SELECT id, username, full_name FROM admin WHERE id = 1 LIMIT 1');
    if ($existing) {
        fwrite(STDERR, "\nAn administrator already exists ({$existing['username']}).\n");
        fwrite(STDERR, "This system allows exactly one Admin account. Use the Settings page to change its password.\n");
        exit(1);
    }

    $username = argument('username');
    $name = argument('name');
    $password = argument('password');

    if ($username === null || $username === '') {
        fwrite(STDOUT, "Admin username [admin]: ");
        $line = trim((string) fgets(STDIN));
        $username = $line !== '' ? $line : 'admin';
    }
    if ($name === null || $name === '') {
        fwrite(STDOUT, "Admin full name [System Administrator]: ");
        $line = trim((string) fgets(STDIN));
        $name = $line !== '' ? $line : 'System Administrator';
    }

    $generated = false;
    if ($password === null || $password === '') {
        $generated = true;
        $password = Validator::temporaryPassword() . random_int(10, 99);
    }

    $username = Validator::username($username);
    $name = Validator::text($name, 'Admin full name', 1, 160);
    $password = Validator::password($password, 'Admin password');

    Database::execute(
        'INSERT INTO admin (id, username, full_name, password_hash, must_change_password)
         VALUES (1, ?, ?, ?, 0)',
        [$username, $name, password_hash($password, PASSWORD_DEFAULT)],
    );

    echo "\nAdministrator created successfully.\n\n";
    echo "  Username : {$username}\n";
    echo "  Name     : {$name}\n";
    if ($generated) {
        echo "  Password : {$password}\n\n";
        echo "Write this password down now. It will not be shown again.\n";
    } else {
        echo "  Password : (the value you supplied)\n";
    }
    echo "\nSign in at http://localhost/guinhawa/ and change the password from Settings > Profile.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "\nSetup failed: " . $error->getMessage() . "\n");
    fwrite(STDERR, "Make sure MySQL is running and guinhawa_db.sql has been imported.\n");
    exit(1);
}
