<?php

declare(strict_types=1);

namespace Guinhawa;

use PDO;

final class Auth
{
    private static ?array $user = null;
    private static bool $resolved = false;
    private static array $config = [];

    public static function boot(array $config): void
    {
        self::$config = $config;

        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        session_name($config['name']);
        session_set_cookie_params([
            'lifetime' => $config['lifetime'],
            'path' => '/',
            'domain' => '',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$user;
        }
        self::$resolved = true;

        $account = $_SESSION['account'] ?? null;
        if (!is_array($account) || empty($account['type']) || empty($account['id'])) {
            return null;
        }

        if ($account['type'] === 'admin') {
            $row = Database::fetchOne('SELECT * FROM admin WHERE id = 1 LIMIT 1');
            if (!$row) {
                self::logout();
                return null;
            }
            self::$user = Users::mapAdmin($row);
            return self::$user;
        }

        if ($account['type'] === 'employee') {
            $row = Database::fetchOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [(int) $account['id']]);
            if (!$row || $row['status'] !== 'active') {
                self::logout();
                return null;
            }
            self::$user = Users::mapEmployee($row);
            return self::$user;
        }

        return null;
    }

    public static function requireUser(bool $allowPasswordChange = false): array
    {
        $user = self::user();
        if (!$user) {
            throw new HttpException('Please sign in to continue.', 401, 'UNAUTHENTICATED');
        }
        if (!$allowPasswordChange && !empty($user['mustChangePassword'])) {
            throw new HttpException('Change your temporary password before continuing.', 403, 'PASSWORD_CHANGE_REQUIRED');
        }
        return $user;
    }

    public static function requireAdmin(bool $allowPasswordChange = false): array
    {
        $user = self::requireUser($allowPasswordChange);
        if ($user['role'] !== 'admin') {
            throw new HttpException('Administrator access is required for that action.', 403, 'FORBIDDEN');
        }
        return $user;
    }

    /** @param string[] $roles */
    public static function requireRole(array $roles, bool $allowPasswordChange = false): array
    {
        $user = self::requireUser($allowPasswordChange);
        if (!in_array($user['role'], $roles, true)) {
            throw new HttpException('Your account cannot use that feature.', 403, 'FORBIDDEN');
        }
        return $user;
    }

    public static function loginAdmin(array $row): array
    {
        session_regenerate_id(true);
        $_SESSION['account'] = ['type' => 'admin', 'id' => 1];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        self::clearLoginFailures();
        self::$user = null;
        self::$resolved = false;
        return Users::mapAdmin($row);
    }

    public static function loginEmployee(array $row): array
    {
        session_regenerate_id(true);
        $_SESSION['account'] = ['type' => 'employee', 'id' => (int) $row['id']];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        self::clearLoginFailures();
        self::$user = null;
        self::$resolved = false;
        return Users::mapEmployee($row);
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => (bool) $params['secure'],
                'httponly' => (bool) $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
        self::$user = null;
        self::$resolved = true;
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public static function requireCsrf(): void
    {
        if (in_array(Http::method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        if (!self::user()) {
            return; // login itself has no session yet
        }

        $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($provided) || $provided === '' || !hash_equals(self::csrfToken(), $provided)) {
            throw new HttpException('Your session token expired. Refresh the page and try again.', 419, 'CSRF');
        }
    }

    public static function tooManyAttempts(): int
    {
        $until = (int) ($_SESSION['login_blocked_until'] ?? 0);
        if ($until > time()) {
            return $until - time();
        }
        if ($until > 0) {
            unset($_SESSION['login_blocked_until']);
        }
        return 0;
    }

    public static function recordLoginFailure(): void
    {
        $failures = (int) ($_SESSION['login_failures'] ?? 0) + 1;
        $_SESSION['login_failures'] = $failures;
        if ($failures >= 5) {
            $_SESSION['login_blocked_until'] = time() + 30;
            $_SESSION['login_failures'] = 0;
        }
    }

    private static function clearLoginFailures(): void
    {
        unset($_SESSION['login_failures'], $_SESSION['login_blocked_until']);
    }

    /** Account audit row for administrator activity. */
    public static function audit(?array $actor, string $action, string $details, ?string $target = null): void
    {
        Database::execute(
            'INSERT INTO account_audit_logs (actor_type, actor_id, actor_name, action, target_employee_id, details)
             VALUES (?, ?, ?, ?, ?, ?)',
            [
                $actor['type'] ?? null,
                isset($actor['id']) ? (int) $actor['id'] : null,
                $actor['name'] ?? 'System',
                $action,
                $target,
                $details,
            ],
        );
    }

    public static function businessAudit(string $action, string $details, ?array $actor = null): void
    {
        $actor ??= self::user();
        Database::execute(
            'INSERT INTO audit_logs (actor, actor_type, actor_id, action, details)
             VALUES (?, ?, ?, ?, ?)',
            [
                $actor['name'] ?? 'System',
                $actor['type'] ?? null,
                isset($actor['id']) ? (int) $actor['id'] : null,
                $action,
                $details,
            ],
        );
    }

    public static function pdo(): PDO
    {
        return Database::pdo();
    }
}
