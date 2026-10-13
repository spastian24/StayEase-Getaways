<?php

$allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];
$configuredOrigins = array_filter(array_map(
    "trim",
    explode(",", getenv("STAYEASE_ALLOWED_ORIGINS") ?: "")
));
foreach ($configuredOrigins as $configuredOrigin) {
    if (filter_var($configuredOrigin, FILTER_VALIDATE_URL)) {
        $allowedOrigins[] = rtrim($configuredOrigin, "/");
    }
}
$allowedOrigins = array_values(array_unique($allowedOrigins));
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";

if (in_array(rtrim($origin, "/"), $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
}
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

session_start();

require_once "db.php";
require_once __DIR__ . "/agentmail.php";

$method = $_SERVER["REQUEST_METHOD"];

$rawBody = file_get_contents("php://input");
$input = json_decode($rawBody, true);

$action = $_GET["action"] ?? "";

function response($success, $message = "", $data = null, $status = 200, $errorCode = null)
{
    http_response_code($status);

    $payload = [
        "success" => $success,
        "message" => $message,
        "data" => $data
    ];

    if ($errorCode !== null) {
        $payload["error_code"] = $errorCode;
    }

    echo json_encode($payload);

    exit();
}

function payrexWebhookSignatureIsValid($rawBody, $signatureHeader, $secret, $livemode)
{
    $signatureParts = [];
    foreach (explode(",", $signatureHeader) as $part) {
        $pair = explode("=", trim($part), 2);
        if (count($pair) === 2) {
            $signatureParts[$pair[0]] = $pair[1];
        }
    }

    $timestamp = $signatureParts["t"] ?? "";
    $signature = $signatureParts[$livemode ? "li" : "te"] ?? "";
    if ($timestamp === "" || $signature === "") {
        return false;
    }

    $expected = hash_hmac("sha256", $timestamp . "." . $rawBody, $secret);
    return hash_equals($expected, $signature);
}

function googleBase64UrlDecode($value)
{
    $value = strtr($value, "-_", "+/");
    $padding = strlen($value) % 4;
    if ($padding !== 0) {
        $value .= str_repeat("=", 4 - $padding);
    }

    $decoded = base64_decode($value, true);
    if ($decoded === false) {
        throw new UnexpectedValueException("Invalid Google sign-in credential.");
    }

    return $decoded;
}

function googleDerEncodeLength($length)
{
    if ($length < 128) {
        return chr($length);
    }

    $encodedLength = "";
    while ($length > 0) {
        $encodedLength = chr($length & 0xff) . $encodedLength;
        $length >>= 8;
    }

    return chr(0x80 | strlen($encodedLength)) . $encodedLength;
}

function googleDerEncodeInteger($integer)
{
    $integer = ltrim($integer, "\x00");
    if ($integer === "") {
        $integer = "\x00";
    } elseif ((ord($integer[0]) & 0x80) !== 0) {
        $integer = "\x00" . $integer;
    }

    return "\x02" . googleDerEncodeLength(strlen($integer)) . $integer;
}

function googleRsaJwkToPem($modulus, $exponent)
{
    $encodedModulus = googleDerEncodeInteger($modulus);
    $encodedExponent = googleDerEncodeInteger($exponent);
    $rsaPublicKeyContents = $encodedModulus . $encodedExponent;
    $rsaPublicKey = "\x30"
        . googleDerEncodeLength(strlen($rsaPublicKeyContents))
        . $rsaPublicKeyContents;
    $algorithmIdentifier = hex2bin("300d06092a864886f70d0101010500");
    $subjectPublicKey = "\x03"
        . googleDerEncodeLength(strlen($rsaPublicKey) + 1)
        . "\x00"
        . $rsaPublicKey;
    $subjectPublicKeyInfo = "\x30"
        . googleDerEncodeLength(strlen($algorithmIdentifier) + strlen($subjectPublicKey))
        . $algorithmIdentifier
        . $subjectPublicKey;

    return "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($subjectPublicKeyInfo), 64, "\n")
        . "-----END PUBLIC KEY-----";
}

function verifyGoogleIdToken($credential, $nonce, $clientId)
{
    $tokenParts = explode(".", $credential);
    if (count($tokenParts) !== 3) {
        throw new UnexpectedValueException("Invalid Google sign-in credential.");
    }

    $header = json_decode(googleBase64UrlDecode($tokenParts[0]), true);
    $claims = json_decode(googleBase64UrlDecode($tokenParts[1]), true);
    $signature = googleBase64UrlDecode($tokenParts[2]);
    if (
        !is_array($header) ||
        !is_array($claims) ||
        ($header["alg"] ?? "") !== "RS256" ||
        empty($header["kid"])
    ) {
        throw new UnexpectedValueException("Invalid Google sign-in credential.");
    }

    static $googleSigningKeys = null;
    if ($googleSigningKeys === null) {
        if (!function_exists("curl_init")) {
            throw new RuntimeException("Google sign-in requires the PHP cURL extension.");
        }

        $request = curl_init("https://www.googleapis.com/oauth2/v3/certs");
        if ($request === false) {
            throw new RuntimeException("Could not initialize Google sign-in verification.");
        }
        curl_setopt_array($request, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ["Accept: application/json"]
        ]);
        $responseBody = curl_exec($request);
        $curlError = curl_error($request);
        $httpStatus = curl_getinfo($request, CURLINFO_HTTP_CODE);
        curl_close($request);

        if ($responseBody === false || $httpStatus < 200 || $httpStatus >= 300) {
            error_log(
                "Google signing-key request failed: "
                . ($responseBody === false ? $curlError : "HTTP " . $httpStatus)
            );
            throw new RuntimeException("Google sign-in verification is temporarily unavailable.");
        }

        $keyResponse = json_decode($responseBody, true);
        if (!is_array($keyResponse) || !is_array($keyResponse["keys"] ?? null)) {
            throw new RuntimeException("Google returned invalid signing keys.");
        }
        $googleSigningKeys = $keyResponse["keys"];
    }

    $signingKey = null;
    foreach ($googleSigningKeys as $key) {
        if (
            is_array($key) &&
            ($key["kid"] ?? "") === $header["kid"] &&
            ($key["kty"] ?? "") === "RSA" &&
            ($key["alg"] ?? "RS256") === "RS256" &&
            isset($key["n"], $key["e"])
        ) {
            $signingKey = $key;
            break;
        }
    }

    if (!$signingKey) {
        throw new UnexpectedValueException("Google sign-in credential has an unknown signing key.");
    }

    $publicKey = openssl_pkey_get_public(
        googleRsaJwkToPem(
            googleBase64UrlDecode($signingKey["n"]),
            googleBase64UrlDecode($signingKey["e"])
        )
    );
    if (
        $publicKey === false ||
        openssl_verify(
            $tokenParts[0] . "." . $tokenParts[1],
            $signature,
            $publicKey,
            OPENSSL_ALGO_SHA256
        ) !== 1
    ) {
        throw new UnexpectedValueException("Google sign-in credential could not be verified.");
    }

    $audience = $claims["aud"] ?? null;
    $audienceIsValid = is_string($audience)
        ? hash_equals($clientId, $audience)
        : (is_array($audience) && in_array($clientId, $audience, true));
    $issuedAt = filter_var($claims["iat"] ?? null, FILTER_VALIDATE_INT);
    $expiresAt = filter_var($claims["exp"] ?? null, FILTER_VALIDATE_INT);
    $email = strtolower(trim($claims["email"] ?? ""));
    $emailVerified = ($claims["email_verified"] ?? false) === true
        || ($claims["email_verified"] ?? "") === "true";

    if (
        !in_array($claims["iss"] ?? "", ["accounts.google.com", "https://accounts.google.com"], true) ||
        !$audienceIsValid ||
        (isset($claims["azp"]) && !hash_equals($clientId, $claims["azp"])) ||
        !is_string($claims["nonce"] ?? null) ||
        !hash_equals($nonce, $claims["nonce"]) ||
        $issuedAt === false ||
        $issuedAt > time() + 60 ||
        $expiresAt === false ||
        $expiresAt <= time() ||
        !preg_match('/^[A-Za-z0-9_-]{1,255}$/', $claims["sub"] ?? "") ||
        !$emailVerified ||
        !filter_var($email, FILTER_VALIDATE_EMAIL) ||
        trim($claims["name"] ?? "") === ""
    ) {
        throw new UnexpectedValueException("Google sign-in credential is invalid or expired.");
    }

    return [
        "subject" => $claims["sub"],
        "email" => $email,
        "name" => trim($claims["name"])
    ];
}

function reservationAmenityPackageKey($amenityName)
{
    $name = strtolower(trim(preg_replace("/\s+/", " ", $amenityName)));
    $aliases = [
        "gym" => "fitness-center",
        "fitness center" => "fitness-center",
        "swimming pool" => "swimming-pool",
        "breakfast" => "complimentary-breakfast",
        "complimentary breakfast" => "complimentary-breakfast",
        "meeting facilities" => "meeting-facilities",
        "balcony" => "balcony",
        "balcony in room" => "balcony",
        "spa" => "luxury-spa",
        "luxury spa" => "luxury-spa",
        "restaurant" => "fine-dining",
        "fine dining restaurant" => "fine-dining"
    ];

    return $aliases[$name] ?? $name;
}

