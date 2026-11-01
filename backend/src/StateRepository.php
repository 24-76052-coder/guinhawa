<?php

declare(strict_types=1);

namespace Guinhawa;

/**
 * Reads every module back out of MySQL in the exact shape the existing React
 * pages already consume. The API returns this snapshot after each successful
 * write, so the browser mirror always matches the database.
 */
final class StateRepository
{
    public static function snapshot(array $user, bool $includeAudit = false): array
    {
        $products = self::products();
        $customers = self::customers();
        $suppliers = self::suppliers();
        $sales = self::sales();
        $orders = self::orders();
        $heldOrders = self::heldOrders();
        $stockMoves = self::stockMoves();
        $deliveries = self::supplierDeliveries();
        $issues = self::inventoryIssues();
        $attendance = self::attendance($user);

        $auditLogs = [];
        if ($includeAudit || ($user['role'] ?? '') === 'admin') {
            $auditLogs = self::auditLogs();
        }

        return [
            'products' => $products['active'],
            'archivedProducts' => $products['archived'],
            'catalog_version' => 2,
            'catalog_imported_at' => '',
            'catalog_source' => 'Pet_Product_Price_List.xlsx',
            'customers' => $customers,
            'suppliers' => $suppliers,
            'supplierDeliveries' => $deliveries,
            'orders' => $orders,
            'stockMoves' => $stockMoves,
            'sales' => $sales,
            'heldOrders' => $heldOrders,
            'inventoryIssues' => $issues,
            'attendance' => $attendance,
            'auditLogs' => $auditLogs,
            'settings' => self::settings(),
        ];
    }

    private static function products(): array
    {
        $rows = Database::fetchAll('SELECT * FROM products ORDER BY id ASC');
        if (!$rows) {
            return ['active' => [], 'archived' => []];
        }

        $variantRows = Database::fetchAll(
            'SELECT v.*, COALESCE(i.quantity, 0) AS stock
             FROM product_variants v
             LEFT JOIN inventory i ON i.product_id = v.product_id AND i.variant_key = v.variant_key
             ORDER BY v.product_id ASC, v.variant_key ASC',
        );

        $variantsByProduct = [];
        foreach ($variantRows as $variant) {
            $variantsByProduct[(int) $variant['product_id']][] = [
                'key' => $variant['variant_key'],
                'label' => $variant['label'],
                'unit' => $variant['unit'],
                'unit_raw' => $variant['unit_raw'],
                'price' => (float) $variant['price'],
                'stock' => (float) $variant['stock'],
                'minimum' => (float) $variant['minimum'],
                'assumed' => (bool) $variant['assumed'],
                'unit_verified' => (bool) $variant['unit_verified'],
            ];
        }

        $active = [];
        $archived = [];

        foreach ($rows as $row) {
            $variants = $variantsByProduct[(int) $row['id']] ?? [];
            if (!$variants) {
                // A product with no selling unit cannot be shown or sold.
                continue;
            }
            $primary = $variants[0];
            $product = [
                'id' => (int) $row['id'],
                'sku' => $row['sku'],
                'barcode' => $row['barcode'] ?? '',
                'name' => $row['name'],
                'category' => $row['category'],
                'subcategory' => $row['subcategory'],
                'brand' => $row['brand'],
                'description' => $row['description'] ?? '',
                'variants' => $variants,
                'price' => $primary['price'],
                'unit' => $primary['unit'],
                'stock' => $primary['stock'],
                'minimum' => (float) $row['minimum'],
                'awaiting_stock' => (bool) $row['awaiting_stock'],
                'expiration_date' => $row['expiration_date'] ?? '',
                'supplier' => $row['supplier'],
                'image' => $row['image'],
                'review' => $row['review'],
                'notes' => $row['notes'] ?? '',
                'source' => $row['source'],
                'sheet_row' => $row['sheet_row'] !== null ? (int) $row['sheet_row'] : null,
                'updated' => self::dateLabel($row['updated_at']),
                'archived' => (bool) $row['archived'],
            ];

            if ((bool) $row['archived']) {
                $product['archived_at'] = self::dateLabel($row['archived_at']);
                $product['archive_reason'] = $row['archived_reason'] ?? '';
                $archived[] = $product;
            } else {
                $active[] = $product;
            }
        }

        return ['active' => $active, 'archived' => $archived];
    }

