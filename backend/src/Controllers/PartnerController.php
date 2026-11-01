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

final class PartnerController
{
    // ------------------------------------------------------------
    // Suppliers
    // ------------------------------------------------------------

    public static function addSupplier(): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $body = Http::body();
        $name = Validator::text($body['name'] ?? '', 'Supplier name', 1, 160);
        $contact = Validator::text($body['contact'] ?? '', 'Contact number', 1, 60);
        $email = Validator::email($body['email'] ?? '');
        $address = Validator::optionalText($body['address'] ?? '', 'Address', 255);

        self::assertSupplierNameFree($name);

        $code = Inventory::nextCode('suppliers', 'SUP');
        Database::execute(
            'INSERT INTO suppliers (code, name, contact, email, address) VALUES (?, ?, ?, ?, ?)',
            [$code, $name, $contact, $email, $address],
        );

        Auth::businessAudit('Supplier Added', "{$name} added to the supplier directory", $actor);
        Http::json(['state' => StateRepository::snapshot($actor), 'supplier' => ['id' => $code, 'name' => $name]], 201);
    }

    public static function updateSupplier(string $code): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $body = Http::body();
        $supplier = Database::fetchOne('SELECT * FROM suppliers WHERE code = ? LIMIT 1', [$code]);
        if (!$supplier) {
            throw new HttpException('Supplier not found.', 404, 'NOT_FOUND');
        }

        $name = Validator::text($body['name'] ?? '', 'Supplier name', 1, 160);
        $contact = Validator::text($body['contact'] ?? '', 'Contact number', 1, 60);
        $email = Validator::email($body['email'] ?? '');
        $address = Validator::optionalText($body['address'] ?? '', 'Address', 255);

        self::assertSupplierNameFree($name, (int) $supplier['id']);

        Database::execute(
            'UPDATE suppliers SET name = ?, contact = ?, email = ?, address = ? WHERE id = ?',
            [$name, $contact, $email, $address, (int) $supplier['id']],
        );
        // Keep the denormalised delivery label in step with a rename.
        Database::execute('UPDATE stock_in SET supplier_name = ? WHERE supplier_id = ?', [$name, (int) $supplier['id']]);

        Auth::businessAudit('Supplier Updated', "{$name} supplier information updated", $actor);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    public static function deleteSupplier(string $code): never
    {
        $actor = Auth::requireRole(['admin', 'inventory-staff']);
        $supplier = Database::fetchOne('SELECT * FROM suppliers WHERE code = ? LIMIT 1', [$code]);
        if (!$supplier) {
            throw new HttpException('Supplier not found.', 404, 'NOT_FOUND');
        }

        Database::execute('DELETE FROM suppliers WHERE id = ?', [(int) $supplier['id']]);
        Auth::businessAudit('Supplier Removed', "{$supplier['name']} removed from the supplier directory", $actor);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    private static function assertSupplierNameFree(string $name, ?int $ignoreId = null): void
    {
        $sql = 'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)';
        $params = [$name];
        if ($ignoreId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $ignoreId;
        }
        if (Database::fetchOne($sql . ' LIMIT 1', $params)) {
            throw new HttpException('A supplier with this name already exists.', 409, 'CONFLICT');
        }
    }

    // ------------------------------------------------------------
    // Customers
    // ------------------------------------------------------------

    public static function addCustomer(): never
    {
        $actor = Auth::requireAdmin();
        $body = Http::body();
        $name = Validator::text($body['name'] ?? '', 'Customer name', 1, 160);
        $contact = Validator::text($body['contact'] ?? '', 'Contact number', 1, 60);
        $email = Validator::email($body['email'] ?? '');
        $address = Validator::optionalText($body['address'] ?? '', 'Address', 255);

        $code = Inventory::nextCode('customers', 'CUS');
        Database::execute(
            'INSERT INTO customers (code, name, contact, email, address) VALUES (?, ?, ?, ?, ?)',
            [$code, $name, $contact, $email, $address],
        );

        Auth::businessAudit('Customer Added', "{$name} added to the customer directory", $actor);
        Http::json(['state' => StateRepository::snapshot($actor), 'customer' => ['id' => $code, 'name' => $name]], 201);
    }

    public static function updateCustomer(string $code): never
    {
        $actor = Auth::requireAdmin();
        $body = Http::body();
        $customer = Database::fetchOne('SELECT * FROM customers WHERE code = ? LIMIT 1', [$code]);
        if (!$customer) {
            throw new HttpException('Customer not found.', 404, 'NOT_FOUND');
        }

        $name = Validator::text($body['name'] ?? $customer['name'], 'Customer name', 1, 160);
        $contact = Validator::text($body['contact'] ?? $customer['contact'], 'Contact number', 1, 60);
        $email = Validator::email($body['email'] ?? $customer['email']);
        $address = Validator::optionalText($body['address'] ?? $customer['address'], 'Address', 255);

        Database::execute(
            'UPDATE customers SET name = ?, contact = ?, email = ?, address = ? WHERE id = ?',
            [$name, $contact, $email, $address, (int) $customer['id']],
        );

        Auth::businessAudit('Customer Updated', "{$name} customer information updated", $actor);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }

    public static function deleteCustomer(string $code): never
    {
        $actor = Auth::requireAdmin();
        $customer = Database::fetchOne('SELECT * FROM customers WHERE code = ? LIMIT 1', [$code]);
        if (!$customer) {
            throw new HttpException('Customer not found.', 404, 'NOT_FOUND');
        }

        Database::execute('DELETE FROM customers WHERE id = ?', [(int) $customer['id']]);
        Auth::businessAudit('Customer Removed', "{$customer['name']} removed from the customer directory", $actor);
        Http::json(['state' => StateRepository::snapshot($actor)]);
    }
}