function maximumBookedRoomsForRange($startDate, $endDate, $reservations)
{
    $maximum = 0;
    $date = new DateTimeImmutable($startDate);
    $end = new DateTimeImmutable($endDate);

    while ($date < $end) {
        $dateValue = $date->format("Y-m-d");
        $booked = 0;
        foreach ($reservations as $reservation) {
            if (
                $reservation["check_in"] <= $dateValue &&
                $reservation["effective_check_out"] > $dateValue
            ) {
                $booked += (int) $reservation["rooms_count"];
            }
        }
        $maximum = max($maximum, $booked);
        $date = $date->modify("+1 day");
    }

    return $maximum;
}

function sendPaymentConfirmationIfNeeded($conn, $paymentId)
{
    $conn->begin_transaction();
    $paymentLookup = $conn->prepare(
        "SELECT p.reservation_id, p.amount, p.confirmation_email_sent_at,
                r.guest_name, r.email, r.check_in, r.check_out
         FROM payments p
         JOIN reservations r ON r.reservation_id = p.reservation_id
         WHERE p.payment_id = ?
         FOR UPDATE"
    );
    if (!$paymentLookup || !$paymentLookup->bind_param("s", $paymentId) || !$paymentLookup->execute()) {
        $conn->rollback();
        throw new RuntimeException("Could not check payment confirmation status.");
    }

    $payment = $paymentLookup->get_result()->fetch_assoc();
    if (!$payment) {
        $conn->rollback();
        throw new RuntimeException("Payment record not found.");
    }
    if ($payment["confirmation_email_sent_at"] !== null) {
        $conn->commit();
        return false;
    }

    try {
        sendAgentMailPaymentConfirmation(
            $payment["email"],
            $payment["guest_name"],
            $payment["reservation_id"],
            (float) $payment["amount"],
            $payment["check_in"],
            $payment["check_out"]
        );
    } catch (RuntimeException $error) {
        $conn->rollback();
        throw $error;
    }

    $emailSentUpdate = $conn->prepare(
        "UPDATE payments
         SET confirmation_email_sent_at = NOW()
         WHERE payment_id = ?"
    );
    if (!$emailSentUpdate || !$emailSentUpdate->bind_param("s", $paymentId) || !$emailSentUpdate->execute()) {
        $conn->rollback();
        throw new RuntimeException("Could not record the payment confirmation email.");
    }

    if (!$conn->commit()) {
        $conn->rollback();
        throw new RuntimeException("Could not commit the payment confirmation status.");
    }

    return true;
}

function retrievePayrexCheckoutSession($checkoutSessionId)
{
    if (!function_exists("curl_init")) {
        throw new RuntimeException("The server is missing the PHP cURL extension required to verify PayRex payments.");
    }

    $secretKey = trim(getenv("PAYREX_SECRET_KEY") ?: "");
    if ($secretKey === "") {
        throw new RuntimeException("PayRex Checkout is not configured on the server.");
    }

    $apiBaseUrl = rtrim(getenv("PAYREX_API_BASE_URL") ?: "https://api.payrexhq.com", "/");
    $request = curl_init(
        $apiBaseUrl . "/checkout_sessions/" . rawurlencode($checkoutSessionId)
    );
    if ($request === false) {
        throw new RuntimeException("Could not initialize the PayRex payment verification request.");
    }

    curl_setopt_array($request, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            "Authorization: Basic " . base64_encode($secretKey . ":"),
            "Accept: application/json"
        ]
    ]);
    $responseBody = curl_exec($request);
    $curlError = curl_error($request);
    $httpStatus = curl_getinfo($request, CURLINFO_HTTP_CODE);
    curl_close($request);

    if ($responseBody === false) {
        error_log("PayRex checkout verification request failed: " . $curlError);
        throw new RuntimeException("Could not reach PayRex to verify the payment. Please retry.");
    }

    $checkoutSession = json_decode($responseBody, true);
    if ($httpStatus < 200 || $httpStatus >= 300 || !is_array($checkoutSession)) {
        error_log("PayRex checkout verification returned HTTP " . $httpStatus . ".");
        throw new RuntimeException("PayRex could not verify this checkout session. Please retry.");
    }

    return $checkoutSession;
}

if ($action === "payrex-webhook") {
    if ($method !== "POST") {
        response(false, "Method not allowed", null, 405);
    }

    $webhookSecret = trim(getenv("PAYREX_WEBHOOK_SECRET") ?: "");
    if ($webhookSecret === "") {
        response(false, "PayRex webhook verification is not configured", null, 503);
    }

    $event = json_decode($rawBody, true);
    if (!is_array($event)) {
        response(false, "Invalid webhook payload", null, 400);
    }

    $livemode = !empty($event["livemode"]);
    $signatureHeader = $_SERVER["HTTP_PAYREX_SIGNATURE"] ?? "";
    if (!payrexWebhookSignatureIsValid($rawBody, $signatureHeader, $webhookSecret, $livemode)) {
        response(false, "Invalid webhook signature", null, 400);
    }

    $eventType = $event["type"] ?? "";
    if (!in_array($eventType, ["payment_intent.succeeded", "checkout_session.completed"], true)) {
        response(true, "Event ignored");
    }

    $eventData = $event["data"] ?? null;
    $paymentEvent = is_array($eventData["resource"] ?? null)
        ? $eventData["resource"]
        : $eventData;
    if (!is_array($paymentEvent)) {
        response(false, "Payment event data is invalid", null, 400);
    }

    $reservationId = trim($paymentEvent["metadata"]["reservation_id"] ?? "");
    $amount = $eventType === "checkout_session.completed"
        ? ($paymentEvent["amount_total"] ?? null)
        : ($paymentEvent["amount"] ?? null);
    $paymentSucceeded = $eventType === "checkout_session.completed"
        ? ($paymentEvent["payment_status"] ?? "") === "paid"
        : ($paymentEvent["status"] ?? "") === "succeeded";
    if (
        !$paymentSucceeded ||
        ($paymentEvent["currency"] ?? "") !== "PHP" ||
        !is_numeric($amount)
    ) {
        response(false, "Payment event is missing required reservation details", null, 400);
    }

    $conn->begin_transaction();
    if ($reservationId !== "") {
        $paymentLookup = $conn->prepare(
            "SELECT p.payment_id, p.amount
         FROM payments p
         WHERE p.reservation_id = ?
         LIMIT 1
         FOR UPDATE"
        );
        if (!$paymentLookup) {
            $conn->rollback();
            response(false, "Could not locate the reservation payment", null, 500);
        }
        $paymentLookup->bind_param("s", $reservationId);
    } elseif ($eventType === "checkout_session.completed" && !empty($paymentEvent["id"])) {
        $checkoutSessionId = trim($paymentEvent["id"]);
        $paymentLookup = $conn->prepare(
            "SELECT p.payment_id, p.amount
             FROM payments p
             WHERE p.transaction_reference = ?
             LIMIT 1
             FOR UPDATE"
        );
        if (!$paymentLookup) {
            $conn->rollback();
            response(false, "Could not locate the reservation payment", null, 500);
        }
        $paymentLookup->bind_param("s", $checkoutSessionId);
    } else {
        $conn->rollback();
        response(false, "Payment event is missing its reservation reference", null, 400);
    }
    if (!$paymentLookup->execute()) {
        $conn->rollback();
        response(false, "Could not locate the reservation payment", null, 500);
    }

    $payment = $paymentLookup->get_result()->fetch_assoc();
    if (!$payment) {
        $conn->rollback();
        response(false, "Reservation payment not found", null, 404);
    }

    if ((int) round((float) $payment["amount"] * 100) !== (int) $amount) {
        $conn->rollback();
        response(false, "Payment amount does not match the reservation", null, 400);
    }

    $paymentUpdate = $conn->prepare(
        "UPDATE payments
         SET payment_status = 'Paid',
             payment_date = CURDATE()
         WHERE payment_id = ?"
    );
    $paymentUpdate->bind_param("s", $payment["payment_id"]);
    if (!$paymentUpdate->execute()) {
        $conn->rollback();
        response(false, "Could not update the payment record", null, 500);
    }
    $conn->commit();

    try {
        $emailSent = sendPaymentConfirmationIfNeeded($conn, $payment["payment_id"]);
    } catch (RuntimeException $error) {
        error_log("PayRex payment confirmation email failed: " . $error->getMessage());
        response(false, "Payment was recorded, but its confirmation email could not be sent. Retry the email from the admin payment page.", null, 502);
    }

    response(true, $emailSent ? "Payment confirmed and email sent" : "Payment confirmation already processed");
}


/* =========================
   USERS
========================= */

