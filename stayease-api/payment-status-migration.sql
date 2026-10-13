ALTER TABLE payments
    ADD COLUMN payment_method VARCHAR(40) NOT NULL DEFAULT 'GCash',
    ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'For review';

INSERT INTO payments (
    payment_id,
    reservation_id,
    customer_name,
    amount,
    payment_method,
    payment_status
)
SELECT
    CONCAT('PAY', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12))),
    r.reservation_id,
    COALESCE(r.guest_name, u.full_name),
    r.total_amount,
    'GCash',
    'For review'
FROM reservations r
JOIN users u ON u.user_id = r.user_id
WHERE NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.reservation_id = r.reservation_id
);
