<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\Inventory;
use Guinhawa\StateRepository;
use Guinhawa\Validator;

final class SettingsController
{
    public static function update(): never
    {
        $actor = Auth::requireAdmin();
        $body = Http::body();

        $fields = [];
        $params = [];

        $textFields = [
            'store_name' => ['Store name', 160],
            'email' => ['Email address', 190],
            'phone' => ['Phone number', 60],
            'address' => ['Address', 255],
            'business_hours' => ['Business hours', 160],
            'description' => ['Description', 500],
        ];
        foreach ($textFields as $field => [$label, $max]) {
            if (array_key_exists($field, $body)) {
                $fields[] = "{$field} = ?";
                $params[] = Validator::optionalText($body[$field], $label, $max);
            }
        }

        if (array_key_exists('low_stock_threshold', $body)) {
            $fields[] = 'low_stock_threshold = ?';
            $params[] = Validator::integer($body['low_stock_threshold'], 'Low stock threshold', 1);
        }
        if (array_key_exists('currency', $body)) {
            $fields[] = 'currency = ?';
            $params[] = in_array($body['currency'], ['PHP', 'USD'], true) ? $body['currency'] : 'PHP';
        }
        if (array_key_exists('date_format', $body)) {
            $fields[] = 'date_format = ?';
            $params[] = Validator::optionalText($body['date_format'], 'Date format', 30) ?: 'MMM DD, YYYY';
        }
        foreach (['email_notifications', 'inventory_alerts', 'order_notifications'] as $field) {
            if (array_key_exists($field, $body)) {
                $fields[] = "{$field} = ?";
                $params[] = !empty($body[$field]) ? 1 : 0;
            }
        }
        if (array_key_exists('gcash_qr', $body)) {
            $fields[] = 'gcash_qr = ?';
            $params[] = Validator::imageReference($body['gcash_qr'], 'GCash QR image');
        }

        if ($fields) {
            Database::execute('UPDATE settings SET ' . implode(', ', $fields) . ' WHERE id = 1', $params);
            Auth::businessAudit('Settings Updated', 'Store settings were updated', $actor);
        }

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }
}
