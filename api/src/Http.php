<?php

declare(strict_types=1);

namespace Guinhawa;

use Throwable;

class HttpException extends \RuntimeException
{
    public function __construct(
        string $message,
        private int $status = 400,
        private string $errorCode = 'BAD_REQUEST',
        private array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function extra(): array
    {
        return $this->extra;
    }
}

final class Http
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    public static function error(string $message, int $status = 400, string $code = 'BAD_REQUEST', array $extra = []): never
    {
        self::json([
            'error' => $message,
            'code' => $code,
        ] + $extra, $status);
    }

    public static function body(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        try {
            $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException('The request body is not valid JSON.', 400, 'INVALID_JSON');
        }

        if (!is_array($decoded)) {
            throw new HttpException('The request body must be a JSON object.', 400, 'INVALID_JSON');
        }

        return $decoded;
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /** Return the API-relative path, e.g. /auth/login from /guinhawa/api/auth/login. */
    public static function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $position = strpos($uri, '/api');
        if ($position === false) {
            return '/';
        }

        $path = substr($uri, $position + 4);
        if ($path === '' || $path === false) {
            return '/';
        }

        return '/' . ltrim($path, '/');
    }

    public static function query(string $key, string $default = ''): string
    {
        $value = $_GET[$key] ?? $default;
        return is_string($value) ? trim($value) : $default;
    }

    public static function handle(Throwable $error): never
    {
        if ($error instanceof HttpException) {
            self::error($error->getMessage(), $error->status(), $error->errorCode(), $error->extra());
        }

        if ($error instanceof \PDOException) {
            error_log('[guinhawa] database error: ' . $error->getMessage());
            if ($error->getCode() === '23000') {
                self::error('That record conflicts with one already saved in the database.', 409, 'CONFLICT');
            }
            self::error('The database could not complete that request.', 500, 'DATABASE_ERROR');
        }

        error_log('[guinhawa] ' . $error::class . ': ' . $error->getMessage() . "\n" . $error->getTraceAsString());
        self::error('The server could not complete that request.', 500, 'SERVER_ERROR');
    }
}