if ($action === "register" && $method === "POST") {

    $name = $input["name"] ?? "";
    $email = strtolower(trim($input["email"] ?? ""));
    $password = $input["password"] ?? "";
    $confirmPassword = $input["confirmPassword"] ?? "";
    if ($name === "" || $email === "" || $password === "" || $confirmPassword === "") {
        response(false, "All fields are required", null, 400);
    }

    if (!hash_equals($password, $confirmPassword)) {
        response(false, "Your passwords do not match.", null, 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(false, "Enter a valid email address", null, 400);
    }

    $check = $conn->prepare(
        "SELECT user_id FROM users WHERE email = ?"
    );

    $check->bind_param("s", $email);
    $check->execute();

    $result = $check->get_result();

    if ($result->num_rows > 0) {
        response(false, "Email already exists", null, 409);
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $userId = bin2hex(random_bytes(7));
    $customerId = bin2hex(random_bytes(7));
    $verificationCode = (string) random_int(100000, 999999);
    $conn->begin_transaction();

    $stmt = $conn->prepare(
        "INSERT INTO users
        (user_id, full_name, email, password_hash, is_verified, verification_code, code_expires_at)
        VALUES (?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))"
    );

    $stmt->bind_param(
        "sssss",
        $userId,
        $name,
        $email,
        $hashedPassword,
        $verificationCode
    );

    if (!$stmt->execute()) {
        $conn->rollback();
        response(false, "Registration failed", null, 500);
    }

    $customerStmt = $conn->prepare(
        "INSERT INTO customers
        (customer_id, user_id, full_name, email)
        VALUES (?, ?, ?, ?)"
    );
    $customerStmt->bind_param(
        "ssss",
        $customerId,
        $userId,
        $name,
        $email
    );

    if (!$customerStmt->execute()) {
        $conn->rollback();
        response(false, "Customer profile creation failed", null, 500);
    }

    try {
        sendAgentMailVerificationCode($email, $verificationCode);
    } catch (RuntimeException $error) {
        $conn->rollback();
        error_log("AgentMail verification email failed: " . $error->getMessage());
        response(
            false,
            "Registration failed because the verification email could not be sent. Please try again.",
            null,
            502
        );
    }

    if (!$conn->commit()) {
        $conn->rollback();
        response(false, "Registration could not be completed", null, 500);
    }

    response(true, "Registration successful", [
        "verificationRequired" => true,
        "email" => $email
    ]);
}

if ($action === "forgot-password" && $method === "POST") {
    $email = strtolower(trim($input["email"] ?? ""));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(false, "Enter a valid email address", null, 400);
    }

    $lookup = $conn->prepare(
        "SELECT user_id, is_verified FROM users WHERE email = ?"
    );
    $lookup->bind_param("s", $email);
    if (!$lookup->execute()) {
        response(false, "Could not start password recovery", null, 500);
    }

    $user = $lookup->get_result()->fetch_assoc();
    if (!$user || (int) $user["is_verified"] !== 1) {
        response(true, "If an eligible account exists, a reset code has been sent", [
            "email" => $email
        ]);
    }

    $resetCode = (string) random_int(100000, 999999);
    $conn->begin_transaction();
    $update = $conn->prepare(
        "UPDATE users
         SET verification_code = ?, code_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
         WHERE user_id = ? AND is_verified = 1"
    );
    $update->bind_param("ss", $resetCode, $user["user_id"]);
    if (!$update->execute() || $update->affected_rows !== 1) {
        $conn->rollback();
        response(false, "Could not start password recovery", null, 500);
    }

    try {
        sendAgentMailPasswordResetCode($email, $resetCode);
    } catch (RuntimeException $error) {
        $conn->rollback();
        error_log("AgentMail password reset email failed: " . $error->getMessage());
        response(false, "The password reset email could not be sent. Please try again.", null, 502);
    }

    if (!$conn->commit()) {
        $conn->rollback();
        response(false, "Could not start password recovery", null, 500);
    }

    response(true, "If an eligible account exists, a reset code has been sent", [
        "email" => $email
    ]);
}

if ($action === "reset-password" && $method === "POST") {
    $email = strtolower(trim($input["email"] ?? ""));
    $resetCode = trim($input["code"] ?? "");
    $newPassword = $input["password"] ?? "";

    if (
        !filter_var($email, FILTER_VALIDATE_EMAIL) ||
        !preg_match("/^\d{6}$/", $resetCode) ||
        $newPassword === ""
    ) {
        response(false, "Enter a valid email, 6-digit code, and new password", null, 400);
    }

    $conn->begin_transaction();
    $lookup = $conn->prepare(
        "SELECT user_id, verification_code,
                (code_expires_at IS NULL OR code_expires_at <= NOW()) AS code_expired
         FROM users
         WHERE email = ? AND is_verified = 1
         FOR UPDATE"
    );
    $lookup->bind_param("s", $email);
    if (!$lookup->execute()) {
        $conn->rollback();
        response(false, "Could not reset the password", null, 500);
    }

    $user = $lookup->get_result()->fetch_assoc();
    if (
        !$user ||
        (int) $user["code_expired"] === 1 ||
        !hash_equals((string) ($user["verification_code"] ?? ""), $resetCode)
    ) {
        $conn->rollback();
        response(false, "The reset code is invalid or expired. Request a new one.", null, 400);
    }

    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        $conn->rollback();
        response(false, "Could not reset the password", null, 500);
    }

    $update = $conn->prepare(
        "UPDATE users
         SET password_hash = ?, verification_code = NULL, code_expires_at = NULL
         WHERE user_id = ? AND is_verified = 1"
    );
    $update->bind_param("ss", $passwordHash, $user["user_id"]);
    if (!$update->execute() || $update->affected_rows !== 1) {
        $conn->rollback();
        response(false, "Could not reset the password", null, 500);
    }

    if (!$conn->commit()) {
        $conn->rollback();
        response(false, "Could not reset the password", null, 500);
    }

    response(true, "Password updated. You can now sign in.");
}

if ($action === "google-login" && $method === "POST") {
    $credential = $input["credential"] ?? "";
    $nonce = $input["nonce"] ?? "";
    $googleClientId = trim(getenv("GOOGLE_CLIENT_ID") ?: "");

    if ($googleClientId === "") {
        response(false, "Google sign-in is not configured on the server.", null, 503);
    }
    if (
        !is_string($credential) ||
        $credential === "" ||
        !is_string($nonce) ||
        !preg_match('/^[A-Za-z0-9_-]{20,128}$/', $nonce)
    ) {
        response(false, "Google sign-in could not be completed. Please try again.", null, 400);
    }

    try {
        $googleAccount = verifyGoogleIdToken(
            $credential,
            $nonce,
            $googleClientId
        );
    } catch (UnexpectedValueException $error) {
        response(false, $error->getMessage(), null, 401);
    } catch (RuntimeException $error) {
        error_log("Google sign-in verification failed: " . $error->getMessage());
        response(false, $error->getMessage(), null, 503);
    }

    $conn->begin_transaction();
    $lookup = $conn->prepare(
        "SELECT user_id, full_name, email, role, is_verified
         FROM users
         WHERE email = ?
         LIMIT 1
         FOR UPDATE"
    );
    if (!$lookup || !$lookup->bind_param("s", $googleAccount["email"]) || !$lookup->execute()) {
        $conn->rollback();
        response(false, "Could not look up the Google account.", null, 500);
    }

    $user = $lookup->get_result()->fetch_assoc();
    if ($user) {
        if (($user["role"] ?? "") !== "customer") {
            $conn->rollback();
            response(false, "This Google account cannot be used to sign in as a guest.", null, 403);
        }

        if ((int) $user["is_verified"] !== 1) {
            $verifyUser = $conn->prepare(
                "UPDATE users
                 SET is_verified = 1,
                     verification_code = NULL,
                     code_expires_at = NULL
                 WHERE user_id = ?"
            );
            if (
                !$verifyUser ||
                !$verifyUser->bind_param("s", $user["user_id"]) ||
                !$verifyUser->execute()
            ) {
                $conn->rollback();
                response(false, "Could not verify the Google account.", null, 500);
            }
        }
    } else {
        $passwordHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            $conn->rollback();
            response(false, "Could not create the Google account.", null, 500);
        }

        $user = [
            "user_id" => bin2hex(random_bytes(7)),
            "full_name" => $googleAccount["name"],
            "email" => $googleAccount["email"],
            "role" => "customer",
            "is_verified" => 1
        ];
        $createUser = $conn->prepare(
            "INSERT INTO users
             (user_id, full_name, email, password_hash, role, is_verified)
             VALUES (?, ?, ?, ?, 'customer', 1)"
        );
        if (
            !$createUser ||
            !$createUser->bind_param(
                "ssss",
                $user["user_id"],
                $user["full_name"],
                $user["email"],
                $passwordHash
            ) ||
            !$createUser->execute()
        ) {
            $conn->rollback();
            response(false, "Could not create the Google account.", null, 500);
        }

        $customerId = bin2hex(random_bytes(7));
        $createCustomer = $conn->prepare(
            "INSERT INTO customers (customer_id, user_id, full_name, email)
             VALUES (?, ?, ?, ?)"
        );
        if (
            !$createCustomer ||
            !$createCustomer->bind_param(
                "ssss",
                $customerId,
                $user["user_id"],
                $user["full_name"],
                $user["email"]
            ) ||
            !$createCustomer->execute()
        ) {
            $conn->rollback();
            response(false, "Could not create the Google customer profile.", null, 500);
        }
    }

    if (!$conn->commit()) {
        $conn->rollback();
        response(false, "Google sign-in could not be completed.", null, 500);
    }

    if (!session_regenerate_id(true)) {
        response(false, "Google sign-in could not start a secure session.", null, 500);
    }
    $_SESSION["user_id"] = $user["user_id"];

    response(true, "Google sign-in successful", [
        "user" => [
            "id" => $user["user_id"],
            "name" => $user["full_name"],
            "email" => $user["email"],
            "type" => "user"
        ]
    ]);
}

