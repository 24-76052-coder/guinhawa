<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\StateRepository;
use Guinhawa\Validator;

final class StateController
{
    public static function index(): never
    {
        $user = Auth::requireUser();
        Http::json(['state' => StateRepository::snapshot($user)]);
    }

    /**
     * Restore a JSON backup produced by Settings -> Download Backup.
     * Account tables (admin/employees) are deliberately never touched by a
     * business-data restore, so an uploaded file cannot create an admin.
     */
    public static function restore(): never
    {
        $actor = Auth::requireAdmin();
        $snapshot = Http::body();
        if (!is_array($snapshot['products'] ?? null) || !is_array($snapshot['sales'] ?? null) || !is_array($snapshot['orders'] ?? null)) {
            throw new HttpException('This is not a valid Guinhawa backup file.', 422, 'VALIDATION');
        }

        Database::transaction(function () use ($snapshot, $actor): void {
            Database::execute('DELETE FROM sale_items');
            Database::execute('DELETE FROM sales');
            Database::execute('DELETE FROM held_orders');
            Database::execute('DELETE FROM stock_in');
            Database::execute('DELETE FROM stock_out');
            Database::execute('DELETE FROM inventory_history');
            Database::execute('DELETE FROM inventory');
            Database::execute('DELETE FROM product_variants');
            Database::execute('DELETE FROM orders');
            Database::execute('DELETE FROM products');
            Database::execute('DELETE FROM suppliers');
            Database::execute('DELETE FROM customers');
            Database::execute('DELETE FROM attendance');
            Database::execute('DELETE FROM audit_logs');

            $productIds = self::restoreProducts($snapshot);
            $supplierIds = self::restoreSuppliers($snapshot['suppliers'] ?? []);
            self::restoreCustomers($snapshot['customers'] ?? []);
            self::restoreOrders($snapshot['orders'] ?? [], $productIds);
            self::restoreSales($snapshot['sales'] ?? [], $productIds);
            self::restoreMovements($snapshot['stockMoves'] ?? [], $productIds);
            self::restoreDeliveries($snapshot['supplierDeliveries'] ?? [], $productIds, $supplierIds);
            self::restoreHeldOrders($snapshot['heldOrders'] ?? []);
            self::restoreAttendance($snapshot['attendance'] ?? []);
            self::restoreAuditLogs($snapshot['auditLogs'] ?? []);
            self::restoreSettings($snapshot['settings'] ?? []);

            Auth::businessAudit('Backup Restored', 'Business data was restored from an uploaded JSON backup', $actor);
        });

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    private static function restoreProducts(array $snapshot): array
    {
        $all = [];
        foreach (['products' => false, 'archivedProducts' => true] as $key => $archived) {
            foreach ((array) ($snapshot[$key] ?? []) as $product) {
                if (is_array($product)) {
                    $all[] = [$product, $archived];
                }
            }
        }

        $ids = [];
        $skuSeen = [];
        foreach ($all as [$product, $archived]) {
            $name = Validator::text($product['name'] ?? '', 'Product name', 1, 190);
            $sku = Validator::optionalText($product['sku'] ?? '', 'SKU', 40);
            if ($sku === '') {
                $sku = 'GPS-' . str_pad((string) (2000 + count($skuSeen) + 1), 4, '0', STR_PAD_LEFT);
            }
            $base = $sku;
            $suffix = 2;
            while (isset($skuSeen[strtolower($sku)])) {
                $sku = substr($base, 0, 30) . '-' . $suffix++;
            }
            $skuSeen[strtolower($sku)] = true;

            $barcode = Validator::optionalText($product['barcode'] ?? '', 'Barcode', 80);
            if ($barcode !== '' && isset($skuSeen['bc:' . strtolower($barcode)])) {
                $barcode = '';
            }
            if ($barcode !== '') {
                $skuSeen['bc:' . strtolower($barcode)] = true;
            }

            $variants = is_array($product['variants'] ?? null) && $product['variants']
                ? $product['variants']
                : [[
                    'key' => 'A',
                    'unit' => $product['unit'] ?? 'Units',
                    'unit_raw' => '',
                    'price' => $product['price'] ?? 0,
                    'stock' => $product['stock'] ?? 0,
                    'minimum' => $product['minimum'] ?? 0,
                    'assumed' => false,
                    'unit_verified' => true,
                ]];

            $totalStock = 0.0;
            foreach ($variants as $variant) {
                $totalStock += (float) ($variant['stock'] ?? 0);
            }

            Database::execute(
                'INSERT INTO products
                    (sku, barcode, name, category, subcategory, brand, description, minimum, expiration_date,
                     supplier, image, review, notes, source, sheet_row, awaiting_stock, archived, archived_at, archived_reason)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $sku,
                    $barcode !== '' ? $barcode : null,
                    $name,
                    Validator::optionalText($product['category'] ?? '', 'Category', 60) ?: 'Other',
                    Validator::optionalText($product['subcategory'] ?? '', 'Subcategory', 120),
                    Validator::optionalText($product['brand'] ?? '', 'Brand', 120),
                    Validator::optionalText($product['description'] ?? '', 'Description', 5000),
                    Validator::number($product['minimum'] ?? 0, 'Minimum stock', 0),
                    self::dateValue($product['expiration_date'] ?? ''),
                    Validator::optionalText($product['supplier'] ?? '', 'Supplier', 160),
                    Validator::imageReference($product['image'] ?? ''),
                    ($product['review'] ?? 'Listed') === 'Verify' ? 'Verify' : 'Listed',
                    Validator::optionalText($product['notes'] ?? '', 'Notes', 5000),
                    Validator::optionalText($product['source'] ?? '', 'Source', 160) ?: 'Restored backup',
                    isset($product['sheet_row']) && is_numeric($product['sheet_row']) ? (int) $product['sheet_row'] : null,
                    $totalStock <= 0 ? 1 : 0,
                    $archived ? 1 : 0,
                    $archived ? date('Y-m-d H:i:s') : null,
                    $archived ? Validator::optionalText($product['archive_reason'] ?? 'Restored archive', 'Archive reason', 255) : null,
                ],
            );

            $newId = Database::lastId();
            $oldId = isset($product['id']) && is_numeric($product['id']) ? (int) $product['id'] : null;
            if ($oldId !== null) {
                $ids[$oldId] = $newId;
            }

            $units = [];
            foreach ($variants as $index => $variant) {
                $key = strtoupper((string) ($variant['key'] ?? ($index === 0 ? 'A' : 'B')));
                if (!in_array($key, ['A', 'B'], true) || isset($units[$key])) {
                    continue;
                }
                $rawUnit = trim((string) ($variant['unit'] ?? 'Units'));
                $unit = in_array($rawUnit, Validator::UNITS, true) ? $rawUnit : 'Units';
                if (in_array(mb_strtolower($unit), array_map('mb_strtolower', $units), true)) {
                    $unit = 'Units';
                }
                $units[$key] = $unit;

                Database::execute(
                    'INSERT INTO product_variants
                        (product_id, variant_key, label, unit, unit_raw, price, minimum, assumed, unit_verified)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $newId,
                        $key,
                        $key === 'A' ? 'Price A' : 'Price B',
                        $unit,
                        Validator::optionalText($variant['unit_raw'] ?? '', 'Unit note', 80),
                        Validator::number($variant['price'] ?? 0, 'Price', 0),
                        Validator::number($variant['minimum'] ?? 0, 'Minimum stock', 0),
                        !empty($variant['assumed']) ? 1 : 0,
                        ($variant['unit_verified'] ?? true) === false ? 0 : 1,
                    ],
                );
                Database::execute(
                    'INSERT INTO inventory (product_id, variant_key, quantity) VALUES (?, ?, ?)',
                    [$newId, $key, Validator::number($variant['stock'] ?? 0, 'Stock', 0)],
                );
            }
        }

