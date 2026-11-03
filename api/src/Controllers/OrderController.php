<?php

declare(strict_types=1);

namespace Guinhawa\Controllers;

use Guinhawa\Auth;
use Guinhawa\Database;
use Guinhawa\Http;
use Guinhawa\HttpException;
use Guinhawa\StateRepository;
use Guinhawa\Validator;

final class OrderController
{
    public static function setStatus(int $id): never
    {
        $actor = Auth::requireAdmin();
        $status = (string) (Http::body()['status'] ?? '');
        if (!in_array($status, Validator::ORDER_STATUSES, true)) {
            throw new HttpException('Please choose a valid order status.', 422, 'VALIDATION');
        }

        $order = Database::fetchOne('SELECT * FROM orders WHERE id = ? LIMIT 1', [$id]);
        if (!$order) {
            throw new HttpException('Order not found.', 404, 'NOT_FOUND');
        }

        Database::execute('UPDATE orders SET status = ? WHERE id = ?', [$status, $id]);
        Auth::businessAudit(
            $status === 'Cancelled' ? 'Order Cancelled' : 'Order Status Changed',
            "Order #{$id} changed from {$order['status']} to {$status}",
            $actor,
        );

        Http::json(['state' => StateRepository::snapshot($actor)]);
    }
}
