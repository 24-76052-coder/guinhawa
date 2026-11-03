<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\Users;
use Guinhawa\Validator;

final class EmployeeController
{
    public static function directory(): never
    {
        Auth::requireUser();
        $rows = Database::fetchAll(
            "SELECT id, employee_id, username, full_name, email, contact_number, role, status,
                    must_change_password, last_login_at, created_at, updated_at
             FROM employees
             WHERE status = 'active' AND role IN ('inventory-staff', 'counter-staff')
             ORDER BY full_name ASC",
        );
        Http::json(['employees' => array_map([Users::class, 'mapEmployee'], $rows)]);
    }

    public static function index(): never
    {
        Auth::requireAdmin();
        $search = Http::query('search');
        $role = Http::query('role');
        $status = Http::query('status');

        $where = ["role IN ('inventory-staff', 'counter-staff')"];
        $params = [];

        if ($role !== '') {
            if (!in_array($role, Validator::STAFF_ROLES, true)) {
                throw new HttpException('Choose a valid staff role filter.', 422, 'VALIDATION');
            }
            $where[] = 'role = ?';
            $params[] = $role;
        }
        if ($status !== '') {
            $where[] = 'status = ?';
            $params[] = Validator::status($status);
        }
        if ($search !== '') {
            $term = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
            $where[] = '(full_name LIKE ? OR employee_id LIKE ? OR username LIKE ? OR email LIKE ? OR contact_number LIKE ?)';
            array_push($params, $term, $term, $term, $term, $term);
        }

        $rows = Database::fetchAll(
            'SELECT id, employee_id, username, full_name, email, contact_number, role, status,
                    must_change_password, last_login_at, created_at, updated_at
             FROM employees
             WHERE ' . implode(' AND ', $where) . "
             ORDER BY status = 'active' DESC, full_name ASC",
            $params,
        );

        Http::json(['employees' => array_map([Users::class, 'mapEmployee'], $rows)]);
    }

    public static function store(): never
    {
        $actor = Auth::requireAdmin();
        $body = Http::body();

        $fullName = Validator::text($body['fullName'] ?? '', 'Full name', 1, 160);
        $employeeId = Validator::employeeId($body['employeeId'] ?? '');
        $username = Validator::username($body['username'] ?? '');
        $email = Validator::email($body['email'] ?? '');
        $contact = Validator::contact($body['contactNumber'] ?? '');
        $role = Validator::staffRole($body['role'] ?? '');
        $status = Validator::status($body['status'] ?? 'active');

        $suppliedPassword = (string) ($body['password'] ?? '');
        if ($suppliedPassword !== '') {
            Validator::password($suppliedPassword);
        }
        $temporaryPassword = $suppliedPassword !== '' ? $suppliedPassword : Validator::temporaryPassword();
        $hash = password_hash($temporaryPassword, PASSWORD_DEFAULT);

        $duplicate = Database::fetchOne(
            'SELECT id, employee_id, username, email FROM employees
             WHERE employee_id = ? OR username = ?' . ($email ? ' OR email = ?' : '') . ' LIMIT 1',
            $email ? [$employeeId, $username, $email] : [$employeeId, $username],
        );
        if ($duplicate) {
            if ($duplicate['employee_id'] === $employeeId) {
                throw new HttpException('That Employee ID is already in use.', 409, 'CONFLICT');
            }
            if ($duplicate['username'] === $username) {
                throw new HttpException('That username is already in use.', 409, 'CONFLICT');
            }
            throw new HttpException('That email address is already in use.', 409, 'CONFLICT');
        }

        Database::execute(
            'INSERT INTO employees
                (employee_id, username, full_name, email, contact_number, role, status,
                 password_hash, must_change_password, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
            [$employeeId, $username, $fullName, $email, $contact, $role, $status, $hash, $actor['code']],
        );

        $created = Database::fetchOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [Database::lastId()]);
        Auth::audit(
            $actor,
            'Employee Account Created',
            "{$created['full_name']} ({$created['employee_id']}) created as {$role}" . ($status === 'inactive' ? ' (inactive)' : '') . '.',
            $created['employee_id'],
        );

        Http::json([
            'account' => Users::mapEmployee($created),
            'temporaryPassword' => $suppliedPassword === '' ? $temporaryPassword : null,
            'generatedPassword' => $suppliedPassword === '',
        ], 201);
    }

