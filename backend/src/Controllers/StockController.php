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

final class StockController
{
    public static function stockIn(): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        self::inbound(Http::body(), $actor, false);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    public static function delivery(): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        self::inbound(Http::body(), $actor, true);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    public static function stockOut(): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $body = Http::body();

        $productId = Validator::integer($body['product_id'] ?? 0, 'Product');
        $quantity = Validator::number($body['quantity'] ?? 0, 'Quantity', 0.01);
        $reason = trim((string) ($body['reason'] ?? 'Customer Order'));
        if (!in_array($reason, Validator::STOCK_OUT_REASONS, true)) {
            throw new HttpException('Choose a valid stock-out reason.', 422, 'VALIDATION');
        }
        $variantKey = Inventory::resolveVariantKey($productId, (string) ($body['variant'] ?? ''), (string) ($body['movement_unit'] ?? ''));
        $customer = Validator::optionalText($body['customer'] ?? '', 'Customer', 160);
        $remarks = Validator::optionalText($body['remarks'] ?? '', 'Remarks', 500);
        $reference = strtoupper(Validator::optionalText($body['reference'] ?? '', 'Reference number', 40));
        $isIssue = in_array($reason, ['Damaged', 'Expired'], true);
        $action = $isIssue ? $reason : 'Stock Out';
        $prefix = $isIssue ? 'ISS' : 'SO';

        Database::transaction(function () use ($productId, $quantity, $reason, $variantKey, $customer, $remarks, $reference, $isIssue, $action, $prefix, $actor): void {
            $product = Inventory::product($productId, true);
            if ((int) $product['archived'] === 1) {
                throw new HttpException('Archived products cannot be issued.', 422, 'VALIDATION');
            }

            $variant = Inventory::variant($productId, $variantKey, true);
            if (!$variant) {
                throw new HttpException('Choose a valid selling unit.', 422, 'VALIDATION');
            }

            $previous = (float) $variant['stock'];
            if ($quantity > $previous) {
                throw new HttpException(
                    'Quantity cannot exceed current stock. Only ' . self::trimNumber($previous) . ' ' . $variant['unit'] . ' available.',
                    422,
                    'INSUFFICIENT_STOCK',
                );
            }

            if ($reference === '') {
                $reference = Inventory::nextReference($prefix);
            } else {
                $duplicate = Database::fetchOne('SELECT id FROM inventory_history WHERE reference = ? LIMIT 1', [$reference]);
                if ($duplicate) {
                    throw new HttpException('That stock movement reference has already been recorded.', 409, 'CONFLICT');
                }
            }

            $next = $previous - $quantity;
            Inventory::setStock($productId, $variantKey, $next);

            $parts = array_filter([
                $customer,
                $reason !== 'Customer Order' ? $reason : '',
                $remarks,
            ], static fn ($part) => $part !== '');
            $movementRemarks = implode(' · ', $parts);

            $historyId = Inventory::recordMovement(
                $reference,
                $productId,
                $variantKey,
                $product['name'],
                $variant['unit'],
                $action,
                $quantity,
                $previous,
                $next,
                $movementRemarks,
                $actor,
            );

            Database::execute(
                'INSERT INTO stock_out
                    (history_id, reference, product_id, variant_key, product_name, unit, quantity,
                     previous_stock, new_stock, customer, reason, remarks, user_label, issued_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
                [$historyId, $reference, $productId, $variantKey, $product['name'], $variant['unit'], $quantity, $previous, $next, $customer, $reason, $remarks, $actor['name']],
            );

            Auth::businessAudit(
                $action === 'Stock Out' ? 'Stock Out' : "{$reason} Product",
                "{$product['name']}: -" . self::trimNumber($quantity) . " {$variant['unit']}",
                $actor,
            );
        });

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    private static function inbound(array $body, array $actor, bool $isDelivery): void
    {
        $productId = Validator::integer($body['product_id'] ?? 0, 'Product');
        $quantity = Validator::number($body['quantity'] ?? 0, 'Quantity', 0.01);
        $variantKey = Inventory::resolveVariantKey($productId, (string) ($body['variant'] ?? ''), (string) ($body['movement_unit'] ?? ''));
        $remarks = Validator::optionalText($body['remarks'] ?? '', 'Remarks', 500);
        $reference = strtoupper(Validator::optionalText($body['reference'] ?? '', 'Reference number', 40));
        $supplierCode = trim((string) ($body['supplier_id'] ?? ''));
        $supplierName = Validator::optionalText($body['supplier'] ?? '', 'Supplier', 160);

        if ($isDelivery && $supplierCode === '') {
            throw new HttpException('Please select a supplier.', 422, 'VALIDATION');
        }

        Database::transaction(function () use ($productId, $quantity, $variantKey, $remarks, $reference, $supplierCode, $supplierName, $isDelivery, $actor): void {
            $product = Inventory::product($productId, true);
            if ((int) $product['archived'] === 1) {
                throw new HttpException('Archived products cannot receive stock.', 422, 'VALIDATION');
            }

            $variant = Inventory::variant($productId, $variantKey, true);
            if (!$variant) {
                throw new HttpException('Choose a valid selling unit.', 422, 'VALIDATION');
            }

            $supplierId = null;
            $resolvedSupplier = $supplierName;
            if ($supplierCode !== '') {
                $supplier = Database::fetchOne('SELECT id, name FROM suppliers WHERE code = ? LIMIT 1', [$supplierCode]);
                if (!$supplier) {
                    throw new HttpException('That supplier no longer exists.', 404, 'NOT_FOUND');
                }
                $supplierId = (int) $supplier['id'];
                $resolvedSupplier = $supplier['name'];
            }

            if ($reference === '') {
                $reference = Inventory::nextReference('SI');
            } else {
                $duplicate = Database::fetchOne('SELECT id FROM inventory_history WHERE reference = ? LIMIT 1', [$reference]);
                if ($duplicate) {
                    throw new HttpException('That stock movement reference has already been recorded.', 409, 'CONFLICT');
                }
            }

            $previous = (float) $variant['stock'];
            $next = $previous + $quantity;
            Inventory::setStock($productId, $variantKey, $next);
            Database::execute('UPDATE products SET awaiting_stock = 0 WHERE id = ?', [$productId]);

            $movementRemarks = $remarks !== '' ? $remarks : ($resolvedSupplier !== '' ? $resolvedSupplier : 'Stock received');

            $historyId = Inventory::recordMovement(
                $reference,
                $productId,
                $variantKey,
                $product['name'],
                $variant['unit'],
                'Stock In',
                $quantity,
                $previous,
                $next,
                $movementRemarks,
                $actor,
            );

            Database::execute(
                'INSERT INTO stock_in
                    (history_id, reference, product_id, variant_key, product_name, unit, quantity,
                     previous_stock, new_stock, supplier_id, supplier_name, remarks, user_label, is_delivery, received_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
                [
                    $historyId,
                    $reference,
                    $productId,
                    $variantKey,
                    $product['name'],
                    $variant['unit'],
                    $quantity,
                    $previous,
                    $next,
                    $supplierId,
                    $resolvedSupplier,
                    $remarks,
                    $actor['name'],
                    $isDelivery ? 1 : 0,
                ],
            );

            Auth::businessAudit(
                'Stock In',
                "{$product['name']}: +" . self::trimNumber($quantity) . " {$variant['unit']}",
                $actor,
            );
        });
    }

    private static function trimNumber(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }
}
