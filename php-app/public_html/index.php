<?php
// ParentIDPassport PHP minimal server

declare(strict_types=1);

const CONFIG_PATH = __DIR__ . '/config.json';
const STATIC_ROOT = __DIR__;

$staticRootReal = realpath(STATIC_ROOT) ?: STATIC_ROOT;

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($requestUri, PHP_URL_PATH) ?: '/';

if ($path === '/index.php') {
    $path = '/';
}

if ($path === '/save-config.ashx') {
    handle_save_request($method);
    exit;
}

serve_static($path);

function handle_save_request(string $method): void
{
    if ($method !== 'POST') {
        http_response_code(405);
        header('Allow: POST');
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method Not Allowed']);
        return;
    }

    $rawInput = file_get_contents('php://input') ?: '';
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        send_json_error('Invalid JSON payload', 400);
        return;
    }

    if (!isset($payload['auth']) || !is_array($payload['auth'])) {
        send_json_error('Missing authentication block', 400);
        return;
    }

    if (!isset($payload['config']) || !is_array($payload['config'])) {
        send_json_error('Missing config block', 400);
        return;
    }

    $existingConfig = load_existing_config();

    if (!authenticate($payload['auth'], $existingConfig)) {
        send_json_error('Authentication failed', 401);
        return;
    }

    $nextConfig = normalise_config($payload['config']);

    if (!is_dir(dirname(CONFIG_PATH))) {
        if (!mkdir(dirname(CONFIG_PATH), 0755, true) && !is_dir(dirname(CONFIG_PATH))) {
            send_json_error('Unable to create configuration directory', 500);
            return;
        }
    }

    $tmpFile = tempnam(sys_get_temp_dir(), 'portal');
    if ($tmpFile === false) {
        send_json_error('Unable to create temporary file', 500);
        return;
    }

    $encoded = json_encode($nextConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        send_json_error('Failed to encode configuration', 500);
        return;
    }

    if (file_put_contents($tmpFile, $encoded, LOCK_EX) === false) {
        @unlink($tmpFile);
        send_json_error('Unable to write configuration', 500);
        return;
    }

    if (!rename($tmpFile, CONFIG_PATH)) {
        @unlink($tmpFile);
        send_json_error('Unable to persist configuration', 500);
        return;
    }

    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'ok',
        'path' => CONFIG_PATH,
        'timestamp' => gmdate('c'),
    ]);
}

function send_json_error(string $message, int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message, 'status' => $status]);
}

function load_existing_config(): array
{
    if (!file_exists(CONFIG_PATH)) {
        return [];
    }

    $raw = file_get_contents(CONFIG_PATH);
    if ($raw === false) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function authenticate(array $auth, array $existingConfig): bool
{
    $expected = $existingConfig['administrator'] ?? null;
    if (!is_array($expected)) {
        // First run scenario: allow bootstrap with matching username provided in new config
        $expected = $auth;
    }

    $username = $auth['username'] ?? null;
    $hash = $auth['passwordHash'] ?? null;

    if (!is_string($username) || !is_string($hash)) {
        return false;
    }

    $expectedUsername = $expected['username'] ?? null;
    $expectedHash = $expected['passwordHash'] ?? null;

    if (!is_string($expectedUsername) || !is_string($expectedHash)) {
        return false;
    }

    if (!hash_equals($expectedUsername, $username)) {
        return false;
    }

    return hash_equals($expectedHash, $hash);
}

function normalise_config(array $config): array
{
    if (!isset($config['updated'])) {
        $config['updated'] = gmdate('c');
    }

    return $config;
}

function serve_static(string $path): void
{
    global $staticRootReal;
    $normalizedPath = rtrim($path, '/');
    if ($normalizedPath === '') {
        $normalizedPath = '/index.html';
    }

    if ($path === '/') {
        $requested = STATIC_ROOT . '/index.html';
    } else {
        $requested = STATIC_ROOT . $path;
    }

    $real = realpath($requested);
    if ($real === false || !str_starts_with($real, $staticRootReal)) {
        http_response_code(404);
        echo 'Not Found';
        return;
    }

    if (is_dir($real)) {
        $real = rtrim($real, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'index.html';
    }

    if (!is_file($real)) {
        http_response_code(404);
        echo 'Not Found';
        return;
    }

    $mime = mime_content_type($real) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=60');
    readfile($real);
}

