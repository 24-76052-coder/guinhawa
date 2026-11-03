<?php
/**
 * Database and application configuration.
 *
 * These are the default XAMPP values (MySQL on 127.0.0.1:3306, user root with
 * no password). Change them here if your XAMPP installation uses a password.
 *
 * Hosting without environment variables (shared PHP hosting) can drop a
 * `config.local.php` next to this file that returns overrides, for example:
 *
 *   return [
 *       'db' => ['host' => 'sql123.example.com', 'user' => '...', 'password' => '...'],
 *       'cors' => ['allowed_origins' => ['https://guinhawa.vercel.app']],
 *       'session' => ['same_site' => 'None', 'secure' => '1'],
 *   ];
 *
 * See `deploy/config.local.example.php`. The file is ignored by git.
 */

declare(strict_types=1);

$cookieSecure = getenv('GUINHAWA_COOKIE_SECURE');

$config = [
    'db' => [
        'host' => getenv('GUINHAWA_DB_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('GUINHAWA_DB_PORT') ?: 3306),
        'name' => getenv('GUINHAWA_DB_NAME') ?: 'guinhawa_db',
        'user' => getenv('GUINHAWA_DB_USER') ?: 'root',
        'password' => getenv('GUINHAWA_DB_PASSWORD') ?: '',
        'charset' => 'utf8mb4',
    ],

    // PHP session cookie used by the API.
    //
    // `Lax` is correct for XAMPP and for any setup where the frontend and API
    // share an origin. When the React app is hosted separately (Vercel calling
    // a PHP host), browsers only send the cookie on cross-site requests when it
    // is `None` + `Secure`, so set both on the API host.
    'session' => [
        'name' => 'guinhawa_session',
        'lifetime' => 60 * 60 * 8,
        'same_site' => getenv('GUINHAWA_COOKIE_SAMESITE') ?: 'Lax',
        // Empty string means "detect HTTPS automatically".
        'secure' => $cookieSecure === false ? '' : $cookieSecure,
    ],

    // Exact browser origins allowed to call this API with cookies. Leave empty
    // for same-origin hosting (XAMPP) — no CORS headers are sent then.
    'cors' => [
        'allowed_origins' => array_values(array_filter(array_map(
            'trim',
            explode(',', getenv('GUINHAWA_ALLOWED_ORIGINS') ?: ''),
        ))),
    ],

    'app' => [
        'timezone' => 'Asia/Manila',
        'debug' => filter_var(getenv('GUINHAWA_DEBUG') ?: '0', FILTER_VALIDATE_BOOL),
    ],
];

// Optional overrides for shared hosts that cannot set environment variables.
$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    $overrides = require $localConfig;
    if (is_array($overrides)) {
        $config = array_replace_recursive($config, $overrides);
    }
}

return $config;
