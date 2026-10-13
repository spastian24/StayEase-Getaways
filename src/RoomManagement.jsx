import React, { useEffect, useState } from 'react';
import './RoomManagement.css';
import notificationIcon from './assets/notification.png';
import standardIcon from './assets/standard.png';
import twinIcon from './assets/twin.png';
import deluxeQueenImage from './assets/Deluxe.png';
import tripleIcon from './assets/triple.png';
import quadrupleIcon from './assets/quadruple.png';
import CalendarControl from './CalendarControl.jsx';

const roomIcons = {
  Standard: standardIcon,
  Twin: twinIcon,
  Queen: deluxeQueenImage,
  Triple: tripleIcon,
  Quadruple: quadrupleIcon
};

const guestCapacityLabels = {
  Standard: '1–2 GUESTS',
  Twin: '1–2 GUESTS',
  Queen: '1–3 GUESTS',
  Triple: '3–6 GUESTS',
  Quadruple: '4–8 GUESTS'
};

const initialRooms = [
  {
    id: 1,
    name: 'Standard Room',
    type: 'Standard',
    maxPax: 2,
    quantity: 5,
    available: true,
    dayStay: '₱1,999',
    overnight: '₱2,499',
    description: 'A welcoming choice for solo travelers or couples looking for a comfortable space to rest and recharge.',
    highlights: ['Cozy and practical space', 'Air conditioning', 'Free Wi-Fi', 'Private bathroom', 'Blackout curtains'],
    icon: standardIcon
  },
  {
    id: 2,
    name: 'Deluxe Twin Room',
    type: 'Twin',
    maxPax: 2,
    quantity: 4,
    available: true,
    dayStay: '₱2,499',
    overnight: '₱3,099',
    description: 'With twin beds and added conveniences, the Deluxe Twin Room is ideal for friends, family, or travel companions who want to stay comfortably together.',
    highlights: ['Twin beds', 'Mini refrigerator', 'Work desk', 'Large closet', 'Comfortable shared space'],
    icon: twinIcon
  },
  {
    id: 3,
    name: 'Deluxe Queen Room',
    type: 'Queen',
    maxPax: 3,
    quantity: 3,
    available: true,
    dayStay: '₱2,999',
    overnight: '₱3,499',
    description: 'Enjoy the comfort of a queen bed with upgraded in-room amenities, making this a great choice for couples or guests looking for a more refined stay.',
    highlights: ['Queen bed', 'Premium toiletries', 'Hairdryer', 'TV with cable', 'Mini refrigerator', 'Work desk'],
    icon: deluxeQueenImage
  },
  {
    id: 4,
    name: 'Superior Triple Room',
    type: 'Triple',
    maxPax: 6,
    quantity: 3,
    available: true,
    dayStay: '₱3,499',
    overnight: '₱4,499',
    description: 'Designed for families and small groups, this spacious room gives you more room to relax, with a private balcony for an added touch of comfort.',
    highlights: ['Spacious seating area', 'Private balcony', 'Smart TV', 'Premium linens', 'Mini refrigerator', 'Work desk'],
    icon: tripleIcon
  },
  {
    id: 5,
    name: 'Superior Quadruple Room',
    type: 'Quadruple',
    maxPax: 8,
    quantity: 2,
    available: true,
    dayStay: '₱3,999',
    overnight: '₱5,499',
    description: 'Our most spacious room is made for larger families and groups, offering plenty of room to relax, gather, and enjoy your stay together.',
    highlights: ['Spacious seating area', 'Private balcony', 'Dining table', 'Smart TV', 'Premium linens', 'Iron & ironing board', 'Mini refrigerator'],
    icon: quadrupleIcon
  }
];

const emptyRoom = {
  name: '',
  type: '',
  maxPax: '',
  quantity: '',
  available: true,
  dayStay: '',
  overnight: '',
  description: '',
  highlights: [],
  icon: standardIcon
};

const getTodayValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createDefaultStatuses = (quantity, available = true) =>
  Array.from(
    { length: quantity },
    () => (available ? 'Available' : 'Maintenance')
  );

const getBookedRoomCount = (inventory, roomId, date) => {
  const roomInventory = inventory.find(
    (room) => Number(room.room_id) === Number(roomId)
  );

  if (!roomInventory) {
    return null;
  }

  return roomInventory.reservations.reduce(
    (booked, reservation) =>
      reservation.check_in <= date && reservation.check_out > date
        ? booked + Number(reservation.rooms_count)
        : booked,
    0
  );
};

