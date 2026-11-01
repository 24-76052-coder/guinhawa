<?php

declare(strict_types=1);

namespace Guinhawa;

final class Validator
{
    public const STAFF_ROLES = ['counter-staff', 'inventory-staff'];
    public const STATUSES = ['active', 'inactive'];
    public const UNITS = [
        'Kilograms', 'Sacks', 'Bags', 'Pieces', 'Tablets', 'Bottles',
        'Boxes', 'Cans', 'Pouches', 'Packs', 'Units',
    ];
    public const PAYMENT_METHODS = ['Cash', 'GCash'];
    public const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];
    public const STOCK_OUT_REASONS = ['Customer Order', 'Usage', 'Damaged', 'Expired', 'Transfer'];

    public static function text(mixed $value, string $label, int $min = 1, int $max = 190): string
    {
        $clean = trim((string) ($value ?? ''));
        $length = mb_strlen($clean);
        if ($length < $min) {
            throw new HttpException("$label is required.", 422, 'VALIDATION');
        }
        if ($length > $max) {
            throw new HttpException("$label must be $max characters or fewer.", 422, 'VALIDATION');
        }
        if (str_contains($clean, "\0")) {
            throw new HttpException("$label contains an invalid character.", 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function optionalText(mixed $value, string $label, int $max = 190): string
    {
        $clean = trim((string) ($value ?? ''));
        if ($clean === '') {
            return '';
        }
        if (mb_strlen($clean) > $max) {
            throw new HttpException("$label must be $max characters or fewer.", 422, 'VALIDATION');
        }
        if (str_contains($clean, "\0")) {
            throw new HttpException("$label contains an invalid character.", 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function email(mixed $value, bool $required = false): ?string
    {
        $clean = self::optionalText($value, 'Email address', 190);
        if ($clean === '') {
            if ($required) {
                throw new HttpException('Email address is required.', 422, 'VALIDATION');
            }
            return null;
        }
        $clean = strtolower($clean);
        if (!filter_var($clean, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException('Please enter a valid email address.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function contact(mixed $value): ?string
    {
        $clean = self::optionalText($value, 'Contact number', 40);
        if ($clean === '') {
            return null;
        }
        if (!preg_match('/^[0-9+()\s-]{7,40}$/', $clean)) {
            throw new HttpException('Please enter a valid contact number.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function password(mixed $value, string $label = 'Password'): string
    {
        $clean = (string) ($value ?? '');
        if (strlen($clean) < 8) {
            throw new HttpException("$label must be at least 8 characters.", 422, 'VALIDATION');
        }
        if (strlen($clean) > 128) {
            throw new HttpException("$label must be 128 characters or fewer.", 422, 'VALIDATION');
        }
        if (!preg_match('/[A-Za-z]/', $clean) || !preg_match('/[0-9]/', $clean)) {
            throw new HttpException("$label must include at least one letter and one number.", 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function employeeId(mixed $value): string
    {
        $clean = strtoupper(self::text($value, 'Employee ID', 3, 40));
        if (!preg_match('/^[A-Z0-9-]+$/', $clean)) {
            throw new HttpException('Employee ID may only contain letters, numbers and dashes.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function username(mixed $value): string
    {
        $clean = strtolower(self::text($value, 'Username', 3, 60));
        if (!preg_match('/^[a-z0-9._-]+$/', $clean)) {
            throw new HttpException('Username may only contain letters, numbers, dots, underscores and dashes.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function staffRole(mixed $value): string
    {
        $clean = strtolower(trim((string) ($value ?? '')));
        if (!in_array($clean, self::STAFF_ROLES, true)) {
            throw new HttpException('Choose Inventory Staff or Counter Staff for this account.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function status(mixed $value): string
    {
        $clean = strtolower(trim((string) ($value ?? '')));
        if (!in_array($clean, self::STATUSES, true)) {
            throw new HttpException('Account status must be Active or Inactive.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function number(mixed $value, string $label, float $min = 0.0, ?float $max = null): float
    {
        if ($value === '' || $value === null || !is_numeric($value)) {
            throw new HttpException("$label must be a valid number.", 422, 'VALIDATION');
        }
        $number = (float) $value;
        if (!is_finite($number) || $number < $min) {
            throw new HttpException("$label must be at least $min.", 422, 'VALIDATION');
        }
        if ($max !== null && $number > $max) {
            throw new HttpException("$label must be $max or lower.", 422, 'VALIDATION');
        }
        return round($number, 2);
    }

    public static function integer(mixed $value, string $label, int $min = 1): int
    {
        if ($value === '' || $value === null || !is_numeric($value) || (int) $value != $value) {
            throw new HttpException("$label must be a whole number.", 422, 'VALIDATION');
        }
        $number = (int) $value;
        if ($number < $min) {
            throw new HttpException("$label is invalid.", 422, 'VALIDATION');
        }
        return $number;
    }

    public static function date(mixed $value, string $label, bool $required = false): ?string
    {
        $clean = trim((string) ($value ?? ''));
        if ($clean === '') {
            if ($required) {
                throw new HttpException("$label is required.", 422, 'VALIDATION');
            }
            return null;
        }
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $clean);
        if (!$parsed || $parsed->format('Y-m-d') !== $clean) {
            throw new HttpException("$label must be a valid date.", 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function unit(mixed $value): string
    {
        $clean = self::text($value, 'Selling unit', 1, 40);
        if (!in_array($clean, self::UNITS, true)) {
            throw new HttpException('Choose a valid selling unit.', 422, 'VALIDATION');
        }
        return $clean;
    }

    public static function category(mixed $value): string
    {
        return self::text($value, 'Category', 1, 60);
    }

    /**
     * Accept a normal web URL or a small embedded image. Anything else
     * (javascript:, data:text/html, oversized payloads) is rejected so a
     * product record can never inject executable content into the UI.
     */
    public static function imageReference(mixed $value, string $label = 'Image'): string
    {
        $clean = trim((string) ($value ?? ''));
        if ($clean === '') {
            return '';
        }
        if (strlen($clean) > 2_000_000) {
            throw new HttpException("$label is too large. Choose an image under 1 MB.", 422, 'VALIDATION');
        }
        if (preg_match('#^https?://#i', $clean)) {
            if (strlen($clean) > 600) {
                throw new HttpException("$label URL is too long.", 422, 'VALIDATION');
            }
            return $clean;
        }
        if (preg_match('#^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$#i', $clean)) {
            return $clean;
        }
        if (str_starts_with($clean, '/')) {
            return $clean;
        }
        throw new HttpException("$label must be a web address or a PNG/JPG/WebP image.", 422, 'VALIDATION');
    }

    public static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts, static fn ($part) => $part !== ''));
        if (count($parts) === 0) {
            return '?';
        }
        if (count($parts) === 1) {
            return strtoupper(mb_substr($parts[0], 0, 2));
        }
        return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr($parts[1], 0, 1));
    }

    public static function temporaryPassword(): string
    {
        // Avoid ambiguous characters (0/O, 1/I/l) so the admin can read the
        // one-time password out to the employee without mistakes.
        $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $lower = 'abcdefghijkmnopqrstuvwxyz';
        $digits = '23456789';
        $alphabet = $letters . $lower . $digits;
        $password = $letters[random_int(0, strlen($letters) - 1)]
            . $lower[random_int(0, strlen($lower) - 1)]
            . $digits[random_int(0, strlen($digits) - 1)];

        for ($index = 0; $index < 7; $index++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return str_shuffle($password);
    }
}
