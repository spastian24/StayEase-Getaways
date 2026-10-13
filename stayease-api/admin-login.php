<?php
declare(strict_types=1);

require __DIR__ . '/api-common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed.']);
}

$input = readJsonBody();

$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if ($username === '' || !is_string($password)) {
    jsonResponse(400, ['error' => 'Enter your username and password.']);
}

$statement = $pdo->prepare(
    'SELECT admin_id, username, password_hash, full_name, role
     FROM admin_users
     WHERE username = :username
     LIMIT 1'
);

$statement->execute(['username' => $username]);
$admin = $statement->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    jsonResponse(401, ['error' => 'Invalid username or password.']);
}

session_regenerate_id(true);
$_SESSION['auth'] = [
    'type' => 'admin',
    'id' => $admin['admin_id'],
    'name' => $admin['full_name'],
    'username' => $admin['username'],
    'role' => $admin['role'],
];

jsonResponse(200, [
    'message' => 'Admin login successful.',
    'admin' => $_SESSION['auth'],
]);
