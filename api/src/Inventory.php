<?php

declare(strict_types=1);

namespace Guinhawa;

final class Inventory
{
    public static function nextReference(string $prefix): string
    {
        $row = Database::fetchOne(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference, '-', -1) AS UNSIGNED)), 0) + 1 AS next_number
             FROM inventory_history
             WHERE reference LIKE ?",
            [$prefix . '-%'],
        );
        return sprintf('%s-%03d', $prefix, (int) $row['next_number']);
    }

    public static function nextSaleNumber(): string
    {
        $row = Database::fetchOne(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(receipt_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_number FROM sales",
        );
        return sprintf('RCP-%03d', (int) $row['next_number']);
    }

    public static function nextHoldNumber(): string
    {
        $row = Database::fetchOne(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(hold_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_number FROM held_orders",
        );
        return sprintf('HLD-%03d', (int) $row['next_number']);
    }

    /** Next SUP-001 / CUS-001 style code for a partner table. */
    public static function nextCode(string $table, string $prefix): string
    {
        $allowed = ['suppliers', 'customers'];
        if (!in_array($table, $allowed, true)) {
            throw new \InvalidArgumentException('Unsupported code table.');
        }
        $row = Database::fetchOne("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM {$table}");
        return sprintf('%s-%03d', $prefix, (int) $row['next_id']);
    }

    public static function product(int $id, bool $lock = false): array
    {
        $sql = 'SELECT * FROM products WHERE id = ? LIMIT 1' . ($lock ? ' FOR UPDATE' : '');
        $row = Database::fetchOne($sql, [$id]);
        if (!$row) {
            throw new HttpException('Product not found.', 404, 'NOT_FOUND');
        }
        return $row;
    }

    /**
     * Product + variant + current stock, locked for the duration of a movement
     * transaction. Returns an empty/null row when the unit does not exist.
     */
    public static function variant(int $productId, string $variantKey, bool $lock = false): ?array
    {
        $sql = 'SELECT p.id AS product_id, p.name AS product_name, p.category, p.archived,
                       p.expiration_date,
                       v.variant_key, v.unit, v.price, v.unit_verified,
                       COALESCE(i.quantity, 0) AS stock
                FROM products p
                JOIN product_variants v ON v.product_id = p.id
                LEFT JOIN inventory i ON i.product_id = v.product_id AND i.variant_key = v.variant_key
                WHERE p.id = ? AND v.variant_key = ? LIMIT 1' . ($lock ? ' FOR UPDATE' : '');
        return Database::fetchOne($sql, [$productId, $variantKey]);
    }

    public static function resolveVariantKey(int $productId, string $requested, string $movementUnit = ''): string
    {
        $requested = strtoupper(trim($requested));
        if ($requested === 'A' || $requested === 'B') {
            return $requested;
        }
        if ($movementUnit !== '') {
            $row = Database::fetchOne(
                'SELECT variant_key FROM product_variants WHERE product_id = ? AND LOWER(unit) = LOWER(?) LIMIT 1',
                [$productId, $movementUnit],
            );
            if ($row) {
                return $row['variant_key'];
            }
        }
        return 'A';
    }

    public static function setStock(int $productId, string $variantKey, float $quantity): void
    {
        Database::execute(
            'INSERT INTO inventory (product_id, variant_key, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)',
            [$productId, $variantKey, $quantity],
        );
    }

    /** Insert a movement row and return its id. */
    public static function recordMovement(
        string $reference,
        int $productId,
        string $variantKey,
        string $productName,
        string $unit,
        string $action,
        float $quantity,
        float $previous,
        float $next,
        string $remarks,
        array $actor,
    ): int {
        Database::execute(
            'INSERT INTO inventory_history
                (reference, product_id, variant_key, product_name, unit, action,
                 quantity, previous_stock, next_stock, remarks, user_label, actor_type, actor_id, movement_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
            [
                $reference,
                $productId,
                $variantKey,
                $productName,
                $unit,
                $action,
                $quantity,
                $previous,
                $next,
                mb_substr($remarks, 0, 500),
                $actor['name'] ?? 'System',
                $actor['type'] ?? null,
                isset($actor['id']) ? (int) $actor['id'] : null,
            ],
        );
        return Database::lastId();
    }
}
