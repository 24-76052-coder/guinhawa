<?php
/**
 * Database and application configuration.
 *
 * These are the default XAMPP values (MySQL on 127.0.0.1:3306, user root with
 * no password). Change them here if your XAMPP installation uses a password.
 */

declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('GUINHAWA_DB_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('GUINHAWA_DB_PORT') ?: 3306),
        'name' => getenv('GUINHAWA_DB_NAME') ?: 'guinhawa_db',
        'user' => getenv('GUINHAWA_DB_USER') ?: 'root',
        'password' => getenv('GUINHAWA_DB_PASSWORD') ?: '',
        'charset' => 'utf8mb4',
    ],

    // PHP session cookie used by the API. Same-origin only.
    'session' => [
        'name' => 'guinhawa_session',
        'lifetime' => 60 * 60 * 8,
    ],

    'app' => [
        'timezone' => 'Asia/Manila',
        'debug' => filter_var(getenv('GUINHAWA_DEBUG') ?: '0', FILTER_VALIDATE_BOOL),
    ],
];