const getStoredRoomStatuses = () => {
  try {
    const stored = localStorage.getItem('stayeaseRoomStatusesByDate');

    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const RoomManagement = ({
  calendarDate,
  setCalendarDate,
  onOpenNotifications,
  unreadCount,
  onRoomStatusChange
}) => {
  const today = getTodayValue();

  const [rooms, setRooms] = useState(initialRooms);
  const [formData, setFormData] = useState(emptyRoom);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');

  const [roomCalendarDates, setRoomCalendarDates] = useState(() =>
    initialRooms.reduce((dates, room) => {
      dates[room.id] = today;
      return dates;
    }, {})
  );

  const [roomStatusesByDate, setRoomStatusesByDate] = useState(() => {
    const storedStatuses = getStoredRoomStatuses();

    if (Object.keys(storedStatuses).length > 0) {
      return storedStatuses;
    }

    return {
      [today]: initialRooms.reduce((statuses, room) => {
        statuses[room.id] = createDefaultStatuses(room.quantity, room.available);
        return statuses;
      }, {})
    };
  });

  useEffect(() => {
    let active = true;

    const loadInventory = async () => {
      try {
        const response = await fetch(
          `${window.location.protocol}//${window.location.hostname}/stayease-api/stayease.php?action=availability`,
          { credentials: 'include' }
        );
        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error(
            result.message ||
              `Could not load room bookings (${response.status}).`
          );
        }

        if (!Array.isArray(result.data?.rooms)) {
          throw new Error('The room booking response is invalid.');
        }

        if (active) {
          setInventory(result.data.rooms);
          setInventoryError('');
          setRooms((current) =>
            current.map((room) => {
              const roomInventory = result.data.rooms.find(
                (item) => Number(item.room_id) === room.id
              );
              return roomInventory
                ? { ...room, quantity: Number(roomInventory.total_rooms) }
                : room;
            })
          );
        }
      } catch (loadError) {
        if (active) {
          setInventoryError(loadError.message);
        }
      } finally {
        if (active) {
          setInventoryLoading(false);
        }
      }
    };

    loadInventory();
    const interval = window.setInterval(loadInventory, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const persistStatuses = (statuses) => {
    try {
      localStorage.setItem(
        'stayeaseRoomStatusesByDate',
        JSON.stringify(statuses)
      );
    } catch {
      return;
    }
  };

  const getRoomStatuses = (roomId, date, quantity, available) => {
    const dateStatuses = roomStatusesByDate[date];

    if (dateStatuses?.[roomId]) {
      const existingStatuses = dateStatuses[roomId];

      if (existingStatuses.length === quantity) {
        return existingStatuses;
      }

      if (existingStatuses.length > quantity) {
        return existingStatuses.slice(0, quantity);
      }

      return [
        ...existingStatuses,
        ...createDefaultStatuses(
          quantity - existingStatuses.length,
          available
        )
      ];
    }

    return createDefaultStatuses(quantity, available);
  };

  const ensureDateStatuses = (roomId, date, quantity, available) => {
    setRoomStatusesByDate((current) => {
      const existingDate = current[date] || {};

      if (existingDate[roomId]?.length === quantity) {
        return current;
      }

      const updated = {
        ...current,
        [date]: {
          ...existingDate,
          [roomId]: getRoomStatuses(roomId, date, quantity, available)
        }
      };

      persistStatuses(updated);

      return updated;
    });
  };

  const handleRoomCalendarChange = (roomId, date) => {
    setRoomCalendarDates((current) => ({
      ...current,
      [roomId]: date
    }));

    const room = rooms.find((item) => item.id === roomId);

    if (room) {
      ensureDateStatuses(
        room.id,
        date,
        room.quantity,
        room.available
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setError('');
  };

  const handleHighlightsChange = (event) => {
    setFormData((prev) => ({
      ...prev,
      highlights: event.target.value
        .split(',')
        .map((highlight) => highlight.trim())
        .filter(Boolean)
    }));

    setError('');
  };

  const handleAvailabilityChange = (id) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === id
          ? {
              ...room,
              available: !room.available
            }
          : room
      )
    );

    setRoomStatusesByDate((current) => {
      const room = rooms.find((item) => item.id === id);

      if (!room) {
        return current;
      }

      const nextAvailable = !room.available;
      const updated = { ...current };

      Object.keys(updated).forEach((date) => {
        const dateStatuses = updated[date];

        if (!dateStatuses?.[id]) {
          return;
        }

        updated[date] = {
          ...dateStatuses,
          [id]: dateStatuses[id].map((status) => {
            if (nextAvailable && status === 'Maintenance') {
              return 'Available';
            }

            if (!nextAvailable && status === 'Available') {
              return 'Maintenance';
            }

            return status;
          })
        };
      });

      persistStatuses(updated);

      return updated;
    });
  };

  const handleUnitStatusChange = (roomId, unitIndex, status) => {
    const date = roomCalendarDates[roomId] || today;

    setRoomStatusesByDate((current) => {
      const room = rooms.find((item) => item.id === roomId);

      if (!room) {
        return current;
      }

      const existingStatuses = getRoomStatuses(
        roomId,
        date,
        room.quantity,
        room.available
      );

      const updatedUnitStatuses = existingStatuses.map(
        (currentStatus, index) =>
          index === unitIndex ? status : currentStatus
      );

      const updated = {
        ...current,
        [date]: {
          ...(current[date] || {}),
          [roomId]: updatedUnitStatuses
        }
      };

      persistStatuses(updated);

      return updated;
    });

    onRoomStatusChange?.(status, date);
  };

  const handleAddRoom = () => {
    setEditingId(null);
    setFormData(emptyRoom);
    setError('');
    setShowForm(true);
  };

  const handleEditRoom = (room) => {
    setEditingId(room.id);

    setFormData({
      name: room.name,
      type: room.type,
      maxPax: room.maxPax,
      quantity: room.quantity,
      available: room.available,
      dayStay: room.dayStay || '',
      overnight: room.overnight || '',
      description: room.description || '',
      highlights: room.highlights || [],
      icon: room.icon || roomIcons[room.type] || standardIcon
    });

    setError('');
    setShowForm(true);
  };

  const handleDeleteRoom = (id) => {
    const room = rooms.find((item) => item.id === id);

    if (!room) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${room.name}?`
    );

    if (!confirmed) {
      return;
    }

    setRooms((prevRooms) =>
      prevRooms.filter((roomItem) => roomItem.id !== id)
    );

    setRoomCalendarDates((current) => {
      const updated = { ...current };
      delete updated[id];
      return updated;
    });

    setRoomStatusesByDate((current) => {
      const updated = {};

      Object.keys(current).forEach((date) => {
        const dateStatuses = { ...(current[date] || {}) };
        delete dateStatuses[id];

        updated[date] = dateStatuses;
      });

      persistStatuses(updated);

      return updated;
    });

    if (selectedRoom?.id === id) {
      setSelectedRoom(null);
    }

    if (editingId === id) {
      setEditingId(null);
      setFormData(emptyRoom);
      setShowForm(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const name = formData.name.trim();
    const type = formData.type.trim();
    const maxPax = Number(formData.maxPax);
    const quantity = Number(formData.quantity);

    if (
      !name ||
      !type ||
      !formData.maxPax ||
      !formData.quantity ||
      !formData.dayStay.trim() ||
      !formData.overnight.trim()
    ) {
      setError(
        'Please complete the room name, capacity, available rooms, and both prices.'
      );
      return;
    }

    if (maxPax < 1) {
      setError('Maximum PAX must be at least 1.');
      return;
    }

    if (quantity < 1) {
      setError('Room quantity must be at least 1.');
      return;
    }

    if (editingId !== null) {
      const previousRoom = rooms.find((room) => room.id === editingId);

      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === editingId
            ? {
                ...room,
                name,
                type,
                maxPax,
                quantity,
                available: formData.available,
                dayStay: formData.dayStay,
                overnight: formData.overnight,
                description: formData.description,
                highlights: formData.highlights,
                icon: room.icon || roomIcons[type] || standardIcon
              }
            : room
        )
      );

      setRoomStatusesByDate((current) => {
        const updated = {};

        Object.keys(current).forEach((date) => {
          const existingStatuses =
            current[date]?.[editingId] || [];

          let nextStatuses = existingStatuses.slice(0, quantity);

          if (nextStatuses.length < quantity) {
            nextStatuses = [
              ...nextStatuses,
              ...createDefaultStatuses(
                quantity - nextStatuses.length,
                formData.available
              )
            ];
          }

          if (!previousRoom && nextStatuses.length === 0) {
            nextStatuses = createDefaultStatuses(
              quantity,
              formData.available
            );
          }

          updated[date] = {
            ...(current[date] || {}),
            [editingId]: nextStatuses
          };
        });

        const selectedDate =
          roomCalendarDates[editingId] || today;

        if (!updated[selectedDate]) {
          updated[selectedDate] = {};
        }

        if (!updated[selectedDate][editingId]) {
          updated[selectedDate][editingId] =
            createDefaultStatuses(quantity, formData.available);
        }

        persistStatuses(updated);

        return updated;
      });
    } else {
      const newRoom = {
        id: Date.now(),
        name,
        type,
        maxPax,
        quantity,
        available: formData.available,
        dayStay: formData.dayStay,
        overnight: formData.overnight,
        description: formData.description,
        highlights: formData.highlights,
        icon: roomIcons[type] || standardIcon
      };

      setRooms((prevRooms) => [...prevRooms, newRoom]);

      setRoomCalendarDates((current) => ({
        ...current,
        [newRoom.id]: today
      }));

      setRoomStatusesByDate((current) => {
        const updated = { ...current };

        Object.keys(updated).forEach((date) => {
          updated[date] = {
            ...(updated[date] || {}),
            [newRoom.id]: createDefaultStatuses(
              quantity,
              formData.available
            )
          };
        });

        if (!updated[today]) {
          updated[today] = {};
        }

        updated[today][newRoom.id] =
          createDefaultStatuses(quantity, formData.available);

        persistStatuses(updated);

        return updated;
      });
    }

    setFormData(emptyRoom);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleCancel = () => {
    setFormData(emptyRoom);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  return (
    <main className="room-management-page">
      <div className="room-management-container">
        <div className="room-management-header">
          <div>
            <p className="room-management-label">
              STAYEASE ADMINISTRATION / ROOMS
            </p>

            <h1>Room Management</h1>

            <p className="room-management-description">
              Add, edit, remove, and manage room availability.
            </p>
          </div>

          <div className="room-header-actions">
            <button
              className="room-notification-button"
              type="button"
              onClick={onOpenNotifications}
            >
              <img
                src={notificationIcon}
                alt="Notifications"
              />
              <span>
                {unreadCount} notifications
              </span>
            </button>
          </div>

          <button
            type="button"
            className="add-room-button"
            onClick={handleAddRoom}
          >
            Add Room
          </button>
        </div>

        {showForm && (
          <section className="room-form-card">
            <div className="room-form-header">
              <div>
                <h2>
                  {editingId !== null
                    ? 'Edit Room'
                    : 'Add Room'}
                </h2>

                <p>
                  {editingId !== null
                    ? 'Update the room information below.'
                    : 'Enter the information for the new room.'}
                </p>
              </div>
            </div>

            {error && (
              <div
                className="room-form-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="room-form-grid">
                <div className="room-form-group">
                  <label htmlFor="room-name">
                    Room Name *
                  </label>

                  <input
                    id="room-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Deluxe Room"
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor="room-type">
                    Room Type *
                  </label>

                  <select
                    id="room-type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="">
                      Select room type
                    </option>
                    <option value="Standard">
                      Standard
                    </option>
                    <option value="Twin">
                      Twin
                    </option>
                    <option value="Queen">
                      Queen
                    </option>
                    <option value="Triple">
                      Triple
                    </option>
                    <option value="Quadruple">
                      Quadruple
                    </option>
                  </select>
                </div>

                <div className="room-form-group">
                  <label htmlFor="room-pax">
                    Maximum PAX *
                  </label>

                  <input
                    id="room-pax"
                    type="number"
                    name="maxPax"
                    min="1"
                    value={formData.maxPax}
                    onChange={handleInputChange}
                    placeholder="e.g. 4"
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor="room-quantity">
                    Number of Rooms Available *
                  </label>

                  <input
                    id="room-quantity"
                    type="number"
                    name="quantity"
                    min="1"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="e.g. 5"
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor="room-day-stay">
                    Day Stay Price *
                  </label>

                  <input
                    id="room-day-stay"
                    type="text"
                    name="dayStay"
                    value={formData.dayStay}
                    onChange={handleInputChange}
                    placeholder="e.g. ₱1,999"
                  />
                </div>

                <div className="room-form-group">
                  <label htmlFor="room-overnight">
                    Night Stay Price *
                  </label>

                  <input
                    id="room-overnight"
                    type="text"
                    name="overnight"
                    value={formData.overnight}
                    onChange={handleInputChange}
                    placeholder="e.g. ₱2,499"
                  />
                </div>

                <div className="room-form-group full-width-room-field">
                  <label htmlFor="room-description">
                    Room Description
                  </label>

                  <textarea
                    id="room-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe the room for administrators and guests"
                    rows="3"
                  />
                </div>

                <div className="room-form-group full-width-room-field">
                  <label htmlFor="room-highlights">
                    Room Highlights
                  </label>

                  <textarea
                    id="room-highlights"
                    value={formData.highlights.join(', ')}
                    onChange={handleHighlightsChange}
                    placeholder="Separate highlights with commas, e.g. Air conditioning, Free Wi-Fi"
                    rows="3"
                  />

                  <small>
                    Separate each highlight with a comma.
                  </small>
                </div>

                <div className="room-form-group room-availability-field">
                  <label htmlFor="room-availability">
                    Availability
                  </label>

                  <select
                    id="room-availability"
                    name="available"
                    value={
                      formData.available
                        ? 'available'
                        : 'unavailable'
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        available:
                          e.target.value === 'available'
                      }))
                    }
                  >
                    <option value="available">
                      Available
                    </option>

                    <option value="unavailable">
                      Unavailable
                    </option>
                  </select>
                </div>
              </div>

              <div className="room-form-actions">
                <button
                  type="button"
                  className="cancel-room-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-room-button"
                >
                  {editingId !== null
                    ? 'Save Changes'
                    : 'Add Room'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="room-list-section">
          <div className="room-list-header">
            <div>
              <h2>Rooms</h2>

              <p>
                {rooms.length} room types registered
              </p>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="empty-room-state">
              <div className="empty-room-icon">
                🏨
              </div>

              <h3>No rooms available</h3>

              <p>
                Add a room to start managing your rooms.
              </p>

              <button
                type="button"
                className="add-room-button"
                onClick={handleAddRoom}
              >
                Add Room
              </button>
            </div>
          ) : (
            <div className="room-card-grid">
              {rooms.map((room) => {
                const selectedDate =
                  roomCalendarDates[room.id] || today;
                const bookedRooms = getBookedRoomCount(
                  inventory,
                  room.id,
                  selectedDate
                );
                const remainingRooms =
                  bookedRooms === null
                    ? null
                    : Math.max(0, room.quantity - bookedRooms);
                const availabilityLabel = inventoryLoading
                  ? 'Checking bookings…'
                  : inventoryError
                    ? 'Booking status unavailable'
                    : !room.available
                      ? 'Unavailable'
                      : remainingRooms === 0
                        ? 'Fully booked'
                        : `${remainingRooms} of ${room.quantity} available`;

                return (
                  <article
                    className="room-card"
                    key={room.id}
                    role="button"
                    tabIndex="0"
                    onClick={() =>
                      setSelectedRoom(room)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        setSelectedRoom(room);
                      }
                    }}
                  >
                    <div className="room-card-visual">
                      <img
                        src={
                          room.icon ||
                          roomIcons[room.type] ||
                          standardIcon
                        }
                        alt=""
                      />

                      <span>
                        {guestCapacityLabels[room.type] ||
                          `UP TO ${room.maxPax} GUESTS`}
                      </span>
                    </div>

                    <div className="room-card-content">
                      <div className="room-card-heading">
                        <div>
                          <span className="room-card-type">
                            {room.type} ROOM
                          </span>

                          <h3>{room.name}</h3>
                        </div>

                        <div
                          className="room-card-calendar"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <CalendarControl
                            value={selectedDate}
                            onChange={(date) =>
                              handleRoomCalendarChange(
                                room.id,
                                date
                              )
                            }
                          />
                        </div>
                      </div>

                      <div
                        className="room-card-status-row"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          className={`availability-button ${
                            room.available &&
                            remainingRooms !== null &&
                            remainingRooms > 0
                              ? 'availability-available'
                              : 'availability-unavailable'
                          }`}
                          disabled={
                            inventoryLoading ||
                            Boolean(inventoryError) ||
                            remainingRooms === 0
                          }
                          onClick={() =>
                            handleAvailabilityChange(
                              room.id
                            )
                          }
                        >
                          <span className="availability-dot"></span>

                          {availabilityLabel}
                        </button>

                        <span className="room-selected-date">
                          {new Date(
                            `${selectedDate}T00:00:00`
                          ).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }
                          )}
                        </span>
                      </div>

                      <p className="room-card-description">
                        {room.description}
                      </p>

                      <div className="room-rate-grid">
                        <div>
                          <span>DAY STAY</span>
                          <strong>
                            {room.dayStay ||
                              'Set rate'}
                          </strong>
                        </div>

                        <div>
                          <span>OVERNIGHT</span>
                          <strong>
                            {room.overnight ||
                              'Set rate'}
                          </strong>
                        </div>
                      </div>

                      <div className="room-highlights">
                        <span>
                          ROOM HIGHLIGHTS
                        </span>

                        <ul>
                          {(room.highlights || []).map(
                            (highlight) => (
                              <li key={highlight}>
                                {highlight}
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      <div className="room-card-footer">
                        <span>
                          {room.quantity} rooms · up to{' '}
                          {room.maxPax} guests
                        </span>

                        <div className="room-actions">
                          <button
                            type="button"
                            className="edit-room-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditRoom(room);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete-room-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteRoom(
                                room.id
                              );
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selectedRoom && (
          <div
            className="room-status-backdrop"
            onClick={() => setSelectedRoom(null)}
          >
            <section
              className="room-status-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="room-status-modal-header">
                <div>
                  <span>
                    ROOM INVENTORY
                  </span>

                  <h2>{selectedRoom.name}</h2>

                  <p>
                    Bookings for this date are locked; update status only for
                    unbooked rooms.
                  </p>

                  <strong className="room-modal-date">
                    {new Date(
                      `${
                        roomCalendarDates[
                          selectedRoom.id
                        ] || today
                      }T00:00:00`
                    ).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </strong>
                </div>

                <button
                  type="button"
                  className="room-modal-close"
                  onClick={() =>
                    setSelectedRoom(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="room-unit-legend">
                {[
                  'Available',
                  'Booked',
                  'Occupied',
                  'Needs cleaning',
                  'Maintenance'
                ].map((status) => (
                  <span
                    key={status}
                    className={`unit-status-key status-${status
                      .toLowerCase()
                      .replaceAll(' ', '-')}`}
                  >
                    {status}
                  </span>
                ))}
              </div>

              <div className="room-unit-grid">
                {getRoomStatuses(
                  selectedRoom.id,
                  roomCalendarDates[
                    selectedRoom.id
                  ] || today,
                  selectedRoom.quantity,
                  selectedRoom.available
                ).map((status, index) => {
                  const selectedDate =
                    roomCalendarDates[selectedRoom.id] || today;
                  const bookedRoomCount =
                    getBookedRoomCount(
                      inventory,
                      selectedRoom.id,
                      selectedDate
                    ) || 0;
                  const isBooked = index < bookedRoomCount;
                  const displayedStatus = isBooked ? 'Booked' : status;

                  return (
                  <label
                    className={`room-unit status-${displayedStatus
                      .toLowerCase()
                      .replaceAll(' ', '-')}`}
                    key={`${selectedRoom.id}-${index}`}
                  >
                    <span>
                      ROOM{' '}
                      {String(index + 1).padStart(
                        2,
                        '0'
                      )}
                    </span>

                    {isBooked ? (
                      <strong>Booked for this date</strong>
                    ) : (
                      <select
                        value={status}
                        onChange={(event) =>
                          handleUnitStatusChange(
                            selectedRoom.id,
                            index,
                            event.target.value
                          )
                        }
                      >
                      <option>
                        Available
                      </option>

                      <option>
                        Booked
                      </option>

                      <option>
                        Occupied
                      </option>

                      <option>
                        Needs cleaning
                      </option>

                      <option>
                        Maintenance
                      </option>
                      </select>
                    )}
                  </label>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
};

export default RoomManagement;