    public static function update(int $id): never
    {
        $actor = Auth::requireAdmin();
        $current = self::find($id);
        $body = Http::body();

        $fullName = Validator::text($body['fullName'] ?? '', 'Full name', 1, 160);
        $employeeId = Validator::employeeId($body['employeeId'] ?? '');
        $username = Validator::username($body['username'] ?? '');
        $email = Validator::email($body['email'] ?? '');
        $contact = Validator::contact($body['contactNumber'] ?? '');
        $role = Validator::staffRole($body['role'] ?? '');
        $status = Validator::status($body['status'] ?? '');

        $duplicate = Database::fetchOne(
            'SELECT id, employee_id, username, email FROM employees
             WHERE id <> ? AND (employee_id = ? OR username = ?' . ($email ? ' OR email = ?' : '') . ') LIMIT 1',
            $email ? [$id, $employeeId, $username, $email] : [$id, $employeeId, $username],
        );
        if ($duplicate) {
            if ($duplicate['employee_id'] === $employeeId) {
                throw new HttpException('That Employee ID is already in use.', 409, 'CONFLICT');
            }
            if ($duplicate['username'] === $username) {
                throw new HttpException('That username is already in use.', 409, 'CONFLICT');
            }
            throw new HttpException('That email address is already in use.', 409, 'CONFLICT');
        }

        Database::execute(
            'UPDATE employees
             SET employee_id = ?, username = ?, full_name = ?, email = ?, contact_number = ?, role = ?, status = ?
             WHERE id = ?',
            [$employeeId, $username, $fullName, $email, $contact, $role, $status, $id],
        );

        $updated = Database::fetchOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [$id]);
        Auth::audit(
            $actor,
            'Employee Account Updated',
            "{$updated['full_name']} ({$updated['employee_id']}) updated - role: {$role}, status: {$status}.",
            $updated['employee_id'],
        );

        Http::json(['account' => Users::mapEmployee($updated)]);
    }

    public static function setStatus(int $id): never
    {
        $actor = Auth::requireAdmin();
        $current = self::find($id);
        $status = Validator::status(Http::body()['status'] ?? '');

        if ($current['status'] === $status) {
            Http::json(['account' => Users::mapEmployee($current)]);
        }

        Database::execute('UPDATE employees SET status = ? WHERE id = ?', [$status, $id]);
        $updated = Database::fetchOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [$id]);
        Auth::audit(
            $actor,
            $status === 'active' ? 'Employee Account Activated' : 'Employee Account Deactivated',
            "{$updated['full_name']} ({$updated['employee_id']}) was " . ($status === 'active' ? 'activated' : 'deactivated') . '.',
            $updated['employee_id'],
        );

        Http::json(['account' => Users::mapEmployee($updated)]);
    }

    public static function resetPassword(int $id): never
    {
        $actor = Auth::requireAdmin();
        $current = self::find($id);
        $temporaryPassword = Validator::temporaryPassword();

        Database::execute(
            'UPDATE employees
             SET password_hash = ?, must_change_password = 1, password_changed_at = NULL
             WHERE id = ?',
            [password_hash($temporaryPassword, PASSWORD_DEFAULT), $id],
        );

        Auth::audit(
            $actor,
            'Employee Password Reset',
            "{$current['full_name']} ({$current['employee_id']}) received a temporary password.",
            $current['employee_id'],
        );

        Http::json(['temporaryPassword' => $temporaryPassword]);
    }

    public static function destroy(int $id): never
    {
        $actor = Auth::requireAdmin();
        $current = self::find($id);

        Auth::audit(
            $actor,
            'Employee Account Deleted',
            "{$current['full_name']} ({$current['employee_id']}) was removed.",
            $current['employee_id'],
        );
        Database::execute('DELETE FROM employees WHERE id = ?', [$id]);

        Http::json(['removed' => Users::mapEmployee($current)]);
    }

    public static function auditLogs(): never
    {
        Auth::requireAdmin();
        $rows = Database::fetchAll('SELECT * FROM account_audit_logs ORDER BY created_at DESC, id DESC LIMIT 300');

        $logs = array_map(static function (array $row): array {
            $timestamp = strtotime((string) $row['created_at']);
            return [
                'id' => 'ACC-' . $row['id'],
                'user' => $row['actor_name'] ?: 'System',
                'action' => $row['action'],
                'details' => $row['target_employee_id']
                    ? $row['details'] . ' [' . $row['target_employee_id'] . ']'
                    : $row['details'],
                'date' => $timestamp ? date('M j Y', $timestamp) : (string) $row['created_at'],
                'time' => $timestamp ? date('h:i A', $timestamp) : '',
            ];
        }, $rows);

        Http::json(['logs' => $logs]);
    }

    private static function find(int $id): array
    {
        $row = Database::fetchOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [$id]);
        if (!$row) {
            throw new HttpException('That employee account no longer exists.', 404, 'NOT_FOUND');
        }
        if (!in_array($row['role'], Validator::STAFF_ROLES, true)) {
            throw new HttpException('Administrator accounts are not managed from this page.', 400, 'VALIDATION');
        }
        return $row;
    }
}