if ($action === "login" && $method === "POST") {

    $email = strtolower(trim($input["email"] ?? ""));
    $password = $input["password"] ?? "";

    $stmt = $conn->prepare(
        "SELECT user_id, full_name, email, password_hash, is_verified
         FROM users
         WHERE email = ?"
    );

    $stmt->bind_param("s", $email);
    $stmt->execute();

    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        response(false, "Invalid email or password", null, 401);
    }

    $user = $result->fetch_assoc();

    if (!password_verify($password, $user["password_hash"])) {
        response(false, "Invalid email or password", null, 401);
    }

    if ((int) $user["is_verified"] !== 1) {
        unset($_SESSION["user_id"]);
        response(true, "Email verification required", [
            "verificationRequired" => true,
            "email" => $user["email"]
        ]);
    }

    $_SESSION["user_id"] = $user["user_id"];

    response(true, "Login successful", [
        "user" => [
            "id" => $user["user_id"],
            "name" => $user["full_name"],
            "email" => $user["email"],
            "type" => "user"
        ]
    ]);
}

if ($action === "verify-email" && $method === "POST") {
    $email = strtolower(trim($input["email"] ?? ""));
    $code = trim($input["code"] ?? "");

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match("/^\d{6}$/", $code)) {
        response(false, "Enter a valid email address and 6-digit code", null, 400);
    }

    $stmt = $conn->prepare(
        "SELECT user_id, full_name, email, is_verified, verification_code,
                (code_expires_at IS NULL OR code_expires_at <= NOW()) AS code_expired
         FROM users
         WHERE email = ?"
    );
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        response(false, "No account was found with that email address", null, 404);
    }

    $user = $result->fetch_assoc();

    if ((int) $user["is_verified"] === 1) {
        $_SESSION["user_id"] = $user["user_id"];
        response(true, "Email is already verified", [
            "user" => [
                "id" => $user["user_id"],
                "name" => $user["full_name"],
                "email" => $user["email"],
                "type" => "user"
            ]
        ]);
    }

    if ((int) $user["code_expired"] === 1) {
        response(false, "Your verification code has expired. Request a new one.", null, 410, "verification_code_expired");
    }

    if (!hash_equals((string) $user["verification_code"], $code)) {
        response(false, "The verification code is incorrect.", null, 400, "verification_code_invalid");
    }

    $update = $conn->prepare(
        "UPDATE users
         SET is_verified = 1, verification_code = NULL, code_expires_at = NULL
         WHERE user_id = ? AND is_verified = 0"
    );
    $update->bind_param("s", $user["user_id"]);

    if (!$update->execute()) {
        response(false, "Email verification could not be completed", null, 500);
    }

    $_SESSION["user_id"] = $user["user_id"];
    response(true, "Email verified successfully", [
        "user" => [
            "id" => $user["user_id"],
            "name" => $user["full_name"],
            "email" => $user["email"],
            "type" => "user"
        ]
    ]);
}

if ($action === "resend-verification" && $method === "POST") {
    $email = strtolower(trim($input["email"] ?? ""));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(false, "Enter a valid email address", null, 400);
    }

    $stmt = $conn->prepare(
        "SELECT user_id, is_verified FROM users WHERE email = ?"
    );
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        response(false, "No account was found with that email address", null, 404);
    }

    $user = $result->fetch_assoc();

    if ((int) $user["is_verified"] === 1) {
        response(false, "This email address is already verified", null, 409);
    }

    $verificationCode = (string) random_int(100000, 999999);
    $update = $conn->prepare(
        "UPDATE users
         SET verification_code = ?, code_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
         WHERE user_id = ? AND is_verified = 0"
    );
    $update->bind_param("ss", $verificationCode, $user["user_id"]);

    if (!$update->execute()) {
        response(false, "A new verification code could not be created", null, 500);
    }

    try {
        sendAgentMailVerificationCode($email, $verificationCode);
    } catch (RuntimeException $error) {
        error_log("AgentMail verification email failed: " . $error->getMessage());
        response(false, "The verification email could not be sent. Please try again.", null, 502);
    }

    response(true, "A new verification code has been sent", ["email" => $email]);
}

if ($action === "auth-status" && $method === "GET") {
    $userId = $_SESSION["user_id"] ?? "";

    if ($userId === "") {
        response(true, "No active session", [
            "authenticated" => false,
            "account" => null
        ]);
    }

    $stmt = $conn->prepare(
        "SELECT user_id, full_name, email
         FROM users
         WHERE user_id = ? AND is_verified = 1"
    );
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        session_unset();
        session_destroy();
        response(true, "No active session", [
            "authenticated" => false,
            "account" => null
        ]);
    }

    $user = $result->fetch_assoc();
    response(true, "Session active", [
        "authenticated" => true,
        "account" => [
            "id" => $user["user_id"],
            "name" => $user["full_name"],
            "email" => $user["email"],
            "type" => "user"
        ]
    ]);
}

if ($action === "logout" && $method === "POST") {
    session_unset();
    session_destroy();

    response(true, "Logged out");
}

if ($action === "reservation-payment" && $method === "POST") {
    $userId = $_SESSION["user_id"] ?? "";
    $reservationId = trim($input["reservation_id"] ?? "");

    if ($userId === "") {
        response(false, "Please sign in to check your payment", null, 401);
    }
    if ($reservationId === "") {
        response(false, "A reservation reference is required", null, 400);
    }

    $stmt = $conn->prepare(
        "SELECT p.payment_id, p.reservation_id, p.payment_status,
                p.amount, p.transaction_reference, p.payment_date,
                p.confirmation_email_sent_at
         FROM payments p
         JOIN reservations r ON r.reservation_id = p.reservation_id
         WHERE p.reservation_id = ? AND r.user_id = ?
         LIMIT 1"
    );
    if (!$stmt || !$stmt->bind_param("ss", $reservationId, $userId) || !$stmt->execute()) {
        response(false, "Could not retrieve the reservation payment status", null, 500);
    }

    $payment = $stmt->get_result()->fetch_assoc();
    if (!$payment) {
        response(false, "Reservation payment not found", null, 404);
    }

    if (
        $payment["payment_status"] !== "Paid" &&
        $payment["transaction_reference"] !== null &&
        $payment["transaction_reference"] !== ""
    ) {
        try {
            $checkoutSession = retrievePayrexCheckoutSession(
                $payment["transaction_reference"]
            );
        } catch (RuntimeException $error) {
            error_log("PayRex payment verification failed: " . $error->getMessage());
            response(false, $error->getMessage(), null, 502);
        }

        $paymentIntent = $checkoutSession["payment_intent"] ?? null;
        $sessionReservationId = trim(
            $checkoutSession["metadata"]["reservation_id"] ?? ""
        );
        $intentReservationId = is_array($paymentIntent)
            ? trim($paymentIntent["metadata"]["reservation_id"] ?? "")
            : "";
        $paymentAmount = is_array($paymentIntent)
            ? ($paymentIntent["amount"] ?? null)
            : null;
        $secretKey = trim(getenv("PAYREX_SECRET_KEY") ?: "");
        $expectedLiveMode = str_starts_with($secretKey, "sk_live_")
            ? true
            : (str_starts_with($secretKey, "sk_test_") ? false : null);

        if (
            ($checkoutSession["id"] ?? "") !== $payment["transaction_reference"] ||
            ($checkoutSession["status"] ?? "") !== "completed" ||
            !is_array($paymentIntent) ||
            ($paymentIntent["status"] ?? "") !== "succeeded" ||
            strtoupper($paymentIntent["currency"] ?? "") !== "PHP" ||
            !is_numeric($paymentAmount) ||
            (int) $paymentAmount !== (int) round((float) $payment["amount"] * 100) ||
            ($sessionReservationId !== $reservationId && $intentReservationId !== $reservationId) ||
            ($sessionReservationId !== "" && $sessionReservationId !== $reservationId) ||
            ($intentReservationId !== "" && $intentReservationId !== $reservationId) ||
            ($expectedLiveMode !== null && !isset($checkoutSession["livemode"])) ||
            ($expectedLiveMode !== null && (bool) $checkoutSession["livemode"] !== $expectedLiveMode)
        ) {
            error_log(
                "PayRex checkout verification did not match reservation "
                . $reservationId . "."
            );
            response(true, "Payment is still awaiting PayRex verification", [
                "reservation_id" => $payment["reservation_id"],
                "payment_status" => $payment["payment_status"],
                "amount" => (float) $payment["amount"],
                "payment_date" => $payment["payment_date"],
                "confirmation_email_sent_at" => $payment["confirmation_email_sent_at"]
            ]);
        }

        $conn->begin_transaction();
        $paymentUpdate = $conn->prepare(
            "UPDATE payments
             SET payment_status = 'Paid',
                 payment_date = CURDATE()
             WHERE payment_id = ? AND payment_status <> 'Paid'"
        );
        if (!$paymentUpdate || !$paymentUpdate->bind_param("s", $payment["payment_id"]) || !$paymentUpdate->execute()) {
            $conn->rollback();
            response(false, "Could not record the verified payment", null, 500);
        }

        if ($paymentUpdate->affected_rows === 1) {
            $title = "Payment received";
            $message = "Payment for reservation " . $reservationId . " has been verified and received.";
            $notificationDate = date("M d, Y h:i A");
            $notification = $conn->prepare(
                "INSERT INTO notifications
                 (user_id, title, message, notification_date, is_read)
                 VALUES (?, ?, ?, ?, 0)"
            );
            if (
                !$notification ||
                !$notification->bind_param(
                    "ssss",
                    $userId,
                    $title,
                    $message,
                    $notificationDate
                ) ||
                !$notification->execute()
            ) {
                $conn->rollback();
                response(false, "Payment was verified, but its notification could not be recorded", null, 500);
            }
        }

        if (!$conn->commit()) {
            $conn->rollback();
            response(false, "Could not save the verified payment", null, 500);
        }
    }

    if ($payment["payment_status"] === "Paid" || !empty($checkoutSession)) {
        try {
            sendPaymentConfirmationIfNeeded($conn, $payment["payment_id"]);
        } catch (RuntimeException $error) {
            error_log("Payment confirmation email failed: " . $error->getMessage());
            response(false, "Payment is verified, but its confirmation email could not be sent. Please retry.", null, 502);
        }
    }

    $statusLookup = $conn->prepare(
        "SELECT payment_status, amount, payment_date, confirmation_email_sent_at
         FROM payments
         WHERE payment_id = ?"
    );
    if (!$statusLookup || !$statusLookup->bind_param("s", $payment["payment_id"]) || !$statusLookup->execute()) {
        response(false, "Could not retrieve the verified payment status", null, 500);
    }
    $payment = array_merge($payment, $statusLookup->get_result()->fetch_assoc());

    response(true, "Reservation payment status retrieved", [
        "reservation_id" => $payment["reservation_id"],
        "payment_status" => $payment["payment_status"],
        "amount" => (float) $payment["amount"],
        "payment_date" => $payment["payment_date"],
        "confirmation_email_sent_at" => $payment["confirmation_email_sent_at"]
    ]);
}


