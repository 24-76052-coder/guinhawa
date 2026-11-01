<?php

declare(strict_types=1);

namespace Guinhawa;

final class Users
{
    public const ROLE_LABELS = [
        'admin' => 'Admin',
        'inventory-staff' => 'Inventory Staff',
        'counter-staff' => 'Counter Staff / Cashier',
    ];

    /** Shape expected by app/src/auth.js and the existing pages. */
    public static function mapAdmin(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'type' => 'admin',
            'code' => 'ADMIN-01',
            'employeeId' => 'ADMIN-01',
            'username' => $row['username'],
            'loginUsername' => $row['username'],
            'name' => $row['full_name'],
            'fullName' => $row['full_name'],
            'email' => '',
            'contactNumber' => '',
            'role' => 'admin',
            'roleLabel' => self::ROLE_LABELS['admin'],
            'status' => 'active',
            'avatar' => Validator::initials($row['full_name']),
            'mustChangePassword' => (bool) $row['must_change_password'],
            'lastLoginAt' => $row['last_login_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }

    public static function mapEmployee(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'type' => 'employee',
            'code' => $row['employee_id'],
            'employeeId' => $row['employee_id'],
            'username' => $row['username'],
            'loginUsername' => $row['username'],
            'name' => $row['full_name'],
            'fullName' => $row['full_name'],
            'email' => $row['email'] ?? '',
            'contactNumber' => $row['contact_number'] ?? '',
            'role' => $row['role'],
            'roleLabel' => self::ROLE_LABELS[$row['role']] ?? $row['role'],
            'status' => $row['status'],
            'avatar' => Validator::initials($row['full_name']),
            'mustChangePassword' => (bool) $row['must_change_password'],
            'lastLoginAt' => $row['last_login_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
}
