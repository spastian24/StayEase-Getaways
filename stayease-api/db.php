<?php

$host = getenv("STAYEASE_DB_HOST") ?: "localhost";
$username = getenv("STAYEASE_DB_USER") ?: "root";
$password = getenv("STAYEASE_DB_PASSWORD") ?: "";
$database = getenv("STAYEASE_DB_NAME") ?: "stayease";

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @new mysqli($host, $username, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8");
    error_log("StayEase database connection failed.");
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed"
    ]);
    exit();
}

$conn->set_charset("utf8mb4");

?>