CREATE DATABASE IF NOT EXISTS stayease
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE stayease;

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(32) NOT NULL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    name VARCHAR(150) NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    is_verified TINYINT(1) NOT NULL DEFAULT 0,
    verification_code VARCHAR(6) NULL,
    code_expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(32) NOT NULL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
    room_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    capacity INT NOT NULL DEFAULT 2,
    min_pax INT NOT NULL DEFAULT 1,
    max_pax INT NOT NULL DEFAULT 2,
    total_rooms INT NOT NULL DEFAULT 1,
    pricing_day DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pricing_overnight DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    image VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS amenities (
    amenity_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    amenity_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS room_amenities (
    room_id INT NOT NULL,
    amenity_id INT NOT NULL,
    included_in_package TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (room_id, amenity_id),
    CONSTRAINT fk_room_amenities_room
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_room_amenities_amenity
        FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id VARCHAR(32) NOT NULL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    room_id INT NOT NULL,
    stay_type VARCHAR(20) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    adults INT NOT NULL,
    children INT NOT NULL DEFAULT 0,
    rooms_count INT NOT NULL DEFAULT 1,
    guest_name VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(40) NULL,
    room_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amenity_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservations_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reservations_room
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservation_amenities (
    reservation_amenity_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reservation_id VARCHAR(32) NOT NULL,
    amenity_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    UNIQUE KEY uq_reservation_amenity (reservation_id, amenity_id),
    CONSTRAINT fk_reservation_amenities_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reservation_amenities_amenity
        FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(20) NOT NULL PRIMARY KEY,
    reservation_id VARCHAR(32) NOT NULL,
    customer_name VARCHAR(150) NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(40) NOT NULL DEFAULT 'PayRex Checkout',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'For review',
    transaction_reference VARCHAR(120) NULL,
    payment_date DATE NULL,
    confirmation_email_sent_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    reservation_id VARCHAR(32) NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_date VARCHAR(40) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notifications_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO rooms
    (room_id, room_name, room_type, description, price, capacity, min_pax, max_pax,
     total_rooms, pricing_day, pricing_overnight, status)
VALUES
    (1, 'Standard Room', 'Standard', 'Cozy and practical space for solo travelers or couples.', 2999, 2, 1, 2, 5, 1999, 2999, 'available'),
    (2, 'Deluxe Twin Room', 'Twin', 'Twin beds with comfortable shared space.', 3499, 2, 1, 2, 4, 2499, 3499, 'available'),
    (3, 'Deluxe Queen', 'Queen', 'A queen room with premium amenities.', 3999, 3, 1, 3, 3, 2999, 3999, 'available'),
    (4, 'Superior Triple', 'Triple', 'Spacious room for families and small groups.', 4499, 6, 3, 6, 3, 3499, 4499, 'available'),
    (5, 'Superior Quadruple Room', 'Quadruple', 'A large room for families and groups.', 5499, 8, 4, 8, 2, 3999, 5499, 'available');

INSERT IGNORE INTO amenities (amenity_name, category, description, price)
VALUES
    ('Gym', 'Property', 'Access to the hotel fitness facilities.', 300.00),
    ('Spa', 'Property', 'Spa access during your stay.', 500.00),
    ('Restaurant', 'Property', 'Restaurant service during your stay.', 500.00),
    ('Meeting Facilities', 'Property', 'Private meeting and event facilities.', 500.00);

INSERT IGNORE INTO room_amenities (room_id, amenity_id)
SELECT r.room_id, a.amenity_id
FROM rooms r
JOIN amenities a ON a.amenity_name = 'Gym'
WHERE r.room_id BETWEEN 1 AND 5;

INSERT IGNORE INTO room_amenities (room_id, amenity_id)
SELECT r.room_id, a.amenity_id
FROM rooms r
JOIN amenities a ON a.amenity_name IN ('Spa', 'Restaurant')
WHERE r.room_id = 5;