    private static function customers(): array
    {
        $rows = Database::fetchAll('SELECT * FROM customers ORDER BY id ASC');
        return array_map(static fn (array $row) => [
            'id' => $row['code'],
            'name' => $row['name'],
            'contact' => $row['contact'],
            'email' => $row['email'] ?? '',
            'address' => $row['address'],
            'orders' => (int) $row['orders_count'],
            'status' => $row['status'],
            'last' => $row['last_order'] ?: '—',
        ], $rows);
    }

    private static function suppliers(): array
    {
        $rows = Database::fetchAll('SELECT * FROM suppliers ORDER BY id ASC');
        return array_map(static fn (array $row) => [
            'id' => $row['code'],
            'name' => $row['name'],
            'contact' => $row['contact'],
            'email' => $row['email'] ?? '',
            'address' => $row['address'],
        ], $rows);
    }

    private static function sales(): array
    {
        $rows = Database::fetchAll('SELECT * FROM sales ORDER BY id ASC');
        if (!$rows) {
            return [];
        }

        $itemRows = Database::fetchAll('SELECT * FROM sale_items ORDER BY id ASC');
        $itemsBySale = [];
        foreach ($itemRows as $item) {
            $itemsBySale[(int) $item['sale_id']][] = [
                'product_id' => $item['product_id'] !== null ? (int) $item['product_id'] : null,
                'variant' => $item['variant_key'],
                'product' => $item['product_name'],
                'category' => $item['category'],
                'quantity' => (float) $item['quantity'],
                'price' => (float) $item['price'],
                'total' => (float) $item['total'],
                'unit' => $item['unit'],
            ];
        }

        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'receipt_no' => $row['receipt_no'],
            'customer' => $row['customer'],
            'customer_id' => $row['customer_id'] ?? '',
            'subtotal' => (float) $row['subtotal'],
            'discount' => (float) $row['discount'],
            'total' => (float) $row['total'],
            'payment_method' => $row['payment_method'],
            'amount_tendered' => (float) $row['amount_tendered'],
            'change_due' => (float) $row['change_due'],
            'status' => $row['status'],
            'cashier' => $row['cashier'],
            'staff_id' => $row['staff_id'],
            'transaction_id' => $row['transaction_id'] ?? '',
            'date' => self::dateLabel($row['sale_date']),
            'created_at' => str_replace('T', ' ', (string) $row['created_at']),
            'items' => $itemsBySale[(int) $row['id']] ?? [],
        ], $rows);
    }

    private static function orders(): array
    {
        $rows = Database::fetchAll('SELECT * FROM orders ORDER BY id ASC');
        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'order_no' => $row['order_no'] ?? '',
            'customer' => $row['customer'],
            'customer_id' => $row['customer_id'] ?? '',
            'product_id' => $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'product' => $row['product'],
            'variant' => $row['variant_key'],
            'quantity' => (float) $row['quantity'],
            'unit' => $row['unit'],
            'unit_price' => (float) $row['unit_price'],
            'total' => (float) $row['total'],
            'status' => $row['status'],
            'message' => $row['message'] ?? '',
            'date' => self::dateLabel($row['order_date']),
            'created_at' => str_replace('T', ' ', (string) $row['created_at']),
        ], $rows);
    }

    private static function heldOrders(): array
    {
        $rows = Database::fetchAll('SELECT * FROM held_orders ORDER BY id DESC');
        return array_map(static function (array $row): array {
            $items = json_decode((string) $row['items_json'], true);
            return [
                'id' => (int) $row['id'],
                'hold_no' => $row['hold_no'],
                'items' => is_array($items) ? $items : [],
                'discount' => (float) $row['discount'],
                'payment_method' => $row['payment_method'],
                'amount_tendered' => $row['amount_tendered'],
                'cashier' => $row['cashier'],
                'created_at' => str_replace('T', ' ', (string) $row['created_at']),
                'date' => self::dateLabel($row['hold_date']),
            ];
        }, $rows);
    }

    private static function stockMoves(): array
    {
        $rows = Database::fetchAll('SELECT * FROM inventory_history ORDER BY id DESC');
        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'date' => self::dateLabel($row['movement_date']),
            'time' => date('h:i A', strtotime((string) $row['created_at'])),
            'product' => $row['product_name'],
            'product_id' => $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'variant' => $row['variant_key'],
            'unit' => $row['unit'],
            'action' => $row['action'],
            'quantity' => (float) $row['quantity'],
            'previous' => (float) $row['previous_stock'],
            'next' => (float) $row['next_stock'],
            'user' => $row['user_label'],
            'reference' => $row['reference'],
            'remarks' => $row['remarks'],
        ], $rows);
    }

    private static function supplierDeliveries(): array
    {
        $rows = Database::fetchAll(
            'SELECT s.*, sup.code AS supplier_code
             FROM stock_in s
             LEFT JOIN suppliers sup ON sup.id = s.supplier_id
             WHERE s.is_delivery = 1
             ORDER BY s.id DESC',
        );
        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'supplier_id' => $row['supplier_code'] ?? '',
            'supplier' => $row['supplier_name'],
            'product_id' => $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'product' => $row['product_name'],
            'variant' => $row['variant_key'],
            'quantity' => (float) $row['quantity'],
            'unit' => $row['unit'],
            'date' => self::dateLabel($row['received_date']),
            'reference' => $row['reference'],
            'user' => $row['user_label'],
            'remarks' => $row['remarks'],
        ], $rows);
    }

    private static function inventoryIssues(): array
    {
        $rows = Database::fetchAll(
            "SELECT * FROM inventory_history WHERE action IN ('Damaged', 'Expired') ORDER BY id DESC",
        );
        return array_map(static fn (array $row) => [
            'id' => 'ISS-' . $row['id'],
            'product_id' => $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'product' => $row['product_name'],
            'variant' => $row['variant_key'],
            'unit' => $row['unit'],
            'quantity' => (float) $row['quantity'],
            'reason' => $row['action'],
            'date' => self::dateLabel($row['movement_date']),
            'staff_id' => $row['user_label'],
            'reference' => $row['reference'],
            'remarks' => $row['remarks'],
        ], $rows);
    }

    private static function attendance(array $user): array
    {
        if (($user['role'] ?? '') === 'admin') {
            $rows = Database::fetchAll('SELECT * FROM attendance ORDER BY work_date DESC, employee_name ASC');
        } else {
            $rows = Database::fetchAll(
                'SELECT * FROM attendance WHERE employee_code = ? ORDER BY work_date DESC',
                [$user['code']],
            );
        }

        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'date' => $row['work_date'],
            'code' => $row['employee_code'],
            'name' => $row['employee_name'],
            'in' => substr((string) $row['clock_in'], 0, 5),
            'out' => $row['clock_out'] ? substr((string) $row['clock_out'], 0, 5) : '',
            'hours' => (float) $row['hours'],
        ], $rows);
    }

    private static function auditLogs(): array
    {
        $rows = Database::fetchAll('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000');
        return array_map(static fn (array $row) => [
            'id' => 'AUD-' . $row['id'],
            'action' => $row['action'],
            'details' => $row['details'],
            'user' => $row['actor'],
            'date' => self::dateLabel($row['created_at']),
            'time' => date('h:i A', strtotime((string) $row['created_at'])),
        ], $rows);
    }

    private static function settings(): array
    {
        $row = Database::fetchOne('SELECT * FROM settings WHERE id = 1 LIMIT 1');
        if (!$row) {
            return [
                'store_name' => 'Guinhawa Poultry Supply',
                'email' => '',
                'phone' => '',
                'address' => '',
                'business_hours' => '',
                'description' => '',
                'low_stock_threshold' => 10,
                'currency' => 'PHP',
                'date_format' => 'MMM DD, YYYY',
                'email_notifications' => true,
                'inventory_alerts' => true,
                'order_notifications' => true,
                'gcash_qr' => '/qqr.jpg',
            ];
        }

        return [
            'store_name' => $row['store_name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'address' => $row['address'],
            'business_hours' => $row['business_hours'],
            'description' => $row['description'],
            'low_stock_threshold' => (int) $row['low_stock_threshold'],
            'currency' => $row['currency'],
            'date_format' => $row['date_format'],
            'email_notifications' => (bool) $row['email_notifications'],
            'inventory_alerts' => (bool) $row['inventory_alerts'],
            'order_notifications' => (bool) $row['order_notifications'],
            'gcash_qr' => $row['gcash_qr'] ?? '',
        ];
    }

    public static function dateLabel(mixed $value): string
    {
        if (!$value) {
            return '';
        }
        $timestamp = strtotime((string) $value);
        return $timestamp ? date('M j Y', $timestamp) : (string) $value;
    }

    public static function isoDate(mixed $value): string
    {
        if (!$value) {
            return '';
        }
        $timestamp = strtotime((string) $value);
        return $timestamp ? date('Y-m-d', $timestamp) : (string) $value;
    }
}