/* =========================
   GET USERS
========================= */

if ($action === "users" && $method === "GET") {

    $result = $conn->query(
        "SELECT user_id, name, email, role, created_at
         FROM users
         ORDER BY user_id DESC"
    );

    $users = [];

    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    response(true, "Users retrieved", $users);
}


/* =========================
   GET SINGLE USER
========================= */

if ($action === "user" && $method === "GET") {

    $id = $_GET["id"] ?? 0;

    $stmt = $conn->prepare(
        "SELECT user_id, name, email, role, created_at
         FROM users
         WHERE user_id = ?"
    );

    $stmt->bind_param("i", $id);
    $stmt->execute();

    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        response(false, "User not found", null, 404);
    }

    response(true, "User retrieved", $result->fetch_assoc());
}


/* =========================
   UPDATE USER
========================= */

if ($action === "user" && $method === "PUT") {

    $id = $input["user_id"] ?? 0;

    $stmt = $conn->prepare(
        "UPDATE users
         SET name = ?, email = ?, role = ?
         WHERE user_id = ?"
    );

    $stmt->bind_param(
        "sssi",
        $input["name"],
        $input["email"],
        $input["role"],
        $id
    );

    if ($stmt->execute()) {
        response(true, "User updated successfully");
    }

    response(false, "Failed to update user", null, 500);
}


/* =========================
   DELETE USER
========================= */

if ($action === "user" && $method === "DELETE") {

    $id = $input["user_id"] ?? 0;

    $stmt = $conn->prepare(
        "DELETE FROM users WHERE user_id = ?"
    );

    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        response(true, "User deleted successfully");
    }

    response(false, "Failed to delete user", null, 500);
}


/* =========================
   ROOMS
========================= */

if ($action === "rooms" && $method === "GET") {

    $result = $conn->query(
        "SELECT *
         FROM rooms
         ORDER BY room_id DESC"
    );

    $rooms = [];

    while ($row = $result->fetch_assoc()) {
        $rooms[] = $row;
    }

    response(true, "Rooms retrieved", $rooms);
}


/* =========================
   ADD ROOM
========================= */

if ($action === "room" && $method === "POST") {

    $stmt = $conn->prepare(
        "INSERT INTO rooms
        (room_name, room_type, description, price, capacity, status)
        VALUES (?, ?, ?, ?, ?, ?)"
    );

    $stmt->bind_param(
        "sssdis",
        $input["room_name"],
        $input["room_type"],
        $input["description"],
        $input["price"],
        $input["capacity"],
        $input["status"]
    );

    if ($stmt->execute()) {
        response(true, "Room added successfully");
    }

    response(false, "Failed to add room", null, 500);
}


/* =========================
   UPDATE ROOM
========================= */

if ($action === "room" && $method === "PUT") {

    $stmt = $conn->prepare(
        "UPDATE rooms
         SET room_name = ?,
             room_type = ?,
             description = ?,
             price = ?,
             capacity = ?,
             status = ?
         WHERE room_id = ?"
    );

    $stmt->bind_param(
        "sssdisi",
        $input["room_name"],
        $input["room_type"],
        $input["description"],
        $input["price"],
        $input["capacity"],
        $input["status"],
        $input["room_id"]
    );

    if ($stmt->execute()) {
        response(true, "Room updated successfully");
    }

    response(false, "Failed to update room", null, 500);
}


/* =========================
   DELETE ROOM
========================= */

if ($action === "room" && $method === "DELETE") {

    $stmt = $conn->prepare(
        "DELETE FROM rooms
         WHERE room_id = ?"
    );

    $stmt->bind_param(
        "i",
        $input["room_id"]
    );

    if ($stmt->execute()) {
        response(true, "Room deleted successfully");
    }

    response(false, "Failed to delete room", null, 500);
}


/* =========================
   AMENITIES
========================= */

if ($action === "amenities" && $method === "GET") {

    $result = $conn->query(
        "SELECT *
         FROM amenities
         ORDER BY amenity_id ASC"
    );

    $amenities = [];

    while ($row = $result->fetch_assoc()) {
        $amenities[] = $row;
    }

    response(true, "Amenities retrieved", $amenities);
}


/* =========================
   ADD AMENITY
========================= */

if ($action === "amenity" && $method === "POST") {

    $stmt = $conn->prepare(
        "INSERT INTO amenities
        (amenity_name, description, price)
        VALUES (?, ?, ?)"
    );

    $stmt->bind_param(
        "ssd",
        $input["amenity_name"],
        $input["description"],
        $input["price"]
    );

    if ($stmt->execute()) {
        response(true, "Amenity added successfully");
    }

    response(false, "Failed to add amenity", null, 500);
}


/* =========================
   UPDATE AMENITY
========================= */

if ($action === "amenity" && $method === "PUT") {

    $stmt = $conn->prepare(
        "UPDATE amenities
         SET amenity_name = ?,
             description = ?,
             price = ?
         WHERE amenity_id = ?"
    );

    $stmt->bind_param(
        "ssdi",
        $input["amenity_name"],
        $input["description"],
        $input["price"],
        $input["amenity_id"]
    );

    if ($stmt->execute()) {
        response(true, "Amenity updated successfully");
    }

    response(false, "Failed to update amenity", null, 500);
}


/* =========================
   DELETE AMENITY
========================= */

if ($action === "amenity" && $method === "DELETE") {

    $stmt = $conn->prepare(
        "DELETE FROM amenities
         WHERE amenity_id = ?"
    );

    $stmt->bind_param(
        "i",
        $input["amenity_id"]
    );

    if ($stmt->execute()) {
        response(true, "Amenity deleted successfully");
    }

    response(false, "Failed to delete amenity", null, 500);
}


/* =========================
   RESERVATION AVAILABILITY
========================= */

if ($action === "availability" && $method === "GET") {
    $result = $conn->query(
        "SELECT rm.room_id, rm.total_rooms,
                r.check_in,
                CASE
                    WHEN r.stay_type = 'day' THEN DATE_ADD(r.check_out, INTERVAL 1 DAY)
                    ELSE r.check_out
                END AS effective_check_out,
                r.rooms_count
         FROM rooms rm
         LEFT JOIN reservations r
           ON r.room_id = rm.room_id
          AND (
                r.status IN ('Confirmed', 'Checked-in')
                OR (r.status = 'Pending' AND r.created_at >= NOW() - INTERVAL 30 MINUTE)
                OR EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.reservation_id = r.reservation_id
                      AND p.payment_status = 'Paid'
                )
          )
         WHERE rm.room_id BETWEEN 1 AND 5
         ORDER BY rm.room_id, r.check_in"
    );

    if (!$result) {
        response(false, "Could not load room availability", null, 500);
    }

    $inventory = [];
    while ($row = $result->fetch_assoc()) {
        $roomId = (int) $row["room_id"];
        if (!isset($inventory[$roomId])) {
            $inventory[$roomId] = [
                "room_id" => $roomId,
                "total_rooms" => (int) $row["total_rooms"],
                "reservations" => []
            ];
        }
        if ($row["check_in"] !== null) {
            $inventory[$roomId]["reservations"][] = [
                "check_in" => $row["check_in"],
                "check_out" => $row["effective_check_out"],
                "rooms_count" => (int) $row["rooms_count"]
            ];
        }
    }

    response(true, "Room availability retrieved", [
        "rooms" => array_values($inventory)
    ]);
}

if ($action === "checkout-reminders" && $method === "POST") {
    $today = date("Y-m-d");
    $tomorrow = date("Y-m-d", strtotime("+1 day"));
    $stmt = $conn->prepare(
        "SELECT reservation_id, user_id, check_out
         FROM reservations
         WHERE status IN ('Confirmed', 'Checked-in')
           AND check_out IN (?, ?)"
    );
    $stmt->bind_param("ss", $today, $tomorrow);
    $stmt->execute();
    $result = $stmt->get_result();
    $remindersCreated = 0;

    while ($reservation = $result->fetch_assoc()) {
        $isToday = $reservation["check_out"] === $today;
        $title = $isToday ? "Check-out is today" : "Check-out is tomorrow";
        $message = "Your StayEase reservation " . $reservation["reservation_id"] .
            ($isToday
                ? " is scheduled to check out today."
                : " is scheduled to check out tomorrow.");
        $existing = $conn->prepare(
            "SELECT notification_id
             FROM notifications
             WHERE user_id = ?
               AND title = ?
               AND message = ?
               AND DATE(created_at) = CURDATE()
             LIMIT 1"
        );
        $existing->bind_param(
            "sss",
            $reservation["user_id"],
            $title,
            $message
        );
        $existing->execute();

        if ($existing->get_result()->num_rows > 0) {
            continue;
        }

        $notificationDate = date("M d, Y h:i A");
        $insert = $conn->prepare(
            "INSERT INTO notifications
             (user_id, title, message, notification_date, is_read)
             VALUES (?, ?, ?, ?, 0)"
        );
        $insert->bind_param(
            "ssss",
            $reservation["user_id"],
            $title,
            $message,
            $notificationDate
        );
        if (!$insert->execute()) {
            response(false, "Failed to create a checkout reminder", null, 500);
        }
        $remindersCreated++;
    }

    response(true, "Checkout reminders processed", [
        "created" => $remindersCreated
    ]);
}


