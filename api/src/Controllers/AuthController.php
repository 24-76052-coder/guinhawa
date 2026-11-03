<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\Users;
use Guinhawa\Validator;

final class AuthController
{
    public static function login(): never
    {
        $body = Http::body();
        $identifier = Validator::text($body['identifier'] ?? '', 'Username or Employee ID', 1, 190);
        $password = (string) ($body['password'] ?? '');
        if ($password === '') {
            throw new HttpException('Please enter your password.', 422, 'VALIDATION');
        }

        $wait = Auth::tooManyAttempts();
        if ($wait > 0) {
            throw new HttpException("Too many sign-in attempts. Try again in {$wait} seconds.", 429, 'RATE_LIMITED');
        }

        $admin = Database::fetchOne('SELECT * FROM admin WHERE username = ? LIMIT 1', [$identifier]);
        if ($admin && password_verify($password, $admin['password_hash'])) {
            Database::execute('UPDATE admin SET last_login_at = NOW() WHERE id = 1');
            $admin['last_login_at'] = date('Y-m-d H:i:s');
            $user = Auth::loginAdmin($admin);
            Http::json(['user' => $user, 'csrfToken' => Auth::csrfToken()]);
        }

        $employee = Database::fetchOne(
            'SELECT * FROM employees WHERE username = ? OR employee_id = ? OR email = ? LIMIT 1',
            [$identifier, strtoupper($identifier), strtolower($identifier)],
        );

        if (!$employee || !password_verify($password, $employee['password_hash'])) {
            Auth::recordLoginFailure();
            throw new HttpException('Incorrect username, employee ID, or password. Please try again.', 401, 'BAD_CREDENTIALS');
        }

        if ($employee['status'] !== 'active') {
            Auth::recordLoginFailure();
            throw new HttpException('This account has been deactivated. Contact the administrator.', 403, 'ACCOUNT_INACTIVE');
        }

        if (password_needs_rehash($employee['password_hash'], PASSWORD_DEFAULT)) {
            Database::execute(
                'UPDATE employees SET password_hash = ? WHERE id = ?',
                [password_hash($password, PASSWORD_DEFAULT), (int) $employee['id']],
            );
        }

        Database::execute('UPDATE employees SET last_login_at = NOW() WHERE id = ?', [(int) $employee['id']]);
        $employee['last_login_at'] = date('Y-m-d H:i:s');
        $user = Auth::loginEmployee($employee);

        Http::json(['user' => $user, 'csrfToken' => Auth::csrfToken()]);
    }

    public static function me(): never
    {
        $user = Auth::requireUser(true);
        Http::json(['user' => $user, 'csrfToken' => Auth::csrfToken()]);
    }

    public static function logout(): never
    {
        $user = Auth::user();
        if ($user) {
            Auth::audit($user, 'Signed Out', "{$user['name']} ({$user['employeeId']}) signed out.");
        }
        Auth::logout();
        Http::json(['ok' => true]);
    }

    public static function changePassword(): never
    {
        $user = Auth::requireUser(true);
        $body = Http::body();
        $current = (string) ($body['currentPassword'] ?? '');
        $new = Validator::password($body['newPassword'] ?? '', 'New password');

        if ($current === '') {
            throw new HttpException('Please enter your current password.', 422, 'VALIDATION');
        }

        $table = $user['type'] === 'admin' ? 'admin' : 'employees';
        $id = (int) $user['id'];
        $row = Database::fetchOne("SELECT * FROM {$table} WHERE id = ? LIMIT 1", [$id]);
        if (!$row || !password_verify($current, $row['password_hash'])) {
            throw new HttpException('Your current password is incorrect.', 400, 'BAD_PASSWORD');
        }
        if (password_verify($new, $row['password_hash'])) {
            throw new HttpException('Please choose a password that is different from your current password.', 422, 'VALIDATION');
        }

        $hash = password_hash($new, PASSWORD_DEFAULT);
        Database::execute(
            "UPDATE {$table}
             SET password_hash = ?, must_change_password = 0, password_changed_at = NOW()
             WHERE id = ?",
            [$hash, $id],
        );

        Auth::audit($user, 'Password Changed', "{$user['name']} ({$user['employeeId']}) changed their password.");

        $fresh = Database::fetchOne("SELECT * FROM {$table} WHERE id = ? LIMIT 1", [$id]);
        $mapped = $user['type'] === 'admin' ? Users::mapAdmin($fresh) : Users::mapEmployee($fresh);

        Http::json(['user' => $mapped, 'csrfToken' => Auth::csrfToken()]);
    }
}
