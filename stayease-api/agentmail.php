<?php

function sendAgentMailMessage($recipientEmail, $subject, $text, $html = null, $attachments = [])
{
    $apiKey = getenv("AGENTMAIL_API_KEY");
    $inboxId = getenv("AGENTMAIL_INBOX_ID");

    if (!$apiKey || !$inboxId) {
        throw new RuntimeException("AgentMail API key or inbox ID is not configured.");
    }

    if (!function_exists("curl_init")) {
        throw new RuntimeException("The PHP cURL extension is not enabled.");
    }

    $payloadData = [
        "to" => $recipientEmail,
        "subject" => $subject,
        "text" => $text
    ];
    if ($html !== null) {
        $payloadData["html"] = $html;
    }
    if ($attachments !== []) {
        $payloadData["attachments"] = $attachments;
    }
    $payload = json_encode($payloadData);

    if ($payload === false) {
        throw new RuntimeException("The email message could not be encoded.");
    }

    $url = "https://api.agentmail.to/v0/inboxes/"
        . rawurlencode($inboxId)
        . "/messages/send";
    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException("Could not initialize the AgentMail request.");
    }

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . $apiKey,
            "Content-Type: application/json"
        ]
    ]);

    $response = curl_exec($curl);
    $curlError = curl_error($curl);
    $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($response === false) {
        throw new RuntimeException("AgentMail request failed: " . $curlError);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        throw new RuntimeException("AgentMail returned HTTP " . $statusCode . ".");
    }
}

function sendAgentMailVerificationCode($recipientEmail, $verificationCode)
{
    sendAgentMailMessage(
        $recipientEmail,
        "Your StayEase verification code",
        "Your StayEase verification code is " . $verificationCode . ". It expires in 10 minutes."
    );
}

function sendAgentMailPasswordResetCode($recipientEmail, $resetCode)
{
    sendAgentMailMessage(
        $recipientEmail,
        "Your StayEase password reset code",
        "Your StayEase password reset code is " . $resetCode . ". It expires in 10 minutes."
    );
}

function sendAgentMailPaymentConfirmation($recipientEmail, $guestName, $reservationId, $amount, $checkIn, $checkOut)
{
    $name = trim($guestName) !== "" ? trim($guestName) : "Guest";
    $formattedAmount = number_format($amount, 2);
    $text = "Hello " . $name . ",\n\n"
        . "Your payment for your StayEase reservation has been confirmed.\n\n"
        . "Reservation reference: " . $reservationId . "\n"
        . "Amount paid: PHP " . $formattedAmount . "\n"
        . "Check-in: " . $checkIn . "\n"
        . "Check-out: " . $checkOut . "\n\n"
        . "Your reservation may still be pending admin approval."
        . " Please keep this email for your records.";

    $imagePath = __DIR__ . DIRECTORY_SEPARATOR . "assets"
        . DIRECTORY_SEPARATOR . "payment-confirmation.png";
    $imageContent = file_get_contents($imagePath);
    if ($imageContent === false) {
        throw new RuntimeException("The payment confirmation image could not be read.");
    }

    $escapedName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");
    $escapedReservationId = htmlspecialchars($reservationId, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");
    $escapedCheckIn = htmlspecialchars($checkIn, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");
    $escapedCheckOut = htmlspecialchars($checkOut, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");
    $html = '<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f5f2ec;'
        . 'font-family:Arial,sans-serif;color:#33251d;">'
        . '<table role="presentation" style="width:100%;max-width:600px;margin:0 auto;'
        . 'border-collapse:collapse;background:#fffdf8;">'
        . '<tr><td style="padding:28px 24px 16px;">'
        . '<h1 style="margin:0 0 12px;font-size:24px;color:#5d3022;">Payment confirmed</h1>'
        . '<p style="margin:0 0 8px;">Hello ' . $escapedName . ',</p>'
        . '<p style="margin:0;">Your payment for your StayEase reservation has been confirmed.</p>'
        . '</td></tr>'
        . '<tr><td style="padding:0 24px 20px;">'
        . '<table role="presentation" style="width:100%;border-collapse:collapse;">'
        . '<tr><td style="padding:8px 0;"><strong>Reservation reference</strong></td>'
        . '<td style="padding:8px 0;text-align:right;">' . $escapedReservationId . '</td></tr>'
        . '<tr><td style="padding:8px 0;"><strong>Amount paid</strong></td>'
        . '<td style="padding:8px 0;text-align:right;">PHP ' . $formattedAmount . '</td></tr>'
        . '<tr><td style="padding:8px 0;"><strong>Check-in</strong></td>'
        . '<td style="padding:8px 0;text-align:right;">' . $escapedCheckIn . '</td></tr>'
        . '<tr><td style="padding:8px 0;"><strong>Check-out</strong></td>'
        . '<td style="padding:8px 0;text-align:right;">' . $escapedCheckOut . '</td></tr>'
        . '</table></td></tr>'
        . '<tr><td style="padding:0 24px 24px;">'
        . '<img src="cid:stayease-payment-confirmation" alt="StayEase guest information" '
        . 'style="display:block;width:100%;max-width:552px;height:auto;border:0;">'
        . '</td></tr>'
        . '<tr><td style="padding:0 24px 28px;font-size:14px;line-height:1.5;">'
        . '<p style="margin:0;">Your reservation may still be pending admin approval. '
        . 'Please keep this email for your records.</p>'
        . '</td></tr></table></body></html>';
    $attachments = [[
        "filename" => "stayease-payment-confirmation.png",
        "content_type" => "image/png",
        "content_disposition" => "inline",
        "content_id" => "stayease-payment-confirmation",
        "content" => base64_encode($imageContent)
    ]];

    sendAgentMailMessage(
        $recipientEmail,
        "Payment confirmed for StayEase reservation " . $reservationId,
        $text,
        $html,
        $attachments
    );
}