        return $ids;
    }

    private static function restoreSuppliers(array $suppliers): array
    {
        $ids = [];
        foreach ($suppliers as $supplier) {
            if (!is_array($supplier)) {
                continue;
            }
            $name = Validator::text($supplier['name'] ?? '', 'Supplier name', 1, 160);
            $contact = Validator::text($supplier['contact'] ?? '', 'Contact number', 1, 60);
            $email = Validator::email($supplier['email'] ?? '');
            $address = Validator::optionalText($supplier['address'] ?? '', 'Address', 255);
            $code = Validator::optionalText($supplier['id'] ?? '', 'Supplier code', 20);
            if ($code === '') {
                $code = 'SUP-' . str_pad((string) (count($ids) + 1), 3, '0', STR_PAD_LEFT);
            }

            Database::execute(
                'INSERT INTO suppliers (code, name, contact, email, address) VALUES (?, ?, ?, ?, ?)',
                [$code, $name, $contact, $email, $address],
            );
            $ids[$code] = Database::lastId();
        }
        return $ids;
    }

    private static function restoreCustomers(array $customers): void
    {
        foreach ($customers as $customer) {
            if (!is_array($customer)) {
                continue;
            }
            $name = Validator::text($customer['name'] ?? '', 'Customer name', 1, 160);
            $code = Validator::optionalText($customer['id'] ?? '', 'Customer code', 20);
            if ($code === '') {
                $code = 'CUS-' . str_pad((string) (Database::lastId() + 1), 3, '0', STR_PAD_LEFT);
            }
            Database::execute(
                'INSERT INTO customers (code, name, contact, email, address, orders_count, status, last_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $code,
                    $name,
                    Validator::optionalText($customer['contact'] ?? '', 'Contact number', 60),
                    Validator::email($customer['email'] ?? ''),
                    Validator::optionalText($customer['address'] ?? '', 'Address', 255),
                    max(0, (int) ($customer['orders'] ?? 0)),
                    ($customer['status'] ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active',
                    Validator::optionalText($customer['last'] ?? '', 'Last order', 40),
                ],
            );
        }
    }

    private static function restoreOrders(array $orders, array $productIds): void
    {
        foreach ($orders as $order) {
            if (!is_array($order)) {
                continue;
            }
            $productId = self::lookupId($productIds, $order['product_id'] ?? null);
            Database::execute(
                'INSERT INTO orders
                    (customer, customer_id, product_id, product, variant_key, quantity, unit, unit_price, total,
                     status, message, order_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    Validator::text($order['customer'] ?? '', 'Customer', 1, 160),
                    Validator::optionalText($order['customer_id'] ?? '', 'Customer ID', 20),
                    $productId,
                    Validator::text($order['product'] ?? 'Restored product', 'Product', 1, 190),
                    in_array(($order['variant'] ?? 'A'), ['A', 'B'], true) ? $order['variant'] : 'A',
                    Validator::number($order['quantity'] ?? 0, 'Quantity', 0),
                    Validator::optionalText($order['unit'] ?? 'Units', 'Unit', 40),
                    Validator::number($order['unit_price'] ?? 0, 'Unit price', 0),
                    Validator::number($order['total'] ?? 0, 'Total', 0),
                    in_array(($order['status'] ?? 'Pending'), Validator::ORDER_STATUSES, true) ? $order['status'] : 'Pending',
                    Validator::optionalText($order['message'] ?? '', 'Message', 5000),
                    self::dateValue($order['date'] ?? '') ?: date('Y-m-d'),
                ],
            );
        }
    }

    private static function restoreSales(array $sales, array $productIds): void
    {
        $receipts = [];
        foreach ($sales as $sale) {
            if (!is_array($sale)) {
                continue;
            }
            $receipt = Validator::optionalText($sale['receipt_no'] ?? '', 'Receipt number', 30);
            if ($receipt === '' || isset($receipts[$receipt])) {
                $receipt = 'RCP-' . str_pad((string) (count($receipts) + 1), 3, '0', STR_PAD_LEFT);
            }
            $receipts[$receipt] = true;

            $created = self::timestampValue($sale['created_at'] ?? '') ?: date('Y-m-d H:i:s');
            $saleDate = self::dateValue($sale['date'] ?? '') ?: substr($created, 0, 10);
            $subtotal = Validator::number($sale['subtotal'] ?? 0, 'Subtotal', 0);
            $discount = Validator::number($sale['discount'] ?? 0, 'Discount', 0);
            $total = Validator::number($sale['total'] ?? max(0, $subtotal - $discount), 'Total', 0);

            Database::execute(
                'INSERT INTO sales
                    (receipt_no, customer, customer_id, subtotal, discount, total, payment_method,
                     amount_tendered, change_due, status, cashier, staff_id, transaction_id, sale_date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $receipt,
                    Validator::optionalText($sale['customer'] ?? '', 'Customer', 160) ?: 'Walk-in Customer',
                    Validator::optionalText($sale['customer_id'] ?? '', 'Customer ID', 20),
                    $subtotal,
                    $discount,
                    $total,
                    in_array(($sale['payment_method'] ?? 'Cash'), Validator::PAYMENT_METHODS, true) ? $sale['payment_method'] : 'Cash',
                    Validator::number($sale['amount_tendered'] ?? $total, 'Amount tendered', 0),
                    Validator::number($sale['change_due'] ?? 0, 'Change due', 0),
                    Validator::optionalText($sale['status'] ?? 'Paid', 'Status', 30) ?: 'Paid',
                    Validator::optionalText($sale['cashier'] ?? '', 'Cashier', 160),
                    Validator::optionalText($sale['staff_id'] ?? '', 'Staff ID', 40),
                    Validator::optionalText($sale['transaction_id'] ?? '', 'Transaction ID', 80) ?: null,
                    $saleDate,
                    $created,
                ],
            );
            $saleId = Database::lastId();

            $items = is_array($sale['items'] ?? null) ? $sale['items'] : [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $quantity = Validator::number($item['quantity'] ?? 0, 'Quantity', 0);
                $price = Validator::number($item['price'] ?? 0, 'Price', 0);
                $lineTotal = isset($item['total']) ? Validator::number($item['total'], 'Line total', 0) : round($quantity * $price, 2);
                Database::execute(
                    'INSERT INTO sale_items
                        (sale_id, product_id, variant_key, product_name, category, unit, quantity, price, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $saleId,
                        self::lookupId($productIds, $item['product_id'] ?? null),
                        in_array(($item['variant'] ?? 'A'), ['A', 'B'], true) ? $item['variant'] : 'A',
                        Validator::text($item['product'] ?? 'Restored item', 'Item name', 1, 190),
                        Validator::optionalText($item['category'] ?? '', 'Category', 60),
                        Validator::optionalText($item['unit'] ?? 'Units', 'Unit', 40),
                        $quantity,
                        $price,
                        $lineTotal,
                    ],
                );
            }
        }
    }

    private static function restoreMovements(array $moves, array $productIds): void
    {
        $references = [];
        foreach ($moves as $move) {
            if (!is_array($move)) {
                continue;
            }
            $reference = Validator::optionalText($move['reference'] ?? '', 'Reference', 40);
            if ($reference === '') {
                $reference = 'RESTORE-' . (count($references) + 1);
            }
            $references[$reference] = true;

            $action = in_array(($move['action'] ?? ''), ['Stock In', 'Stock Out', 'Adjustment', 'Damaged', 'Expired'], true)
                ? $move['action']
                : 'Adjustment';

            Database::execute(
                'INSERT INTO inventory_history
                    (reference, product_id, variant_key, product_name, unit, action, quantity,
                     previous_stock, next_stock, remarks, user_label, movement_date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $reference,
                    self::lookupId($productIds, $move['product_id'] ?? null),
                    in_array(($move['variant'] ?? 'A'), ['A', 'B'], true) ? $move['variant'] : 'A',
                    Validator::text($move['product'] ?? 'Restored product', 'Product', 1, 190),
                    Validator::optionalText($move['unit'] ?? 'Units', 'Unit', 40),
                    $action,
                    Validator::number($move['quantity'] ?? 0, 'Quantity', 0),
                    Validator::number($move['previous'] ?? 0, 'Previous stock', 0),
                    Validator::number($move['next'] ?? 0, 'Next stock', 0),
                    Validator::optionalText($move['remarks'] ?? '', 'Remarks', 500),
                    Validator::optionalText($move['user'] ?? '', 'User', 160) ?: 'System',
                    self::dateValue($move['date'] ?? '') ?: date('Y-m-d'),
                    self::timestampValue(trim((string) (($move['date'] ?? '') . ' ' . ($move['time'] ?? '')))) ?: date('Y-m-d H:i:s'),
                ],
            );
        }
    }

    private static function restoreDeliveries(array $deliveries, array $productIds, array $supplierIds): void
    {
        $references = [];
        foreach ($deliveries as $delivery) {
            if (!is_array($delivery)) {
                continue;
            }
            $reference = Validator::optionalText($delivery['reference'] ?? '', 'Reference', 40);
            if ($reference === '' || isset($references[$reference])) {
                $reference = 'DEL-' . (count($references) + 1);
            }
            $references[$reference] = true;
            $supplierCode = Validator::optionalText($delivery['supplier_id'] ?? '', 'Supplier code', 20);

            Database::execute(
                'INSERT INTO stock_in
                    (reference, product_id, variant_key, product_name, unit, quantity, previous_stock, new_stock,
                     supplier_id, supplier_name, remarks, user_label, is_delivery, received_date)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 1, ?)',
                [
                    $reference,
                    self::lookupId($productIds, $delivery['product_id'] ?? null),
                    in_array(($delivery['variant'] ?? 'A'), ['A', 'B'], true) ? $delivery['variant'] : 'A',
                    Validator::text($delivery['product'] ?? 'Restored delivery', 'Product', 1, 190),
                    Validator::optionalText($delivery['unit'] ?? 'Units', 'Unit', 40),
                    Validator::number($delivery['quantity'] ?? 0, 'Quantity', 0),
                    Validator::number($delivery['quantity'] ?? 0, 'Quantity', 0),
                    $supplierIds[$supplierCode] ?? null,
                    Validator::optionalText($delivery['supplier'] ?? '', 'Supplier', 160),
                    Validator::optionalText($delivery['remarks'] ?? '', 'Remarks', 500),
                    Validator::optionalText($delivery['user'] ?? '', 'User', 160) ?: 'System',
                    self::dateValue($delivery['date'] ?? '') ?: date('Y-m-d'),
                ],
            );
        }
    }

    private static function restoreHeldOrders(array $orders): void
    {
        foreach ($orders as $order) {
            if (!is_array($order)) {
                continue;
            }
            $holdNo = Validator::optionalText($order['hold_no'] ?? '', 'Hold number', 30)
                ?: 'HLD-' . str_pad((string) (Database::lastId() + 1), 3, '0', STR_PAD_LEFT);
            Database::execute(
                'INSERT INTO held_orders (hold_no, items_json, discount, payment_method, amount_tendered, cashier, hold_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $holdNo,
                    json_encode(is_array($order['items'] ?? null) ? $order['items'] : [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    Validator::number($order['discount'] ?? 0, 'Discount', 0),
                    in_array(($order['payment_method'] ?? 'Cash'), Validator::PAYMENT_METHODS, true) ? $order['payment_method'] : 'Cash',
                    (string) ($order['amount_tendered'] ?? ''),
                    Validator::optionalText($order['cashier'] ?? '', 'Cashier', 160),
                    self::dateValue($order['date'] ?? '') ?: date('Y-m-d'),
                ],
            );
        }
    }

    private static function restoreAttendance(array $records): void
    {
        foreach ($records as $record) {
            if (!is_array($record)) {
                continue;
            }
            $code = Validator::text($record['code'] ?? '', 'Employee code', 3, 40);
            $date = self::dateValue($record['date'] ?? '');
            if (!$date || empty($record['in'])) {
                continue;
            }
            Database::execute(
                'INSERT IGNORE INTO attendance (employee_code, employee_name, work_date, clock_in, clock_out, hours)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [
                    $code,
                    Validator::optionalText($record['name'] ?? '', 'Employee name', 160) ?: $code,
                    $date,
                    substr((string) $record['in'], 0, 8),
                    !empty($record['out']) ? substr((string) $record['out'], 0, 8) : null,
                    Validator::number($record['hours'] ?? 0, 'Hours', 0),
                ],
            );
        }
    }

    private static function restoreAuditLogs(array $logs): void
    {
        foreach (array_slice($logs, 0, 1000) as $log) {
            if (!is_array($log)) {
                continue;
            }
            $stamp = self::timestampValue(trim((string) (($log['date'] ?? '') . ' ' . ($log['time'] ?? '')))) ?: date('Y-m-d H:i:s');
            Database::execute(
                'INSERT INTO audit_logs (actor, action, details, created_at) VALUES (?, ?, ?, ?)',
                [
                    Validator::optionalText($log['user'] ?? '', 'User', 160) ?: 'System',
                    Validator::optionalText($log['action'] ?? '', 'Action', 120) ?: 'Restored Activity',
                    Validator::optionalText($log['details'] ?? '', 'Details', 500),
                    $stamp,
                ],
            );
        }
    }

    private static function restoreSettings(array $settings): void
    {
        if (!$settings) {
            return;
        }
        $map = [
            'store_name' => 160,
            'email' => 190,
            'phone' => 60,
            'address' => 255,
            'business_hours' => 160,
            'description' => 500,
        ];
        foreach ($map as $field => $max) {
            if (array_key_exists($field, $settings)) {
                Database::execute("UPDATE settings SET {$field} = ? WHERE id = 1", [
                    Validator::optionalText($settings[$field], ucfirst(str_replace('_', ' ', $field)), $max),
                ]);
            }
        }
        if (array_key_exists('low_stock_threshold', $settings)) {
            Database::execute('UPDATE settings SET low_stock_threshold = ? WHERE id = 1', [max(1, (int) $settings['low_stock_threshold'])]);
        }
        if (array_key_exists('gcash_qr', $settings)) {
            Database::execute('UPDATE settings SET gcash_qr = ? WHERE id = 1', [Validator::imageReference($settings['gcash_qr'])]);
        }
    }

    private static function lookupId(array $map, mixed $oldId): ?int
    {
        if (!is_numeric($oldId)) {
            return null;
        }
        return $map[(int) $oldId] ?? null;
    }

    private static function dateValue(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }
        $timestamp = strtotime($value);
        return $timestamp ? date('Y-m-d', $timestamp) : null;
    }

    private static function timestampValue(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }
        $timestamp = strtotime($value);
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
    }
}
