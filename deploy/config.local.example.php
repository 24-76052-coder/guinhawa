<?php
/**
 * Example hosting overrides for Guinhawa.
 *
 * Copy this file to `backend/config/config.local.php` on the PHP host and fill
 * in the real values. That file is ignored by git, so passwords stay out of the
 * repository. XAMPP does not need it — the defaults in config.php already work.
 */

declare(strict_types=1);

return [
    // Database details from your hosting control panel (Plesk/DirectAdmin).
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'your_account_guinhawa',
        'user' => 'your_account_guinhawa',
        'password' => 'the-database-password',
    ],

    // Exact frontend origins allowed to call this API with the session cookie.
    // No trailing slash. Add preview domains if you use them.
    'cors' => [
        'allowed_origins' => [
            'https://guinhawa.vercel.app',
        ],
    ],

    // Required when the frontend and API are on different domains.
    // `None` forces `Secure`, so the API must be served over HTTPS.
    'session' => [
        'same_site' => 'None',
        'secure' => '1',
    ],
];
