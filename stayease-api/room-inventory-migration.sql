SET @room_inventory_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rooms'
      AND COLUMN_NAME = 'total_rooms'
);

SET @room_inventory_ddl = IF(
    @room_inventory_column_exists = 0,
    'ALTER TABLE rooms ADD COLUMN total_rooms INT NOT NULL DEFAULT 1 AFTER max_pax',
    'SELECT 1'
);

PREPARE room_inventory_statement FROM @room_inventory_ddl;
EXECUTE room_inventory_statement;
DEALLOCATE PREPARE room_inventory_statement;

UPDATE rooms
SET total_rooms = CASE room_id
    WHEN 1 THEN 5
    WHEN 2 THEN 4
    WHEN 3 THEN 3
    WHEN 4 THEN 3
    WHEN 5 THEN 2
    ELSE total_rooms
END
WHERE room_id BETWEEN 1 AND 5;

UPDATE rooms
SET room_name = CASE room_id
    WHEN 1 THEN 'Standard Room'
    WHEN 2 THEN 'Deluxe Twin Room'
    ELSE room_name
END
WHERE room_id IN (1, 2);
