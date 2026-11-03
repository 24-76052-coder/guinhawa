<?php

declare(strict_types=1);

$config = require __DIR__ . '/config/config.php';

date_default_timezone_set($config['app']['timezone']);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Guinhawa\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

\Guinhawa\Database::configure($config['db']);
\Guinhawa\Auth::boot($config['session']);
