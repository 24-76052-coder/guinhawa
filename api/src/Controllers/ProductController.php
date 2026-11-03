<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\Inventory;
use Guinhawa\StateRepository;
use Guinhawa\Validator;

final class ProductController
{
    public static function index(): never
    {
        $user = Auth::requireUser();
        Http::json(['state' => StateRepository::snapshot($user)]);
    }

    public static function store(): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $body = Http::body();

        $name = Validator::text($body['name'] ?? '', 'Product name', 1, 190);
        $category = Validator::category($body['category'] ?? '');
        $variants = self::variantsFrom($body, null, true);
        $minimum = Validator::number($body['minimum'] ?? 0, 'Minimum stock', 0);
        $image = Validator::imageReference($body['image'] ?? '', 'Product image');

        $productId = Database::transaction(function () use ($actor, $body, $name, $category, $variants, $minimum, $image): int {
            $nextIdRow = Database::fetchOne('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM products');
            $nextId = (int) $nextIdRow['next_id'];
            $sku = Validator::optionalText($body['sku'] ?? '', 'SKU', 40);
            if ($sku === '') {
                $sku = 'GPS-' . str_pad((string) (2000 + $nextId), 4, '0', STR_PAD_LEFT);
            }
            $barcode = Validator::optionalText($body['barcode'] ?? '', 'Barcode', 80);
            self::assertUniqueIdentifiers($sku, $barcode);
            $total = array_sum(array_column($variants, 'stock'));

            Database::execute(
                'INSERT INTO products
                    (sku, barcode, name, category, subcategory, brand, description, minimum,
                     expiration_date, supplier, image, review, notes, source, sheet_row, awaiting_stock)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $sku,
                    $barcode !== '' ? $barcode : null,
                    $name,
                    $category,
                    Validator::optionalText($body['subcategory'] ?? '', 'Subcategory', 120),
                    Validator::optionalText($body['brand'] ?? '', 'Brand', 120),
                    Validator::optionalText($body['description'] ?? '', 'Description', 5000),
                    $minimum,
                    Validator::date($body['expiration_date'] ?? '', 'Expiration date'),
                    Validator::optionalText($body['supplier'] ?? '', 'Supplier', 160),
                    $image,
                    ($body['review'] ?? 'Listed') === 'Verify' ? 'Verify' : 'Listed',
                    Validator::optionalText($body['notes'] ?? '', 'Notes', 5000),
                    Validator::optionalText($body['source'] ?? '', 'Source', 160) ?: 'Manual entry',
                    isset($body['sheet_row']) && $body['sheet_row'] !== '' ? Validator::integer($body['sheet_row'], 'Sheet row', 1) : null,
                    $total <= 0 ? 1 : 0,
                ],
            );

            $productId = Database::lastId();

            foreach ($variants as $variant) {
                self::insertVariant($productId, $variant);
                Inventory::setStock($productId, $variant['key'], $variant['stock']);
                if ($variant['stock'] > 0) {
                    $reference = Inventory::nextReference('SI');
                    $historyId = Inventory::recordMovement(
                        $reference,
                        $productId,
                        $variant['key'],
                        $name,
                        $variant['unit'],
                        'Stock In',
                        $variant['stock'],
                        0,
                        $variant['stock'],
                        'Initial product stock',
                        $actor,
                    );
                    Database::execute(
                        'INSERT INTO stock_in
                            (history_id, reference, product_id, variant_key, product_name, unit, quantity,
                             previous_stock, new_stock, remarks, user_label, received_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURDATE())',
                        [$historyId, $reference, $productId, $variant['key'], $name, $variant['unit'], $variant['stock'], $variant['stock'], 'Initial product stock', $actor['name']],
                    );
                }
            }

            Auth::businessAudit('Product Added', "{$name} added to the catalogue", $actor);
            return $productId;
        });

        $product = Database::fetchOne('SELECT * FROM products WHERE id = ? LIMIT 1', [$productId]);
        Http::json([
            'state' => StateRepository::snapshot($actor),
            'product' => $product,
        ], 201);
    }

    public static function update(int $id): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $body = Http::body();
        $product = Inventory::product($id);

        $name = array_key_exists('name', $body)
            ? Validator::text($body['name'], 'Product name', 1, 190)
            : $product['name'];
        $category = array_key_exists('category', $body)
            ? Validator::category($body['category'])
            : $product['category'];

        $existingVariants = self::variantsOf($id);
        $variants = self::variantsFrom($body, $existingVariants, false);

        $minimum = array_key_exists('minimum', $body)
            ? Validator::number($body['minimum'], 'Minimum stock', 0)
            : (float) $product['minimum'];
        $image = array_key_exists('image', $body)
            ? Validator::imageReference($body['image'], 'Product image')
            : $product['image'];

        $stockChanged = false;
        foreach ($variants as $variant) {
            $before = $existingVariants[$variant['key']] ?? null;
            if (!$before || (float) $before['stock'] !== (float) $variant['stock']) {
                $stockChanged = true;
            }
        }

        Database::transaction(function () use ($actor, $body, $product, $id, $name, $category, $variants, $minimum, $image, $existingVariants, &$stockChanged): void {
            $sku = array_key_exists('sku', $body)
                ? Validator::optionalText($body['sku'], 'SKU', 40)
                : $product['sku'];
            if ($sku === '') {
                $sku = $product['sku'];
            }
            $barcode = array_key_exists('barcode', $body)
                ? Validator::optionalText($body['barcode'], 'Barcode', 80)
                : (string) ($product['barcode'] ?? '');
            self::assertUniqueIdentifiers($sku, $barcode, $id);

            $total = array_sum(array_column($variants, 'stock'));

            $fields = [
                'sku = ?',
                'barcode = ?',
                'name = ?',
                'category = ?',
                'minimum = ?',
                'image = ?',
            ];
            $params = [
                $sku,
                $barcode !== '' ? $barcode : null,
                $name,
                $category,
                $minimum,
                $image,
            ];

            $optional = [
                'subcategory' => ['Subcategory', 120],
                'brand' => ['Brand', 120],
                'description' => ['Description', 5000],
                'supplier' => ['Supplier', 160],
                'notes' => ['Notes', 5000],
                'source' => ['Source', 160],
            ];
            foreach ($optional as $field => [$label, $max]) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "{$field} = ?";
                    $params[] = Validator::optionalText($body[$field], $label, $max);
                }
            }
            if (array_key_exists('expiration_date', $body)) {
                $fields[] = 'expiration_date = ?';
                $params[] = Validator::date($body['expiration_date'], 'Expiration date');
            }
            if (array_key_exists('review', $body)) {
                $fields[] = 'review = ?';
                $params[] = $body['review'] === 'Verify' ? 'Verify' : 'Listed';
            }
            if (array_key_exists('sheet_row', $body)) {
                $fields[] = 'sheet_row = ?';
                $params[] = $body['sheet_row'] === '' || $body['sheet_row'] === null
                    ? null
                    : Validator::integer($body['sheet_row'], 'Sheet row', 1);
            }
            if ($total > 0) {
                $fields[] = 'awaiting_stock = 0';
            }

            $params[] = $id;
            Database::execute('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);

            $kept = [];
            foreach ($variants as $variant) {
                $kept[] = $variant['key'];
                $before = $existingVariants[$variant['key']] ?? null;
                $previous = $before ? (float) $before['stock'] : 0.0;

                if ($before) {
                    Database::execute(
                        'UPDATE product_variants
                         SET label = ?, unit = ?, unit_raw = ?, price = ?, minimum = ?, assumed = ?, unit_verified = ?
                         WHERE product_id = ? AND variant_key = ?',
                        [
                            $variant['label'],
                            $variant['unit'],
                            $variant['unit_raw'],
                            $variant['price'],
                            $variant['minimum'],
                            $variant['assumed'] ? 1 : 0,
                            $variant['unit_verified'] ? 1 : 0,
                            $id,
                            $variant['key'],
                        ],
                    );
                } else {
                    self::insertVariant($id, $variant);
                }
                Inventory::setStock($id, $variant['key'], $variant['stock']);

                if ($previous !== (float) $variant['stock']) {
                    Inventory::recordMovement(
                        Inventory::nextReference('ADJ'),
                        $id,
                        $variant['key'],
                        $name,
                        $variant['unit'],
                        'Adjustment',
                        abs($variant['stock'] - $previous),
                        $previous,
                        $variant['stock'],
                        'Manual inventory update',
                        $actor,
                    );
                }
            }

            foreach ($existingVariants as $key => $old) {
                if (!in_array($key, $kept, true)) {
                    Database::execute(
                        'DELETE FROM product_variants WHERE product_id = ? AND variant_key = ?',
                        [$id, $key],
                    );
                }
            }

            Auth::businessAudit(
                $stockChanged ? 'Product Stock Adjusted' : 'Product Edited',
                $stockChanged ? "{$name} stock updated" : "{$name} information updated",
                $actor,
            );
        });

        $fresh = Database::fetchOne('SELECT * FROM products WHERE id = ? LIMIT 1', [$id]);
        Http::json(['state' => StateRepository::snapshot($actor), 'product' => $fresh]);
    }

    public static function archive(int $id): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $product = Inventory::product($id);

        if ((int) $product['archived'] === 0) {
            Database::execute(
                "UPDATE products SET archived = 1, archived_at = NOW(), archived_reason = 'Removed from the active catalogue' WHERE id = ?",
                [$id],
            );
            Auth::businessAudit('Product Archived', "{$product['name']} archived (history preserved)", $actor);
        }

        $archived = Database::fetchOne('SELECT * FROM products WHERE id = ? LIMIT 1', [$id]);
        Http::json(['state' => StateRepository::snapshot($actor), 'product' => $archived]);
    }

    public static function restore(int $id): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $product = Inventory::product($id);

        Database::execute(
            'UPDATE products SET archived = 0, archived_at = NULL, archived_reason = NULL WHERE id = ?',
            [$id],
        );
        Auth::businessAudit('Product Restored', "{$product['name']} restored to the catalogue", $actor);

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    private static function variantsOf(int $productId): array
    {
        $rows = Database::fetchAll(
            'SELECT v.*, COALESCE(i.quantity, 0) AS stock
             FROM product_variants v
             LEFT JOIN inventory i ON i.product_id = v.product_id AND i.variant_key = v.variant_key
             WHERE v.product_id = ? ORDER BY v.variant_key ASC',
            [$productId],
        );

        $variants = [];
        foreach ($rows as $row) {
            $variants[$row['variant_key']] = [
                'key' => $row['variant_key'],
                'label' => $row['label'],
                'unit' => $row['unit'],
                'unit_raw' => $row['unit_raw'],
                'price' => (float) $row['price'],
                'stock' => (float) $row['stock'],
                'minimum' => (float) $row['minimum'],
                'assumed' => (bool) $row['assumed'],
                'unit_verified' => (bool) $row['unit_verified'],
            ];
        }
        return $variants;
    }

    /**
     * Accepts either the full Products form (price_a/unit_a/...) or the
     * Inventory form (a `variants` array). Existing variants are preserved
     * when an update only sends the fields it changed.
     */
    private static function variantsFrom(array $body, ?array $existing, bool $creating): array
    {
        if (isset($body['variants']) && is_array($body['variants'])) {
            $raw = array_values($body['variants']);
        } elseif (!$creating && !array_key_exists('price_a', $body) && !array_key_exists('unit_a', $body)) {
            $raw = array_values($existing ?? []);
            if (!$raw) {
                throw new HttpException('A product needs at least one selling unit.', 422, 'VALIDATION');
            }
            return array_map(static fn (array $variant) => $variant, $raw);
        } else {
            $raw = [[
                'key' => 'A',
                'label' => 'Price A',
                'unit' => $body['unit_a'] ?? ($existing['A']['unit'] ?? 'Units'),
                'unit_raw' => $body['unit_a_raw'] ?? ($existing['A']['unit_raw'] ?? ''),
                'price' => $body['price_a'] ?? 0,
                'stock' => $body['stock_a'] ?? 0,
                'minimum' => $existing['A']['minimum'] ?? 0,
                'assumed' => $existing['A']['assumed'] ?? false,
                'unit_verified' => $body['unit_a_verified'] ?? true,
            ]];

            $hasSecond = array_key_exists('price_b', $body)
                ? ($body['price_b'] !== '' && $body['price_b'] !== null)
                : isset($existing['B']);

            if ($hasSecond) {
                $raw[] = [
                    'key' => 'B',
                    'label' => 'Price B',
                    'unit' => $body['unit_b'] ?? ($existing['B']['unit'] ?? 'Sacks'),
                    'unit_raw' => $body['unit_b_raw'] ?? ($existing['B']['unit_raw'] ?? ''),
                    'price' => $body['price_b'] ?? 0,
                    'stock' => $body['stock_b'] ?? 0,
                    'minimum' => $existing['B']['minimum'] ?? 0,
                    'assumed' => $existing['B']['assumed'] ?? false,
                    'unit_verified' => $body['unit_b_verified'] ?? true,
                ];
            }
        }

        $variants = [];
        $unitsSeen = [];
        foreach ($raw as $index => $variant) {
            $key = strtoupper(trim((string) ($variant['key'] ?? ($index === 0 ? 'A' : 'B'))));
            if (!in_array($key, ['A', 'B'], true) || isset($variants[$key])) {
                throw new HttpException('Each product may have one Price A and one Price B.', 422, 'VALIDATION');
            }
            $unit = Validator::unit($variant['unit'] ?? 'Units');
            $unitKey = mb_strtolower($unit);
            if (isset($unitsSeen[$unitKey])) {
                throw new HttpException('Price A and Price B cannot use the same selling unit.', 422, 'VALIDATION');
            }
            $unitsSeen[$unitKey] = true;

            $verifiedRaw = $variant['unit_verified'] ?? true;
            $verified = !in_array(strtolower((string) $verifiedRaw), ['no', 'false', '0', 'unverified'], true);

            $variants[$key] = [
                'key' => $key,
                'label' => $key === 'A' ? 'Price A' : 'Price B',
                'unit' => $unit,
                'unit_raw' => Validator::optionalText($variant['unit_raw'] ?? '', 'Unit note', 80),
                'price' => Validator::number($variant['price'] ?? 0, 'Price ' . $key, 0),
                'stock' => Validator::number($variant['stock'] ?? 0, 'Stock ' . $key, 0),
                'minimum' => Validator::number($variant['minimum'] ?? 0, 'Minimum stock', 0),
                'assumed' => (bool) ($variant['assumed'] ?? false),
                'unit_verified' => $verified,
            ];
        }

        if (!isset($variants['A'])) {
            throw new HttpException('Price A and Unit A are required.', 422, 'VALIDATION');
        }

        ksort($variants);
        return array_values($variants);
    }

    private static function insertVariant(int $productId, array $variant): void
    {
        Database::execute(
            'INSERT INTO product_variants
                (product_id, variant_key, label, unit, unit_raw, price, minimum, assumed, unit_verified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $productId,
                $variant['key'],
                $variant['label'],
                $variant['unit'],
                $variant['unit_raw'],
                $variant['price'],
                $variant['minimum'],
                $variant['assumed'] ? 1 : 0,
                $variant['unit_verified'] ? 1 : 0,
            ],
        );
    }

    private static function assertUniqueIdentifiers(string $sku, string $barcode, ?int $ignoreId = null): void
    {
        $sql = 'SELECT id, sku, barcode FROM products WHERE ';
        $params = [];
        if ($ignoreId !== null) {
            $sql .= 'id <> ? AND ';
            $params[] = $ignoreId;
        }
        $sql .= '(sku = ?' . ($barcode !== '' ? ' OR barcode = ?' : '') . ') LIMIT 1';
        $params[] = $sku;
        if ($barcode !== '') {
            $params[] = $barcode;
        }

        $existing = Database::fetchOne($sql, $params);
        if ($existing) {
            if (strcasecmp($existing['sku'], $sku) === 0) {
                throw new HttpException('SKU is already assigned to another product.', 409, 'CONFLICT');
            }
            throw new HttpException('Barcode is already assigned to another product.', 409, 'CONFLICT');
        }
    }
}
