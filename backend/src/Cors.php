<?php

declare(strict_types=1);

namespace Guinhawa;

/**
 * Cross-origin support for split deployments.
 *
 * XAMPP serves the React app and the API from the same origin, so no CORS
 * headers are needed and this class stays silent. When the React app is hosted
 * elsewhere (for example Vercel with a separately hosted PHP API), the exact
 * frontend origins listed in `GUINHAWA_ALLOWED_ORIGINS` are allowed to call the
 * API with the session cookie.
 *
 * Credentialed CORS requires an exact origin — wildcards are not allowed by
 * browsers when `Access-Control-Allow-Credentials` is true.
 */
final class Cors
{
    /** @param list<string> $allowedOrigins */
    public static function apply(array $allowedOrigins): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin === '' || $allowedOrigins === []) {
            return;
        }
        if (!in_array($origin, $allowedOrigins, true)) {
            return;
        }

        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, Accept');
        header('Access-Control-Max-Age: 86400');
    }
}
