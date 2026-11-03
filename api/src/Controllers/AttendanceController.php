<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\StateRepository;
use Guinhawa\Validator;

final class AttendanceController
{
    public static function clockIn(): never
    {
        $actor = Auth::requireUser();
        $body = Http::body();
        $code = self::resolveCode($actor, $body['code'] ?? '');
        $name = self::resolveName($actor, $code, $body['name'] ?? '');

        $existing = Database::fetchOne(
            'SELECT id FROM attendance WHERE employee_code = ? AND work_date = CURDATE() LIMIT 1',
            [$code],
        );
        if (!$existing) {
            Database::execute(
                'INSERT INTO attendance (employee_code, employee_name, work_date, clock_in, hours)
                 VALUES (?, ?, CURDATE(), CURTIME(), 0)',
                [$code, $name],
            );
            Auth::businessAudit('Attendance Clock In', "{$name} ({$code}) clocked in", $actor);
        }

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    public static function clockOut(): never
    {
        $actor = Auth::requireUser();
        $body = Http::body();
        $code = self::resolveCode($actor, $body['code'] ?? '');

        $row = Database::fetchOne(
            'SELECT * FROM attendance WHERE employee_code = ? AND work_date = CURDATE() LIMIT 1',
            [$code],
        );
        if (!$row) {
            throw new HttpException('No clock-in record was found for today.', 404, 'NOT_FOUND');
        }

        if (!$row['clock_out']) {
            $minutes = max(0, (int) round((time() - strtotime(date('Y-m-d') . ' ' . $row['clock_in'])) / 60));
            $hours = round($minutes / 60, 1);
            Database::execute(
                'UPDATE attendance SET clock_out = CURTIME(), hours = ? WHERE id = ?',
                [$hours, (int) $row['id']],
            );
            Auth::businessAudit('Attendance Clock Out', "{$row['employee_name']} ({$code}) clocked out", $actor);
        }

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    private static function resolveCode(array $actor, mixed $requested): string
    {
        $requested = strtoupper(trim((string) ($requested ?? '')));
        if ($actor['role'] !== 'admin') {
            return $actor['code'];
        }
        if ($requested === '') {
            $requested = 'ADMIN-01';
        }
        return Validator::text($requested, 'Employee code', 3, 40);
    }

    private static function resolveName(array $actor, string $code, mixed $requested): string
    {
        if ($code === 'ADMIN-01' && $actor['role'] === 'admin') {
            return $actor['name'];
        }

        $employee = Database::fetchOne(
            "SELECT full_name FROM employees WHERE employee_id = ? AND status = 'active' LIMIT 1",
            [$code],
        );
        if ($employee) {
            return $employee['full_name'];
        }

        if ($code === $actor['code']) {
            return $actor['name'];
        }

        $name = trim((string) ($requested ?? ''));
        if ($name === '') {
            throw new HttpException('That employee code does not match an active staff account.', 422, 'VALIDATION');
        }
        return Validator::text($name, 'Employee name', 1, 160);
    }
}