/* =========================
   RESERVATIONS
========================= */

if ($action === "reservations" && $method === "GET") {

    $sql = "
        SELECT
            r.reservation_id,
            r.user_id,
            r.room_id,
            r.check_in,
            r.check_out,
            r.adults,
            r.children,
            r.rooms_count,
            r.status,
            r.total_amount,
            r.created_at,
            COALESCE(r.guest_name, u.full_name) AS guest_name,
            u.email,
            rm.room_name
        FROM reservations r
        JOIN users u
            ON r.user_id = u.user_id
        JOIN rooms rm
            ON r.room_id = rm.room_id
        ORDER BY r.created_at DESC, r.reservation_id DESC
    ";

    $result = $conn->query($sql);

    $reservations = [];

    while ($row = $result->fetch_assoc()) {
        $reservations[] = $row;
    }

    response(true, "Reservations retrieved", $reservations);
}


/* =========================
   CREATE RESERVATION
========================= */

if ($action === "reservation" && $method === "POST") {
    $userId = $_SESSION["user_id"] ?? "";
    if ($userId === "") {
        response(false, "Please sign in before making a reservation", null, 401);
    }

    $roomId = $input["room_id"] ?? "";
    $stayType = $input["stay_type"] ?? "";
    $checkIn = $input["check_in"] ?? "";
    $checkOut = $input["check_out"] ?? "";
    $adults = filter_var($input["adults"] ?? null, FILTER_VALIDATE_INT);
    $children = filter_var($input["children"] ?? null, FILTER_VALIDATE_INT);
    $roomsCount = filter_var($input["rooms_count"] ?? null, FILTER_VALIDATE_INT);
    $guestName = trim($input["guest_name"] ?? "");
    $email = strtolower(trim($input["email"] ?? ""));
    $phone = trim($input["phone"] ?? "");
    $amenities = $input["amenities"] ?? [];

    if (
        $roomId === "" ||
        !in_array($stayType, ["day", "overnight"], true) ||
        $checkIn === "" ||
        $checkOut === "" ||
        $adults === false ||
        $adults < 1 ||
        $children === false ||
        $children < 0 ||
        $roomsCount === false ||
        $roomsCount < 1 ||
        $guestName === "" ||
        !filter_var($email, FILTER_VALIDATE_EMAIL) ||
        $phone === "" ||
        !is_array($amenities)
    ) {
        response(false, "Reservation details are incomplete or invalid", null, 400);
    }

    $checkInDate = DateTime::createFromFormat("!Y-m-d", $checkIn);
    $checkOutDate = DateTime::createFromFormat("!Y-m-d", $checkOut);
    if (
        !$checkInDate ||
        !$checkOutDate ||
        $checkInDate->format("Y-m-d") !== $checkIn ||
        $checkOutDate->format("Y-m-d") !== $checkOut ||
        ($stayType === "day" && $checkOut !== $checkIn) ||
        ($stayType === "overnight" && $checkOut <= $checkIn)
    ) {
        response(false, "The reservation dates are invalid", null, 400);
    }

    $availabilityEnd = $checkOut;
    if ($stayType === "day") {
        $availabilityEnd = (clone $checkInDate)->modify("+1 day")->format("Y-m-d");
    }

    $roomStmt = $conn->prepare(
        "SELECT room_name, min_pax, max_pax, total_rooms, pricing_day, pricing_overnight
         FROM rooms
         WHERE room_id = ?"
    );
    $roomStmt->bind_param("s", $roomId);
    $roomStmt->execute();
    $room = $roomStmt->get_result()->fetch_assoc();

    if (!$room) {
        response(false, "The selected room is not available", null, 400);
    }

    if ($roomsCount > (int) $room["total_rooms"]) {
        response(false, "The requested number of rooms exceeds this room type's total inventory.", [
            "available_rooms" => (int) $room["total_rooms"]
        ], 409);
    }

    if (($adults + $children) > ((int) $room["max_pax"] * $roomsCount)) {
        response(false, "The selected room cannot accommodate this number of guests", null, 400);
    }

    if (ceil(($adults + $children) / $roomsCount) < (int) $room["min_pax"]) {
        response(false, "The selected room requires more guests per room", null, 400);
    }

    $roomRate = (float) $room[
        $stayType === "day" ? "pricing_day" : "pricing_overnight"
    ];
    $roomSubtotal = $roomRate * $roomsCount;
    $amenitySubtotal = 0;
    $amenityIds = [];
    $includedAmenityKeysByRoom = [
        "R001" => ["fitness-center"],
        "R002" => ["fitness-center", "swimming-pool"],
        "R003" => ["fitness-center", "swimming-pool", "complimentary-breakfast"],
        "R004" => ["fitness-center", "swimming-pool", "complimentary-breakfast", "meeting-facilities", "balcony"],
        "R005" => ["fitness-center", "swimming-pool", "complimentary-breakfast", "meeting-facilities", "balcony", "luxury-spa", "fine-dining"]
    ];

    foreach (array_unique($amenities) as $amenityName) {
        if (!is_string($amenityName)) {
            response(false, "The selected amenities are invalid", null, 400);
        }

        $packageKey = reservationAmenityPackageKey($amenityName);
        if (
            $roomId === "R005" ||
            in_array($packageKey, $includedAmenityKeysByRoom[$roomId] ?? [], true)
        ) {
            response(false, "This amenity is already included in your selected room.", null, 400);
        }

        $amenityStmt = $conn->prepare(
            "SELECT amenity_id, price
             FROM amenities
             WHERE amenity_name = ?"
        );
        $amenityStmt->bind_param("s", $amenityName);
        $amenityStmt->execute();
        $amenity = $amenityStmt->get_result()->fetch_assoc();

        if (!$amenity) {
            response(false, "A selected amenity is not available", null, 400);
        }

        $amenityIds[] = (int) $amenity["amenity_id"];
        $amenitySubtotal += (float) $amenity["price"];
    }

    $totalAmount = $roomSubtotal + $amenitySubtotal;
    $reservationId = "SE" . strtoupper(bin2hex(random_bytes(6)));
    $reservationStatus = "Pending";

    if (!function_exists("curl_init")) {
        response(false, "The server is missing the PHP cURL extension required for PayRex Checkout", null, 500);
    }

    $payrexSecretKey = trim(getenv("PAYREX_SECRET_KEY") ?: "");
    if ($payrexSecretKey === "") {
        response(false, "PayRex Checkout is not configured. Add PAYREX_SECRET_KEY to the Apache environment.", null, 503);
    }

    $payrexApiBaseUrl = rtrim(getenv("PAYREX_API_BASE_URL") ?: "https://api.payrexhq.com", "/");
    $frontendOrigin = rtrim(trim(getenv("STAYEASE_FRONTEND_URL") ?: ""), "/");
    if ($frontendOrigin === "") {
        $requestOrigin = rtrim($_SERVER["HTTP_ORIGIN"] ?? "", "/");
        $frontendOrigin = in_array($requestOrigin, $allowedOrigins, true)
            ? $requestOrigin
            : "http://localhost:5173";
    } elseif (!filter_var($frontendOrigin, FILTER_VALIDATE_URL)) {
        response(false, "The configured StayEase frontend URL is invalid", null, 500);
    }
    if (!in_array($frontendOrigin, $allowedOrigins, true)) {
        $allowedOrigins[] = $frontendOrigin;
    }

    $returnUrl = $frontendOrigin . "/?reservation_id=" . rawurlencode($reservationId) . "&payrex_payment=";
    $payrexPayload = [
        "currency" => "PHP",
        "success_url" => $returnUrl . "success",
        "cancel_url" => $returnUrl . "cancel",
        "customer_reference_id" => $reservationId,
        "description" => "StayEase reservation " . $reservationId,
        "metadata" => [
            "reservation_id" => $reservationId
        ],
        "payment_intent_data" => [
            "metadata" => [
                "reservation_id" => $reservationId
            ]
        ],
        "line_items" => [[
            "name" => "StayEase reservation",
            "amount" => (int) round($totalAmount * 100),
            "quantity" => 1
        ]]
    ];

    $payrexRequest = curl_init($payrexApiBaseUrl . "/checkout_sessions");
    curl_setopt_array($payrexRequest, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            "Authorization: Basic " . base64_encode($payrexSecretKey . ":"),
            "Content-Type: application/x-www-form-urlencoded"
        ],
        CURLOPT_POSTFIELDS => http_build_query($payrexPayload, "", "&", PHP_QUERY_RFC3986)
    ]);
    $payrexResponseBody = curl_exec($payrexRequest);
    $payrexHttpStatus = curl_getinfo($payrexRequest, CURLINFO_HTTP_CODE);
    curl_close($payrexRequest);

    $payrexResponse = is_string($payrexResponseBody)
        ? json_decode($payrexResponseBody, true)
        : null;
    if (
        $payrexHttpStatus < 200 ||
        $payrexHttpStatus >= 300 ||
        !is_array($payrexResponse) ||
        empty($payrexResponse["url"]) ||
        empty($payrexResponse["id"])
    ) {
        response(false, "PayRex Checkout could not be started. Check your test secret key and merchant payment settings.", [
            "provider_status" => $payrexHttpStatus
        ], 502);
    }

    $conn->begin_transaction();
    $inventoryLock = $conn->prepare(
        "SELECT total_rooms
         FROM rooms
         WHERE room_id = ?
         FOR UPDATE"
    );
    $inventoryLock->bind_param("s", $roomId);
    if (!$inventoryLock->execute()) {
        $conn->rollback();
        response(false, "Could not verify room availability", null, 500);
    }
    $lockedRoom = $inventoryLock->get_result()->fetch_assoc();
    if (!$lockedRoom) {
        $conn->rollback();
        response(false, "The selected room is not available", null, 409);
    }

    $bookedRoomsStmt = $conn->prepare(
        "SELECT r.check_in,
                CASE
                    WHEN r.stay_type = 'day' THEN DATE_ADD(r.check_out, INTERVAL 1 DAY)
                    ELSE r.check_out
                END AS effective_check_out,
                r.rooms_count
         FROM reservations r
         WHERE r.room_id = ?
           AND r.check_in < ?
           AND (
                CASE
                    WHEN r.stay_type = 'day' THEN DATE_ADD(r.check_out, INTERVAL 1 DAY)
                    ELSE r.check_out
                END
           ) > ?
           AND (
                r.status IN ('Confirmed', 'Checked-in')
                OR (r.status = 'Pending' AND r.created_at >= NOW() - INTERVAL 30 MINUTE)
                OR EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.reservation_id = r.reservation_id
                      AND p.payment_status = 'Paid'
                )
           )"
    );
    $bookedRoomsStmt->bind_param("sss", $roomId, $availabilityEnd, $checkIn);
    if (!$bookedRoomsStmt->execute()) {
        $conn->rollback();
        response(false, "Could not verify room availability", null, 500);
    }
    $bookedRoomsResult = $bookedRoomsStmt->get_result();
    $bookedReservations = [];
    while ($bookedReservation = $bookedRoomsResult->fetch_assoc()) {
        $bookedReservations[] = $bookedReservation;
    }
    $availableRooms = (int) $lockedRoom["total_rooms"] -
        maximumBookedRoomsForRange($checkIn, $availabilityEnd, $bookedReservations);
    if ($roomsCount > $availableRooms) {
        $conn->rollback();
        response(false, "Not enough rooms are available for the selected dates.", [
            "available_rooms" => max(0, $availableRooms)
        ], 409);
    }

    $stmt = $conn->prepare(
        "INSERT INTO reservations
        (
            reservation_id,
            user_id,
            room_id,
            stay_type,
            check_in,
            check_out,
            adults,
            children,
            rooms_count,
            guest_name,
            email,
            phone,
            room_subtotal,
            amenity_subtotal,
            total_amount,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $stmt->bind_param(
        "ssssssiiisssddds",
        $reservationId,
        $userId,
        $roomId,
        $stayType,
        $checkIn,
        $checkOut,
        $adults,
        $children,
        $roomsCount,
        $guestName,
        $email,
        $phone,
        $roomSubtotal,
        $amenitySubtotal,
        $totalAmount,
        $reservationStatus
    );

    if (!$stmt->execute()) {
        $conn->rollback();
        response(false, "Failed to save the reservation", null, 500);
    }

    if ($amenityIds) {
        $amenityLinkStmt = $conn->prepare(
            "INSERT INTO reservation_amenities
            (reservation_id, amenity_id)
            VALUES (?, ?)"
        );

        foreach ($amenityIds as $amenityId) {
            $amenityLinkStmt->bind_param("si", $reservationId, $amenityId);
            if (!$amenityLinkStmt->execute()) {
                $conn->rollback();
                response(false, "Failed to save the selected amenities", null, 500);
            }
        }
    }

    $notificationTitle = "Reservation request received";
    $notificationMessage = "Your reservation " . $reservationId . " is awaiting admin approval.";
    $notificationDate = date("M d, Y h:i A");
    $notificationStmt = $conn->prepare(
        "INSERT INTO notifications
         (user_id, title, message, notification_date, is_read)
         VALUES (?, ?, ?, ?, 0)"
    );
    $notificationStmt->bind_param(
        "ssss",
        $userId,
        $notificationTitle,
        $notificationMessage,
        $notificationDate
    );
    if (!$notificationStmt->execute()) {
        $conn->rollback();
        response(false, "Failed to save the reservation notification", null, 500);
    }

    $paymentId = "PAY" . strtoupper(bin2hex(random_bytes(6)));
    $paymentMethod = "PayRex Checkout";
    $paymentStatus = "For review";
    $paymentStmt = $conn->prepare(
        "INSERT INTO payments
         (payment_id, reservation_id, customer_name, amount, payment_method, payment_status, transaction_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $paymentStmt->bind_param(
        "sssdsss",
        $paymentId,
        $reservationId,
        $guestName,
        $totalAmount,
        $paymentMethod,
        $paymentStatus,
        $payrexResponse["id"]
    );
    if (!$paymentStmt->execute()) {
        $conn->rollback();
        response(false, "Failed to create the reservation payment record", null, 500);
    }

    $conn->commit();
    response(true, "Reservation created successfully", [
        "reservation_id" => $reservationId,
        "status" => $reservationStatus,
        "room_subtotal" => $roomSubtotal,
        "amenity_subtotal" => $amenitySubtotal,
        "total_amount" => $totalAmount,
        "checkout_session_id" => $payrexResponse["id"],
        "checkout_url" => $payrexResponse["url"]
    ]);
}


/* =========================
   UPDATE RESERVATION
========================= */

if ($action === "reservation" && $method === "PUT") {

    $reservationId = trim($input["reservation_id"] ?? "");
    $nextStatus = trim($input["status"] ?? "");
    $allowedStatuses = ["Pending", "Confirmed", "Cancelled", "Checked-in", "Checked-out"];

    if ($reservationId === "" || !in_array($nextStatus, $allowedStatuses, true)) {
        response(false, "A valid reservation and status are required", null, 400);
    }

    $lookup = $conn->prepare(
        "SELECT r.user_id, r.status, r.room_id, r.check_in, r.check_out,
                r.stay_type, r.rooms_count, rm.total_rooms
         FROM reservations r
         JOIN rooms rm ON rm.room_id = r.room_id
         WHERE r.reservation_id = ?"
    );
    $lookup->bind_param("s", $reservationId);
    $lookup->execute();
    $reservation = $lookup->get_result()->fetch_assoc();

    if (!$reservation) {
        response(false, "Reservation not found", null, 404);
    }

    $conn->begin_transaction();
    if ($nextStatus === "Confirmed" && $reservation["status"] !== "Confirmed") {
        $roomLock = $conn->prepare(
            "SELECT total_rooms
             FROM rooms
             WHERE room_id = ?
             FOR UPDATE"
        );
        $roomLock->bind_param("s", $reservation["room_id"]);
        if (!$roomLock->execute()) {
            $conn->rollback();
            response(false, "Could not verify room availability", null, 500);
        }
        $roomInventory = $roomLock->get_result()->fetch_assoc();
        $availabilityEnd = $reservation["check_out"];
        if ($reservation["stay_type"] === "day") {
            $availabilityEnd = (new DateTimeImmutable($reservation["check_in"]))
                ->modify("+1 day")
                ->format("Y-m-d");
        }

        $bookedRooms = $conn->prepare(
            "SELECT r.check_in,
                    CASE
                        WHEN r.stay_type = 'day' THEN DATE_ADD(r.check_out, INTERVAL 1 DAY)
                        ELSE r.check_out
                    END AS effective_check_out,
                    r.rooms_count
             FROM reservations r
             WHERE r.reservation_id <> ?
               AND r.room_id = ?
               AND r.check_in < ?
               AND (
                    CASE
                        WHEN r.stay_type = 'day' THEN DATE_ADD(r.check_out, INTERVAL 1 DAY)
                        ELSE r.check_out
                    END
               ) > ?
               AND (
                    r.status IN ('Confirmed', 'Checked-in')
                    OR (r.status = 'Pending' AND r.created_at >= NOW() - INTERVAL 30 MINUTE)
                    OR EXISTS (
                        SELECT 1
                        FROM payments p
                        WHERE p.reservation_id = r.reservation_id
                          AND p.payment_status = 'Paid'
                    )
               )"
        );
        $bookedRooms->bind_param(
            "ssss",
            $reservationId,
            $reservation["room_id"],
            $availabilityEnd,
            $reservation["check_in"]
        );
        if (!$bookedRooms->execute() || !$roomInventory) {
            $conn->rollback();
            response(false, "Could not verify room availability", null, 500);
        }
        $result = $bookedRooms->get_result();
        $otherReservations = [];
        while ($bookedReservation = $result->fetch_assoc()) {
            $otherReservations[] = $bookedReservation;
        }
        $availableRooms = (int) $roomInventory["total_rooms"] -
            maximumBookedRoomsForRange(
                $reservation["check_in"],
                $availabilityEnd,
                $otherReservations
            );
        if ((int) $reservation["rooms_count"] > $availableRooms) {
            $conn->rollback();
            response(false, "This reservation exceeds the remaining room inventory and cannot be confirmed.", [
                "available_rooms" => max(0, $availableRooms)
            ], 409);
        }
    }

    $stmt = $conn->prepare(
        "UPDATE reservations
         SET status = ?
         WHERE reservation_id = ?"
    );
    $stmt->bind_param("ss", $nextStatus, $reservationId);

    if (!$stmt->execute()) {
        $conn->rollback();
        response(false, "Failed to update reservation", null, 500);
    }

    if ($reservation["status"] !== $nextStatus) {
        $title = "Reservation status updated";
        $message = "Your reservation " . $reservationId . " is now " . strtolower($nextStatus) . ".";
        $notificationDate = date("M d, Y h:i A");
        $notification = $conn->prepare(
            "INSERT INTO notifications
             (user_id, title, message, notification_date, is_read)
             VALUES (?, ?, ?, ?, 0)"
        );
        $notification->bind_param(
            "ssss",
            $reservation["user_id"],
            $title,
            $message,
            $notificationDate
        );

        if (!$notification->execute()) {
            $conn->rollback();
            response(false, "Failed to save the guest notification for this status change", null, 500);
        }
    }

    $conn->commit();
    response(true, "Reservation status updated successfully", [
        "reservation_id" => $reservationId,
        "status" => $nextStatus
    ]);
}


/* =========================
   CANCEL / DELETE RESERVATION
========================= */

if ($action === "reservation" && $method === "DELETE") {

    $stmt = $conn->prepare(
        "DELETE FROM reservations
         WHERE reservation_id = ?"
    );

    $stmt->bind_param(
        "i",
        $input["reservation_id"]
    );

    if ($stmt->execute()) {
        response(true, "Reservation cancelled successfully");
    }

    response(false, "Failed to cancel reservation", null, 500);
}


/* =========================
   PAYMENTS
========================= */

if ($action === "payments" && $method === "GET") {

    $sql = "
        SELECT
            p.payment_id,
            p.reservation_id,
            p.amount,
            p.payment_method,
            p.payment_status,
            p.confirmation_email_sent_at,
            COALESCE(NULLIF(p.payment_date, '0000-00-00'), DATE(p.created_at)) AS payment_date,
            COALESCE(p.customer_name, r.guest_name, u.full_name) AS customer_name
        FROM payments p
        JOIN reservations r
            ON p.reservation_id = r.reservation_id
        JOIN users u
            ON r.user_id = u.user_id
        ORDER BY p.payment_id DESC
    ";

    $result = $conn->query($sql);

    $payments = [];

    while ($row = $result->fetch_assoc()) {
        $payments[] = $row;
    }

    response(true, "Payments retrieved", $payments);
}


/* =========================
   CREATE PAYMENT
========================= */

if ($action === "payment" && $method === "POST") {
    $paymentId = "PAY" . strtoupper(bin2hex(random_bytes(6)));
    $reservationId = trim($input["reservation_id"] ?? "");
    $paymentMethod = trim($input["payment_method"] ?? "");
    $status = trim($input["payment_status"] ?? "For review");
    $amount = filter_var($input["amount"] ?? null, FILTER_VALIDATE_FLOAT);
    $customerName = trim($input["customer_name"] ?? "");

    if (
        $reservationId === "" ||
        $paymentMethod === "" ||
        $amount === false ||
        $amount < 0 ||
        !in_array($status, ["For review", "Paid", "Refunded", "Failed"], true)
    ) {
        response(false, "Payment details are invalid", null, 400);
    }

    $stmt = $conn->prepare(
        "INSERT INTO payments
        (
            payment_id,
            reservation_id,
            customer_name,
            amount,
            payment_method,
            payment_status
        )
        VALUES (?, ?, ?, ?, ?, ?)"
    );

    $stmt->bind_param(
        "sssdss",
        $paymentId,
        $reservationId,
        $customerName,
        $amount,
        $paymentMethod,
        $status
    );

    if ($stmt->execute()) {
        response(true, "Payment recorded successfully", [
            "payment_id" => $paymentId
        ]);
    }

    response(false, "Failed to record payment", null, 500);
}

if ($action === "payment" && $method === "PUT") {
    $paymentId = trim($input["payment_id"] ?? "");
    $status = trim($input["payment_status"] ?? "");
    $allowedStatuses = ["For review", "Paid", "Refunded", "Failed"];

    if ($paymentId === "" || !in_array($status, $allowedStatuses, true)) {
        response(false, "A valid payment and status are required", null, 400);
    }

    $lookup = $conn->prepare(
        "SELECT p.payment_status, p.reservation_id, r.user_id
         FROM payments p
         JOIN reservations r ON r.reservation_id = p.reservation_id
         WHERE p.payment_id = ?"
    );
    $lookup->bind_param("s", $paymentId);
    $lookup->execute();
    $payment = $lookup->get_result()->fetch_assoc();

    if (!$payment) {
        response(false, "Payment not found", null, 404);
    }

    $update = $conn->prepare(
        "UPDATE payments
         SET payment_status = ?,
             payment_date = CASE WHEN ? = 'Paid' THEN CURDATE() ELSE payment_date END
         WHERE payment_id = ?"
    );
    $update->bind_param("sss", $status, $status, $paymentId);
    $conn->begin_transaction();
    if (!$update->execute()) {
        $conn->rollback();
        response(false, "Failed to update payment status", null, 500);
    }

    if ($payment["payment_status"] !== $status) {
        $title = $status === "Paid" ? "Payment received" : "Payment status updated";
        $message = $status === "Paid"
            ? "Payment for reservation " . $payment["reservation_id"] . " has been verified and received."
            : "Payment for reservation " . $payment["reservation_id"] . " is now " . strtolower($status) . ".";
        $notificationDate = date("M d, Y h:i A");
        $notification = $conn->prepare(
            "INSERT INTO notifications
             (user_id, title, message, notification_date, is_read)
             VALUES (?, ?, ?, ?, 0)"
        );
        $notification->bind_param(
            "ssss",
            $payment["user_id"],
            $title,
            $message,
            $notificationDate
        );
        if (!$notification->execute()) {
            $conn->rollback();
            response(false, "Failed to notify the guest about their payment status", null, 500);
        }
    }

    $conn->commit();

    if ($status === "Paid") {
        try {
            sendPaymentConfirmationIfNeeded($conn, $paymentId);
        } catch (RuntimeException $error) {
            error_log("Admin payment confirmation email failed: " . $error->getMessage());
            response(false, "Payment was marked paid, but its confirmation email could not be sent. Use Send confirmation to retry.", [
                "payment_id" => $paymentId,
                "payment_status" => $status
            ], 502);
        }
    }

    response(true, "Payment status updated", [
        "payment_id" => $paymentId,
        "payment_status" => $status
    ]);
}

/* =========================
   NOTIFICATIONS
========================= */

if ($action === "notifications" && $method === "GET") {

    $userId = $_SESSION["user_id"] ?? "";

    if ($userId === "") {
        response(false, "Please sign in to view notifications", null, 401);
    }

    $stmt = $conn->prepare(
        "SELECT *
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, notification_id DESC"
    );

    $stmt->bind_param("s", $userId);
    $stmt->execute();

    $result = $stmt->get_result();

    $notifications = [];

    while ($row = $result->fetch_assoc()) {
        $notifications[] = $row;
    }

    response(true, "Notifications retrieved", $notifications);
}

if ($action === "notifications" && $method === "PUT") {
    $userId = $_SESSION["user_id"] ?? "";

    if ($userId === "") {
        response(false, "Please sign in to update notifications", null, 401);
    }

    $stmt = $conn->prepare(
        "UPDATE notifications
         SET is_read = 1
         WHERE user_id = ?"
    );
    $stmt->bind_param("s", $userId);

    if ($stmt->execute()) {
        response(true, "Notifications marked as read");
    }

    response(false, "Failed to update notifications", null, 500);
}


/* =========================
   CREATE NOTIFICATION
========================= */

if ($action === "notification" && $method === "POST") {

    $stmt = $conn->prepare(
        "INSERT INTO notifications
        (user_id, title, message)
        VALUES (?, ?, ?)"
    );

    $stmt->bind_param(
        "iss",
        $input["user_id"],
        $input["title"],
        $input["message"]
    );

    if ($stmt->execute()) {
        response(true, "Notification created successfully");
    }

    response(false, "Failed to create notification", null, 500);
}



if ($action === "reports" && $method === "GET") {

    $totalUsers = $conn->query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'customer'"
    )->fetch_assoc()["total"];

    $totalRooms = $conn->query(
        "SELECT COUNT(*) AS total FROM rooms"
    )->fetch_assoc()["total"];

    $totalReservations = $conn->query(
        "SELECT COUNT(*) AS total FROM reservations"
    )->fetch_assoc()["total"];

    $totalRevenue = $conn->query(
        "SELECT COALESCE(SUM(amount), 0) AS total
         FROM payments
         WHERE payment_status = 'paid'"
    )->fetch_assoc()["total"];

    response(true, "Reports retrieved", [
        "total_customers" => $totalUsers,
        "total_rooms" => $totalRooms,
        "total_reservations" => $totalReservations,
        "total_revenue" => $totalRevenue
    ]);
}



response(
    false,
    "Invalid API action",
    null,
    404
);

?>